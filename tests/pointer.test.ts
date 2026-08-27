import { describe, it, expect } from 'vitest';
import {
  PointerTracker,
  classifyPointerUp,
  shouldStartDrag,
  distance,
  DRAG_THRESHOLD_PX,
} from '../src/input/pointer';

describe('pointer distance helpers', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('detects drag when movement >= threshold', () => {
    expect(shouldStartDrag({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    expect(shouldStartDrag({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
    expect(shouldStartDrag({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(false);
  });

  it('classifies small movement as click', () => {
    expect(classifyPointerUp({ x: 10, y: 10 }, { x: 12, y: 11 }, false)).toBe('click');
  });

  it('classifies large movement as dragEnd when not dragging', () => {
    expect(classifyPointerUp({ x: 0, y: 0 }, { x: 10, y: 0 }, false)).toBe('dragEnd');
  });

  it('classifies dragEnd when was dragging regardless of distance', () => {
    expect(classifyPointerUp({ x: 0, y: 0 }, { x: 0, y: 0 }, true)).toBe('dragEnd');
  });
});

describe('PointerTracker', () => {
  it('emits click when movement is under threshold', () => {
    const tracker = new PointerTracker();
    const events: string[] = [];
    tracker.on((e) => events.push(e.kind));

    tracker.pointerDown(50, 50);
    tracker.pointerUp(52, 51);

    expect(events).toEqual(['click']);
  });

  it('emits dragStart when movement exceeds threshold', () => {
    const tracker = new PointerTracker();
    const events: string[] = [];
    tracker.on((e) => events.push(e.kind));

    tracker.pointerDown(10, 10);
    tracker.pointerMove(20, 10);
    tracker.pointerMove(25, 10);
    tracker.pointerUp(25, 10);

    expect(events).toEqual(['dragStart', 'dragMove', 'dragEnd']);
  });

  it('uses custom threshold', () => {
    expect(shouldStartDrag({ x: 0, y: 0 }, { x: 9, y: 0 }, 10)).toBe(false);
    expect(shouldStartDrag({ x: 0, y: 0 }, { x: 10, y: 0 }, 10)).toBe(true);
    expect(DRAG_THRESHOLD_PX).toBe(5);
  });

  it('does not emit dragStart without pointer down', () => {
    const tracker = new PointerTracker();
    const events: string[] = [];
    tracker.on((e) => events.push(e.kind));
    tracker.pointerMove(100, 100);
    expect(events).toEqual([]);
  });
});
