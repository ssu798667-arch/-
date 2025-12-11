
import React from 'react';
import GameScene from './components/GameScene';
import HandController from './components/HandController';
import { useGameStore } from './store';
import { GameStatus, DangerStatus } from './types';

// Animated Bird Logo SVG
const BirdLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M10,50 Q25,20 50,50 T90,50" stroke="currentColor" strokeWidth="4" fill="none" className="animate-pulse">
        <animate attributeName="d" 
                 values="M10,50 Q25,20 50,50 T90,50; M10,50 Q25,80 50,50 T90,50; M10,50 Q25,20 50,50 T90,50" 
                 dur="1s" 
                 repeatCount="indefinite" />
    </path>
    <circle cx="90" cy="50" r="3" />
  </svg>
);

const UI: React.FC = () => {
  const { 
    status, score, birdCount, 
    resetGame, handDetected, cameraPermissionGranted, setStatus,
    dangerStatus, dangerTimer
  } = useGameStore();

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-8">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="text-white font-mono">
          <h1 className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 shadow-glow">
            光隙
          </h1>
          <div className="mt-2 text-blue-200 text-sm opacity-80">
            飞行距离: {score}m / 800m
          </div>
          <div className={`mt-1 text-xl font-bold font-mono transition-colors duration-200 ${dangerStatus === DangerStatus.WARNING ? 'text-red-500 animate-bounce' : 'text-yellow-200'}`}>
            鸟群数量: {birdCount}
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-8 right-8 flex flex-col items-end gap-2">
         {!cameraPermissionGranted ? (
             <div className="bg-red-900/50 text-red-200 px-3 py-1 rounded text-xs border border-red-500/30 backdrop-blur-md">
                需要摄像头权限
             </div>
         ) : !handDetected ? (
             <div className="bg-yellow-900/50 text-yellow-200 px-3 py-1 rounded text-xs border border-yellow-500/30 backdrop-blur-md animate-pulse">
                请在摄像头前展示手势
             </div>
         ) : (
            <div className="bg-green-900/50 text-green-200 px-3 py-1 rounded text-xs border border-green-500/30 backdrop-blur-md">
                神经链接已连接
             </div>
         )}
      </div>

      {/* Menus & Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        {/* Warning / Rescue Overlay (Scaled Down) */}
        {status === GameStatus.PLAYING && dangerStatus === DangerStatus.WARNING && (
          <div className="flex flex-col items-center z-50">
            <div className="text-5xl font-black text-red-500 animate-pulse tracking-tighter mb-4 shadow-red-glow filter drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
              碰撞警告！
            </div>
            <div className="bg-red-950/90 border-4 border-red-500 px-8 py-6 rounded-2xl backdrop-blur-xl text-center shadow-[0_0_50px_rgba(220,38,38,0.5)] transform scale-90">
              <p className="text-white text-xl font-bold mb-3 animate-bounce">✊ 握拳急救！</p>
              <div className="text-6xl font-mono text-red-300 font-black">
                {(dangerTimer / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        )}

        {/* Start Menu */}
        {status === GameStatus.MENU && (
          <div className="bg-black/80 p-8 rounded-2xl border border-cyan-500/30 backdrop-blur-xl text-center max-w-md shadow-[0_0_50px_rgba(8,145,178,0.2)]">
            <h2 className="text-2xl text-white font-bold mb-4">迁徙协议</h2>
            <p className="text-blue-200 mb-6 text-sm leading-relaxed text-left">
              <span className="block mb-2">1. 使用 <strong>张开手掌</strong> 控制鸟群飞行方向。</span>
              <span className="block mb-2">2. 躲避城市中的 <strong>光束</strong> 与 <strong>光柱</strong>。</span>
              <span className="block text-yellow-400 mb-2">3. <strong>握紧拳头</strong> 可收缩鸟群穿越狭窄缝隙。</span>
              <span className="block text-red-400">4. 若发生碰撞，<strong>快速握拳</strong> 可召回迷失的鸟儿！</span>
            </p>
            <button 
              onClick={() => setStatus(GameStatus.PLAYING)}
              className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
            >
              开始迁徙
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {status === GameStatus.GAME_OVER && (
          <div className="bg-black/90 p-8 rounded-2xl border border-red-500/30 backdrop-blur-xl text-center max-w-md">
            <h2 className="text-4xl text-red-500 font-bold mb-2">迷失方向</h2>
            <p className="text-gray-400 mb-6">鸟群在光污染中迷失了，迁徙失败。</p>
            <div className="text-2xl text-white font-mono mb-8">
              飞行距离: <span className="text-cyan-400">{score}m</span>
            </div>
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-lg transition-all"
            >
              重新开始
            </button>
          </div>
        )}

        {/* Victory Screen - Artistic Redesign */}
        {status === GameStatus.GAME_WON && (
          <div className="relative overflow-hidden rounded-3xl backdrop-blur-3xl bg-slate-900/80 border border-emerald-500/30 p-10 max-w-3xl w-full shadow-[0_0_80px_rgba(16,185,129,0.2)] flex flex-col md:flex-row gap-8 items-center">
            
            {/* Left/Top visual side */}
            <div className="flex flex-col items-center justify-center flex-1 text-center border-b md:border-b-0 md:border-r border-emerald-500/20 pb-8 md:pb-0 md:pr-8 w-full md:w-auto">
               <div className="relative w-32 h-32 mb-6">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
                  <BirdLogo className="relative w-full h-full text-emerald-300 drop-shadow-[0_0_15px_rgba(110,231,183,0.5)]" />
               </div>
               <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-200 to-green-500 tracking-tight">
                 成功飞离
               </h2>
               <p className="text-emerald-100/70 mt-2 font-light">成功飞离城市霓虹</p>
               <div className="mt-6 inline-flex items-center px-4 py-2 bg-emerald-950/50 rounded-full border border-emerald-500/30">
                  <span className="text-emerald-400 font-mono font-bold mr-2">存活鸟群:</span>
                  <span className="text-white font-mono">{birdCount} / 16</span>
               </div>
            </div>

            {/* Right/Bottom content side */}
            <div className="flex-1 flex flex-col justify-center h-full">
               <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 rounded-xl border-l-4 border-yellow-400 mb-8 backdrop-blur-sm">
                  <h3 className="text-yellow-400 font-bold text-lg mb-2 flex items-center">
                    <span className="mr-2">💡</span> 生态科普
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed text-justify">
                     <strong>人造光（ALAN）</strong> 严重干扰候鸟的自然导航系统。每年有数百万只候鸟因城市光污染而迷失方向，最终撞击高楼大厦。
                  </p>
                  <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                     在迁徙季节，哪怕只是关掉一盏不必要的灯，也能为它们点亮回家的路。
                  </p>
               </div>
               
               <button 
                onClick={resetGame}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 tracking-widest text-lg"
              >
                再次起飞
              </button>
            </div>
            
          </div>
        )}
      </div>
      
      {/* Bottom Instructions */}
      {status === GameStatus.PLAYING && dangerStatus !== DangerStatus.WARNING && (
        <div className="w-full text-center text-white/30 text-xs font-mono tracking-widest uppercase mb-4">
           移动手掌控制方向 // 握拳收缩鸟群
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <GameScene />
      <HandController />
      <UI />
    </div>
  );
};

export default App;
