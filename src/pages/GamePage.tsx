import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import type { ArticleMeta, PlatformStatus, GameState, ToolUsed } from '../types/game';
// import { motion } from 'framer-motion'; //暫時不需要動畫

// 定義 GamePage 元件接收的 props 的型別
type GamePageProps = {
  initialGameState: {
    session_id: string;
    round_number: number;
    platforms: Array<{ name: string; audience: number; trust: number; spread: number }>;
    ai_article: ArticleMeta;
  };
};

const GamePage: React.FC<GamePageProps> = ({ initialGameState }) => {
  const navigate = useNavigate();
  const { gameState, setGameState } = useGame();
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showToolModal, setShowToolModal] = useState(false);

  // 狀態用於控制澄清/附和介面
  const [showInputInterface, setShowInputInterface] = useState(false);
  const [activeActionType, setActiveActionType] = useState<'clarify' | 'support' | 'ignore' | null>(null);
  const [inputTitle, setInputTitle] = useState('');
  const [inputLink, setInputLink] = useState('');
  const [inputContent, setInputContent] = useState('');

  // 新增發布新聞對話框的狀態
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  // 使用傳入的 initialGameState 初始化遊戲狀態
  useEffect(() => {
    if (initialGameState) {
      const initialState: GameState = {
        session_id: initialGameState.session_id,
        round_number: initialGameState.round_number,
        actor: 'player',
        article: initialGameState.ai_article,
        trust_change: 0,
        reach_count: 0,
        spread_change: 0,
        platform_setup: initialGameState.platforms.map(p => ({
          name: p.name,
          audience: p.audience.toString()
        })),
        platform_status: initialGameState.platforms.map(p => ({
          name: p.name,
          audience: p.audience,
          trust: p.trust,
          spread: p.spread,
          session_id: initialGameState.session_id,
          round_number: initialGameState.round_number,
          platform_name: p.name,
          player_trust: p.trust,
          ai_trust: p.trust,
          spread_rate: p.spread
        })),
        tool_used: null,
        tool_list: [],
        effectiveness: 'low',
        simulated_comments: ['遊戲開始！', `回合 ${initialGameState.round_number} 開始！`],
        player_article: null,
        isLoading: false,
        error: null,
        roundLog: []
      };
      setGameState(initialState);
    }
  }, [initialGameState]);

  // 處理玩家操作
  const handlePlayerAction = (actionType: 'clarify' | 'support' | 'ignore') => {
    console.log(`Player action: ${actionType}`);

    if (actionType === 'clarify' || actionType === 'support') {
      setActiveActionType(actionType);
      setShowInputInterface(true);
      setInputTitle('');
      setInputLink('');
      setInputContent('');
    } else if (actionType === 'ignore') {
      const newLog = `玩家選擇了 ${actionType} 操作`;
      if (gameState) {
        setGameState({
          ...gameState,
          simulated_comments: [...gameState.simulated_comments, newLog]
        });
      }
    }
  };

  // 處理輸入介面提交
  const handleInputSubmit = () => {
    console.log(`提交 ${activeActionType}:`, { title: inputTitle, link: inputLink, content: inputContent });
    const newLog = `玩家提交了 ${activeActionType} 內容`;
    if (gameState) {
      setGameState({
        ...gameState,
        simulated_comments: [...gameState.simulated_comments, newLog]
      });
    }
    setShowInputInterface(false);
    setActiveActionType(null);
  };

  // 處理輸入介面取消
  const handleInputCancel = () => {
    console.log(`${activeActionType} 操作已取消`);
    const newLog = `${activeActionType} 操作已取消`;
    if (gameState) {
      setGameState({
        ...gameState,
        simulated_comments: [...gameState.simulated_comments, newLog]
      });
    }
    setShowInputInterface(false);
    setActiveActionType(null);
  };

  // 模擬後端回應
  const mockPlayerTurnResponse = (): GameState => {
    if (!gameState) throw new Error('Game state is not initialized');
    
    const updatedPlatformStatus = gameState.platform_status.map(platform => ({
      ...platform,
      player_trust: (platform.player_trust || platform.trust) + (Math.floor(Math.random() * 20) - 10),
      ai_trust: (platform.ai_trust || platform.trust) + (Math.floor(Math.random() * 20) - 10),
      spread_rate: (platform.spread_rate || platform.spread) + (Math.floor(Math.random() * 20) - 10)
    }));

    return {
      ...gameState,
      actor: 'player',
      article: {
        title: newsTitle,
        content: newsContent,
        author: '玩家',
        published_date: new Date().toISOString()
      },
      platform_status: updatedPlatformStatus,
      simulated_comments: [...gameState.simulated_comments, '玩家發布了新聞']
    };
  };

  const handlePublishNews = async () => {
    if (!newsTitle || !newsContent || !selectedPlatform) {
      alert('請填寫所有必要欄位');
      return;
    }

    setIsPublishing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockResponse = mockPlayerTurnResponse();
      setGameState(mockResponse);
      
      setNewsTitle('');
      setNewsContent('');
      setSelectedPlatform('');
      setSelectedTool(null);
    } catch (error) {
      console.error('發布新聞時發生錯誤:', error);
      alert('發布失敗，請稍後再試');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleNextRound = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!gameState) throw new Error('Game state is not initialized');

      const updatedPlatformStatus = gameState.platform_status.map(platform => ({
        ...platform,
        player_trust: (platform.player_trust || 0) + (Math.floor(Math.random() * 20) - 10),
        ai_trust: (platform.ai_trust || 0) + (Math.floor(Math.random() * 20) - 10),
        spread_rate: (platform.spread_rate || 0) + (Math.floor(Math.random() * 20) - 10)
      }));

      const mockResponse: GameState = {
        ...gameState,
        round_number: gameState.round_number + 1,
        actor: 'ai',
        article: {
          title: 'AI 生成的新聞標題',
          content: 'AI 生成的新聞內容...',
          author: 'ai',
          published_date: new Date().toISOString(),
          target_platform: undefined,
          polished_content: undefined,
          image_url: undefined,
          source: undefined,
          requirement: undefined,
          veracity: 'partial'
        },
        trust_change: Math.floor(Math.random() * 20) - 10,
        reach_count: Math.floor(Math.random() * 1000) + 100,
        spread_change: Math.floor(Math.random() * 20) - 10,
        platform_status: updatedPlatformStatus,
        tool_used: null,
        effectiveness: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        simulated_comments: [
          '這新聞看起來很可疑！',
          '真的發生這麼嚴重嗎？',
          '請政府說明！'
        ]
      };
      
      setGameState(mockResponse);
    } catch (error) {
      console.error('進入下一回合時發生錯誤:', error);
      alert('操作失敗，請稍後再試');
    }
  };

  const handleUseTool = (toolName: string) => {
    setSelectedTool(toolName);
    setShowToolModal(false);
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">載入中...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* 遊戲狀態 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">遊戲狀態</h1>
          <div className="grid grid-cols-3 gap-4">
            {gameState.platform_status.map((platform, index) => (
              <div key={index} className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-bold mb-2">{platform.name || '未知平台'}</h3>
                <p>玩家信任值: {platform.player_trust ?? 'N/A'}</p>
                <p>AI 信任值: {platform.ai_trust ?? 'N/A'}</p>
                <p>傳播率: {platform.spread_rate ?? 'N/A'}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* 當前回合資訊 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">第 {gameState.round_number} 回合</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold mb-2">當前新聞</h3>
            <p className="font-bold">{gameState.article.title || '無標題'}</p>
            <p className="text-gray-300">{gameState.article.content || '無內容'}</p>
            <p className="text-sm text-gray-400 mt-2">
              發布者: {gameState.article.author || '未知'} | 
              時間: {gameState.article.published_date ? new Date(gameState.article.published_date).toLocaleString() : '未知'}
            </p>
          </div>
        </div>

        {/* 玩家操作區 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">玩家操作</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="mb-4">
              <label className="block mb-2">選擇平台</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full bg-gray-700 text-white p-2 rounded"
              >
                <option value="">請選擇平台</option>
                {gameState.platform_setup.map((platform, index) => (
                  <option key={index} value={platform.name}>
                    {platform.name} ({platform.audience})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-2">新聞標題</label>
              <input
                type="text"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                className="w-full bg-gray-700 text-white p-2 rounded"
                placeholder="輸入新聞標題"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2">新聞內容</label>
              <textarea
                value={newsContent}
                onChange={(e) => setNewsContent(e.target.value)}
                className="w-full bg-gray-700 text-white p-2 rounded h-32"
                placeholder="輸入新聞內容"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handlePlayerAction('clarify')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                澄清
              </button>
              <button
                onClick={() => handlePlayerAction('support')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                附和
              </button>
              <button
                onClick={() => handlePlayerAction('ignore')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                忽略
              </button>

              <button
                onClick={() => setShowToolModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                使用工具
              </button>
              <button
                onClick={handlePublishNews}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                {isPublishing ? '發布中...' : '發布新聞'}
              </button>
              <button
                onClick={handleNextRound}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
                disabled={isPublishing}
              >
                進入下一回合 (AI 回合)
              </button>
            </div>
          </div>
        </div>

        {/* 遊戲日誌 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">遊戲日誌</h2>
          <div className="bg-gray-800 p-4 rounded-lg h-48 overflow-y-auto">
            <div className="space-y-2 text-sm text-gray-300">
              {gameState.simulated_comments?.map((log: string, index: number) => (
                <p key={index}>{log}</p>
              ))}
            </div>
          </div>
        </div>

        {/* 澄清/附和/忽略 輸入介面 */}
        {showInputInterface && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
              <h3 className="text-2xl font-bold mb-4 text-center text-blue-400">
                {activeActionType === 'clarify' ? '澄清' : activeActionType === 'support' ? '附和' : '忽略'} 內容輸入
              </h3>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="inputTitle">
                  標題
                </label>
                <input
                  type="text"
                  id="inputTitle"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="inputLink">
                  連結 (選填)
                </label>
                <input
                  type="text"
                  id="inputLink"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={inputLink}
                  onChange={(e) => setInputLink(e.target.value)}
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="inputContent">
                  內文
                </label>
                <textarea
                  id="inputContent"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32 resize-none"
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  placeholder="輸入內文"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  onClick={handleInputSubmit}
                >
                  提交
                </button>
                <button
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  onClick={handleInputCancel}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 工具選擇 Modal */}
        {showToolModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">選擇工具</h3>
              <div className="space-y-2">
                {gameState.tool_list?.map((tool, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseTool(tool.tool_name)}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white p-2 rounded text-left"
                  >
                    <p className="font-bold">{tool.tool_name}</p>
                    <p className="text-sm text-gray-300">{tool.description}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowToolModal(false)}
                className="mt-4 w-full bg-gray-600 hover:bg-gray-500 text-white p-2 rounded"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage; 