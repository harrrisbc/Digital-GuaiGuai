import { describe, expect, it } from 'vitest';
import { isInHitbox, pointInPetBody } from '../src/input/hitbox';
import { PET_CANVAS_HEIGHT } from '../src/stopwatch/menu';

describe('pointInPetBody', () => {
  it('returns true at bag center', () => {
    expect(pointInPetBody(48, 64, 0)).toBe(true);
  });

  it('returns false at top-left corner outside bag', () => {
    expect(pointInPetBody(0, 0, 0)).toBe(false);
  });

  it('accounts for pet offset when menu expanded', () => {
    expect(pointInPetBody(48, 104, 40)).toBe(true);
    expect(pointInPetBody(48, 30, 40)).toBe(false);
  });
});

describe('isInHitbox', () => {
  const base = {
    windowX: 100,
    windowY: 200,
    canvasHeight: PET_CANVAS_HEIGHT,
    petOffsetY: 0,
  };

  it('returns true anywhere inside window when idle', () => {
    expect(
      isInHitbox({
        ...base,
        screenX: 100,
        screenY: 200,
        state: 'idle',
      }),
    ).toBe(true);
  });

  it('returns true for bag center when idle', () => {
    expect(
      isInHitbox({
        ...base,
        screenX: 148,
        screenY: 264,
        state: 'idle',
      }),
    ).toBe(true);
  });

  it('includes menu region when menuOpen', () => {
    expect(
      isInHitbox({
        ...base,
        screenX: 148,
        screenY: 210,
        state: 'menuOpen',
        petOffsetY: 40,
        canvasHeight: PET_CANVAS_HEIGHT + 40,
      }),
    ).toBe(true);
  });

  it('returns true for full window while dragging', () => {
    expect(
      isInHitbox({
        ...base,
        screenX: 100,
        screenY: 200,
        state: 'drag',
      }),
    ).toBe(true);
  });

  it('returns false when cursor is outside window bounds', () => {
    expect(
      isInHitbox({
        ...base,
        screenX: 50,
        screenY: 150,
        state: 'idle',
      }),
    ).toBe(false);
  });
});
