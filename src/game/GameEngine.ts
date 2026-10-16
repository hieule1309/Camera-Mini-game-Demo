import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GameConfig, PerformanceStats, VisionDetectionResult } from '../types/game';

interface TargetItem {
  id: number;
  graphics: Graphics;
  type: 'orb' | 'star' | 'hazard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  pulsePhase: number;
  points: number;
  color: number;
  isHit: boolean;
}

interface Particle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  size: number;
  color: number;
}

interface FloatingScore {
  text: Text;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  lifetime: number;
}

interface Shockwave {
  graphics: Graphics;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: number;
}

export interface GameEngineEvents {
  onScoreUpdate: (score: number, combo: number, targetsHit: number) => void;
  onStatsUpdate: (stats: PerformanceStats) => void;
  onInterrupted: (reason: string) => void;
  onResumed: () => void;
}

export class GameEngine {
  private app: Application | null = null;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private config: GameConfig;
  private events: GameEngineEvents;

  // Scene Containers
  private backgroundLayer = new Container();
  private effectsLayer = new Container();
  private targetsLayer = new Container();
  private playerLayer = new Container();
  private uiLayer = new Container();

  // Player Character / Reticle
  private playerGraphics = new Graphics();
  private playerAura = new Graphics();
  private playerX = 0;
  private playerY = 0;
  private targetPlayerX = 0;
  private targetPlayerY = 0;
  private isDragging = false;
  private activePointerId: number | null = null;
  private isAiControlled = false;

  // Entities
  private targets: TargetItem[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingScores: FloatingScore[] = [];

  // Gameplay State
  private score = 0;
  private combo = 0;
  private comboTimer = 0;
  private targetsHit = 0;
  private isPaused = false;
  private isDestroyed = false;
  private lastSpawnTime = 0;
  private nextTargetId = 1;

  // Shake & Screen FX
  private shakeTimer = 0;
  private shakeIntensity = 0;

  // Telemetry & FPS Counter
  private frameCount = 0;
  private lastFpsUpdateTime = performance.now();
  private currentFps = 60;
  private droppedFrames = 0;
  private resolutionScale = 1.0;
  private lastInferenceTimeMs = 0;
  private isReady = false;
  private cleanupListeners: Array<() => void> = [];

  constructor(container: HTMLElement, config: GameConfig, events: GameEngineEvents) {
    this.container = container;
    this.config = config;
    this.events = events;
  }

  public async init(): Promise<void> {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);

    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0, // Transparent for seamless camera background overlay
      resolution: dpr * this.resolutionScale,
      autoDensity: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });

    if (this.isDestroyed) {
      app.destroy(false, { children: true });
      return;
    }

    this.app = app;
    this.canvas = app.canvas;
    this.canvas.className = 'w-full h-full touch-none select-none cursor-crosshair';
    this.canvas.style.touchAction = 'none';

    // Ensure container is empty before attaching
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.isReady = true;

    // Add layers in z-order
    this.app.stage.addChild(this.backgroundLayer);
    this.app.stage.addChild(this.effectsLayer);
    this.app.stage.addChild(this.targetsLayer);
    this.app.stage.addChild(this.playerLayer);
    this.app.stage.addChild(this.uiLayer);

    // Initial player position (center bottom)
    this.playerX = window.innerWidth / 2;
    this.playerY = window.innerHeight * 0.7;
    this.targetPlayerX = this.playerX;
    this.targetPlayerY = this.playerY;

    this.playerLayer.addChild(this.playerAura);
    this.playerLayer.addChild(this.playerGraphics);

    this.setupInterruptionHandlers();
    this.setupPointerEvents();

    // Start Pixi Ticker
    this.app.ticker.add((ticker) => {
      this.gameLoop(ticker.deltaTime);
    });

    this.drawPlayer();
  }

  public get isInitialized(): boolean {
    return this.isReady && Boolean(this.app?.renderer);
  }

  public updateConfig(newConfig: GameConfig): void {
    this.config = newConfig;
  }

  public setResolutionScale(scale: number): void {
    this.resolutionScale = scale;
    if (this.app?.renderer) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
      this.app.renderer.resolution = dpr * scale;
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
    }
  }

  public setVisionDetection(result: VisionDetectionResult, latencyMs: number): void {
    this.lastInferenceTimeMs = latencyMs;
    // If not dragging manually with touch, smoothly direct player with AI detection
    if (!this.isDragging && result.isTracking) {
      if (!this.isAiControlled) {
        this.isAiControlled = true;
        this.drawPlayer();
      }
      const screenX = result.x * window.innerWidth;
      const screenY = result.y * window.innerHeight;
      this.targetPlayerX = screenX;
      this.targetPlayerY = screenY;
    }
  }

  private setupPointerEvents(): void {
    if (!this.canvas) return;
    const cvs = this.canvas;

    // Touch, pointer, drag and interrupted operations handler
    const onPointerDown = (e: PointerEvent) => {
      if (this.isPaused) {
        this.resume();
        return;
      }
      this.isDragging = true;
      if (this.isAiControlled) {
        this.isAiControlled = false;
        this.drawPlayer();
      }
      this.activePointerId = e.pointerId;
      try {
        cvs.setPointerCapture(e.pointerId);
      } catch {
        // Fallback for browsers that don't support setPointerCapture on elements
      }
      this.targetPlayerX = e.clientX;
      this.targetPlayerY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging || this.activePointerId !== e.pointerId) return;
      this.targetPlayerX = e.clientX;
      this.targetPlayerY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.activePointerId === e.pointerId) {
        this.isDragging = false;
        this.activePointerId = null;
        try {
          cvs.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      console.warn('[GameEngine] Pointer cancelled by OS / interruption:', e.pointerId);
      this.isDragging = false;
      this.activePointerId = null;
    };

    const onLostCapture = () => {
      this.isDragging = false;
      this.activePointerId = null;
    };

    cvs.addEventListener('pointerdown', onPointerDown, { passive: false });
    cvs.addEventListener('pointermove', onPointerMove, { passive: false });
    cvs.addEventListener('pointerup', onPointerUp, { passive: false });
    cvs.addEventListener('pointercancel', onPointerCancel, { passive: false });
    cvs.addEventListener('lostpointercapture', onLostCapture, { passive: false });

    this.cleanupListeners.push(() => {
      cvs.removeEventListener('pointerdown', onPointerDown);
      cvs.removeEventListener('pointermove', onPointerMove);
      cvs.removeEventListener('pointerup', onPointerUp);
      cvs.removeEventListener('pointercancel', onPointerCancel);
      cvs.removeEventListener('lostpointercapture', onLostCapture);
    });
  }

  private setupInterruptionHandlers(): void {
    // Handle phone calls, lock screen, switching app tabs
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.pause('Ứng dụng chuyển sang chế độ nền');
      }
    };

    const handleBlur = () => {
      this.isDragging = false;
      this.activePointerId = null;
    };

    const handleResize = () => {
      if (this.app?.renderer) {
        this.app.renderer.resize(window.innerWidth, window.innerHeight);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);

    this.cleanupListeners.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
    });
  }

  public pause(reason: string = 'Tạm dừng'): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.isDragging = false;
    this.activePointerId = null;
    this.events.onInterrupted(reason);
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.events.onResumed();
  }

  public togglePause(): void {
    if (this.isPaused) this.resume();
    else this.pause('Người chơi tạm dừng');
  }

  public resetGame(): void {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.targetsHit = 0;
    this.clearAllTargets();
    this.events.onScoreUpdate(0, 0, 0);
  }

  private clearAllTargets(): void {
    for (const t of this.targets) {
      this.targetsLayer.removeChild(t.graphics);
      t.graphics.destroy();
    }
    this.targets = [];
  }

  private drawPlayer(): void {
    const auraColor = this.isAiControlled ? 0xa855f7 : 0x06b6d4; // Purple for AI, Cyan for Touch
    const coreColor = 0xffffff;

    this.playerAura.clear();
    this.playerAura.circle(0, 0, 36).fill({ color: auraColor, alpha: 0.25 });
    this.playerAura.circle(0, 0, 26).stroke({ width: 2, color: auraColor, alpha: 0.8 });

    this.playerGraphics.clear();
    // Inner sci-fi reticle ring
    this.playerGraphics.circle(0, 0, 16).fill({ color: coreColor, alpha: 0.9 });
    this.playerGraphics.star(0, 0, 4, 12, 6).fill({ color: auraColor, alpha: 0.95 });
  }

  private gameLoop(delta: number): void {
    if (this.isPaused || this.isDestroyed || !this.app) return;

    const now = performance.now();
    this.frameCount++;

    // Measure FPS every 500ms
    if (now - this.lastFpsUpdateTime >= 500) {
      const elapsedSec = (now - this.lastFpsUpdateTime) / 1000;
      this.currentFps = Math.round(this.frameCount / elapsedSec);
      if (this.currentFps < 40) {
        this.droppedFrames++;
      }
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;

      // Report telemetry
      this.events.onStatsUpdate({
        fps: this.currentFps,
        renderTimeMs: Math.round(delta * 16.6),
        inferenceTimeMs: Math.round(this.lastInferenceTimeMs),
        droppedFrames: this.droppedFrames,
        resolutionScale: this.resolutionScale,
        targetCount: this.targets.length,
        particleCount: this.particles.length,
        memoryMb:
          typeof window !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
            ? Math.round(
                (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize /
                  (1024 * 1024)
              )
            : undefined,
      });
    }

    // Smooth player movement interpolation (Lerp)
    const lerpSpeed = this.isDragging ? 0.45 : 0.25;
    this.playerX += (this.targetPlayerX - this.playerX) * lerpSpeed;
    this.playerY += (this.targetPlayerY - this.playerY) * lerpSpeed;

    // Constrain player inside screen boundaries
    this.playerX = Math.max(30, Math.min(window.innerWidth - 30, this.playerX));
    this.playerY = Math.max(30, Math.min(window.innerHeight - 30, this.playerY));

    this.playerAura.x = this.playerX;
    this.playerAura.y = this.playerY;
    this.playerGraphics.x = this.playerX;
    this.playerGraphics.y = this.playerY;

    // Rotation effect
    this.playerGraphics.rotation += 0.05 * delta;
    this.playerAura.rotation -= 0.03 * delta;

    // Shake effect decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.app.stage.x = offsetX;
      this.app.stage.y = offsetY;
    } else {
      this.app.stage.x = 0;
      this.app.stage.y = 0;
    }

    // Combo Timer Decay
    if (this.comboTimer > 0) {
      this.comboTimer -= delta * 16.6;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.events.onScoreUpdate(this.score, this.combo, this.targetsHit);
      }
    }

    // Spawn Targets
    const spawnInterval = this.config.gameplay.spawnIntervalMs;
    const maxTargets = this.config.gameplay.maxActiveTargets;
    if (now - this.lastSpawnTime >= spawnInterval && this.targets.length < maxTargets) {
      this.spawnTarget();
      this.lastSpawnTime = now;
    }

    // Update Targets & Check Collisions
    this.updateTargets(delta);

    // Update Particle FX
    this.updateParticles(delta);

    // Update Shockwaves
    this.updateShockwaves(delta);

    // Update Floating Score Labels
    this.updateFloatingScores(delta);
  }

  private spawnTarget(): void {
    const isGolden = Math.random() < this.config.gameplay.bonusGoldenChance;
    const isHazard = !isGolden && Math.random() < 0.15;
    const type: 'orb' | 'star' | 'hazard' = isGolden ? 'star' : isHazard ? 'hazard' : 'orb';

    const radius = isGolden ? 24 : isHazard ? 20 : 22;
    const color = isGolden ? 0xfbbf24 : isHazard ? 0xef4444 : 0x38bdf8;
    const points = isGolden
      ? this.config.gameplay.targetBaseScore * 3
      : isHazard
        ? -50
        : this.config.gameplay.targetBaseScore;

    // Spawn from random screen edges
    const side = Math.floor(Math.random() * 3); // 0: Top, 1: Left, 2: Right
    let startX = 0;
    let startY = 0;
    let vx = 0;
    let vy = 0;
    const baseSpeed = this.config.gameplay.targetSpeed;

    if (side === 0) {
      startX = Math.random() * (window.innerWidth - 80) + 40;
      startY = -radius;
      vx = (Math.random() - 0.5) * baseSpeed;
      vy = Math.random() * baseSpeed + 1.2;
    } else if (side === 1) {
      startX = -radius;
      startY = Math.random() * (window.innerHeight * 0.5) + 50;
      vx = Math.random() * baseSpeed + 1.5;
      vy = (Math.random() - 0.5) * baseSpeed;
    } else {
      startX = window.innerWidth + radius;
      startY = Math.random() * (window.innerHeight * 0.5) + 50;
      vx = -(Math.random() * baseSpeed + 1.5);
      vy = (Math.random() - 0.5) * baseSpeed;
    }

    const g = new Graphics();
    this.drawTargetGraphics(g, type, color, radius);
    g.x = startX;
    g.y = startY;

    this.targetsLayer.addChild(g);

    this.targets.push({
      id: this.nextTargetId++,
      graphics: g,
      type,
      x: startX,
      y: startY,
      vx,
      vy,
      radius,
      baseRadius: radius,
      pulsePhase: Math.random() * Math.PI * 2,
      points,
      color,
      isHit: false,
    });
  }

  private drawTargetGraphics(g: Graphics, type: 'orb' | 'star' | 'hazard', color: number, radius: number): void {
    g.clear();
    if (type === 'star') {
      g.star(0, 0, 5, radius * 1.2, radius * 0.6).fill({ color, alpha: 0.95 });
      g.circle(0, 0, radius * 1.4).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    } else if (type === 'hazard') {
      g.circle(0, 0, radius).fill({ color, alpha: 0.9 });
      g.rect(-radius * 0.6, -2, radius * 1.2, 4).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(0, 0, radius * 1.3).stroke({ width: 2, color: 0xfca5a5, alpha: 0.6 });
    } else {
      g.circle(0, 0, radius).fill({ color, alpha: 0.85 });
      g.circle(0, 0, radius * 0.5).fill({ color: 0xffffff, alpha: 0.8 });
      g.circle(0, 0, radius * 1.3).stroke({ width: 2, color, alpha: 0.5 });
    }
  }

  private updateTargets(delta: number): void {
    const playerRadius = 24;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];

      // Movement & sinusoidal floating
      t.x += t.vx * delta;
      t.y += t.vy * delta;
      t.pulsePhase += 0.08 * delta;
      const pulseScale = 1 + Math.sin(t.pulsePhase) * 0.12;

      t.graphics.x = t.x;
      t.graphics.y = t.y;
      t.graphics.scale.set(pulseScale);
      t.graphics.rotation += 0.02 * delta;

      // Collision detection with Player Character
      const dx = t.x - this.playerX;
      const dy = t.y - this.playerY;
      const distance = Math.hypot(dx, dy);

      if (distance < t.radius + playerRadius) {
        this.handleTargetHit(t);
        this.targetsLayer.removeChild(t.graphics);
        t.graphics.destroy();
        this.targets.splice(i, 1);
        continue;
      }

      // Check out-of-bounds
      if (
        t.y > window.innerHeight + 60 ||
        t.x < -60 ||
        t.x > window.innerWidth + 60
      ) {
        this.targetsLayer.removeChild(t.graphics);
        t.graphics.destroy();
        this.targets.splice(i, 1);
      }
    }
  }

  private handleTargetHit(target: TargetItem): void {
    target.isHit = true;
    this.targetsHit++;

    // Shake screen
    this.shakeIntensity = this.config.visuals.shakeIntensity;
    this.shakeTimer = 8;

    // Shockwave burst
    this.createShockwave(target.x, target.y, target.color);

    // Particle explosion
    this.createParticleBurst(target.x, target.y, target.color, this.config.visuals.particleCount);

    if (target.type === 'hazard') {
      this.combo = 0;
      this.comboTimer = 0;
      this.score = Math.max(0, this.score + target.points);
      this.showFloatingText(target.x, target.y, `${target.points}`, 0xef4444);
    } else {
      this.combo++;
      this.comboTimer = 2500; // 2.5s to maintain combo
      const multiplier = 1 + (this.combo - 1) * 0.25;
      const gainedScore = Math.round(target.points * multiplier);
      this.score += gainedScore;

      const label = this.combo > 1 ? `+${gainedScore} (x${this.combo})` : `+${gainedScore}`;
      this.showFloatingText(target.x, target.y, label, target.color);
    }

    this.events.onScoreUpdate(this.score, this.combo, this.targetsHit);
  }

  private createShockwave(x: number, y: number, color: number): void {
    const g = new Graphics();
    this.effectsLayer.addChild(g);
    this.shockwaves.push({
      graphics: g,
      x,
      y,
      radius: 10,
      maxRadius: 70,
      alpha: 1,
      color,
    });
  }

  private updateShockwaves(delta: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 4 * delta;
      sw.alpha -= 0.05 * delta;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.effectsLayer.removeChild(sw.graphics);
        sw.graphics.destroy();
        this.shockwaves.splice(i, 1);
        continue;
      }

      sw.graphics.clear();
      sw.graphics
        .circle(sw.x, sw.y, sw.radius)
        .stroke({ width: 3, color: sw.color, alpha: sw.alpha });
    }
  }

  private createParticleBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 5 + 2;
      const size = Math.random() * 5 + 3;

      const g = new Graphics();
      g.circle(0, 0, size).fill({ color, alpha: 1 });
      g.x = x;
      g.y = y;

      this.effectsLayer.addChild(g);

      this.particles.push({
        graphics: g,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02,
        size,
        color,
      });
    }
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 0.08 * delta; // slight gravity
      p.alpha -= p.decay * delta;

      if (p.alpha <= 0) {
        this.effectsLayer.removeChild(p.graphics);
        p.graphics.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      p.graphics.x = p.x;
      p.graphics.y = p.y;
      p.graphics.alpha = p.alpha;
      p.graphics.scale.set(p.alpha);
    }
  }

  private showFloatingText(x: number, y: number, textString: string, color: number): void {
    const textStyle = new TextStyle({
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 22,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        alpha: 0.6,
        blur: 4,
        distance: 2,
      },
    });

    const pixiText = new Text({
      text: textString,
      style: textStyle,
    });
    pixiText.anchor.set(0.5);
    pixiText.x = x;
    pixiText.y = y - 10;

    this.uiLayer.addChild(pixiText);

    this.floatingScores.push({
      text: pixiText,
      x,
      y: y - 10,
      vy: -2.5,
      alpha: 1,
      lifetime: 35,
    });
  }

  private updateFloatingScores(delta: number): void {
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const fs = this.floatingScores[i];
      fs.y += fs.vy * delta;
      fs.lifetime -= delta;
      fs.alpha = Math.max(0, fs.lifetime / 35);

      fs.text.y = fs.y;
      fs.text.alpha = fs.alpha;
      fs.text.scale.set(1 + (1 - fs.alpha) * 0.3);

      if (fs.lifetime <= 0) {
        this.uiLayer.removeChild(fs.text);
        fs.text.destroy();
        this.floatingScores.splice(i, 1);
      }
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.isReady = false;

    for (const cleanup of this.cleanupListeners) {
      try {
        cleanup();
      } catch {
        // Ignore
      }
    }
    this.cleanupListeners = [];

    if (this.canvas && this.canvas.parentElement) {
      try {
        this.canvas.parentElement.removeChild(this.canvas);
      } catch {
        // Ignore
      }
      this.canvas = null;
    }

    if (this.app) {
      try {
        this.app.destroy(false, { children: true });
      } catch (e) {
        console.warn('Error destroying Pixi app:', e);
      }
      this.app = null;
    }
  }
}
