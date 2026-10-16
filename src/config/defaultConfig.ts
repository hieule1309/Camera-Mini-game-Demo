import { GameConfig } from '../types/game';

export const DEFAULT_GAME_CONFIG: GameConfig = {
  version: '1.0.0-fallback',
  updatedAt: '2026-10-16T00:00:00Z',
  gameplay: {
    spawnIntervalMs: 1400,
    targetSpeed: 2.5,
    maxActiveTargets: 5,
    targetBaseScore: 100,
    comboMultiplier: 1.2,
    bonusGoldenChance: 0.15,
  },
  visuals: {
    particleCount: 20,
    shakeIntensity: 6,
    trailLength: 8,
  },
  features: {
    handTrackingEnabled: true,
    batterySaverMode: false,
    offlineSyncEnabled: true,
  },
};
