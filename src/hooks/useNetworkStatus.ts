import { useState, useEffect, useCallback } from 'react';
import { syncService, SyncStatus } from '../services/syncService';
import { configService, ConfigLoadResult } from '../services/configService';
import { SyncRecord } from '../types/game';

export interface UseNetworkStatusReturn {
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncQueue: SyncRecord[];
  configResult: ConfigLoadResult;
  retrySync: () => Promise<void>;
  retryConfig: () => Promise<void>;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncQueue, setSyncQueue] = useState<SyncRecord[]>([]);
  const [configResult, setConfigResult] = useState<ConfigLoadResult>(configService.getLastResult());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubSync = syncService.subscribe((queue, status) => {
      setSyncQueue(queue);
      setSyncStatus(status);
    });

    const unsubConfig = configService.subscribe((res) => {
      setConfigResult(res);
    });

    // Initial config load
    configService.fetchVersionedConfig();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
      unsubConfig();
    };
  }, []);

  const retrySync = useCallback(async () => {
    await syncService.retrySync();
  }, []);

  const retryConfig = useCallback(async () => {
    await configService.fetchVersionedConfig();
  }, []);

  return {
    isOnline,
    syncStatus,
    syncQueue,
    configResult,
    retrySync,
    retryConfig,
  };
}
