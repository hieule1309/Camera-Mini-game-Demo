import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CameraView } from './components/CameraView';
import { PixiGameCanvas } from './components/PixiGameCanvas';
import { HUD } from './components/HUD';
import { PerformanceOverlay } from './components/PerformanceOverlay';
import { NetworkBanner } from './components/NetworkBanner';
import { SettingsModal } from './components/SettingsModal';
import { useCamera } from './hooks/useCamera';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { GameEngine } from './game/GameEngine';
import { GameConfig, PerformanceStats } from './types/game';
import { syncService } from './services/syncService';
import { visionDetector, VisionDetectorMode } from './services/visionDetector';

export const App: React.FC = () => {
  // Camera feed hook
  const {
    videoRef,
    permissionState,
    errorMessage,
    facingMode,
    hasTorch,
    isTorchOn,
    toggleFacingMode,
    toggleTorch,
    requestCamera,
    stopCamera,
  } = useCamera();
  const [isVrMode, setIsVrMode] = useState(true);

  const toggleVrMode = useCallback(() => {
    if (isVrMode) {
      stopCamera();
      setIsVrMode(false);
    } else {
      setIsVrMode(true);
      void requestCamera().then((started) => {
        if (!started) setIsVrMode(false);
      });
    }
  }, [isVrMode, requestCamera, stopCamera]);

  // Network & Versioned Config & State Sync
  const {
    isOnline,
    syncStatus,
    syncQueue,
    configResult,
    retrySync,
    retryConfig,
  } = useNetworkStatus();

  // Dynamic game configuration
  const [gameConfig, setGameConfig] = useState<GameConfig>(configResult.config);

  // Sync config when remote config finishes loading
  useEffect(() => {
    setGameConfig(configResult.config);
  }, [configResult.config]);

  // Game Engine instance ref
  const engineRef = useRef<GameEngine | null>(null);

  // Gameplay state
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [targetsHit, setTargetsHit] = useState(0);
  const [highScore, setHighScore] = useState(syncService.getHighScore());
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);

  // Performance telemetry
  const [perfStats, setPerfStats] = useState<PerformanceStats>({
    fps: 60,
    renderTimeMs: 16,
    inferenceTimeMs: 0,
    droppedFrames: 0,
    resolutionScale: 1.0,
    targetCount: 0,
    particleCount: 0,
  });

  // Mobile optimization settings
  const [resolutionScale, setResolutionScale] = useState(() =>
    window.matchMedia('(max-width: 768px)').matches ? 0.75 : 1.0
  );
  const [batterySaver, setBatterySaver] = useState(false);
  const [visionMode, setVisionMode] = useState<VisionDetectorMode>(() =>
    window.matchMedia('(max-width: 768px)').matches ? 'motion' : 'mediapipe'
  );

  useEffect(() => {
    visionDetector.setMode(visionMode);
  }, [visionMode]);

  // UI Modals
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Callback from GameEngine
  const handleScoreUpdate = useCallback((newScore: number, newCombo: number, hitCount: number) => {
    setScore(newScore);
    setCombo(newCombo);
    setTargetsHit(hitCount);

    if (newScore > highScore) {
      setHighScore(newScore);
    }
  }, [highScore]);

  // Periodic score save to sync queue
  useEffect(() => {
    if (score > 0 && targetsHit > 0 && targetsHit % 5 === 0) {
      syncService.saveScore(score, targetsHit);
    }
  }, [targetsHit, score]);

  const handleStatsUpdate = useCallback((stats: PerformanceStats) => {
    setPerfStats(stats);
  }, []);

  const handleInterrupted = useCallback((reason: string) => {
    setIsPaused(true);
    setPauseReason(reason);
  }, []);

  const handleResumed = useCallback(() => {
    setIsPaused(false);
    setPauseReason(null);
  }, []);

  const togglePause = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  }, []);

  const resetGame = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetGame();
    }
    setScore(0);
    setCombo(0);
    setTargetsHit(0);
    setIsPaused(false);
    setPauseReason(null);
  }, []);

  const handleToggleBatterySaver = useCallback(() => {
    setBatterySaver((prev) => {
      const next = !prev;
      setGameConfig((cfg) => ({
        ...cfg,
        visuals: {
          ...cfg.visuals,
          particleCount: next ? 8 : 24,
        },
        gameplay: {
          ...cfg.gameplay,
          maxActiveTargets: next ? 4 : 6,
        },
      }));
      if (next) {
        setResolutionScale(0.75);
      } else {
        setResolutionScale(1.0);
      }
      return next;
    });
  }, []);

  const handleSetVisionMode = useCallback((mode: VisionDetectorMode) => {
    setVisionMode(mode);
  }, []);

  return (
    <main className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Camera Feed Layer */}
      <CameraView
        videoRef={videoRef}
        permissionState={permissionState}
        errorMessage={errorMessage}
        isVrMode={isVrMode}
        facingMode={facingMode}
        onRequestPermission={requestCamera}
      />

      {/* 2. PixiJS Canvas Layer */}
      <PixiGameCanvas
        config={gameConfig}
        videoRef={videoRef}
        facingMode={facingMode}
        isCameraActive={isVrMode && permissionState === 'granted'}
        onScoreUpdate={handleScoreUpdate}
        onStatsUpdate={handleStatsUpdate}
        onInterrupted={handleInterrupted}
        onResumed={handleResumed}
        resolutionScale={resolutionScale}
        engineRef={engineRef}
      />

      {/* 3. Top Network & Versioned Config Banner */}
      <NetworkBanner
        isOnline={isOnline}
        syncStatus={syncStatus}
        syncQueue={syncQueue}
        configResult={configResult}
        onRetrySync={retrySync}
        onRetryConfig={retryConfig}
      />

      {/* 4. Heads-Up Display (HUD) */}
      <HUD
        score={score}
        combo={combo}
        highScore={highScore}
        targetsHit={targetsHit}
        isPaused={isPaused}
        isVrMode={isVrMode}
        pauseReason={pauseReason}
        hasTorch={hasTorch}
        isTorchOn={isTorchOn}
        facingMode={facingMode}
        visionMode={visionMode}
        onTogglePause={togglePause}
        onToggleVrMode={toggleVrMode}
        onResetGame={resetGame}
        onToggleFacing={toggleFacingMode}
        onToggleTorch={toggleTorch}
        onToggleSettings={() => setShowSettings((s) => !s)}
        onTogglePerfOverlay={() => setShowPerfOverlay((p) => !p)}
      />

      {/* 5. Performance & Mobile Telemetry Overlay */}
      {showPerfOverlay && (
        <PerformanceOverlay
          stats={perfStats}
          resolutionScale={resolutionScale}
          batterySaver={batterySaver}
          visionMode={visionMode}
          onClose={() => setShowPerfOverlay(false)}
          onSetResolutionScale={setResolutionScale}
          onToggleBatterySaver={handleToggleBatterySaver}
          onSetVisionMode={handleSetVisionMode}
        />
      )}

      {/* 6. Settings Modal */}
      {showSettings && (
        <SettingsModal
          config={gameConfig}
          onClose={() => setShowSettings(false)}
          onUpdateConfig={setGameConfig}
        />
      )}
    </main>
  );
};
export default App;
