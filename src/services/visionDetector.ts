import { VisionDetectionResult } from '../types/game';

export type VisionDetectorMode = 'mediapipe' | 'motion' | 'simulation';

export interface VisionDetectorStatus {
  mode: VisionDetectorMode;
  isReady: boolean;
  isLoading: boolean;
  modelName: string;
  error?: string;
}

// Low-pass exponential moving average (EMA) filter to prevent jitter on mobile
class CoordinateSmoother {
  private alpha: number;
  private currentX: number | null = null;
  private currentY: number | null = null;

  constructor(alpha: number = 0.35) {
    this.alpha = alpha;
  }

  public update(targetX: number, targetY: number): { x: number; y: number } {
    if (this.currentX === null || this.currentY === null) {
      this.currentX = targetX;
      this.currentY = targetY;
    } else {
      this.currentX = this.currentX + this.alpha * (targetX - this.currentX);
      this.currentY = this.currentY + this.alpha * (targetY - this.currentY);
    }
    return { x: this.currentX, y: this.currentY };
  }

  public reset(): void {
    this.currentX = null;
    this.currentY = null;
  }
}

export class VisionDetector {
  private mode: VisionDetectorMode = 'motion';
  private handLandmarker: unknown = null;
  private isLoading = false;
  private isReady = true;
  private smoother = new CoordinateSmoother(0.4);
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private simAngle = 0;
  private lastInferenceTimeMs = 0;
  private statusListeners: Set<(status: VisionDetectorStatus) => void> = new Set();
  private lastError: string | undefined = undefined;
  private mediapipeInitAttempted = false;

  constructor() {
    if (typeof document !== 'undefined') {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = 160;
      this.sampleCanvas.height = 120;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public getStatus(): VisionDetectorStatus {
    return {
      mode: this.mode,
      isReady: this.isReady,
      isLoading: this.isLoading,
      modelName:
        this.mode === 'mediapipe'
          ? 'MediaPipe HandLandmarker v0.10'
          : this.mode === 'motion'
            ? 'Realtime Motion & Cử chỉ Bàn tay'
            : 'Interactive Virtual Tracking',
      error: this.lastError,
    };
  }

  public subscribeStatus(cb: (status: VisionDetectorStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatus());
    return () => this.statusListeners.delete(cb);
  }

  private notifyStatus(): void {
    const s = this.getStatus();
    for (const cb of this.statusListeners) cb(s);
  }

  public setMode(mode: VisionDetectorMode): void {
    this.mode = mode;
    this.smoother.reset();
    if (mode === 'mediapipe' && !this.handLandmarker && !this.isLoading) {
      this.initMediaPipe();
    } else {
      this.isReady = true;
      this.notifyStatus();
    }
  }

  public tryUpgradeToMediaPipe(): void {
    if (this.handLandmarker || this.isLoading || this.mediapipeInitAttempted) return;
    this.mediapipeInitAttempted = true;
    this.initMediaPipe().then((ok) => {
      if (ok) {
        this.mode = 'mediapipe';
        this.notifyStatus();
      }
    });
  }

  public async initMediaPipe(): Promise<boolean> {
    if (this.mode === 'mediapipe' && this.handLandmarker) {
      this.isReady = true;
      this.notifyStatus();
      return true;
    }

    this.isLoading = true;
    this.lastError = undefined;
    this.notifyStatus();

    try {
      const vision = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, HandLandmarker } = vision;

      const wasmFileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isReady = true;
      this.isLoading = false;
      this.mode = 'mediapipe';
      this.notifyStatus();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[VisionDetector] MediaPipe init failed, staying in motion tracking mode:', msg);
      this.lastError = 'MediaPipe đang tải hoặc ngoại tuyến. Đang dùng Motion Tracker.';
      this.isLoading = false;
      this.mode = 'motion';
      this.isReady = true;
      this.notifyStatus();
      return false;
    }
  }

  public detect(video: HTMLVideoElement, isMirrored: boolean = true): { result: VisionDetectionResult; latencyMs: number } {
    const startTime = performance.now();

    // 1. Explicit Simulation Mode (Only when user explicitly selected simulation)
    if (this.mode === 'simulation') {
      this.simAngle += 0.03;
      const simX = 0.5 + Math.cos(this.simAngle) * 0.25;
      const simY = 0.5 + Math.sin(this.simAngle * 1.5) * 0.2;
      const smoothed = this.smoother.update(simX, simY);
      const latencyMs = performance.now() - startTime;
      this.lastInferenceTimeMs = latencyMs;

      return {
        result: {
          x: smoothed.x,
          y: smoothed.y,
          isTracking: true,
          confidence: 0.8,
          label: 'Giả lập AI Tracker',
          gesture: 'open_palm',
        },
        latencyMs,
      };
    }

    // Camera not yet ready
    if (!video || video.readyState < 2) {
      return {
        result: {
          x: 0.5,
          y: 0.5,
          isTracking: false,
          confidence: 0,
          label: 'Đang kết nối camera...',
        },
        latencyMs: 0,
      };
    }

    // 2. Try MediaPipe if model loaded
    if (this.handLandmarker) {
      try {
        const hl = this.handLandmarker as {
          detectForVideo: (
            v: HTMLVideoElement,
            timestamp: number
          ) => {
            landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
          };
        };

        const results = hl.detectForVideo(video, performance.now());
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          const indexFinger = landmarks[8] || landmarks[0];

          let targetX = indexFinger.x;
          if (isMirrored) {
            targetX = 1 - targetX;
          }
          const targetY = indexFinger.y;

          const smoothed = this.smoother.update(targetX, targetY);
          const latencyMs = performance.now() - startTime;
          this.lastInferenceTimeMs = latencyMs;

          return {
            result: {
              x: smoothed.x,
              y: smoothed.y,
              isTracking: true,
              confidence: 0.95,
              label: 'Bàn tay (MediaPipe)',
              gesture: 'pointing',
            },
            latencyMs,
          };
        }
        // In MediaPipe mode, don't let the fallback motion detector pull the
        // pointer toward a moving face when no hand was found in this frame.
        const latencyMs = performance.now() - startTime;
        this.lastInferenceTimeMs = latencyMs;
        return {
          result: {
            x: 0.5,
            y: 0.5,
            isTracking: false,
            confidence: 0,
            label: 'Không phát hiện bàn tay',
          },
          latencyMs,
        };
      } catch (err) {
        console.warn('MediaPipe frame error:', err);
        // A MediaPipe frame error should not switch to unrestricted motion
        // tracking, which can mistake face movement for a hand.
        return {
          result: {
            x: 0.5,
            y: 0.5,
            isTracking: false,
            confidence: 0,
            label: 'Lỗi nhận diện bàn tay',
          },
          latencyMs: performance.now() - startTime,
        };
      }
    }

    // 3. Fast Optical Motion & Skin-tone Tracking (~1ms)
    if (this.sampleCanvas && this.sampleCtx) {
      const res = this.detectMotionOrSkin(video, isMirrored);
      const latencyMs = performance.now() - startTime;
      this.lastInferenceTimeMs = latencyMs;
      return { result: res, latencyMs };
    }

    // If no detection, DO NOT simulate movement - stay still
    return {
      result: {
        x: 0.5,
        y: 0.5,
        isTracking: false,
        confidence: 0,
        label: 'Không phát hiện bàn tay',
      },
      latencyMs: performance.now() - startTime,
    };
  }

  private detectMotionOrSkin(video: HTMLVideoElement, isMirrored: boolean): VisionDetectionResult {
    if (!this.sampleCtx || !this.sampleCanvas) {
      return { x: 0.5, y: 0.5, isTracking: false, confidence: 0 };
    }

    const w = this.sampleCanvas.width;
    const h = this.sampleCanvas.height;

    this.sampleCtx.drawImage(video, 0, 0, w, h);
    const imgData = this.sampleCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    const prev = this.prevFrameData;
    const currentFrame = new Uint8ClampedArray(data.length);
    currentFrame.set(data);
    this.prevFrameData = currentFrame;

    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        // Ignore the usual face area (upper, central part of the image).
        // This lightweight motion mode has no face model, so this ROI mask
        // prevents face pixels from dominating the hand centroid.
        const nx = x / w;
        const ny = y / h;
        if (ny < 0.55 && nx > 0.18 && nx < 0.82) continue;

        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Frame difference (moving object / waving hand)
        let isMoving = false;
        if (prev) {
          const pr = prev[idx];
          const pg = prev[idx + 1];
          const pb = prev[idx + 2];
          const diff = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
          if (diff > 40) {
            isMoving = true;
          }
        }

        // Skin-tone detection
        const isSkin = r > 65 && g > 40 && b > 20 && r > g && r > b && (r - g) > 10;

        if (isMoving || isSkin) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    // Require enough pixels to avoid noise
    if (count > 25) {
      let rawX = (sumX / count) / w;
      if (isMirrored) {
        rawX = 1 - rawX;
      }
      const rawY = (sumY / count) / h;
      const smoothed = this.smoother.update(rawX, rawY);

      return {
        x: smoothed.x,
        y: smoothed.y,
        isTracking: true,
        confidence: Math.min(count / 150, 1),
        label: 'Cử chỉ Bàn tay (Motion/Skin)',
        gesture: 'pointing',
      };
    }

    return {
      x: 0.5,
      y: 0.5,
      isTracking: false,
      confidence: 0,
      label: 'Đang chờ cử chỉ...',
    };
  }

  public getLastInferenceTimeMs(): number {
    return this.lastInferenceTimeMs;
  }
}

export const visionDetector = new VisionDetector();
