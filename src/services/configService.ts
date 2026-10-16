import { GameConfig } from '../types/game';
import { DEFAULT_GAME_CONFIG } from '../config/defaultConfig';

const STORAGE_KEY_CONFIG = 'camera_game_config_v1';
const CONFIG_URL = '/game-config.json';

export type ConfigLoadStatus = 'idle' | 'loading' | 'retrying' | 'success' | 'fallback';

export interface ConfigLoadResult {
  config: GameConfig;
  status: ConfigLoadStatus;
  source: 'remote' | 'cache' | 'default';
  version: string;
  error?: string;
  attempts: number;
}

class ConfigService {
  private currentConfig: GameConfig = DEFAULT_GAME_CONFIG;
  private listeners: Set<(result: ConfigLoadResult) => void> = new Set();
  private lastResult: ConfigLoadResult = {
    config: DEFAULT_GAME_CONFIG,
    status: 'idle',
    source: 'default',
    version: DEFAULT_GAME_CONFIG.version,
    attempts: 0,
  };

  constructor() {
    this.loadFromCache();
  }

  public getConfig(): GameConfig {
    return this.currentConfig;
  }

  public getLastResult(): ConfigLoadResult {
    return this.lastResult;
  }

  public subscribe(callback: (result: ConfigLoadResult) => void): () => void {
    this.listeners.add(callback);
    callback(this.lastResult);
    return () => this.listeners.delete(callback);
  }

  private notify(result: ConfigLoadResult) {
    this.lastResult = result;
    this.currentConfig = result.config;
    for (const listener of this.listeners) {
      listener(result);
    }
  }

  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (cached) {
        const parsed = JSON.parse(cached) as GameConfig;
        if (parsed && parsed.version) {
          this.currentConfig = parsed;
          this.lastResult = {
            config: parsed,
            status: 'fallback',
            source: 'cache',
            version: parsed.version,
            attempts: 0,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load config from cache:', e);
    }
  }

  public async fetchVersionedConfig(maxRetries: number = 3): Promise<ConfigLoadResult> {
    let attempt = 0;
    let delay = 800; // base delay in ms

    while (attempt <= maxRetries) {
      attempt++;
      try {
        this.notify({
          ...this.lastResult,
          status: attempt > 1 ? 'retrying' : 'loading',
          attempts: attempt,
        });

        // Add cache busting param to verify version freshness
        const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
          cache: 'no-cache',
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const remoteConfig = (await response.json()) as GameConfig;

        if (!remoteConfig || !remoteConfig.version) {
          throw new Error('Invalid config schema: missing version');
        }

        // Cache remote config
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(remoteConfig));

        const successResult: ConfigLoadResult = {
          config: remoteConfig,
          status: 'success',
          source: 'remote',
          version: remoteConfig.version,
          attempts: attempt,
        };
        this.notify(successResult);
        return successResult;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[ConfigService] Attempt ${attempt} failed:`, errorMsg);

        if (attempt <= maxRetries) {
          // Exponential backoff with jitter
          const jitter = Math.random() * 200;
          await new Promise((res) => setTimeout(res, delay + jitter));
          delay *= 1.8;
        } else {
          // Final fallback
          const fallbackResult: ConfigLoadResult = {
            config: this.currentConfig,
            status: 'fallback',
            source: this.lastResult.source === 'cache' ? 'cache' : 'default',
            version: this.currentConfig.version,
            error: errorMsg,
            attempts: attempt,
          };
          this.notify(fallbackResult);
          return fallbackResult;
        }
      }
    }

    return this.lastResult;
  }
}

export const configService = new ConfigService();
