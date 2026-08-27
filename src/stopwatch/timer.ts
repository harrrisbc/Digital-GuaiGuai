/** Stopwatch elapsed-time tracker */
export interface StopwatchState {
  elapsedMs: number;
  running: boolean;
  startedAt: number | null;
}

export class Stopwatch {
  elapsedMs = 0;
  running = false;
  private startedAt: number | null = null;

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.startedAt = Date.now();
  }

  pause(): void {
    if (!this.running) {
      return;
    }
    this.tick(Date.now());
    this.running = false;
    this.startedAt = null;
  }

  /** Toggle between running and paused */
  toggle(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset(): void {
    this.elapsedMs = 0;
    this.running = false;
    this.startedAt = null;
  }

  /** Accumulate elapsed time while running; call each animation frame */
  tick(now: number): void {
    if (!this.running || this.startedAt === null) {
      return;
    }
    this.elapsedMs += now - this.startedAt;
    this.startedAt = now;
  }

  /** Whether timer has non-zero elapsed or is actively running */
  isActive(): boolean {
    return this.running || this.elapsedMs > 0;
  }

  format(): string {
    return formatElapsed(this.elapsedMs);
  }

  getState(): StopwatchState {
    return {
      elapsedMs: this.elapsedMs,
      running: this.running,
      startedAt: this.startedAt,
    };
  }
}

/** Format milliseconds as HH:MM:SS */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
