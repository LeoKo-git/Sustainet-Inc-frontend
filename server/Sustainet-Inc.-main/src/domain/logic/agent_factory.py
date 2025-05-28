import json
from pathlib import Path
from typing import Dict, Any, List, Optional

from agno.agent import Agent as AgnoAgent
from agno.models.openai import OpenAIChat
from agno.models.google import Gemini
from agno.models.anthropic import Claude

from src.utils.variables_render import VariablesRenderer
from src.utils.exceptions import ResourceNotFoundError, BusinessLogicError
from src.utils.logger import logger
from src.config.settings import settings
from src.infrastructure.database.agent_repo import AgentRepository
from src.infrastructure.database.models.agent import Agent

# 工具類註冊表
TOOL_CLASSES: Dict[str, type] = {}

# 添加額外的工具目錄
extra_tools_dir = Path.cwd() / "src" / "domain" / "logic" / "tools"
if extra_tools_dir.is_dir():
    logger.info(f"添加額外工具目錄: {extra_tools_dir}")
else:
    logger.warning(f"額外工具目錄不存在: {extra_tools_dir}")
    
    # 載入預設工具
    try:
    from src.domain.logic.tools.calculator import CalculatorTools
    TOOL_CLASSES["calculator"] = CalculatorTools
        logger.debug("添加默認 CalculatorTools")
except ImportError as e:
    logger.warning(f"無法載入默認 CalculatorTools: {e}")

    try:
        from src.domain.logic.tools.placeholder import Placeholder
    TOOL_CLASSES["placeholder"] = Placeholder
        logger.debug("添加默認 Placeholder")
        except ImportError as e:
    logger.warning(f"無法載入默認 Placeholder: {e}")

logger.info(f"系統中可用的工具類列表: {', '.join(TOOL_CLASSES.keys())}")

class MockAgent:
    """模擬的 Agent 類，用於開發和測試"""
    
    def __init__(self, session_id: str, name: str, instructions: str, description: str, tools: List[Any], **kwargs):
        self.session_id = session_id
        self.name = name
        self.instructions = instructions
        self.description = description
        self.tools = tools
        self.kwargs = kwargs
        logger.debug(f"創建模擬 Agent: {name}")
    
    def run(self, input_text: Optional[str] = None) -> Any:
        """模擬 Agent 的運行"""
        logger.debug(f"模擬 Agent {self.name} 運行，輸入: {input_text}")
        return {
            "content": f"這是來自 {self.name} 的模擬回應。輸入文本: {input_text}",
            "tools_used": [tool.name for tool in self.tools]
        }

class AgentFactory:
    """
    Agent Factory 服務，負責創建和管理 Agent
    """
    
    def __init__(self, agent_repo: AgentRepository):
        """
        初始化 Agent Factory 服務。
        
        Args:
            agent_repo: Agent Repository 實例
        """
        self.agent_repo = agent_repo

    def run_agent_by_name(self,
                         session_id: str,
                         agent_name: str,
                         variables: Dict[str, Any],
                         input_text: Optional[str] = None,
                         response_model: Optional[type] = None,
                         **kwargs) -> Any:
        """創建、執行指定名稱的代理，並返回結果內容。

        Args:
            session_id: 會話 ID
            agent_name: 要運行的代理名稱
            variables: 傳遞給代理模板的變數
            input_text: 傳遞給 agent.run 的輸入文本
            response_model: 可選的響應模型類別
            **kwargs: 額外參數

        Returns:
            代理執行結果內容

        Raises:
            ResourceNotFoundError: 如果找不到代理配置
            BusinessLogicError: 如果代理配置無效或執行失敗
        """
        try:
            # 1. 獲取 Agent 資料
            agent = self.agent_repo.get_by_name(agent_name)
            if not agent:
                raise ResourceNotFoundError(f"找不到名稱為 {agent_name} 的 Agent")

            # 2. 處理變數替換
            if variables:
                if agent.description:
                    agent.description = VariablesRenderer.render_variables(agent.description, variables)
                if agent.instruction:
                    agent.instruction = VariablesRenderer.render_variables(agent.instruction, variables)

            # 3. 創建 Agent 實例
            agent_instance = self._create_agent_from_data(session_id, agent, variables, response_model)
            if not agent_instance:
                raise BusinessLogicError("無法創建 Agent 實例")

            # 4. 執行 Agent
            result = agent_instance.run(input_text)
            
            # 5. 處理結果
            if hasattr(result, 'content'):
                content = result.content
            else:
                content = str(result)
            
            return content.strip() if isinstance(content, str) else content

        except ResourceNotFoundError:
            raise
        except Exception as e:
            logger.error(f"執行代理 {agent_name} (session: {session_id}) 時發生錯誤: {str(e)}")
            raise BusinessLogicError(f"執行代理失敗: {str(e)}")

    def create_agent(self, agent_id: int, session_id: str = None, variables: Dict[str, Any] = None) -> Any:
        """
        根據 ID 創建 Agent。

        Args:
            agent_id: Agent ID
            session_id: 會話 ID
            variables: 變數字典

        Returns:
            創建的 Agent 實例

        Raises:
            ResourceNotFoundError: 如果找不到 Agent
            BusinessLogicError: 如果創建失敗
        """
        agent = self.agent_repo.get_by_id(agent_id)
        if not agent:
            raise ResourceNotFoundError(f"找不到 ID 為 {agent_id} 的 Agent")
        
        return self._create_agent_from_data(session_id, agent, variables, None)

    def create_agent_by_name(self, session_id: str, agent_name: str, variables: Dict[str, Any] = None) -> Any:
        """
        根據名稱創建 Agent。

        Args:
            session_id: 會話 ID
            agent_name: Agent 名稱
            variables: 變數字典

        Returns:
            創建的 Agent 實例

        Raises:
            ResourceNotFoundError: 如果找不到 Agent
            BusinessLogicError: 如果創建失敗
        """
        agent = self.agent_repo.get_by_name(agent_name)
        if not agent:
            raise ResourceNotFoundError(f"找不到名稱為 {agent_name} 的 Agent")
        
        return self._create_agent_from_data(session_id, agent, variables, None)

    def _create_agent_from_data(self, session_id: str, agent: Agent, variables: Dict[str, Any] = None, response_model: Optional[type] = None) -> MockAgent:
        """從 Agent 資料創建 Agent 實例。

        Args:
            session_id: 會話 ID
            agent: Agent 實體
            variables: 變數字典
            response_model: 可選的響應模型類別

        Returns:
            創建的 Agent 實例

        Raises:
            BusinessLogicError: 如果創建失敗
        """
        try:
            # 1. 建立基本配置
            config = {
                "name": agent.agent_name or "default-agent",
                "description": agent.description or "Default agent for the game",
                "instruction": agent.instruction or "You are a helpful assistant.",
                "tools": self._get_tools(agent.tools) if agent.tools else [],
                "num_history_responses": 5,
                "markdown": True,
                "debug": True
            }

            logger.debug(f"Agent 配置: {config}")
            
            # 2. 處理變數替換
            if variables:
                if config["description"]:
                    config["description"] = VariablesRenderer.render_variables(config["description"], variables)
                if config["instruction"]:
                    config["instruction"] = VariablesRenderer.render_variables(config["instruction"], variables)
            
            # 3. 創建模擬 Agent 實例
            try:
                agent_instance = MockAgent(
                session_id=session_id,
                name=config["name"],
                instructions=config["instruction"],
                description=config["description"],
                tools=config["tools"],
                num_history_responses=config["num_history_responses"],
                markdown=config["markdown"],
                    debug_mode=config["debug"]
            )
                logger.debug(f"成功創建 Agent 實例: {config['name']}")
            return agent_instance
            except Exception as e:
                logger.error(f"創建 Agent 實例失敗: {e}")
                raise BusinessLogicError(f"創建 Agent 實例失敗: {str(e)}")
            
        except Exception as e:
            logger.error(f"創建 Agent 失敗: {e}")
            raise BusinessLogicError(f"創建 Agent 失敗: {str(e)}")

    def _get_tools(self, agent_data: Dict[str, Any]) -> List[Any]:
        """
        從 Agent 配置獲取工具實例列表。

        Args:
            agent_data: Agent 配置資料

        Returns:
            工具實例列表
        """
        tools_cfg = agent_data.get("tools")
        if isinstance(tools_cfg, str):
            try:
                tools_cfg = json.loads(tools_cfg)
            except json.JSONDecodeError:
                logger.warning(f"工具設定不是合法 JSON：{tools_cfg}")
                return []

        if isinstance(tools_cfg, dict) and "tools" in tools_cfg:
            tools_cfg = tools_cfg["tools"]

        if not tools_cfg:
            return []
        if not isinstance(tools_cfg, list):
            tools_cfg = [tools_cfg]

        instances = []
        for entry in tools_cfg:
            if isinstance(entry, str):
                cls = TOOL_CLASSES.get(entry)
                if cls:
                    try:
                        instance = cls()
                        instances.append(instance)
                        logger.debug(f"成功創建工具實例: {entry}")
                    except Exception as e:
                        logger.error(f"創建工具實例失敗 '{entry}': {e}")
                else:
                    logger.warning(f"未知工具 '{entry}'，跳過")
            elif isinstance(entry, dict):
                name = entry.get("name")
                params = entry.get("params", {})
                if not name:
                    logger.warning(f"工具配置缺少 name，條目：{entry}，跳過")
                    continue
                cls = TOOL_CLASSES.get(name)
                if cls:
                    try:
                        instance = cls(**params)
                        instances.append(instance)
                        logger.debug(f"成功創建工具實例: {name}")
                    except Exception as e:
                        logger.error(f"創建工具實例失敗 '{name}': {e}")
                else:
                    logger.warning(f"未知工具 '{name}'，跳過")
        return instances
