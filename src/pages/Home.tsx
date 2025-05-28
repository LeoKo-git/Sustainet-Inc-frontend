import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

type HomeProps = {
  onStart: (playerName: string) => void;
  isGameLoading?: boolean;
};

// 按鈕元件
const MenuButton = ({
  label,
  onClick,
  icon,
  imageSrc,
  color = 'bg-blue-500',
  disabled = false,
  position = { x: 0, y: 0 },
  className = ''
}: {
  label: string;
  onClick: () => void;
  icon?: string;
  imageSrc?: string;
  color?: string;
  disabled?: boolean;
  position?: { x: number | string; y: number | string };
  className?: string;
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    style={{
      position: 'absolute',
      left: position.x,
      top: position.y,
      transform: 'translateX(-50%)',
    }}
    className={`
      ${color}
      text-white
      px-8
      py-3
      rounded-lg
      text-lg
      font-medium
      transition-all
      hover:scale-105
      disabled:opacity-50
      disabled:hover:scale-100
      backdrop-blur-sm
      border-2
      border-white/20
      hover:border-white/40
      ${className}
    `}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <span className="flex items-center justify-center gap-2">
      {imageSrc ? (
        <img 
          src={imageSrc} 
          alt={label} 
          className="w-full h-full object-contain"
        />
      ) : (
        icon
      )}
      {!imageSrc && label}
    </span>
  </motion.button>
);

export default function Home({ onStart, isGameLoading = false }: HomeProps) {
  const [name, setName] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // 音樂初始化與控制，加入全局點擊觸發
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

    // 新增：全局點擊觸發音樂
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

  // 音樂靜音切換
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleButtonClick = (callback: () => void) => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
    }
    setIsLoading(true);
    callback();
  };

  useEffect(() => {
    const updateScale = () => {
      const mainFrame = document.querySelector('.main-frame');
      if (mainFrame) {
        const scaleX = window.innerWidth / 1440;
        const scaleY = window.innerHeight / 810;
        const newScale = Math.min(scaleX, scaleY);
        (mainFrame as HTMLElement).style.setProperty('--scale', newScale.toString());
        setScale(newScale);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

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
          transform: 'scale(var(--scale, 1))',
          transformOrigin: 'center center',
          background: 'transparent',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* 主動畫全螢幕鋪滿（以 main-frame 為基準） */}
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
          src="/game-cover.mp4"
        />

        {/* 半透明遮罩 */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

        {/* Yes 按鈕 */}
        {!showNameInput && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'absolute',
              left: 840,
              top: 560,
              width: 120,
              height: 40,
              background: 'none',
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              zIndex: 30,
              transform: 'none',
            }}
            onClick={() => setShowNameInput(true)}
          >
            <img src="/yes.webp" alt="Yes" style={{ width: '100%', height: '100%' }} />
          </motion.button>
        )}

        {/* Cancel 按鈕 */}
        {!showNameInput && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: 'absolute',
              left: 1020,
              top: 560,
              width: 120,
              height: 40,
              background: 'none',
              padding: 0,
              border: 'none',
              cursor: 'pointer',
              zIndex: 30,
              transform: 'none',
            }}
            onClick={() => {}}
          >
            <img src="/cancle.webp" alt="Cancel" style={{ width: '100%', height: '100%' }} />
          </motion.button>
        )}

        {/* 遊戲紀錄按鈕（精確定位） */}
        <button
          style={{
            position: 'absolute',
            left: 906,
            top: 215,
            width: 24,
            height: 24,
            background: 'none',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            zIndex: 30,
          }}
          onClick={() => { /* TODO: 遊戲紀錄功能 */ }}
        >
          <img src="/buttom.webp" alt="遊戲紀錄" style={{ width: '100%', height: '100%' }} />
        </button>

        {/* 遊玩方式按鈕（精確定位） */}
        <button
          style={{
            position: 'absolute',
            left: 906,
            top: 263.5,
            width: 24,
            height: 24,
            background: 'none',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            zIndex: 30,
          }}
          onClick={() => { /* TODO: 遊玩方式功能 */ }}
        >
          <img src="/buttom.webp" alt="遊玩方式" style={{ width: '100%', height: '100%' }} />
        </button>

        {/* 設定按鈕（精確定位） */}
        <button
          style={{
            position: 'absolute',
            left: 906,
            top: 310,
            width: 24,
            height: 24,
            background: 'none',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
            zIndex: 30,
          }}
          onClick={() => setIsMuted((prev) => !prev)}
        >
          <img src="/buttom.webp" alt="設定" style={{ width: '100%', height: '100%' }} />
        </button>

        {/* 玩家名字輸入區塊（響應式浮窗，覆蓋動畫上方，z-index:9999） */}
        {showNameInput && !isGameLoading && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 768,
              height: 402,
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <video
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 768,
                height: 402,
                objectFit: 'cover',
                borderRadius: 12,
                zIndex: 1,
              }}
              autoPlay
              loop
              muted
              playsInline
              src={'/entername.mp4'}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 240,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              <input
                type="text"
                placeholder="請輸入玩家名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && name.trim()) {
                    onStart(name);
                  }
                }}
                style={{
                  fontSize: 20,
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  marginBottom: 24,
                  width: '75%',
                }}
              />
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  width: 160,
                  height: 52,
                  marginTop: 8,
                }}
                onClick={() => onStart(name)}
                disabled={!name.trim()}
              >
                <img src="/enter.png" alt="進入遊戲" style={{ width: '100%', height: '100%', display: 'block' }} />
              </motion.button>
            </div>
          </div>
        )}

        {/* 遊戲載入中時顯示 loading 動畫，覆蓋 main-frame */}
        {isGameLoading && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 768,
              height: 402,
              transform: 'translate(-50%, -50%)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <video
              style={{
                width: 768,
                height: 402,
                objectFit: 'cover',
                borderRadius: 12,
                zIndex: 1,
              }}
              autoPlay
              loop
              muted
              playsInline
              src={'/loading.mp4'}
            />
          </div>
        )}
      </div>
      {/* 讓 main-frame 內 input 的 placeholder 變白色 */}
      <style>{`
        .main-frame input::placeholder {
          color: #fff !important;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}