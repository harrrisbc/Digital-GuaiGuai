import type { PetState } from '../pet/state-machine';
import {
  CANVAS_WIDTH,
  EXPANDED_CANVAS_HEIGHT,
  getMenuLayout,
  pointInMenu,
  pointInRegion,
} from '../stopwatch/menu';

/** Approximate interactive pet body region relative to pet draw origin */
export const PET_BODY = {
  x: 8,
  y: 16,
  width: 80,
  height: 96,
};

export interface HitboxContext {
  /** Global cursor X in physical/logical screen coordinates */
  screenX: number;
  /** Global cursor Y in physical/logical screen coordinates */
  screenY: number;
  /** Window top-left X */
  windowX: number;
  /** Window top-left Y */
  windowY: number;
  /** Current pet state */
  state: PetState;
  /** Vertical offset of pet sprite within canvas */
  petOffsetY: number;
  /** Current canvas height */
  canvasHeight: number;
  /** Scale factor between window logical size and screen coordinates */
  scaleFactor: number;
}

export function pointInPetBody(localX: number, localY: number, petOffsetY: number): boolean {
  const region = {
    x: PET_BODY.x,
    y: PET_BODY.y + petOffsetY,
    width: PET_BODY.width,
    height: PET_BODY.height,
    id: 'start' as const,
  };
  return pointInRegion(localX, localY, region);
}

export function pointInInteractiveArea(
  localX: number,
  localY: number,
  state: PetState,
  petOffsetY: number,
): boolean {
  if (state === 'menuOpen') {
    const layout = getMenuLayout(true);
    return pointInMenu(localX, localY, layout) || pointInPetBody(localX, localY, petOffsetY);
  }

  if (state === 'drag' || state === 'fall') {
    return localX >= 0 && localY >= 0 && localX < CANVAS_WIDTH && localY < EXPANDED_CANVAS_HEIGHT;
  }

  return pointInPetBody(localX, localY, petOffsetY);
}

/** Whether the cursor is over an interactive region of the pet window */
export function isInHitbox(ctx: HitboxContext): boolean {
  const localX = (ctx.screenX - ctx.windowX) / ctx.scaleFactor;
  const localY = (ctx.screenY - ctx.windowY) / ctx.scaleFactor;

  if (localX < 0 || localY < 0 || localX >= CANVAS_WIDTH || localY >= ctx.canvasHeight) {
    return false;
  }

  return pointInInteractiveArea(localX, localY, ctx.state, ctx.petOffsetY);
}
