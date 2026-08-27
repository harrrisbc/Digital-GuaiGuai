/** Vertical physics state for gravity fall */
export interface PhysicsState {
  y: number;
  vy: number;
  groundY: number;
  /** Remaining bounce frames after landing */
  bounceFrames: number;
}

export const DEFAULT_GRAVITY = 0.8;
export const BOUNCE_VELOCITY = -3;
export const BOUNCE_FRAME_COUNT = 2;

export function createPhysicsState(groundY: number, startY?: number): PhysicsState {
  return {
    y: startY ?? groundY,
    vy: 0,
    groundY,
    bounceFrames: 0,
  };
}

/**
 * Advance one frame of fall physics.
 * Returns 'landed' when pet has settled on ground after bounce.
 */
export function tickFall(
  state: PhysicsState,
  gravity: number = DEFAULT_GRAVITY,
): 'falling' | 'landed' {
  if (state.bounceFrames > 0) {
    state.bounceFrames -= 1;
    state.vy += gravity;
    state.y += state.vy;

    if (state.y >= state.groundY) {
      state.y = state.groundY;
      state.vy = 0;
    }

    if (state.bounceFrames === 0) {
      state.y = state.groundY;
      state.vy = 0;
      return 'landed';
    }

    return 'falling';
  }

  state.vy += gravity;
  state.y += state.vy;

  if (state.y >= state.groundY) {
    state.y = state.groundY;
    state.vy = BOUNCE_VELOCITY;
    state.bounceFrames = BOUNCE_FRAME_COUNT;
    return 'falling';
  }

  return 'falling';
}

/** Reset vertical velocity when drag ends and fall begins */
export function beginFall(state: PhysicsState): void {
  state.vy = 0;
  state.bounceFrames = 0;
}

/** Snap pet to ground (e.g. after drag to bottom) */
export function snapToGround(state: PhysicsState): void {
  state.y = state.groundY;
  state.vy = 0;
  state.bounceFrames = 0;
}
