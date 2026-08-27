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
import { drawMenu, getMenuLayout, hitTestMenu, CANVAS_WIDTH, CANVAS_HEIGHT } from '../stopwatch/menu';

export interface RendererOptions {
  mount: HTMLElement;
  stateMachine: PetStateMachine;
  stopwatch: Stopwatch;
  onLanded?: (x: number, y: number) => void;
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
  private groundY = 0;
  private onLanded?: (x: number, y: number) => void;
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
    this.getWindowY = options.getWindowY;
    this.setWindowY = options.setWindowY;

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.canvas.style.width = `${CANVAS_WIDTH}px`;
    this.canvas.style.height = `${CANVAS_HEIGHT}px`;
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

  /** Initialize ground Y from screen bottom IPC result */
  setGroundFromScreenBottom(screenBottom: ScreenBottom): void {
    this.groundY = screenBottom.bottomY - CANVAS_HEIGHT;
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

  /** Handle menu button click at canvas coordinates */
  handleMenuClick(canvasX: number, canvasY: number): boolean {
    if (!this.stateMachine.isMenuOpen()) {
      return false;
    }

    const action = hitTestMenu(canvasX, canvasY);
    switch (action) {
      case 'start':
        this.stopwatch.toggle();
        this.stateMachine.stopwatchRunning = this.stopwatch.running;
        return true;
      case 'reset':
        this.stopwatch.reset();
        this.stateMachine.stopwatchRunning = false;
        return true;
      case 'close':
        this.stateMachine.transition('MENU_CLOSE');
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
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const anim = this.stateMachine.getCurrentAnimation();
    const sheet = this.sheets[anim];
    const frameCount = ANIMATION_FRAMES[anim];
    const frameIndex = Math.floor(this.animationFrame) % frameCount;
    const { text, red } = this.getBoxText();

    if (sheet?.isReady()) {
      sheet.drawFrame(ctx, frameIndex, 0, 0, anim, { boxText: text, boxTextRed: red });
    } else {
      drawProceduralFrame(ctx, 0, 0, anim, frameIndex, { boxText: text, boxTextRed: red });
    }

    if (this.stateMachine.isMenuOpen()) {
      drawMenu(ctx, this.stopwatch, getMenuLayout());
    }
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT };
