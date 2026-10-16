import React from 'react';
import { RefreshCw, CheckCircle2, CloudUpload, FileText } from 'lucide-react';
import { SyncStatus } from '../services/syncService';
import { ConfigLoadResult } from '../services/configService';
import { SyncRecord } from '../types/game';

interface NetworkBannerProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncQueue: SyncRecord[];
  configResult: ConfigLoadResult;
  onRetrySync: () => void;
  onRetryConfig: () => void;
}

export const NetworkBanner: React.FC<NetworkBannerProps> = ({
  isOnline,
  syncStatus,
  syncQueue,
  configResult,
  onRetrySync,
  onRetryConfig,
}) => {
  const pendingRecords = syncQueue.filter((r) => r.status === 'pending' || r.status === 'failed');

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none max-w-[92vw]">
      {/* Network & Config Pill */}
      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1 shadow-lg pointer-events-auto text-xs">
        {/* Online/Offline indicator */}
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Mất mạng
            </span>
          )}
        </div>

        <span className="w-1 h-3 bg-slate-700 rounded-full" />

        {/* Config Version */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span>Config: <strong className="text-white font-mono">{configResult.version}</strong></span>
          <span className="text-[10px] text-slate-400">
            ({configResult.source === 'remote' ? 'Máy chủ' : configResult.source === 'cache' ? 'Cache' : 'Dự phòng'})
          </span>

          {configResult.status === 'retrying' || configResult.status === 'loading' ? (
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
          ) : configResult.status === 'fallback' ? (
            <button
              onClick={onRetryConfig}
              className="p-1 hover:bg-slate-800 rounded text-amber-400 transition-colors"
              title="Thử tải lại Config từ máy chủ"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          )}
        </div>
      </div>

      {/* Sync Queue Outbox Notification when offline items exist */}
      {pendingRecords.length > 0 && (
        <div className="flex items-center gap-2 bg-slate-950/95 border border-amber-500/50 rounded-xl px-3 py-1.5 shadow-xl text-xs text-amber-200 pointer-events-auto animate-in slide-in-from-top-1">
          <CloudUpload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {pendingRecords.length} phiên điểm đang chờ đồng bộ {isOnline ? '...' : '(ngoại tuyến)'}
          </span>
          <button
            onClick={onRetrySync}
            disabled={!isOnline || syncStatus === 'syncing'}
            className="ml-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-semibold disabled:opacity-40 transition-all flex items-center gap-1"
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              'Đồng bộ ngay'
            )}
          </button>
        </div>
      )}
    </div>
  );
};
