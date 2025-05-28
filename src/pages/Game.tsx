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
  const [form, setForm] = useState({ title: '', link: '', content: '' });
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
    }
  }, [isMuted]);

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
  const logs = gameState?.dashboard_info?.current_round?.social_reactions || [];

  // 計算所有平台信任值加總
  const playerTotalTrust = platforms.reduce((sum, p) => sum + (p.player_trust ?? 0), 0);
  const aiTotalTrust = platforms.reduce((sum, p) => sum + (p.ai_trust ?? 0), 0);

  // 載入中狀態
  const isLoading = !gameState || !gameState.article;

  // 串接後端 API：送出澄清/附和
  const handleSubmit = async (actionType: 'clarify' | 'agree' | 'ignore') => {
    if (actionType !== 'ignore') {
      if (!form.title.trim() || !form.content.trim()) {
        alert('請填寫標題和內容');
        return;
      }
      if (!selectedPlatform) {
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
      // 送出前先記錄舊的信任值
      const prevPlatforms = (gameState?.platform_status || []).map((p: any) => ({
        platform_name: p.platform_name,
        player_trust: p.player_trust,
        ai_trust: p.ai_trust,
      }));

      let payload: any;
      if (actionType === 'ignore') {
        payload = {
          session_id: gameState.session_id,
          round_number: gameState.round_number,
          action_type: 'ignore',
          article: {
            title: gameState.article?.title || '',
            content: gameState.article?.content || '',
            author: gameState.article?.author || '',
            published_date: gameState.article?.published_date || '',
            target_platform: gameState.article?.target_platform || '',
          }
        };
    } else {
        payload = {
          session_id: gameState.session_id,
          round_number: gameState.round_number,
          action_type: actionType,
          article: {
            title: form.title,
            content: form.content,
            author: '玩家',
            published_date: new Date().toISOString(),
            target_platform: selectedPlatform,
          },
          tool_used: selectedTool ? [{ tool_name: selectedTool }] : [],
        };
      }
      console.log('Sending payload:', payload);
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
      
      // 先更新遊戲狀態
      setGameState(data);
      setShowInput(null);
      setForm({ title: '', link: '', content: '' });
      setSelectedTool(null);
      
      // 計算信任值變化（玩家行動）
      if (data.platform_status && prevPlatforms.length) {
        const diff = data.platform_status.map((p: any) => {
          const prev = prevPlatforms.find((x: any) => x.platform_name === p.platform_name);
          return {
            platform: p.platform_name,
            player: prev ? p.player_trust - prev.player_trust : 0,
            ai: prev ? p.ai_trust - prev.ai_trust : 0,
          };
        });
        setPlayerActionTrustDiff(diff);
        if (playerDiffTimeout.current) clearTimeout(playerDiffTimeout.current);
        playerDiffTimeout.current = window.setTimeout(() => setPlayerActionTrustDiff(null), 8000);
      }
      
      // 等待狀態更新完成後再進入下一回合
      setTimeout(async () => {
        try {
          setLoadingType('ai'); // 進入 AI 行動 loading
          // 先等待 AI 行動
          const aiActionPayload = {
            session_id: data.session_id,
            round_number: data.round_number
          };
          console.log('Waiting for AI action...');
          const aiActionRes = await fetch('https://sustainet-net.up.railway.app/api/games/ai-turn', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(aiActionPayload),
          });
          
          if (!aiActionRes.ok) {
            const errorText = await aiActionRes.text();
            console.error('AI action error:', aiActionRes.status, aiActionRes.statusText, errorText);
            alert('等待 AI 行動失敗');
            setIsActionLoading(false);
            setLoadingType(null);
            return;
          }
          
          const aiActionData = await aiActionRes.json();
          console.log('AI action response:', aiActionData);
          
          // 進入下一回合，先清除上一回合 AI 影響提示，延後 setGameState 直到 loading 結束
          setTimeout(() => {
            setPlayerActionTrustDiff(null);
            setAiActionTrustDiff(null);
            setGameState(aiActionData); // 只在 next-round 回傳後才切換畫面
            setIsActionLoading(false);
            setLoadingType(null);
            // 新回合畫面顯示後再顯示 AI 行動造成的影響（不自動消失）
            if (aiActionData && aiActionData.platform_status && prevPlatforms.length) {
              const diff = aiActionData.platform_status.map((p: any) => {
                const prev = prevPlatforms.find((x: any) => x.platform_name === p.platform_name);
                return {
                  platform: p.platform_name,
                  player: prev ? p.player_trust - prev.player_trust : 0,
                  ai: prev ? p.ai_trust - prev.ai_trust : 0,
                };
              });
              setAiActionTrustDiff(diff);
            }
          }, 500);
        } catch (err) {
          console.error('Round transition error:', err);
          alert('回合轉換失敗，請稍後再試');
          setIsActionLoading(false);
          setLoadingType(null);
        }
      }, 1000);
    } catch (err) {
      console.error('Network Error:', err);
      alert('網路錯誤，請稍後再試');
      setIsActionLoading(false);
      setLoadingType(null);
    }
  };

  if (gameOver) {
    return (
      <div className="text-white h-screen flex flex-col items-center justify-center space-y-6 animate-fade-in">
        <div className="card max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-4">🎉 遊戲結束！</h2>
          <div className="space-y-2">
            <p className="text-lg">你的最終信任值：<span className="text-blue-400 font-semibold">{playerScore}</span></p>
            <p className="text-lg">AI 最終信任值：<span className="text-blue-400 font-semibold">{agentScore}</span></p>
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
            top: 220,
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
                <div style={{ width: 60, textAlign: 'center' }}>AI</div>
              </div>
              {platforms.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>
                  <div style={{ width: 100 }}>{p.platform_name}</div>
                  <div style={{ width: 60, textAlign: 'center' }}>{p.player_trust}</div>
                  <div style={{ width: 60, textAlign: 'center' }}>{p.ai_trust}</div>
                </div>
              ))}
            </div>
            {/* 顯示玩家行動與 AI 行動造成的信任值變化 */}
            {playerActionTrustDiff && (
              <div style={{
                marginTop: 12,
                background: 'rgba(0,123,255,0.12)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 15,
                color: '#90caf9',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                transition: 'opacity 0.3s',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>你這回合行動的影響</div>
                {playerActionTrustDiff.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 90, display: 'inline-block', color: '#fff' }}>{d.platform}：</span>
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
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>AI 行動造成的影響</div>
                {aiActionTrustDiff.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 90, display: 'inline-block', color: '#fff' }}>{d.platform}：</span>
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
          </div>
        </div>
        {/* 左下角音樂控制按鈕 */}
        <button
          onClick={() => setIsMuted((prev) => !prev)}
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
          title={isMuted ? '取消靜音' : '靜音'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
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
              background: 'rgba(0,0,0,0.7)',
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
            <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 120,
                  height: 40,
                  background: '#fff',
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
                onClick={() => handleSubmit(showInput!)}
                disabled={!form.title.trim() || !form.content.trim()}
              >
                送出
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
                onClick={() => {
                  setShowInput(null);
                  setForm({ title: '', link: '', content: '' });
                }}
              >
                取消
              </motion.button>
          </div>
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
                  background: '#fff',
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
          </div>
        )}
      </div>
    </div>
  );
}
