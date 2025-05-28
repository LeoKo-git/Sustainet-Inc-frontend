import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from src.application.dto.game_dto import (
    NewsPolishRequest, NewsPolishResponse,
    GameStartRequest, GameStartResponse,
    AiTurnRequest, AiTurnResponse,
    PlayerTurnRequest, PlayerTurnResponse,
    StartNextRoundRequest, StartNextRoundResponse,
    GameDashboardRequest, GameDashboardResponse, CurrentRoundInfo, PlatformDashboardStatus,
    ArticleMeta
)
from src.infrastructure.database.game_setup_repo import GameSetupRepository
from src.infrastructure.database.platform_state_repo import PlatformStateRepository
from src.infrastructure.database.news_repo import NewsRepository
from src.infrastructure.database.action_record_repo import ActionRecordRepository
from src.infrastructure.database.game_round_repo import GameRoundRepository
from src.domain.logic.agent_factory import AgentFactory
from src.domain.logic.game_initialization import GameInitializationLogic
from src.domain.logic.ai_turn import AiTurnLogic
from src.domain.logic.game_master import GameMasterLogic
from src.domain.logic.game_state import GameStateLogic
from src.domain.logic.player_action import PlayerActionLogic
from src.utils.exceptions import BusinessLogicError, ResourceNotFoundError
from src.utils.logger import logger

# Tool related imports
from src.infrastructure.database.tool_repo import ToolRepository
from src.infrastructure.database.tool_usage_repo import ToolUsageRepository
from src.domain.logic.tool_effect_logic import ToolEffectLogic
from src.application.dto.game_dto import ToolUsed as PlayerToolUsedDTO

# New imports for refactored architecture
from src.domain.logic.turn_execution import TurnExecutionLogic
from src.domain.logic.game_state_manager import GameStateManager
from src.domain.logic.response_converter import ResponseConverter
from src.domain.logic.tool_availability_logic import ToolAvailabilityLogic
from src.domain.logic.game_end_logic import GameEndLogic
from src.config.game_config import game_config
        
class GameService:
    def __init__(
        self,
        setup_repo: GameSetupRepository,
        state_repo: PlatformStateRepository,
        news_repo: NewsRepository,
        action_repo: ActionRecordRepository,
        round_repo: GameRoundRepository,
        tool_repo: ToolRepository,
        tool_usage_repo: ToolUsageRepository,
        agent_factory: Optional[AgentFactory] = None,
    ):
        self.setup_repo = setup_repo
        self.state_repo = state_repo
        self.news_repo = news_repo
        self.action_repo = action_repo
        self.round_repo = round_repo
        self.agent_factory = agent_factory
        self.tool_repo = tool_repo
        self.tool_usage_repo = tool_usage_repo
        
        # Domain logic instances
        self.game_init_logic = GameInitializationLogic()
        self.ai_turn_logic = AiTurnLogic()
        self.gm_logic = GameMasterLogic()
        self.game_state_logic = GameStateLogic()
        self.player_action_logic = PlayerActionLogic()
        self.tool_effect_logic = ToolEffectLogic()
        
        # New refactored components
        self.turn_execution_logic = TurnExecutionLogic(
            self.ai_turn_logic, self.tool_repo, self.agent_factory, self.news_repo
        )
        self.game_state_manager = GameStateManager(
            setup_repo, state_repo, action_repo, tool_usage_repo,
            self.game_state_logic, self.gm_logic, self.tool_effect_logic, self.agent_factory
        )
        self.tool_availability_logic = ToolAvailabilityLogic(tool_repo)
        self.response_converter = ResponseConverter(setup_repo, self.tool_availability_logic)
        self.game_end_logic = GameEndLogic()

    def start_game(self, request: Optional[GameStartRequest] = None) -> GameStartResponse:
        # Create new game using domain logic
        game = self.game_init_logic.create_new_game()
        
        # Save to database
        platforms_data = self.game_state_logic.convert_platforms_to_db_format(game.platforms)
        
        self.setup_repo.create_game_setup(
            session_id=game.session_id.value, 
            platforms=platforms_data, 
            player_initial_trust=game_config.initial_player_trust, 
            ai_initial_trust=game_config.initial_ai_trust
        )

        self.state_repo.create_all_platforms_states(
            session_id=game.session_id.value,
            round_number=game.current_round,
            platforms=platforms_data,
            player_trust=game_config.initial_player_trust,
            ai_trust=game_config.initial_ai_trust,
            spread_rate=game_config.initial_spread_rate
        )
        
        self.round_repo.create_game_round(
            session_id=game.session_id.value,
            round_number=game.current_round,
            is_completed=False
        )
              
        # Execute AI turn
        ai_request = AiTurnRequest(session_id=game.session_id.value, round_number=game.current_round)
        ai_response = self.ai_turn(ai_request)
        return GameStartResponse(**ai_response.model_dump())

    def ai_turn(self, request: AiTurnRequest) -> AiTurnResponse:
        return self._execute_turn(
            actor="ai",
            session_id=request.session_id,
            round_number=request.round_number,
            article=None,
            tool_used=[],
            tool_list=None
        )

    def player_turn(self, request: PlayerTurnRequest) -> PlayerTurnResponse:
        return self._execute_turn(
            actor="player",
            session_id=request.session_id,
            round_number=request.round_number,
            article=request.article,
            tool_used=request.tool_used or [],
            tool_list=request.tool_list
        )

    def start_next_round(self, request: StartNextRoundRequest) -> StartNextRoundResponse:
        session_id = request.session_id
        
        last_round = self.round_repo.get_latest_round_by_session(session_id)
        if not last_round:
            raise BusinessLogicError("找不到上一回合紀錄")
        
        next_round_number = last_round.round_number + 1
        
        # 檢查是否已達最大回合數
        if next_round_number > game_config.max_rounds:
            # 取得最終遊戲狀態
            final_platform_states = self.state_repo.get_by_session_and_round(
                session_id, last_round.round_number
            )
            
            platform_states_for_check = [
                {
                    "platform_name": state.platform_name,
                    "player_trust": state.player_trust,
                    "ai_trust": state.ai_trust,
                    "spread_rate": state.spread_rate
                }
                for state in final_platform_states
            ]
            
            game_end_result = self.game_end_logic.check_game_end_condition(
                session_id, last_round.round_number, platform_states_for_check
            )
            
            # 返回遊戲結束信息而不是開始新回合
            raise BusinessLogicError(
                f"遊戲已結束！{self.game_end_logic.format_game_end_summary(game_end_result)['winner_message']} "
                f"原因：{self.game_end_logic.format_game_end_summary(game_end_result)['reason_message']}"
            )

        platforms = self.setup_repo.get_by_session_id(session_id).platforms
        self.state_repo.create_all_platforms_states(
            session_id=session_id,
            round_number=next_round_number,
            platforms=platforms
        )
        
        self.round_repo.create_game_round(
            session_id=session_id,
            round_number=next_round_number,
            is_completed=False
        )
        
        ai_request = AiTurnRequest(session_id=session_id, round_number=next_round_number)
        ai_response = self.ai_turn(ai_request)
        return StartNextRoundResponse(**ai_response.model_dump())

    def _execute_turn(
        self,
        actor: str,
        session_id: str,
        round_number: int,
        article: Optional[ArticleMeta],
        tool_used: Optional[List[PlayerToolUsedDTO]],
        tool_list: Optional[List[Dict[str, Any]]]
    ):
        """重構後的回合執行 - 只負責流程編排"""
        logger.info(f"Executing turn for actor: {actor}", extra={
            "session_id": session_id, 
            "round_number": round_number
        })
        
        # 1. 獲取當前遊戲狀態
        current_states = self.state_repo.get_by_session_and_round(session_id, round_number)
        if not current_states:
            raise ResourceNotFoundError(f"找不到回合 {round_number} 的遊戲狀態")
            
        # 2. 獲取可用工具
        available_tools = self.tool_availability_logic.get_available_tools(session_id, round_number)
        
        # 3. 執行回合
        if actor == "ai":
            # AI 回合 - 使用模擬的 AI 行為
            result = {
                "content": "這是一條模擬的 AI 新聞",
                "platform": "Facebook",
                "reach_count": 1000,
                "trust_change": -5,
                "spread_change": 10,
                "effectiveness": "medium",
                "simulated_comments": [
                    "這看起來不太對勁...",
                    "需要更多證據支持",
                    "這個說法有待商榷"
                ]
            }
        else:
            # 玩家回合
            if not article:
                raise BusinessLogicError("玩家回合必須提供文章內容")
                
            result = {
                "content": article.content,
                "platform": article.platform,
                "reach_count": 500,
                "trust_change": 5,
                "spread_change": -5,
                "effectiveness": "high",
                "tools_used": [tool.tool_name for tool in tool_used] if tool_used else []
            }
            
        # 4. 更新遊戲狀態
        self.game_state_manager.update_game_state(
            session_id=session_id,
            round_number=round_number,
            turn_result=result
        )
        
        # 5. 轉換響應格式
        response = self.response_converter.convert_turn_response(
            session_id=session_id,
            round_number=round_number,
            actor=actor,
            turn_result=result
        )
        
        return response

    # def get_game_dashboard(self, request: GameDashboardRequest) -> GameDashboardResponse:
    #     """
    #     取得當前遊戲狀態的即時面板，顯示當前回合資訊和平台狀態
        
    #     Args:
    #         request: Dashboard請求
            
    #     Returns:
    #         當前遊戲狀態的即時面板數據
    #     """
    #     session_id = request.session_id
        
    #     try:
    #         # 1. 取得最新回合
    #         latest_round = self.round_repo.get_latest_round_by_session(session_id)
    #         current_round_number = latest_round.round_number
            
    #         # 2. 取得當前回合的行動記錄
    #         current_actions = self.action_repo.get_actions_by_session_and_round(
    #             session_id, current_round_number
    #         )
            
    #         # 3. 取得當前回合的平台狀態
    #         current_platform_states = self.state_repo.get_by_session_and_round(
    #             session_id, current_round_number
    #         )
            
    #         # 4. 建立當前回合資訊
    #         current_round_info = self._build_current_round_info(
    #             current_round_number, current_actions
    #         )
            
    #         # 5. 建立平台狀態（包含趨勢）
    #         platform_dashboard_status = self._build_platform_dashboard_status(
    #             session_id, current_round_number, current_platform_states
    #         )
            
    #         # 6. 建立遊戲進度
    #         game_progress = {
    #             "current_round": current_round_number,
    #             "max_rounds": game_config.max_rounds,
    #             "is_ended": current_round_number >= game_config.max_rounds  # 修正：正確設定結束狀態
    #         }
            
    #         # 7. 檢查遊戲結束狀態
    #         game_end_info = None
    #         platform_states_for_check = [
    #             {
    #                 "platform_name": state.platform_name,
    #                 "player_trust": state.player_trust,
    #                 "ai_trust": state.ai_trust,
    #                 "spread_rate": state.spread_rate
    #             }
    #             for state in current_platform_states
    #         ]
            
    #         game_end_result = self.game_end_logic.check_game_end_condition(
    #             session_id, current_round_number, platform_states_for_check
    #         )
            
    #         if game_end_result["is_ended"]:
    #             game_end_info = self.game_end_logic.format_game_end_summary(game_end_result)
    #             game_progress["is_ended"] = True
            
    #         return GameDashboardResponse(
    #             session_id=session_id,
    #             current_round=current_round_info,
    #             platform_status=platform_dashboard_status,
    #             game_progress=game_progress,
    #             game_end_info=game_end_info
    #         )
            
    #     except ResourceNotFoundError:
    #         raise
    #     except Exception as e:
    #         logger.error(f"Dashboard error for session {session_id}: {str(e)}")
    #         raise BusinessLogicError(f"取得遊戲面板時發生錯誤: {str(e)}")
    
    def _build_current_round_info(self, round_number: int, actions: List) -> CurrentRoundInfo:
        """建立當前回合資訊"""
        ai_action = None
        player_action = None
        
        # 分類AI和玩家行動
        for action in actions:
            if action.actor == "ai":
                ai_action = action
            elif action.actor == "player":
                player_action = action
        
        # 格式化AI新聞
        ai_news = None
        if ai_action:
            ai_news = {
                "title": ai_action.content[:50] + "…" if len(ai_action.content) > 50 else ai_action.content,
                "content": ai_action.content,
                "platform": ai_action.platform,
                "category": "永續議題"  # 可以從新聞分類中取得
            }
        
        # 格式化玩家回應
        player_response = None
        if player_action:
            # 取得玩家使用的工具
            player_tools = self.tool_usage_repo.get_by_action_id(player_action.id)
            tools_used = [tool.tool_name for tool in player_tools]
            
            player_response = {
                "content": player_action.content,
                "tools_used": tools_used
            }
        
        # 社群反應（來自AI模擬留言）
        social_reactions = []
        if ai_action and ai_action.simulated_comments:
            social_reactions = [
                f"{comment} (質疑)" if "假" in comment or "謊" in comment 
                else f"{comment} (疑惑)" if "真的假的" in comment or "幫" in comment
                else f"{comment} (支持)" 
                for comment in ai_action.simulated_comments[:3]  # 只取前3個
            ]
        
        # AI影響評估
        ai_impact = None
        if ai_action:
            ai_impact = {
                "reach_count": ai_action.reach_count or 0,
                "spread_change": f"+{ai_action.spread_change}%" if ai_action.spread_change and ai_action.spread_change > 0 else f"{ai_action.spread_change}%" if ai_action.spread_change else "0%",
                "trust_change": f"{ai_action.trust_change} 點" if ai_action.trust_change else "0 點",
                "effectiveness": self._translate_effectiveness(ai_action.effectiveness)
            }
        
        # 澄清效果
        clarification_effect = None
        if player_action:
            # 計算工具加成
            tool_bonus = ""
            if player_response and player_response["tools_used"]:
                tool_bonus = f"信任度 +{len(player_response['tools_used']) * 2}"
            
            clarification_effect = {
                "tool_bonus": tool_bonus,
                "final_effectiveness": self._translate_effectiveness(player_action.effectiveness),
                "reach_count": player_action.reach_count or 0,
                "trust_change": f"+{player_action.trust_change} 點" if player_action.trust_change and player_action.trust_change > 0 else f"{player_action.trust_change} 點" if player_action.trust_change else "0 點"
            }
        
        return CurrentRoundInfo(
            round_number=round_number,
            ai_news=ai_news,
            player_response=player_response,
            social_reactions=social_reactions,
            ai_impact=ai_impact,
            clarification_effect=clarification_effect
        )
    
    def _build_platform_dashboard_status(
        self, 
        session_id: str, 
        current_round: int, 
        current_states: List
    ) -> List[PlatformDashboardStatus]:
        """建立平台面板狀態（包含趨勢）"""
        dashboard_statuses = []
        
        for state in current_states:
            # 計算趨勢（與上一回合比較）
            trust_trend = "→"  # 默認沒有變化
            
            if current_round > 1:
                try:
                    prev_states = self.state_repo.get_by_session_and_round(
                        session_id, current_round - 1
                    )
                    prev_state = next(
                        (s for s in prev_states if s.platform_name == state.platform_name), 
                        None
                    )
                    
                    if prev_state:
                        player_diff = state.player_trust - prev_state.player_trust
                        if player_diff > 0:
                            trust_trend = "↗"  # 上升
                        elif player_diff < 0:
                            trust_trend = "↘"  # 下降
                except:
                    pass  # 如果無法取得上一回合數據，保持默認值
            
            dashboard_status = PlatformDashboardStatus(
                platform_name=state.platform_name,
                player_trust=state.player_trust,
                ai_trust=state.ai_trust,
                spread_rate=state.spread_rate,
                trust_trend=trust_trend
            )
            
            dashboard_statuses.append(dashboard_status)
        
        return dashboard_statuses
    
    def _translate_effectiveness(self, effectiveness: str) -> str:
        """翻譯效果評級"""
        if not effectiveness:
            return "未評估"
        
        translation = {
            "low": "低效",
            "medium": "中度有效",
            "high": "高效"
        }
        
        return translation.get(effectiveness.lower(), effectiveness)
    
    def _build_dashboard_info_for_turn(
        self, 
        session_id: str, 
        round_number: int, 
        game_turn_result
    ) -> Dict[str, Any]:
        """為回合回應構建即時dashboard信息"""
        try:
            # 取得當前回合的行動記錄（包含剛執行的行動）
            current_actions = self.action_repo.get_actions_by_session_and_round(
                session_id, round_number
            )
            
            # 取得當前平台狀態（從 GM 評估結果中取得）
            platform_states = [
                {
                    "platform_name": state.platform_name,
                    "player_trust": state.player_trust,
                    "ai_trust": state.ai_trust,
                    "spread_rate": state.spread_rate  # 修正：從 .spread 改為 .spread_rate
                }
                for state in game_turn_result.gm_evaluation.platform_status
            ]
            
            # 建立當前回合資訊
            current_round_info = self._build_current_round_info_from_actions(
                round_number, current_actions
            )
            
            # 建立平台狀態（包含趨勢）
            platform_dashboard_status = self._build_platform_dashboard_status_from_states(
                session_id, round_number, platform_states
            )
            
            # 遊戲進度
            game_progress = {
                "current_round": round_number,
                "max_rounds": game_config.max_rounds,
                "is_ended": round_number >= game_config.max_rounds  # 修正：正確設定結束狀態
            }
            
            return {
                "current_round": current_round_info,
                "platform_status": platform_dashboard_status,
                "game_progress": game_progress
            }
            
        except Exception as e:
            logger.warning(f"Failed to build dashboard info for turn: {str(e)}")
            return {}
    
    def _build_current_round_info_from_actions(self, round_number: int, actions: List) -> Dict[str, Any]:
        """從行動記錄建立當前回合資訊（簡化版）"""
        ai_action = None
        player_action = None
        
        for action in actions:
            if action.actor == "ai":
                ai_action = action
            elif action.actor == "player":
                player_action = action
        
        info = {"round_number": round_number}
        
        # AI新聞簡化信息
        if ai_action:
            info["ai_news"] = {
                "title": ai_action.content[:50] + "…" if len(ai_action.content) > 50 else ai_action.content,
                "platform": ai_action.platform,
                "reach_count": ai_action.reach_count or 0,
                "trust_change": ai_action.trust_change or 0
            }
            
            # 社群反應（只取前2個）
            if ai_action.simulated_comments:
                info["social_reactions"] = ai_action.simulated_comments[:2]
        
        # 玩家回應簡化信息
        if player_action:
            tools_used = [
                tool.tool_name for tool in 
                self.tool_usage_repo.get_by_action_id(player_action.id)
            ]
            
            info["player_response"] = {
                "effectiveness": self._translate_effectiveness(player_action.effectiveness),
                "trust_change": player_action.trust_change or 0,
                "tools_used": tools_used
            }
        
        return info
    
    def _build_platform_dashboard_status_from_states(
        self, 
        session_id: str, 
        current_round: int, 
        platform_states: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """從平台狀態建立面板狀態（簡化版）"""
        dashboard_statuses = []
        
        for state in platform_states:
            # 計算趨勢
            trust_trend = "→"  # 默認
            
            if current_round > 1:
                try:
                    prev_states = self.state_repo.get_by_session_and_round(
                        session_id, current_round - 1
                    )
                    prev_state = next(
                        (s for s in prev_states if s.platform_name == state["platform_name"]), 
                        None
                    )
                    
                    if prev_state:
                        player_diff = state["player_trust"] - prev_state.player_trust
                        if player_diff > 0:
                            trust_trend = "↗"
                        elif player_diff < 0:
                            trust_trend = "↘"
                except:
                    pass
            
            dashboard_status = {
                "platform_name": state["platform_name"],
                "player_trust": state["player_trust"],
                "ai_trust": state["ai_trust"],
                "spread_rate": state["spread_rate"],
                "trust_trend": trust_trend
            }
            
            dashboard_statuses.append(dashboard_status)
        
        return dashboard_statuses
    
    def polish_news(self, request: NewsPolishRequest) -> NewsPolishResponse:
        if not self.agent_factory:
            raise BusinessLogicError("系統未設定 Agent Factory")
        
        variables = {"content": request.content, "requirements": request.requirements or "將文章潤色使其更吸引人、更有說服力"}
        
        if request.sources:
            variables["sources"] = "\n".join(request.sources)
        if request.platform:
            variables["platform"] = request.platform
        if request.platform_user:
            variables["platform_user"] = request.platform_user
        if request.current_situation:
            variables["current_situation"] = request.current_situation
        if request.additional_context:
            variables.update(request.additional_context)
        
        try:
            result = self.agent_factory.run_agent_by_name(
                session_id=request.session_id,
                agent_name="news_polish_agent", 
                variables=variables,
                input_text="input_text"
            )
            
            if isinstance(result, dict):
                return NewsPolishResponse(
                    original_content=request.content,
                    polished_content=result.get("polished_content", ""),
                    suggestions=result.get("suggestions"),
                    reasoning=result.get("reasoning")
                )
            elif isinstance(result, str):
                try:
                    result_data = json.loads(result)
                    return NewsPolishResponse(
                        original_content=request.content,
                        polished_content=result_data.get("polished_content", ""),
                        suggestions=result_data.get("suggestions"),  
                        reasoning=result_data.get("reasoning")
                    )
                except json.JSONDecodeError:
                    return NewsPolishResponse(
                        original_content=request.content,
                        polished_content=result
                    )
            else:
                return NewsPolishResponse(
                    original_content=request.content,
                    polished_content=str(result)
                )
                
        except ResourceNotFoundError:
            raise ResourceNotFoundError(
                message="找不到潤稿專用 Agent",
                resource_type="agent",
                resource_id="news_polish_agent"
            )
        except Exception as e:
            raise BusinessLogicError(f"潤稿過程發生錯誤: {str(e)}")
