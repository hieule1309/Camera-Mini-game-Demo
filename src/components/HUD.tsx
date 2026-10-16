import React from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Camera,
  CameraOff,
  Flashlight,
  Sparkles,
  Trophy,
  Flame,
  Activity,
  Sliders,
  Hand,
} from 'lucide-react';

interface HUDProps {
  score: number;
  combo: number;
  highScore: number;
  targetsHit: number;
  isPaused: boolean;
  pauseReason: string | null;
  hasTorch: boolean;
  isTorchOn: boolean;
  facingMode: 'user' | 'environment';
  visionMode: string;
  isVrMode: boolean;
  onTogglePause: () => void;
  onToggleVrMode: () => void;
  onResetGame: () => void;
  onToggleFacing: () => void;
  onToggleTorch: () => void;
  onToggleSettings: () => void;
  onTogglePerfOverlay: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  combo,
  highScore,
  targetsHit,
  isPaused,
  pauseReason,
  hasTorch,
  isTorchOn,
  facingMode,
  visionMode,
  isVrMode,
  onTogglePause,
  onToggleVrMode,
  onResetGame,
  onToggleFacing,
  onToggleTorch,
  onToggleSettings,
  onTogglePerfOverlay,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 pb-6 select-none">
      {/* Top Bar: Score, Combo & Controls */}
      <div className="flex items-start justify-between w-full">
        {/* Score & Combo */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-2xl px-4 py-2 shadow-lg">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Điểm số</div>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 font-mono">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {combo > 1 && (
              <div className="flex items-center gap-1 bg-amber-500/20 backdrop-blur-md border border-amber-500/50 rounded-xl px-3 py-1 text-amber-300 font-bold text-xs animate-bounce shadow-md shadow-amber-500/20">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>COMBO x{combo}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1 text-slate-400 text-xs font-medium">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span>Kỷ lục: {highScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Action Controls (Top Right) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleVrMode}
            className={`p-2.5 rounded-xl border backdrop-blur-md transition-all active:scale-95 ${
              isVrMode
                ? 'bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border-slate-700/80'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
            }`}
            title={isVrMode ? 'Tắt chế độ VR và camera' : 'Bật lại chế độ VR'}
            aria-label={isVrMode ? 'Tắt chế độ VR' : 'Bật chế độ VR'}
          >
            {isVrMode ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>

          {hasTorch && (
            <button
              onClick={onToggleTorch}
              className={`p-2.5 rounded-xl border backdrop-blur-md transition-all active:scale-95 ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
              }`}
              title="Bật/Tắt Đèn Flash"
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onToggleFacing}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition-all active:scale-95"
            title={`Đổi Camera (${facingMode === 'user' ? 'Trước' : 'Sau'})`}
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePerfOverlay}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition-all active:scale-95"
            title="Đo FPS & Hiệu năng"
          >
            <Activity className="w-5 h-5 text-emerald-400" />
          </button>

          <button
            onClick={onToggleSettings}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition-all active:scale-95"
            title="Cài đặt & Tối ưu"
          >
            <Sliders className="w-5 h-5 text-indigo-400" />
          </button>

          <button
            onClick={onTogglePause}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 backdrop-blur-md transition-all active:scale-95"
            title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
          >
            {isPaused ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Bottom Center: Gesture / Touch Indicator & Targets Hit */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-full px-3.5 py-1.5 text-xs text-slate-300">
          <Hand className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {visionMode === 'mediapipe'
              ? 'MediaPipe: Giơ tay trước camera'
              : visionMode === 'motion'
                ? 'Motion/Quang phổ: Di chuyển vật sáng'
                : 'Giả lập AI Tracker: Tự động di chuyển'}
          </span>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-full px-3 py-1">
          Mục tiêu: <span className="font-bold text-white">{targetsHit}</span>
        </div>
      </div>

      {/* Pause & Interruption Overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
            <Pause className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Trò chơi Tạm dừng</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-xs">
            {pauseReason || 'Thao tác bị gián đoạn. Chạm vào nút bên dưới để tiếp tục chơi.'}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePause}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/30 active:scale-95 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Tiếp tục chơi
            </button>
            <button
              onClick={onResetGame}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Chơi lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
