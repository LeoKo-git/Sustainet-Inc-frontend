// ✅ Game.tsx（整合：回合流程 + 澄清輸入欄位 + 工具選擇 + 結果顯示）
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRoundFlow } from '../hooks/useRoundFlow';
import { useGame } from '../contexts/GameContext';

export default function Game() {
  const {
    round,
    phase,
    playerScore,
    agentScore,
    lastResult,
    gameOver,
    setPhase,
    submitTool,
    setGameOver,
  } = useRoundFlow(5);

  const { gameState, setGameState } = useGame();

  const [aiNews, setAiNews] = useState<any>(null);

  useEffect(() => {
    if (gameState?.actor === 'ai' && gameState.article) {
      setAiNews(gameState.article);
    }
  }, [gameState]);

  const [scale, setScale] = useState(1);
  const [showInput, setShowInput] = useState<null | 'clarify' | 'agree'>(null);
  const [inputValue, setInputValue] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [form, setForm] = useState({ title: '', link: '', content: '', style: '' });
  const [showIgnoreConfirm, setShowIgnoreConfirm] = useState(false);
  const hasInitialized = useRef(false);  // 新增 ref 來追蹤是否已經初始化

  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  // 新增：分開記錄玩家行動與 AI 行動造成的信任值變化
  const [playerActionTrustDiff, setPlayerActionTrustDiff] = useState<null | { platform: string, player: number, ai: number }[]>(null);
  const [aiActionTrustDiff, setAiActionTrustDiff] = useState<null | { platform: string, player: number, ai: number }[]>(null);
  const playerDiffTimeout = useRef<number | null>(null);
  const aiDiffTimeout = useRef<number | null>(null);

  // 工具 hover 狀態
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  // loadingType: 'player' | 'ai' | null
  const [loadingType, setLoadingType] = useState<null | 'player' | 'ai'>(null);

  // 新增：AI潤飾 loading 狀態
  const [isPolishing, setIsPolishing] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(0.5); // 初始音量

  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);

  const [showPlayerResult, setShowPlayerResult] = useState(false);
  const [playerResultData, setPlayerResultData] = useState<any>(null);
  const [aiActionPending, setAiActionPending] = useState(false);

  const [showPolishStyleInput, setShowPolishStyleInput] = useState(false);
  const [polishStyle, setPolishStyle] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 新增：AI行動結果彈窗狀態
  const [showAiResult, setShowAiResult] = useState(false);
  const [aiResultData, setAiResultData] = useState<any>(null);

  useEffect(() => {
    const updateScale = () => {
      const scaleX = window.innerWidth / 1440;
      const scaleY = window.innerHeight / 810;
      setScale(Math.min(scaleX, scaleY));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // 音樂初始化與控制
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/main-menu-background.mp4');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.5;
    }
    const playMusic = async () => {
      if (audioRef.current) {
        try {
          await audioRef.current.play();
        } catch (error) {
          // 需要用戶互動才能播放
        }
      }
    };
    playMusic();
    // 全局點擊觸發音樂
    const tryPlayOnUserInteraction = () => {
      playMusic();
      window.removeEventListener('click', tryPlayOnUserInteraction);
    };
    window.addEventListener('click', tryPlayOnUserInteraction);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.removeEventListener('click', tryPlayOnUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  // 玩家輸入欄位
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const selectTool = (toolName: string) => {
    setSelectedTool(selectedTool === toolName ? null : toolName);
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const fetchGameStart = async () => {
      try {
        console.log('Fetching game start data...');
        const res = await fetch('https://sustainet-net.up.railway.app/api/games/start', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          mode: 'cors',
        });
        
        console.log('Response status:', res.status);
        
        if (!res.ok) {
          console.error('Game start API error:', res.status, res.statusText);
          const errorText = await res.text();
          console.error('Error response:', errorText);
          alert('無法載入遊戲資料，請檢查網路或聯絡管理員。');
          return;
        }

        const data = await res.json();
        console.log('Game Start API Response:', JSON.stringify(data, null, 2));
        
        if (!data.tool_list) {
          console.warn('No tool_list in response:', data);
        }
        
        setGameState(data);
      } catch (error) {
        console.error('Error fetching game start:', error);
        alert('無法載入遊戲資料，請檢查網路或聯絡管理員。');
      }
    };
    fetchGameStart();
  }, []);

  // 用 gameState 取代假資料
  // 回合數
  const roundNumber = gameState?.round_number;
  // 新聞內容
  const news: any = aiNews || {};
  // 平台狀態
  const platforms = gameState?.platform_status || [];
  // 工具列
  const tools = gameState?.tool_list || [];
  // 社群反應
  const logs = gameState?.simulated_comments || [];

  // 計算所有平台信任值加總
  const playerTotalTrust = platforms.reduce((sum, p) => sum + (p.player_trust ?? 0), 0);
  const aiTotalTrust = platforms.reduce((sum, p) => sum + (p.ai_trust ?? 0), 0);

  // 載入中狀態
  const isLoading = !gameState || !gameState.article;

  // 串接後端 API：送出澄清/附和/忽略
  const handleSubmit = async (actionType: 'clarify' | 'agree' | 'ignore') => {
    if (actionType !== 'ignore') {
      if (!form.title.trim() || !form.content.trim()) {
        alert('請填寫標題和內容');
        return;
      }
      if (!selectedPlatform || !String(selectedPlatform).trim()) {
        alert('請選擇平台');
        return;
      }
    }
    if (!gameState?.session_id || !gameState?.round_number) {
      alert('遊戲狀態異常，請重新整理頁面');
      return;
    }
    setIsActionLoading(true);
    setLoadingType('player');
    try {
      let payload: any;
      if (actionType === 'ignore') {
        payload = {
          session_id: String(gameState.session_id),
          round_number: String(gameState.round_number),
          action_type: 'ignore',
          article: {
            title: String(gameState.article?.title ?? ''),
            content: String(gameState.article?.content ?? ''),
            author: String(gameState.article?.author ?? ''),
            published_date: String(gameState.article?.published_date ?? ''),
            target_platform: String(gameState.article?.target_platform ?? ''),
          }
        };
    } else {
        payload = {
          session_id: String(gameState.session_id),
          round_number: String(gameState.round_number),
          action_type: actionType,
          article: {
            title: String(form.title ?? ''),
            content: String(form.content ?? ''),
            author: '玩家',
            published_date: String(new Date().toISOString()),
            target_platform: String(selectedPlatform ?? ''),
          },
          tool_used: selectedTool ? [{ tool_name: String(selectedTool) }] : [],
        };
      }
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      const res = await fetch('https://sustainet-net.up.railway.app/api/games/player-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('API Error:', errorData);
        alert(errorData?.message || '送出失敗');
        setIsActionLoading(false);
        setLoadingType(null);
        return;
      }
      const data = await res.json();
      console.log('Player turn response:', data);
      setGameState(data);
      setShowInput(null);
      setForm({ title: '', link: '', content: '', style: '' });
      setSelectedTool(null);
      setIsActionLoading(false);
      setLoadingType(null);
      // 計算信任值變化
      let trustDiff = null;
      if (data.platform_status) {
        const prevPlatforms = (gameState?.platform_status || []).map((p: any) => ({
          platform_name: p.platform_name,
          player_trust: p.player_trust,
          ai_trust: p.ai_trust,
        }));
        trustDiff = data.platform_status.map((p: any) => {
          const prev = prevPlatforms.find((x: any) => x.platform_name === p.platform_name);
          return {
            platform: p.platform_name,
            player: prev ? p.player_trust - prev.player_trust : 0,
            ai: prev ? p.ai_trust - prev.ai_trust : 0,
          };
        });
      }
      setPlayerResultData({
        trustDiff,
        reachCount: data.reach_count ?? 0,
      });
      setShowPlayerResult(true);
      // 前端記錄玩家行動
      setRoundHistory(prev => [
        ...prev,
        {
          round_number: data.round_number,
          actor: 'player',
          player_action: actionType,
          player_content: data.article?.content || '',
          news_title: data.article?.title || '',
          reach_count: data.reach_count ?? 0,
          platform_trust: data.platform_status?.map((p: any) => ({
            platform: p.platform_name,
            player_trust: p.player_trust,
            ai_trust: p.ai_trust
          })) || [],
        }
      ]);
    } catch (err) {
      console.error('Network Error:', err);
      alert('網路錯誤，請稍後再試');
      setIsActionLoading(false);
      setLoadingType(null);
    }
  };

  // 進入下一回合
  const handleNextRound = async () => {
    if (!gameState?.session_id || !gameState?.round_number) {
      alert('遊戲狀態異常，請重新整理頁面');
      return;
    }
    setIsActionLoading(true);
    setLoadingType('ai');
    try {
      const payload = {
        session_id: String(gameState.session_id),
        round_number: String(gameState.round_number + 1)
      };
      console.log('Sending next round payload:', payload);
      const res = await fetch('https://sustainet-net.up.railway.app/api/games/next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Next round API error:', res.status, res.statusText, errorText);
        alert('進入下一回合失敗');
        setIsActionLoading(false);
        setLoadingType(null);
        return;
      }
      const nextRoundData = await res.json();
      console.log('Next round response:', nextRoundData);
      
      // 顯示 AI 行動影響
      if (nextRoundData.platform_status) {
        const prevPlatforms = (gameState?.platform_status || []).map((p: any) => ({
          platform_name: p.platform_name,
          player_trust: p.player_trust,
          ai_trust: p.ai_trust,
        }));
        const diff = nextRoundData.platform_status.map((p: any) => {
          const prev = prevPlatforms.find((x: any) => x.platform_name === p.platform_name);
          return {
            platform: p.platform_name,
            player: prev ? p.player_trust - prev.player_trust : 0,
            ai: prev ? p.ai_trust - prev.ai_trust : 0,
          };
        });
        setAiActionTrustDiff(diff);
        if (aiDiffTimeout.current) clearTimeout(aiDiffTimeout.current);
        aiDiffTimeout.current = window.setTimeout(() => setAiActionTrustDiff(null), 8000);
      }
      
      setGameState(nextRoundData);
      setIsActionLoading(false);
      setLoadingType(null);

      // 新增：每進入新回合就 push 一筆 AI 行動到 roundHistory
      setRoundHistory(prev => [
        ...prev,
        {
          round_number: nextRoundData.round_number,
          actor: 'ai',
          ai_action: nextRoundData.article?.content || '',
          news_title: nextRoundData.article?.title || '',
          reach_count: nextRoundData.reach_count ?? 0,
          platform_trust: nextRoundData.platform_status?.map((p: any) => ({
            platform: p.platform_name,
            player_trust: p.player_trust,
            ai_trust: p.ai_trust
          })) || [],
        }
      ]);
    } catch (err) {
      console.error('Next round error:', err);
      alert('回合轉換失敗，請稍後再試');
      setIsActionLoading(false);
      setLoadingType(null);
    }
  };

  // 修改 handleNextRoundAsync，接收上一回合資料，正確計算 round_number
  const handleNextRoundAsync = async (prevRoundData?: any) => {
    setIsActionLoading(true);
    setLoadingType('ai');
    const baseState = prevRoundData || gameState;
    if (!baseState?.session_id || !baseState?.round_number) {
      alert('遊戲狀態異常，請重新整理頁面');
      setAiActionPending(false);
      setIsActionLoading(false);
      setLoadingType(null);
      return;
    }
    try {
      const payload = {
        session_id: String(baseState.session_id),
        round_number: String(Number(baseState.round_number) + 1)
      };
      console.log('Next round payload:', JSON.stringify(payload, null, 2));
      const res = await fetch('https://sustainet-net.up.railway.app/api/games/next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Next round API error:', res.status, res.statusText, errorText);
        alert('進入下一回合失敗');
        setAiActionPending(false);
        setIsActionLoading(false);
        setLoadingType(null);
        return;
      }
      const nextRoundData = await res.json();
      setGameState(nextRoundData);
      setAiActionPending(false);
      // 新增：每進入新回合就 push 一筆 AI 行動到 roundHistory
      setRoundHistory(prev => [
        ...prev,
        {
          round_number: nextRoundData.round_number,
          actor: 'ai',
          ai_action: nextRoundData.article?.content || '',
          news_title: nextRoundData.article?.title || '',
          reach_count: nextRoundData.reach_count ?? 0,
          platform_trust: nextRoundData.platform_status?.map((p: any) => ({
            platform: p.platform_name,
            player_trust: p.player_trust,
            ai_trust: p.ai_trust
          })) || [],
        }
      ]);
      // 新增：計算AI行動造成的信任值變化，顯示彈窗
      let trustDiff = null;
      if (nextRoundData.platform_status) {
        const prevPlatforms = (gameState?.platform_status || []).map((p: any) => ({
          platform_name: p.platform_name,
          player_trust: p.player_trust,
          ai_trust: p.ai_trust,
        }));
        trustDiff = nextRoundData.platform_status.map((p: any) => {
          const prev = prevPlatforms.find((x: any) => x.platform_name === p.platform_name);
          return {
            platform: p.platform_name,
            player: prev ? p.player_trust - prev.player_trust : 0,
            ai: prev ? p.ai_trust - prev.ai_trust : 0,
          };
        });
      }
      setAiResultData({
        trustDiff,
        reachCount: nextRoundData.reach_count ?? 0,
      });
      setShowAiResult(true);
    } catch (err) {
      alert('回合轉換失敗，請稍後再試');
      setAiActionPending(false);
    } finally {
      setIsActionLoading(false);
      setLoadingType(null);
    }
  };

  // 新增：AI潤飾功能
  const handlePolishContent = async (styleOverride?: string) => {
    if (!form.content.trim()) {
      alert('請先輸入要潤飾的新聞內容');
      return;
    }
    if (!gameState?.session_id) {
      alert('遊戲狀態異常，請重新整理頁面');
      return;
    }
    if (!selectedPlatform) {
      alert('請先選擇平台');
      return;
    }
    setIsPolishing(true);
    try {
      const res = await fetch('https://sustainet-net.up.railway.app/api/games/polish-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: gameState.session_id,
          content: form.content,
          requirements: styleOverride || form.style || '讓內容更吸引人、易讀、具說服力',
          platform: selectedPlatform
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.message || 'AI潤飾失敗');
        setIsPolishing(false);
        return;
      }
      const data = await res.json();
      setForm(f => ({ ...f, content: data.polished_content || f.content }));
    } catch (e) {
      alert('AI潤飾過程發生錯誤');
    } finally {
      setIsPolishing(false);
    }
  };

  useEffect(() => {
    if (gameState && roundHistory.length === 0 && gameState.platform_status) {
      setRoundHistory([
        {
          round_number: gameState.round_number,
          actor: 'ai',
          ai_action: gameState.article?.content || '',
          news_title: gameState.article?.title || '',
          reach_count: gameState.reach_count ?? 0,
          platform_trust: gameState.platform_status.map((p: any) => ({
            platform: p.platform_name,
            player_trust: p.player_trust,
            ai_trust: p.ai_trust
          })),
        }
      ]);
      // 顯示第一回合AI行動結果彈窗
      let trustDiff = null;
      if (gameState.platform_status) {
        // 沒有前一回合，預設前值50
        trustDiff = gameState.platform_status.map((p: any) => ({
          platform: p.platform_name,
          player: p.player_trust - 50,
          ai: p.ai_trust - 50,
        }));
      }
      setAiResultData({
        trustDiff,
        reachCount: gameState.reach_count ?? 0,
      });
      setShowAiResult(true);
    }
  }, [gameState]);

  if (gameOver) {
    return (
      <div className="text-white h-screen flex flex-col items-center justify-center space-y-6 animate-fade-in">
        <div className="card max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-4">🎉 遊戲結束！</h2>
          <div className="space-y-2">
            <p className="text-lg">你的最終信任值：<span className="text-blue-400 font-semibold">{playerScore}</span></p>
            <p className="text-lg">Inforia Labs 最終信任值：<span className="text-blue-400 font-semibold">{agentScore}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
  return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'black',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* main-frame 包裹背景動畫，與主畫面一致 */}
        <div
          className="main-frame"
          style={{
            position: 'relative',
            width: 1440,
            height: 810,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            background: 'transparent',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* 原本的背景動畫 */}
          <video
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0,
            }}
            autoPlay
            loop
            muted
            playsInline
            src="/background.mp4"
          />
          {/* loading 動畫疊在上方 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <video
              src="/loading.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ width: 360, height: 360, objectFit: 'contain', background: 'transparent' }}
            />
        </div>
      </div>
      </div>
    );
  }

  if (!gameState) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>載入遊戲資料中...</div>;
  }
  if (gameState && !gameState.article) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>遊戲資料異常，請重新整理或聯絡管理員。</div>;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'black',
        overflow: 'hidden',
      }}
    >
      <div
        className="main-frame"
        style={{
          position: 'relative',
          width: 1440,
          height: 810,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: 'transparent',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* 背景動畫 */}
        <video
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
          autoPlay
          loop
          muted
          playsInline
          src="/background.mp4"
        />
        {/* 半透明遮罩 */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        {/* 左上角回合數顯示 */}
        <div
          style={{
            position: 'absolute',
            left: 32,
            top: 32,
            zIndex: 20,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 12,
            padding: '16px 24px',
            color: '#fff',
            fontSize: 20,
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: 120,
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          第 {roundNumber} 回合
            </div>

        {/* 左側社群反應 */}
        <div
          style={{
            position: 'absolute',
            left: 32,
            top: 138,
            width: 220,
            zIndex: 20,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 16,
            padding: '20px 16px',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>社群反應</div>
          {logs.map((log: string, index: number) => (
            <div
              key={index}
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 8px',
                fontSize: 15,
                lineHeight: 1.5,
                borderLeft: '4px solid #90caf9',
                wordBreak: 'break-all',
                textAlign: 'left',
              }}
            >
              {log}
          </div>
          ))}
        </div>

        {/* 右上角信任值與音樂控制 */}
        <div
          style={{
            position: 'absolute',
            right: 32,
            top: 32,
            zIndex: 20,
            display: 'block',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 12,
              padding: '16px 24px',
              color: '#fff',
              fontSize: 20,
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              minWidth: 220,
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>信任值</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', fontWeight: 600, borderBottom: '1px solid #fff2', paddingBottom: 4, marginBottom: 4 }}>
                <div style={{ width: 100 }}>平台</div>
                <div style={{ width: 60, textAlign: 'center' }}>你</div>
                <div style={{ width: 60, textAlign: 'center' }}>Inforia Labs</div>
              </div>
              {platforms.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>
                  <div style={{ width: 100 }}>{p.platform_name}</div>
                  <div style={{ width: 60, textAlign: 'center' }}>{p.player_trust}</div>
                  <div style={{ width: 60, textAlign: 'center' }}>{p.ai_trust}</div>
                </div>
                ))}
              </div>
            </div>
          </div>
        {/* 左下角設定按鈕 */}
                  <button
          onClick={() => setShowSettings(true)}
          style={{
            position: 'absolute',
            left: 32,
            bottom: 32,
            zIndex: 20,
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: 28,
          }}
          title="設定"
        >
          ⚙️
                  </button>
        {/* 左下角 Dashboard 按鈕 */}
        <button
          onClick={() => setShowDashboard(true)}
          style={{
            position: 'absolute',
            left: 133,
            bottom: 32,
            zIndex: 20,
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '50%',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: 28,
          }}
          title="Dashboard"
        >
          📊
        </button>
        {/* 設定面板 */}
        {showSettings && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(30,30,40,0.98)',
              borderRadius: 16,
              zIndex: 2000,
              padding: 32,
              minWidth: 400,
              minHeight: 180,
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>設定</div>
            {/* 音量控制 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8 }}>音量</div>
                  <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={e => {
                  const v = Number(e.target.value);
                  setVolume(v);
                }}
                style={{ width: 200 }}
              />
              <span style={{ marginLeft: 12 }}>{Math.round(volume * 100)}%</span>
                  <button
                onClick={() => setIsMuted(m => !m)}
                style={{
                  marginLeft: 24,
                  background: 'none',
                  border: '1px solid #fff',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '4px 12px',
                  cursor: 'pointer',
                }}
              >
                {isMuted ? '取消靜音' : '靜音'}
                  </button>
              </div>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                marginTop: 24,
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 18,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              關閉
            </button>
            </div>
        )}
        {/* 右下角工具列 */}
        <div
          style={{
            position: 'absolute',
            right: 32,
            bottom: 32,
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            alignItems: 'flex-end',
          }}
        >
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4, textAlign: 'right' }}>可用的工具</div>
          {tools.map((tool: any, i: number) => (
            <button
              key={i}
              onClick={() => selectTool(tool.tool_name)}
              onMouseEnter={() => setHoveredTool(tool.tool_name)}
              onMouseLeave={() => setHoveredTool(null)}
              style={{
                background: selectedTool === tool.tool_name
                  ? 'rgba(0,123,255,0.85)'
                  : 'rgba(0,123,255,0.55)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '14px 24px',
                fontSize: 18,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                outline: selectedTool === tool.tool_name ? '2px solid #fff' : 'none',
                opacity: 1,
                transition: 'all 0.2s',
                minWidth: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {tool.tool_name}
              {/* Tooltip */}
              {hoveredTool === tool.tool_name && (
                <div
                  style={{
                    position: 'absolute',
                    right: '100%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(30,30,40,0.98)',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '14px 18px',
                    minWidth: 220,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    fontSize: 15,
                    zIndex: 100,
                    whiteSpace: 'pre-line',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{tool.tool_name}</div>
                  <div style={{ marginBottom: 6 }}>{tool.description}</div>
                  <div style={{ fontSize: 14, color: '#90caf9' }}>
                    信任值效果：{tool.trust_effect}，擴散效果：{tool.spread_effect}
          </div>
                </div>
              )}
            </button>
          ))}
        </div>
        {/* 主要按鈕 */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute',
            left: 440,
            top: 660,
            width: 160,
            height: 52,
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
          onClick={() => setShowInput('clarify')}
        >
          澄清
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute',
            left: 640,
            top: 660,
            width: 160,
            height: 52,
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
          onClick={() => setShowInput('agree')}
        >
          附和
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          style={{
            position: 'absolute',
            left: 840,
            top: 660,
            width: 160,
            height: 52,
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
          onClick={() => {
            setShowIgnoreConfirm(true);
          }}
        >
          忽略
        </motion.button>
        {/* 輸入框浮窗（澄清/附和） */}
        {showInput && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '60%',
              width: 480,
              minHeight: 320,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.9)',
              borderRadius: 16,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: 32,
            }}
          >
            {/* 平台選擇 */}
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
              style={{
                width: '100%',
                fontSize: 18,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fff',
                marginBottom: 16,
                color: '#fff',
                background: 'rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                outline: 'none',
                backgroundImage: 'none',
              }}
            >
              <option value="" disabled>請選擇平台</option>
              {platforms.map((p, i) => (
                <option key={i} value={p.platform_name} style={{ color: '#222' }}>{p.platform_name}</option>
              ))}
            </select>
                  <input
                    type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="新聞標題"
              style={{
                width: '100%',
                fontSize: 18,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fff',
                marginBottom: 16,
                color: '#fff',
                background: 'rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="text"
              value={form.link}
              onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
              placeholder="新聞連結（選填）"
              style={{
                width: '100%',
                fontSize: 18,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fff',
                marginBottom: 16,
                color: '#fff',
                background: 'rgba(255,255,255,0.1)',
                boxSizing: 'border-box',
              }}
            />
            {/* 新增：原始內容 textarea 可編輯 */}
                  <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="新聞內文"
              style={{
                width: '100%',
                fontSize: 16,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fff',
                marginBottom: 24,
                color: '#fff',
                background: 'rgba(255,255,255,0.1)',
                minHeight: 80,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            {/* AI潤飾按鈕移到這裡 */}
            <button
              onClick={() => setShowPolishStyleInput(true)}
              disabled={isPolishing}
              style={{
                marginBottom: 8,
                background: isPolishing ? '#888' : '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 18,
                fontWeight: 600,
                cursor: isPolishing ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              {isPolishing ? 'AI潤飾中...' : 'AI潤飾'}
            </button>
            {showPolishStyleInput && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                pointerEvents: 'auto',
              }}>
                <div style={{
                  background: '#222', borderRadius: 12, padding: 32, minWidth: 340, color: '#fff', boxShadow: '0 2px 16px #0008',
                  position: 'relative', left: 180, top: -120
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>描述你想要的風格</div>
                  <input
                    type="text"
                    value={polishStyle}
                    onChange={e => setPolishStyle(e.target.value)}
                    placeholder="例如：正式、幽默、簡潔、..."
                    style={{
                      width: 280, fontSize: 16, padding: '10px 14px', borderRadius: 8,
                      border: '1px solid #fff', marginBottom: 16, color: '#fff', background: 'rgba(255,255,255,0.1)',
                      display: 'block', marginLeft: 'auto', marginRight: 'auto'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <button
                      onClick={async () => {
                        setShowPolishStyleInput(false);
                        await handlePolishContent(polishStyle);
                        setPolishStyle('');
                      }}
                      style={{
                        background: '#2196f3', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '10px 24px', fontSize: 18, fontWeight: 600, cursor: 'pointer'
                      }}
                    >確認</button>
                  <button
                      onClick={() => setShowPolishStyleInput(false)}
                      style={{
                        background: '#bbb', color: '#222', border: 'none', borderRadius: 8,
                        padding: '10px 24px', fontSize: 18, fontWeight: 600, cursor: 'pointer'
                      }}
                    >取消</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* 中央偏上：本回合新聞內容 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 120,
            width: 600,
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)',
            borderRadius: 16,
            padding: '32px 40px',
            color: '#fff',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            textAlign: 'left',
          }}
        >
          {/* 只顯示新聞內容，不再顯示 loading 動畫 */}
          <>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{news.title}</div>
            <div style={{ fontSize: 18, marginBottom: 16 }}>{news.content}</div>
            <div style={{ fontSize: 14, color: '#ccc' }}>
              發布者: {news.author} | 時間: {news.published_date}
            </div>
            <div style={{ fontSize: 15, color: '#90caf9', marginTop: 8 }}>
              觸及人數：{gameState?.reach_count ?? 0} 人
            </div>
          </>
        </div>
        {/* 忽略確認視窗 */}
        {showIgnoreConfirm && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '60%',
              width: 400,
              minHeight: 160,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.8)',
              borderRadius: 16,
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: 32,
            }}
          >
            <div style={{ color: '#fff', fontSize: 20, marginBottom: 32, textAlign: 'center' }}>
              你確定要忽略這則新聞嗎？
            </div>
            <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 120,
                  height: 40,
                  background: '#2196f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  fontWeight: 600
                }}
                onClick={() => {
                  setShowIgnoreConfirm(false);
                  handleSubmit('ignore');
                }}
              >
                確認
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 120,
                  height: 40,
                  background: '#bbb',
                  color: '#222',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
                onClick={() => setShowIgnoreConfirm(false)}
              >
                取消
              </motion.button>
            </div>
          </div>
        )}
        {/* 玩家行動結果彈窗 */}
        {showPlayerResult && playerResultData && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(30,30,40,0.98)',
              borderRadius: 16,
              zIndex: 3000,
              padding: 40,
              minWidth: 420,
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>你的行動結果</div>
            {playerResultData.trustDiff && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>信任值變化</div>
                {playerResultData.trustDiff.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <span style={{ width: 90, display: 'inline-block', color: '#fff', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{d.platform}：</span>
                    <span style={{ color: d.player > 0 ? '#4caf50' : d.player < 0 ? '#e57373' : '#fff' }}>
                      你 {d.player > 0 ? `+${d.player}` : d.player}
                    </span>
                    <span style={{ color: d.ai > 0 ? '#4caf50' : d.ai < 0 ? '#e57373' : '#fff', marginLeft: 8 }}>
                      AI {d.ai > 0 ? `+${d.ai}` : d.ai}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontWeight: 600, marginBottom: 18 }}>觸及人數：{playerResultData.reachCount} 人</div>
                  <button
              onClick={() => {
                setShowPlayerResult(false);
                setPlayerResultData(null);
                handleNextRoundAsync();
              }}
              style={{
                marginTop: 12,
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 32px',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                width: '60%'
              }}
            >
              確認
                  </button>
                </div>
        )}
        {/* Inforia Labs 行動結果彈窗 */}
        {showAiResult && aiResultData && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(30,30,40,0.98)',
              borderRadius: 16,
              zIndex: 3000,
              padding: 40,
              minWidth: 420,
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>Inforia Labs發布了一則新聞</div>
            <div style={{ fontSize: 18, color: '#90caf9', marginBottom: 18 }}>標題：{gameState?.article?.title || ''}</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>觸及人數：{aiResultData.reachCount} 人</div>
            {aiResultData.trustDiff && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>信任值變化</div>
                {aiResultData.trustDiff.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    <span style={{ width: 90, display: 'inline-block', color: '#fff', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{d.platform}：</span>
                    <span style={{ color: d.player > 0 ? '#4caf50' : d.player < 0 ? '#e57373' : '#fff' }}>
                      你 {d.player > 0 ? `+${d.player}` : d.player}
                    </span>
                    <span style={{ color: d.ai > 0 ? '#4caf50' : d.ai < 0 ? '#e57373' : '#fff', marginLeft: 8 }}>
                      Inforia Labs {d.ai > 0 ? `+${d.ai}` : d.ai}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 18, color: '#fff', margin: '24px 0 0 0', fontWeight: 700 }}>你要怎麼回應呢？</div>
            <button
              onClick={() => {
                setShowAiResult(false);
                setAiResultData(null);
              }}
              style={{
                marginTop: 20,
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 32px',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                width: '60%'
              }}
            >
              確認
            </button>
          </div>
        )}
        {/* 全畫面 loading 動畫，疊在所有內容之上 */}
        {isActionLoading && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              zIndex: 9999,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}
          >
            <video
              src={loadingType === 'ai' ? '/aiaction.mp4' : '/loading.mp4'}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: 360, height: 360, objectFit: 'contain', background: 'transparent' }}
            />
            {loadingType === 'ai' && (
              <div style={{ color: '#fff', fontSize: 22, marginTop: 24, fontWeight: 600 }}>
                Inforia Labs 正在思考下一步...請稍候
              </div>
            )}
            </div>
        )}
        {/* Dashboard 面板 */}
        {showDashboard && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(30,30,40,0.98)',
              borderRadius: 16,
              zIndex: 2000,
              padding: 32,
              minWidth: 600,
              minHeight: 400,
              color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 24, letterSpacing: 2, textAlign: 'center' }}>
              玩家 Dashboard
          </div>
            {/* 本回合資訊 */}
            <div style={{
              background: 'rgba(0,123,255,0.10)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>本回合資訊</div>
              <div>回合數：{gameState.round_number}</div>
              <div>新聞標題：{gameState.article?.title}</div>
              <div>觸及人數：{gameState?.reach_count ?? 0} 人</div>
        </div>
            {/* 社群反應 */}
            <div style={{
              background: 'rgba(255,193,7,0.10)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>社群反應</div>
              {gameState.simulated_comments && gameState.simulated_comments.length > 0 ? (
                <ul style={{ paddingLeft: 20 }}>
                  {gameState.simulated_comments.map((r: string, i: number) => (
                    <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#aaa' }}>本回合尚無社群反應</div>
              )}
          </div>
            {/* 平台信任值 */}
            <div style={{
              background: 'rgba(76,175,80,0.10)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>平台信任值</div>
              <table style={{ width: '100%', color: '#fff', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #fff2' }}>
                    <th style={{ textAlign: 'left', padding: 6 }}>平台</th>
                    <th style={{ textAlign: 'center', padding: 6 }}>你</th>
                    <th style={{ textAlign: 'center', padding: 6 }}>Inforia Labs</th>
                  </tr>
                </thead>
                <tbody>
                  {gameState.platform_status?.map((p: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: 6 }}>{p.platform_name}</td>
                      <td style={{ textAlign: 'center', padding: 6 }}>{p.player_trust}</td>
                      <td style={{ textAlign: 'center', padding: 6 }}>{p.ai_trust}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 顯示 AI 行動造成的信任值變化 */}
            {aiActionTrustDiff && (
              <div style={{
                marginTop: 12,
                background: 'rgba(255,193,7,0.12)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 15,
                color: '#ffb300',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                transition: 'opacity 0.3s',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>Inforia Labs 行動造成的影響</div>
                {aiActionTrustDiff.map((d, i) => {
                  const prev = roundHistory[i - 1];
                  const prevP = prev?.platform_trust?.find((x: any) => x.platform === d.platform);
                  const playerDiff = d.player - (prevP ? prevP.player_trust : 50);
                  const aiDiff = d.ai - (prevP ? prevP.ai_trust : 50);
                  return (
                    <div key={d.platform} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 90, display: 'inline-block', color: '#fff', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{d.platform}：</span>
                      <span style={{ color: playerDiff > 0 ? '#4caf50' : playerDiff < 0 ? '#e57373' : '#fff' }}>
                        你 {playerDiff > 0 ? `+${playerDiff}` : playerDiff}
                      </span>
                      <span style={{ color: aiDiff > 0 ? '#4caf50' : aiDiff < 0 ? '#e57373' : '#fff', marginLeft: 8 }}>
                        AI {aiDiff > 0 ? `+${aiDiff}` : aiDiff}
                      </span>
                    </div>
                  );
                })}
        </div>
      )}
            {/* 回合歷史 */}
            <div style={{
              background: 'rgba(33,150,243,0.10)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>回合歷史</div>
              {roundHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {roundHistory.map((r, i) => {
                    const prev = roundHistory[i - 1];
                    const isAI = r.actor === 'ai';
                    return (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 10,
                        padding: '16px 18px',
                        marginBottom: 16,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                      }}>
                        <div style={{ fontWeight: 700, color: '#2196f3', marginBottom: 4 }}>第 {r.round_number} 回合</div>
                        {isAI ? (
                          <>
                            <div style={{ fontWeight: 700, color: '#ffb300', marginBottom: 4 }}>Inforia Labs 行動</div>
                            <div style={{ marginLeft: 12, fontSize: 15, color: '#90caf9', marginBottom: 16 }}>
                              發布新聞標題：{r.news_title}
                            </div>
                            <div style={{ marginLeft: 12, marginBottom: 16, color: '#fff', whiteSpace: 'pre-line' }}>
                              {r.ai_action || '—'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, color: '#4caf50', marginBottom: 4 }}>玩家行動</div>
                            <div style={{ marginLeft: 12, fontSize: 15, color: '#90caf9', marginBottom: 16 }}>
                              使用了{r.player_action || '—'}
                            </div>
                            {!['ignore', '忽略'].includes(r.player_action) && (
                              <>
                                <div style={{ marginLeft: 12, fontSize: 15, color: '#90caf9', marginBottom: 16 }}>
                                  發布新聞標題：{r.news_title}
                                </div>
                                <div style={{ marginLeft: 12, marginBottom: 16, color: '#fff', whiteSpace: 'pre-line' }}>
                                  {r.player_content || '—'}
                                </div>
                              </>
                            )}
                          </>
                        )}
                        <div style={{ marginLeft: 12, fontSize: 15, color: '#90caf9', marginBottom: 2 }}>
                          觸及人數：{r.reach_count ?? '—'}
                        </div>
                        <div style={{ marginLeft: 12, fontSize: 15, color: '#90caf9', marginBottom: 2 }}>
                          造成各平台信任值影響：
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: 6 }}>平台</th>
                                <th style={{ textAlign: 'center', padding: 6 }}>你</th>
                                <th style={{ textAlign: 'center', padding: 6 }}>Inforia Labs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.platform_trust?.map((p: any) => {
                                const prevP = prev?.platform_trust?.find((x: any) => x.platform === p.platform);
                                const playerDiff = p.player_trust - (prevP ? prevP.player_trust : 50);
                                const aiDiff = p.ai_trust - (prevP ? prevP.ai_trust : 50);
                                return (
                                  <tr key={p.platform}>
                                    <td style={{ padding: 6 }}>{p.platform}</td>
                                    <td style={{ textAlign: 'center', padding: 6 }}>{p.player_trust} ({playerDiff >= 0 ? `+${playerDiff}` : playerDiff})</td>
                                    <td style={{ textAlign: 'center', padding: 6 }}>{p.ai_trust} ({aiDiff >= 0 ? `+${aiDiff}` : aiDiff})</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: '#aaa' }}>尚無回合紀錄</div>
              )}
            </div>
        <button
              onClick={() => setShowDashboard(false)}
              style={{
                marginTop: 24,
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 18,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              關閉
        </button>
          </div>
      )}
      </div>
    </div>
  );
}
