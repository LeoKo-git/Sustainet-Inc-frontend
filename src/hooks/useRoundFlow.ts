import { useState } from 'react';

export type Phase = 'news' | 'action' | 'result';
export type ToolResult = {
  tools: string[];
  trustDelta: number;
  message: string;
};

export type PlayerAction = 'clarify' | 'agree' | 'ignore';

type ToolSubmission = {
  action: PlayerAction;
  title: string;
  content: string;
  link: string;
  tools: string[];
};

export function useRoundFlow(maxRounds = 5) {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('news');
  const [playerScore, setPlayerScore] = useState(80);
  const [agentScore, setAgentScore] = useState(75);
  const [lastResult, setLastResult] = useState<ToolResult | null>(null);
  const [gameOver, setGameOver] = useState(false);

  function submitTool(submission: ToolSubmission) {
    // 模擬結果，可改為呼叫 API
    let trustDelta = 0;
    let message = '';

    switch (submission.action) {
      case 'clarify':
        // 澄清邏輯：根據內容和工具增加信任值（這裡先簡單模擬）
        trustDelta = Math.floor(Math.random() * 5) + 1;
        const toolsText = submission.tools.length > 0 
          ? `使用了 ${submission.tools.join('、')}`
          : '沒有使用任何工具';
        message = `你${toolsText}，信任值上升 ${trustDelta} 點`;
        break;
      case 'agree':
        // 附和邏輯：可能增加或減少信任值，取決於新聞的真實性（這裡先簡單模擬）
        trustDelta = Math.floor(Math.random() * 3) - 1; // 範圍 -1 到 2
        message = trustDelta > 0 ? `你附和了新聞，信任值變化 ${trustDelta} 點` : `你附和了新聞，信任值變化 ${trustDelta} 點`;
        break;
      case 'ignore':
        // 忽略邏輯：信任值變化較小（這裡先簡單模擬）
        trustDelta = Math.floor(Math.random() * 2); // 範圍 0 到 1
        message = `你無視了新聞，信任值變化 ${trustDelta} 點`;
        break;
    }

    const result = {
      tools: submission.tools,
      trustDelta,
      message,
    };

    setPlayerScore((prev) => prev + trustDelta);
    setLastResult(result);
    setPhase('result');

    setTimeout(() => {
      if (round >= maxRounds) {
        setGameOver(true);
      } else {
        setRound((prev) => prev + 1);
        setPhase('news');
      }
    }, 2000); // 顯示回合結果 2 秒後自動進入下一輪
  }

  return {
    round,
    phase,
    playerScore,
    agentScore,
    lastResult,
    gameOver,
    setPhase,
    submitTool,
  };
}