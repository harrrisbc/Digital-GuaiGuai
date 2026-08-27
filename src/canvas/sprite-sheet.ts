/** Color palette from design spec */
export const COLORS = {
  bagGreen: '#6DBF4A',
  bagGreenDark: '#4A9E2E',
  mascotBlue: '#3B7FD9',
  mascotOrange: '#F07830',
  bowYellow: '#F0C030',
  guaiguaiRed: '#D03030',
  whiteBox: '#F8F8F8',
  trafficGreen: '#30D030',
  trafficAmber: '#D0A030',
  trafficRed: '#D03030',
  black: '#1A1A1A',
  skin: '#F0C090',
} as const;

export type SpriteAnimation = 'idle' | 'drag' | 'fall' | 'focus';

export interface DrawFrameOptions {
  /** Text shown in 造句 white box (stopwatch time or 乖乖) */
  boxText?: string;
  /** Use red styling for 乖乖 characters */
  boxTextRed?: boolean;
}

const FRAME_WIDTH = 96;
const FRAME_HEIGHT = 128;

/** Frame counts per animation sheet */
export const ANIMATION_FRAMES: Record<SpriteAnimation, number> = {
  idle: 4,
  drag: 1,
  fall: 3,
  focus: 2,
};

/** Horizontal sprite sheet loader and drawer */
export class SpriteSheet {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  private readonly image: HTMLImageElement | null;
  private loaded = false;
  private readonly useProcedural: boolean;

  constructor(
    image: HTMLImageElement | null,
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    useProcedural = false,
  ) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frameCount = frameCount;
    this.useProcedural = useProcedural || image === null;

    if (image) {
      if (image.complete && image.naturalWidth > 0) {
        this.loaded = true;
      } else {
        image.addEventListener('load', () => {
          this.loaded = true;
        });
      }
    }
  }

  isReady(): boolean {
    return this.useProcedural || this.loaded;
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
    animation: SpriteAnimation = 'idle',
    options: DrawFrameOptions = {},
  ): void {
    const clampedIndex = ((frameIndex % this.frameCount) + this.frameCount) % this.frameCount;

    if (!this.useProcedural && this.loaded && this.image) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.image,
        clampedIndex * this.frameWidth,
        0,
        this.frameWidth,
        this.frameHeight,
        x,
        y,
        this.frameWidth,
        this.frameHeight,
      );
      ctx.restore();
      if (options.boxText) {
        drawSentenceBoxText(ctx, x, y, options.boxText, options.boxTextRed ?? false);
      }
      return;
    }

    drawProceduralFrame(ctx, x, y, animation, clampedIndex, options);
  }
}

/** Load a sprite sheet PNG from URL */
export async function loadSpriteSheet(
  url: string,
  frameCount: number,
  frameWidth = FRAME_WIDTH,
  frameHeight = FRAME_HEIGHT,
): Promise<SpriteSheet> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(new SpriteSheet(img, frameWidth, frameHeight, frameCount));
    img.onerror = () => resolve(new SpriteSheet(null, frameWidth, frameHeight, frameCount, true));
    img.src = url;
  });
}

/** Procedurally draw one animation frame of 乖乖 */
export function drawProceduralFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  animation: SpriteAnimation,
  frameIndex: number,
  options: DrawFrameOptions = {},
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  let sway = 0;
  let squash = 1;
  let tilt = 0;

  switch (animation) {
    case 'idle':
      sway = frameIndex % 2 === 0 ? 0 : 1;
      break;
    case 'drag':
      tilt = 4;
      break;
    case 'fall':
      if (frameIndex === 2) {
        squash = 0.85;
      } else if (frameIndex === 1) {
        squash = 1.1;
      }
      break;
    case 'focus':
      sway = 0;
      break;
  }

  ctx.translate(x + sway, y);
  if (tilt !== 0) {
    ctx.translate(FRAME_WIDTH / 2, FRAME_HEIGHT / 2);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.translate(-FRAME_WIDTH / 2, -FRAME_HEIGHT / 2);
  }
  if (squash !== 1) {
    ctx.translate(FRAME_WIDTH / 2, FRAME_HEIGHT);
    ctx.scale(1, squash);
    ctx.translate(-FRAME_WIDTH / 2, -FRAME_HEIGHT);
  }

  drawBagBody(ctx);
  drawMascot(ctx, animation, frameIndex);
  drawTrafficLight(ctx, animation, frameIndex);
  drawSentenceBox(ctx);

  ctx.restore();

  if (options.boxText) {
    drawSentenceBoxText(ctx, x + sway, y, options.boxText, options.boxTextRed ?? false);
  }
}

function drawBagBody(ctx: CanvasRenderingContext2D): void {
  // Main lime-green bag
  ctx.fillStyle = COLORS.bagGreen;
  roundRect(ctx, 8, 16, 80, 96, 8);
  ctx.fill();

  // Dark bottom banner
  ctx.fillStyle = COLORS.bagGreenDark;
  ctx.fillRect(8, 96, 80, 16);

  // Top fold highlight
  ctx.fillStyle = '#8AD060';
  ctx.fillRect(12, 20, 72, 6);
}

function drawMascot(ctx: CanvasRenderingContext2D, animation: SpriteAnimation, frameIndex: number): void {
  const blink = animation === 'idle' && frameIndex === 3;

  // Blue hair / hat
  ctx.fillStyle = COLORS.mascotBlue;
  ctx.fillRect(36, 28, 24, 10);
  ctx.fillRect(32, 34, 32, 8);

  // Face
  ctx.fillStyle = COLORS.skin;
  ctx.fillRect(34, 38, 28, 22);

  // Eyes
  ctx.fillStyle = COLORS.black;
  if (blink) {
    ctx.fillRect(40, 46, 6, 1);
    ctx.fillRect(50, 46, 6, 1);
  } else {
    ctx.fillRect(40, 44, 4, 4);
    ctx.fillRect(52, 44, 4, 4);
  }

  // Buck teeth
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(44, 54, 4, 4);
  ctx.fillRect(48, 54, 4, 4);

  // Orange shirt
  ctx.fillStyle = COLORS.mascotOrange;
  ctx.fillRect(30, 58, 36, 18);

  // Yellow bow tie
  ctx.fillStyle = COLORS.bowYellow;
  ctx.fillRect(42, 62, 4, 4);
  ctx.fillRect(50, 62, 4, 4);
  ctx.fillRect(46, 64, 4, 2);
}

function drawTrafficLight(ctx: CanvasRenderingContext2D, animation: SpriteAnimation, frameIndex: number): void {
  // Pole
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(72, 48, 4, 28);

  // Housing
  ctx.fillRect(68, 40, 12, 32);
  ctx.fillStyle = '#333333';
  ctx.fillRect(69, 41, 10, 30);

  const greenOn = animation === 'focus' || animation === 'idle' || animation === 'drag';
  const pulse = animation === 'idle' && frameIndex % 2 === 1;

  drawLight(ctx, 73, 44, animation === 'fall' ? COLORS.trafficAmber : COLORS.trafficRed, false);
  drawLight(ctx, 73, 52, COLORS.trafficAmber, animation === 'fall');
  drawLight(
    ctx,
    73,
    60,
    COLORS.trafficGreen,
    greenOn && (animation !== 'idle' || !pulse || frameIndex % 2 === 0),
  );
}

function drawLight(ctx: CanvasRenderingContext2D, lx: number, ly: number, color: string, on: boolean): void {
  ctx.fillStyle = on ? color : '#444444';
  ctx.beginPath();
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawSentenceBox(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COLORS.whiteBox;
  ctx.fillRect(14, 88, 68, 22);
  ctx.strokeStyle = '#CCCCCC';
  ctx.strokeRect(14.5, 88.5, 67, 21);
}

function drawSentenceBoxText(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  text: string,
  red: boolean,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = red ? 'bold 12px sans-serif' : '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = red ? COLORS.guaiguaiRed : COLORS.black;
  ctx.fillText(text, offsetX + FRAME_WIDTH / 2, offsetY + 99);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(rx + radius, ry);
  ctx.lineTo(rx + rw - radius, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
  ctx.lineTo(rx + rw, ry + rh - radius);
  ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
  ctx.lineTo(rx + radius, ry + rh);
  ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
  ctx.lineTo(rx, ry + radius);
  ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
  ctx.closePath();
}

export { FRAME_WIDTH, FRAME_HEIGHT };
