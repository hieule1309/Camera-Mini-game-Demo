import React from 'react';
import { X, Sliders } from 'lucide-react';
import { GameConfig } from '../types/game';

interface SettingsModalProps {
  config: GameConfig;
  onClose: () => void;
  onUpdateConfig: (updated: GameConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onClose, onUpdateConfig }) => {
  const handleSpeedChange = (speed: number) => {
    onUpdateConfig({
      ...config,
      gameplay: {
        ...config.gameplay,
        targetSpeed: speed,
      },
    });
  };

  const handleSpawnIntervalChange = (ms: number) => {
    onUpdateConfig({
      ...config,
      gameplay: {
        ...config.gameplay,
        spawnIntervalMs: ms,
      },
    });
  };

  const handleParticleCountChange = (count: number) => {
    onUpdateConfig({
      ...config,
      visuals: {
        ...config.visuals,
        particleCount: count,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">Cài đặt Game & Gameplay</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          {/* Target Speed Slider */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Tốc độ di chuyển mục tiêu:</span>
              <span className="font-mono font-bold text-cyan-400">{config.gameplay.targetSpeed}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.2"
              value={config.gameplay.targetSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Spawn Interval */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Tần suất xuất hiện mục tiêu:</span>
              <span className="font-mono font-bold text-cyan-400">{config.gameplay.spawnIntervalMs} ms</span>
            </div>
            <input
              type="range"
              min="600"
              max="2500"
              step="100"
              value={config.gameplay.spawnIntervalMs}
              onChange={(e) => handleSpawnIntervalChange(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Particle Count */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Số lượng hạt nổ khi va chạm:</span>
              <span className="font-mono font-bold text-cyan-400">{config.visuals.particleCount} hạt</span>
            </div>
            <input
              type="range"
              min="6"
              max="40"
              step="2"
              value={config.visuals.particleCount}
              onChange={(e) => handleParticleCountChange(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Version Info Card */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Phiên bản Config:</span>
              <span className="font-mono text-cyan-300 font-semibold">{config.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian cập nhật:</span>
              <span>{config.updatedAt || 'Hôm nay'}</span>
            </div>
            <div className="flex justify-between">
              <span>Engine đồ họa:</span>
              <span className="text-white font-medium">PixiJS v8.6 (WebGL 2.0 / WebGPU)</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
};
