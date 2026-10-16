import { SyncRecord } from '../types/game';

const STORAGE_KEY_QUEUE = 'camera_game_sync_queue_v1';
const STORAGE_KEY_HIGH_SCORE = 'camera_game_high_score_v1';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline_queued' | 'error';

class SyncService {
  private queue: SyncRecord[] = [];
  private listeners: Set<(queue: SyncRecord[], status: SyncStatus) => void> = new Set();
  private status: SyncStatus = 'idle';
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    // Listen to network status changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncService] Device is back online. Flushing sync queue...');
        this.processQueue();
      });
    }
  }

  public getHighScore(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  public saveScore(score: number, targetsHit: number): void {
    const currentHigh = this.getHighScore();
    const newHigh = Math.max(currentHigh, score);
    try {
      localStorage.setItem(STORAGE_KEY_HIGH_SCORE, newHigh.toString());
    } catch (e) {
      console.warn('Failed to save high score to localStorage:', e);
    }

    const record: SyncRecord = {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      score,
      highScore: newHigh,
      targetsHit,
      status: 'pending',
      attempts: 0,
    };

    this.queue.push(record);
    this.saveQueue();
    this.notify();

    if (navigator.onLine) {
      this.processQueue();
    } else {
      this.status = 'offline_queued';
      this.notify();
    }
  }

  public subscribe(callback: (queue: SyncRecord[], status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.queue, this.status);
    return () => this.listeners.delete(callback);
  }

  public async retrySync(): Promise<void> {
    await this.processQueue();
  }

  public clearSynced(): void {
    this.queue = this.queue.filter((r) => r.status !== 'synced');
    this.saveQueue();
    this.notify();
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse sync queue:', e);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Failed to save sync queue:', e);
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener([...this.queue], this.status);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;

    const pending = this.queue.filter((item) => item.status === 'pending' || item.status === 'failed');
    if (pending.length === 0) {
      this.status = 'synced';
      this.notify();
      return;
    }

    this.isProcessing = true;
    this.status = 'syncing';
    this.notify();

    for (const record of pending) {
      record.attempts++;
      try {
        // Simulated mock sync endpoint with simulated server delay
        await this.mockApiSync(record);
        record.status = 'synced';
        this.saveQueue();
        this.notify();
      } catch (e) {
        console.warn(`[SyncService] Failed to sync record ${record.id}:`, e);
        record.status = 'failed';
        this.saveQueue();
        this.status = 'error';
        this.notify();
        break;
      }
    }

    this.isProcessing = false;
    const remaining = this.queue.filter((r) => r.status === 'pending' || r.status === 'failed');
    this.status = remaining.length === 0 ? 'synced' : 'error';
    this.notify();
  }

  private mockApiSync(record: SyncRecord): Promise<boolean> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!navigator.onLine) {
          reject(new Error(`Network offline during sync for record ${record.id}`));
          return;
        }
        // Successfully synced
        resolve(true);
      }, 500);
    });
  }
}

export const syncService = new SyncService();
