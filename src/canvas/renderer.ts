import {
  ANIMATION_FRAMES,
  type SpriteAnimation,
  SpriteSheet,
  loadSpriteSheet,
  drawProceduralFrame,
  FRAME_WIDTH,
  FRAME_HEIGHT,
} from './sprite-sheet';
import { PetStateMachine } from '../pet/state-machine';
import {
  beginFall,
  createPhysicsState,
  snapToGround,
  tickFall,
  type PhysicsState,
} from '../pet/physics';
import { Stopwatch } from '../stopwatch/timer';
import {
  drawMenu,
  getMenuLayout,
  getPetDrawOffset,
  hitTestMenu,
  CANVAS_WIDTH,
  PET_CANVAS_HEIGHT,
  EXPANDED_CANVAS_HEIGHT,
} from '../stopwatch/menu';

export interface RendererOptions {
  mount: HTMLElement;
  stateMachine: PetStateMachine;
  stopwatch: Stopwatch;
  onLanded?: (x: number, y: number) => void;
  onStopwatchChange?: () => void;
  onMenuClose?: () => void;
  getWindowY?: () => number;
  setWindowY?: (y: number) => void;
}

export interface ScreenBottom {
  bottomY: number;
  monitorId?: string;
}

/** Canvas game loop: pixel art pet, physics, stopwatch overlay, menu */
export class PetRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly stateMachine: PetStateMachine;
  readonly stopwatch: Stopwatch;

  private sheets: Partial<Record<SpriteAnimation, SpriteSheet>> = {};
  private physics: PhysicsState | null = null;
  private animationFrame = 0;
  private lastFrameTime = 0;
  private rafId = 0;
  private running = false;
  private lastTrayUpdate = 0;
  private readonly trayUpdateIntervalMs = 1000;
  private groundY = 0;
  private petOffsetY = 0;
  private canvasHeight = PET_CANVAS_HEIGHT;
  private menuExpanded = false;
  private onLanded?: (x: number, y: number) => void;
  private onStopwatchChange?: () => void;
  private onMenuClose?: () => void;
  private getWindowY?: () => number;
  private setWindowY?: (y: number) => void;

  /** FPS per animation type */
  private readonly animationFps: Record<SpriteAnimation, number> = {
    idle: 2,
    drag: 1,
    fall: 8,
    focus: 2,
  };

  constructor(options: RendererOptions) {
    this.stateMachine = options.stateMachine;
    this.stopwatch = options.stopwatch;
    this.onLanded = options.onLanded;
    this.onStopwatchChange = options.onStopwatchChange;
    this.onMenuClose = options.onMenuClose;
    this.getWindowY = options.getWindowY;
    this.setWindowY = options.setWindowY;

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = this.canvasHeight;
    this.canvas.style.width = `${CANVAS_WIDTH}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;
    this.canvas.style.imageRendering = 'pixelated';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable');
    }
    this.ctx = ctx;
    options.mount.appendChild(this.canvas);
  }

  async loadSprites(basePath = '/assets/sprites'): Promise<void> {
    const entries: [SpriteAnimation, string][] = [
      ['idle', `${basePath}/guaiguai-idle.png`],
      ['drag', `${basePath}/guaiguai-drag.png`],
      ['fall', `${basePath}/guaiguai-fall.png`],
      ['focus', `${basePath}/guaiguai-focus.png`],
    ];

    await Promise.all(
      entries.map(async ([anim, url]) => {
        this.sheets[anim] = await loadSpriteSheet(url, ANIMATION_FRAMES[anim]);
      }),
    );
  }

  getPetOffsetY(): number {
    return this.petOffsetY;
  }

  getCanvasHeight(): number {
    return this.canvasHeight;
  }

  isMenuExpanded(): boolean {
    return this.menuExpanded;
  }

  setMenuExpanded(expanded: boolean): void {
    this.menuExpanded = expanded;
    this.petOffsetY = getPetDrawOffset(expanded);
    this.canvasHeight = expanded ? EXPANDED_CANVAS_HEIGHT : PET_CANVAS_HEIGHT;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = this.canvasHeight;
    this.canvas.style.height = `${this.canvasHeight}px`;
    document.documentElement.style.height = `${this.canvasHeight}px`;
    document.body.style.height = `${this.canvasHeight}px`;
    const app = document.getElementById('app');
    if (app) {
      app.style.height = `${this.canvasHeight}px`;
    }
  }

  /** Initialize ground Y from screen bottom IPC result */
  setGroundFromScreenBottom(screenBottom: ScreenBottom): void {
    this.groundY = screenBottom.bottomY - PET_CANVAS_HEIGHT;
    if (!this.physics) {
      this.physics = createPhysicsState(this.groundY, this.groundY);
    } else {
      this.physics.groundY = this.groundY;
      if (this.stateMachine.state === 'idle') {
        snapToGround(this.physics);
      }
    }
  }

  getPhysics(): PhysicsState | null {
    return this.physics;
  }

  startFall(): void {
    if (!this.physics) {
      return;
    }
    beginFall(this.physics);
    if (this.getWindowY) {
      this.physics.y = this.getWindowY();
    }
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Render a single frame (e.g. before showing the window) */
  renderFrame(): void {
    this.render(performance.now());
  }

  /** Notify tray / external listeners after stopwatch state changes */
  notifyStopwatchChange(): void {
    this.onStopwatchChange?.();
  }

  /** Handle menu button click at canvas coordinates */
  handleMenuClick(canvasX: number, canvasY: number): boolean {
    if (!this.stateMachine.isMenuOpen()) {
      return false;
    }

    const action = hitTestMenu(canvasX, canvasY, getMenuLayout(true));
    switch (action) {
      case 'start':
        this.stopwatch.toggle();
        this.stateMachine.stopwatchRunning = this.stopwatch.running;
        this.notifyStopwatchChange();
        return true;
      case 'reset':
        this.stopwatch.reset();
        this.stateMachine.stopwatchRunning = false;
        this.notifyStopwatchChange();
        return true;
      case 'close':
        this.stateMachine.transition('MENU_CLOSE');
        this.onMenuClose?.();
        return true;
    }
  }

  private loop = (now: number): void => {
    if (!this.running) {
      return;
    }

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.stopwatch.tick(now);
    if (
      this.stopwatch.running &&
      now - this.lastTrayUpdate >= this.trayUpdateIntervalMs
    ) {
      this.lastTrayUpdate = now;
      this.notifyStopwatchChange();
    }
    this.updatePhysics();
    this.updateAnimation(delta);
    this.render(now);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updatePhysics(): void {
    if (this.stateMachine.state !== 'fall' || !this.physics) {
      return;
    }

    const result = tickFall(this.physics);
    this.setWindowY?.(this.physics.y);

    if (result === 'landed') {
      snapToGround(this.physics);
      this.stateMachine.transition('LANDED');
      this.onLanded?.(0, this.physics.y);
    }
  }

  private updateAnimation(deltaMs: number): void {
    const anim = this.stateMachine.getCurrentAnimation();
    const fps = this.animationFps[anim];
    const frameDuration = 1000 / fps;
    this.animationFrame += deltaMs / frameDuration;
  }

  private getBoxText(): { text: string; red: boolean } {
    if (this.stopwatch.isActive()) {
      return { text: this.stopwatch.format(), red: false };
    }
    return { text: '乖乖', red: true };
  }

  private render(_now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, this.canvasHeight);

    const anim = this.stateMachine.getCurrentAnimation();
    const sheet = this.sheets[anim];
    const frameCount = ANIMATION_FRAMES[anim];
    const frameIndex = Math.floor(this.animationFrame) % frameCount;
    const { text, red } = this.getBoxText();
    const petY = this.petOffsetY;

    if (sheet?.isReady()) {
      sheet.drawFrame(ctx, frameIndex, 0, petY, anim, { boxText: text, boxTextRed: red });
    } else {
      drawProceduralFrame(ctx, 0, petY, anim, frameIndex, { boxText: text, boxTextRed: red });
    }

    if (this.stateMachine.isMenuOpen()) {
      drawMenu(ctx, this.stopwatch, getMenuLayout(true));
    }
  }
}

export {
  CANVAS_WIDTH,
  PET_CANVAS_HEIGHT as CANVAS_HEIGHT,
  FRAME_WIDTH,
  FRAME_HEIGHT,
};
