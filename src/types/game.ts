export interface GameConfig {
  version: string;
  updatedAt: string;
  gameplay: {
    spawnIntervalMs: number;
    targetSpeed: number;
    maxActiveTargets: number;
    targetBaseScore: number;
    comboMultiplier: number;
    bonusGoldenChance: number;
  };
  visuals: {
    particleCount: number;
    shakeIntensity: number;
    trailLength: number;
  };
  features: {
    handTrackingEnabled: boolean;
    batterySaverMode: boolean;
    offlineSyncEnabled: boolean;
  };
}

export type CameraPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable' | 'checking';

export interface PerformanceStats {
  fps: number;
  renderTimeMs: number;
  inferenceTimeMs: number;
  droppedFrames: number;
  memoryMb?: number;
  resolutionScale: number;
  targetCount: number;
  particleCount: number;
}

export interface VisionDetectionResult {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  isTracking: boolean;
  confidence: number;
  label?: string;
  gesture?: 'open_palm' | 'pinch' | 'pointing' | 'none';
}

export interface SyncRecord {
  id: string;
  timestamp: number;
  score: number;
  highScore: number;
  targetsHit: number;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
}
