import type { ArticleMeta, GameStartResponse, AiTurnResponse, PlayerTurnResponse, StartNextRoundResponse } from '../types/game';

// 模擬的遊戲狀態
let currentSessionId = '';
let currentRound = 1;

// 預設的平台設置
const defaultPlatformSetup = [
  { platform: 'Facebook', audience: '一般大眾' },
  { platform: 'Twitter', audience: '年輕族群' },
  { platform: 'Instagram', audience: '時尚愛好者' }
];

// 預設的工具列表
const defaultToolList = [
  { name: '事實查核', description: '檢查新聞內容的真實性' },
  { name: '專家諮詢', description: '請教相關領域的專家' },
  { name: '數據分析', description: '分析相關數據和統計' }
];

// 模擬的遊戲開始
export const startGame = async (): Promise<GameStartResponse> => {
  currentSessionId = `session_${Date.now()}`;
  currentRound = 1;
  
  return {
    session_id: currentSessionId,
    round_number: currentRound,
    actor: 'ai',
    article: {
      title: '模擬的 AI 新聞標題',
      content: '這是一條模擬的 AI 新聞內容，用於測試前端功能。',
      author: 'AI 記者',
      published_date: new Date().toISOString(),
      target_platform: 'Facebook',
      polished_content: null,
      image_url: null,
      source: null,
      requirement: null,
      veracity: null
    },
    platform_setup: defaultPlatformSetup,
    platform_status: [
      { platform_name: 'Facebook', player_trust: 50, ai_trust: 50, spread_rate: 10 },
      { platform_name: 'Twitter', player_trust: 50, ai_trust: 50, spread_rate: 10 },
      { platform_name: 'Instagram', player_trust: 50, ai_trust: 50, spread_rate: 10 }
    ],
    tool_list: defaultToolList,
    tool_used: [],
    effectiveness: 'medium',
    simulated_comments: [
      '這看起來不太對勁...',
      '需要更多證據支持',
      '這個說法有待商榷'
    ]
  };
};

// 模擬的 AI 回合
export const aiTurn = async (sessionId: string, roundNumber: number): Promise<AiTurnResponse> => {
  return {
    session_id: sessionId,
    round_number: roundNumber,
    actor: 'ai',
    article: {
      title: `第 ${roundNumber} 回合的 AI 新聞`,
      content: `這是第 ${roundNumber} 回合的模擬 AI 新聞內容。`,
      author: 'AI 記者',
      published_date: new Date().toISOString(),
      target_platform: 'Facebook',
      polished_content: null,
      image_url: null,
      source: null,
      requirement: null,
      veracity: null
    },
    platform_setup: defaultPlatformSetup,
    platform_status: [
      { platform_name: 'Facebook', player_trust: 45, ai_trust: 55, spread_rate: 15 },
      { platform_name: 'Twitter', player_trust: 45, ai_trust: 55, spread_rate: 15 },
      { platform_name: 'Instagram', player_trust: 45, ai_trust: 55, spread_rate: 15 }
    ],
    tool_list: defaultToolList,
    tool_used: [],
    effectiveness: 'medium',
    simulated_comments: [
      '這看起來不太對勁...',
      '需要更多證據支持',
      '這個說法有待商榷'
    ]
  };
};

// 模擬的玩家回合
export const playerTurn = async (
  sessionId: string,
  roundNumber: number,
  article: ArticleMeta,
  toolUsed: string[] = []
): Promise<PlayerTurnResponse> => {
  return {
    session_id: sessionId,
    round_number: roundNumber,
    actor: 'player',
    article,
    platform_setup: defaultPlatformSetup,
    platform_status: [
      { platform_name: 'Facebook', player_trust: 55, ai_trust: 45, spread_rate: 5 },
      { platform_name: 'Twitter', player_trust: 55, ai_trust: 45, spread_rate: 5 },
      { platform_name: 'Instagram', player_trust: 55, ai_trust: 45, spread_rate: 5 }
    ],
    tool_list: defaultToolList,
    tool_used: toolUsed,
    effectiveness: 'high',
    simulated_comments: [
      '這個說法很有道理！',
      '謝謝分享這個資訊',
      '終於有人說出真相了'
    ]
  };
};

// 模擬的開始下一回合
export const startNextRound = async (sessionId: string): Promise<StartNextRoundResponse> => {
  currentRound += 1;
  return aiTurn(sessionId, currentRound);
}; 