import React, { useState } from 'react';
import { Camera, CameraOff, Video, Hand, Sparkles, Smartphone } from 'lucide-react';
import { CameraPermissionState } from '../types/game';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  permissionState: CameraPermissionState;
  errorMessage: string | null;
  isVrMode: boolean;
  facingMode: 'user' | 'environment';
  onRequestPermission: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  permissionState,
  errorMessage,
  isVrMode,
  facingMode,
  onRequestPermission,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const isMirrored = facingMode === 'user';

  return (
    <>
      {/* 1. Background Video Layer - Rendered at z-0 directly beneath transparent canvas (z-10) */}
      <div className={`absolute inset-0 w-full h-full overflow-hidden z-0 select-none pointer-events-none ${isVrMode ? '' : 'hidden'}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isMirrored ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* Cyberpunk HUD Grid Overlay for AR Vibe */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.7) 100%), linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 32px 32px, 32px 32px',
          }}
        />
      </div>

      {/* 2. Camera Permission & Onboarding Modal - Rendered at z-30 ABOVE the canvas */}
      {permissionState !== 'granted' && !isDismissed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md p-5 text-center select-none pointer-events-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Glowing Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
              {permissionState === 'denied' ? (
                <CameraOff className="w-8 h-8 text-rose-400" />
              ) : (
                <Video className="w-8 h-8 text-cyan-400 animate-pulse" />
              )}
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              {permissionState === 'denied'
                ? 'Camera Đang Bị Chặn'
                : 'Bật Camera & Trải Nghiệm AR'}
            </h2>

            {/* Explanation of what the camera does */}
            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-2.5 text-slate-300">
              <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Tính năng Camera dùng để làm gì?
              </div>
              <div className="flex items-start gap-2">
                <Hand className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Điều khiển bằng Bàn tay:</strong> Giơ ngón tay trước camera, AI sẽ tự động theo dõi để hứng mục tiêu không cần chạm màn hình!
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Thực tế tăng cường (AR):</strong> Các quả cầu, hiệu ứng nổ và sao sáng sẽ bay lượn ngay trên không gian thực của bạn.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2.5">
              <button
                onClick={onRequestPermission}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Camera className="w-5 h-5" />
                {permissionState === 'denied' ? 'Cấp quyền lại trong Cài đặt' : 'Bật Camera & Bắt đầu'}
              </button>

              <button
                onClick={() => setIsDismissed(true)}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl text-xs font-medium transition-colors"
              >
                Chơi không cần Camera (Chạm vuốt Touch)
              </button>
            </div>

            {errorMessage && (
              <p role="alert" className="text-xs text-rose-300 mt-4 leading-relaxed">
                {errorMessage}
              </p>
            )}

            {permissionState === 'denied' && (
              <p className="text-[11px] text-amber-400/90 mt-4 leading-relaxed">
                👉 Nhấp vào biểu tượng <strong>Cài đặt / Ổ khóa</strong> trên thanh địa chỉ trình duyệt, chọn <strong>Cho phép Camera</strong> rồi tải lại trang.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};
