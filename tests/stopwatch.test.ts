import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Stopwatch, formatElapsed } from '../src/stopwatch/timer';

describe('Stopwatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero', () => {
    const sw = new Stopwatch();
    expect(sw.elapsedMs).toBe(0);
    expect(sw.running).toBe(false);
    expect(sw.format()).toBe('00:00:00');
  });

  it('accumulates elapsed time while running', () => {
    const sw = new Stopwatch();
    sw.start();
    vi.advanceTimersByTime(5000);
    sw.tick(Date.now());
    expect(sw.elapsedMs).toBe(5000);
    expect(sw.format()).toBe('00:00:05');
  });

  it('pauses and preserves elapsed time', () => {
    const sw = new Stopwatch();
    sw.start();
    vi.advanceTimersByTime(3000);
    sw.tick(Date.now());
    sw.pause();
    expect(sw.running).toBe(false);
    expect(sw.elapsedMs).toBe(3000);

    vi.advanceTimersByTime(2000);
    sw.tick(Date.now());
    expect(sw.elapsedMs).toBe(3000);
  });

  it('resets to zero', () => {
    const sw = new Stopwatch();
    sw.start();
    vi.advanceTimersByTime(10000);
    sw.tick(Date.now());
    sw.reset();
    expect(sw.elapsedMs).toBe(0);
    expect(sw.running).toBe(false);
    expect(sw.format()).toBe('00:00:00');
  });

  it('accumulates across start after pause', () => {
    const sw = new Stopwatch();
    sw.start();
    vi.advanceTimersByTime(2000);
    sw.tick(Date.now());
    sw.pause();

    vi.advanceTimersByTime(1000);
    sw.start();
    vi.advanceTimersByTime(3000);
    sw.tick(Date.now());
    expect(sw.elapsedMs).toBe(5000);
  });

  it('toggle starts and pauses', () => {
    const sw = new Stopwatch();
    sw.toggle();
    expect(sw.running).toBe(true);
    sw.toggle();
    expect(sw.running).toBe(false);
  });

  it('formats hours minutes seconds', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(65000)).toBe('00:01:05');
    expect(formatElapsed(3661000)).toBe('01:01:01');
  });
});
