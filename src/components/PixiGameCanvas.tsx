import React, { useEffect, useRef } from 'react';
import type { GameEngine } from '../game/GameEngine';
import { GameConfig, PerformanceStats } from '../types/game';
import { visionDetector } from '../services/visionDetector';

interface PixiGameCanvasProps {
  config: GameConfig;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facingMode: 'user' | 'environment';
  isCameraActive: boolean;
  onScoreUpdate: (score: number, combo: number, targetsHit: number) => void;
  onStatsUpdate: (stats: PerformanceStats) => void;
  onInterrupted: (reason: string) => void;
  onResumed: () => void;
  resolutionScale: number;
  engineRef?: React.MutableRefObject<GameEngine | null>;
}

export const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({
  config,
  videoRef,
  facingMode,
  isCameraActive,
  onScoreUpdate,
  onStatsUpdate,
  onInterrupted,
  onResumed,
  resolutionScale,
  engineRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const internalEngineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize GameEngine
  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let engine: GameEngine | null = null;
    void import('../game/GameEngine')
      .then(async ({ GameEngine: Engine }) => {
        if (!isMounted || !containerRef.current) return;
        engine = new Engine(containerRef.current, config, {
          onScoreUpdate,
          onStatsUpdate,
          onInterrupted,
          onResumed,
        });
        await engine.init();
        if (!isMounted) return;
        internalEngineRef.current = engine;
        if (engineRef) engineRef.current = engine;
        engine.setResolutionScale(resolutionScale);
      })
      .catch((error: unknown) => {
        console.error('Failed to load game renderer:', error);
      });

    return () => {
      isMounted = false;
      engine?.destroy();
      internalEngineRef.current = null;
      if (engineRef) {
        engineRef.current = null;
      }
    };
  }, []);

  // Update Config when changed
  useEffect(() => {
    if (internalEngineRef.current) {
      internalEngineRef.current.updateConfig(config);
    }
  }, [config]);

  // Update Resolution Scale
  useEffect(() => {
    if (internalEngineRef.current) {
      internalEngineRef.current.setResolutionScale(resolutionScale);
    }
  }, [resolutionScale]);

  // Vision AI Detection Loop
  useEffect(() => {
    let active = true;
    let lastVisionTime = 0;
    let lastVideoTime = -1;
    const isMirrored = facingMode === 'user';

    const runVisionLoop = () => {
      if (!active) return;

      const video = videoRef.current;
      const now = performance.now();
      // Run camera inference at up to 24 FPS; Pixi still renders independently at display FPS.
      if (
        isCameraActive && video && video.readyState >= 2 &&
        video.currentTime !== lastVideoTime && now - lastVisionTime >= 1000 / 60
      ) {
        try {
          const { result, latencyMs } = visionDetector.detect(video, isMirrored);
          if (internalEngineRef.current) {
            internalEngineRef.current.setVisionDetection(result, latencyMs);
          }
          lastVisionTime = now;
          lastVideoTime = video.currentTime;
        } catch (e) {
          console.warn('Vision frame error:', e);
        }
      }

      animFrameRef.current = requestAnimationFrame(runVisionLoop);
    };

    animFrameRef.current = requestAnimationFrame(runVisionLoop);

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isCameraActive, facingMode, videoRef]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full touch-none select-none z-10 pointer-events-auto overflow-hidden"
      style={{ touchAction: 'none', background: 'transparent' }}
    />
  );
};
