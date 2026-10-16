import React from 'react';
import { X, Gauge, Cpu, Layers, Battery, Smartphone, Eye } from 'lucide-react';
import { PerformanceStats } from '../types/game';
import { VisionDetectorMode } from '../services/visionDetector';

interface PerformanceOverlayProps {
  stats: PerformanceStats;
  resolutionScale: number;
  batterySaver: boolean;
  visionMode: VisionDetectorMode;
  onClose: () => void;
  onSetResolutionScale: (scale: number) => void;
  onToggleBatterySaver: () => void;
  onSetVisionMode: (mode: VisionDetectorMode) => void;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  stats,
  resolutionScale,
  batterySaver,
  visionMode,
  onClose,
  onSetResolutionScale,
  onToggleBatterySaver,
  onSetVisionMode,
}) => {
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-emerald-400';
    if (fps >= 35) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="absolute top-16 right-4 z-30 w-80 max-w-[calc(100vw-32px)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-slate-200 select-none animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm text-white">Đo FPS & Tối ưu Di động</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Real-time Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2 my-3">
        {/* FPS */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Tốc độ khung hình
          </div>
          <div className={`text-2xl font-black font-mono ${getFpsColor(stats.fps)}`}>
            {stats.fps} <span className="text-xs font-normal text-slate-400">FPS</span>
          </div>
        </div>

        {/* Inference Latency */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            Vision AI Latency
          </div>
          <div className="text-2xl font-black font-mono text-purple-300">
            {stats.inferenceTimeMs} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
        </div>

        {/* Dropped Frames */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400">Frame Drops</div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {stats.droppedFrames}
          </div>
        </div>

        {/* Memory / Entities */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Entities / FX
          </div>
          <div className="text-lg font-bold font-mono text-indigo-300">
            {stats.targetCount}t / {stats.particleCount}p
          </div>
        </div>
      </div>

      {/* Mobile Optimization Controls */}
      <div className="space-y-3 pt-1">
        {/* Render Scale */}
        <div>
          <div className="flex justify-between text-xs text-slate-300 mb-1.5">
            <span>Độ phân giải Render Canvas:</span>
            <span className="font-mono font-bold text-cyan-400">{Math.round(resolutionScale * 100)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[0.5, 0.75, 1.0].map((scale) => (
              <button
                key={scale}
                onClick={() => onSetResolutionScale(scale)}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  resolutionScale === scale
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {Math.round(scale * 100)}% {scale === 0.75 ? '(Cân bằng)' : scale === 0.5 ? '(Tiết kiệm)' : '(Sắc nét)'}
              </button>
            ))}
          </div>
        </div>

        {/* Vision AI Mode Switch */}
        <div>
          <div className="text-xs text-slate-300 mb-1.5">Bộ xử lý Nhận diện (Vision AI):</div>
          <div className="flex flex-col gap-1">
            {[
              { id: 'mediapipe', label: 'MediaPipe HandLandmarker', desc: 'Nhận dạng bàn tay 21 điểm (WASM/GPU)' },
              { id: 'motion', label: 'Motion & Quang phổ Centroid', desc: 'Siêu nhẹ (~1ms), chạy offline không tải model' },
              { id: 'simulation', label: 'Giả lập AI Tracker', desc: 'Không cần camera, tự động chuyển động mượt' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSetVisionMode(item.id as VisionDetectorMode)}
                className={`p-2 text-left rounded-xl border text-xs transition-all ${
                  visionMode === item.id
                    ? 'bg-purple-500/20 border-purple-500/80 text-purple-200'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="font-semibold text-white">{item.label}</div>
                <div className="text-[10px] text-slate-400">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Battery Saver Mode */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-white">Chế độ Tiết kiệm Pin</div>
              <div className="text-[10px] text-slate-400">Giảm hiệu ứng hạt & tải nhiệt thiết bị</div>
            </div>
          </div>
          <button
            onClick={onToggleBatterySaver}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              batterySaver ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                batterySaver ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Canvas đã khóa DPR tối đa 2.0 để tránh quá nhiệt trên màn hình OLED Retina.</span>
      </div>
    </div>
  );
};
