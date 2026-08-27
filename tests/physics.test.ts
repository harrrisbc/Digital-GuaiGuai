import { describe, it, expect } from 'vitest';
import {
  createPhysicsState,
  tickFall,
  beginFall,
  snapToGround,
  DEFAULT_GRAVITY,
  BOUNCE_FRAME_COUNT,
} from '../src/pet/physics';

describe('physics', () => {
  it('creates state at ground by default', () => {
    const state = createPhysicsState(500);
    expect(state.y).toBe(500);
    expect(state.vy).toBe(0);
    expect(state.groundY).toBe(500);
  });

  it('applies gravity each frame while falling', () => {
    const state = createPhysicsState(200, 0);
    beginFall(state);

    const first = tickFall(state);
    expect(first).toBe('falling');
    expect(state.vy).toBe(DEFAULT_GRAVITY);
    expect(state.y).toBeCloseTo(DEFAULT_GRAVITY);
  });

  it('lands on ground with bounce then settles', () => {
    const groundY = 100;
    const state = createPhysicsState(groundY, 90);
    beginFall(state);
    state.vy = 15;

    let status: 'falling' | 'landed' = 'falling';
    let frames = 0;
    while (status === 'falling' && frames < 50) {
      status = tickFall(state);
      frames += 1;
    }

    expect(status).toBe('landed');
    expect(state.y).toBe(groundY);
    expect(state.vy).toBe(0);
  });

  it('triggers bounce frames on first ground contact', () => {
    const groundY = 50;
    const state = createPhysicsState(groundY, 48);
    beginFall(state);
    state.vy = 5;

    tickFall(state);
    expect(state.y).toBe(groundY);
    expect(state.bounceFrames).toBe(BOUNCE_FRAME_COUNT);
    expect(state.vy).toBe(-3);
  });

  it('snapToGround resets velocity and bounce', () => {
    const state = createPhysicsState(100, 20);
    state.vy = 10;
    state.bounceFrames = 2;
    snapToGround(state);
    expect(state.y).toBe(100);
    expect(state.vy).toBe(0);
    expect(state.bounceFrames).toBe(0);
  });

  it('beginFall zeroes vertical velocity', () => {
    const state = createPhysicsState(100, 50);
    state.vy = 12;
    beginFall(state);
    expect(state.vy).toBe(0);
    expect(state.bounceFrames).toBe(0);
  });
});
