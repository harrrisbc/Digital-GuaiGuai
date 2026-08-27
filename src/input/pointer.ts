export const DRAG_THRESHOLD_PX = 5;

export type PointerEventKind = 'click' | 'dragStart' | 'dragMove' | 'dragEnd';

export interface PointerPoint {
  x: number;
  y: number;
}

export interface PointerEventPayload {
  kind: PointerEventKind;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

type PointerListener = (event: PointerEventPayload) => void;

/** Euclidean distance between two points */
export function distance(a: PointerPoint, b: PointerPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Classify mouseup as click or dragEnd based on movement threshold */
export function classifyPointerUp(
  start: PointerPoint,
  end: PointerPoint,
  wasDragging: boolean,
  threshold: number = DRAG_THRESHOLD_PX,
): 'click' | 'dragEnd' {
  if (wasDragging) {
    return 'dragEnd';
  }
  return distance(start, end) < threshold ? 'click' : 'dragEnd';
}

/** Should pointer movement trigger drag start */
export function shouldStartDrag(
  start: PointerPoint,
  current: PointerPoint,
  threshold: number = DRAG_THRESHOLD_PX,
): boolean {
  return distance(start, current) >= threshold;
}

/**
 * Tracks pointer down/move/up and emits click vs drag events.
 * Drag threshold: movement >= 5px from mousedown.
 */
export class PointerTracker {
  private down = false;
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private readonly threshold: number;
  private listeners: PointerListener[] = [];

  constructor(threshold: number = DRAG_THRESHOLD_PX) {
    this.threshold = threshold;
  }

  on(listener: PointerListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  pointerDown(x: number, y: number): void {
    this.down = true;
    this.dragging = false;
    this.startX = x;
    this.startY = y;
  }

  pointerMove(x: number, y: number): void {
    if (!this.down) {
      return;
    }

    if (!this.dragging && shouldStartDrag({ x: this.startX, y: this.startY }, { x, y }, this.threshold)) {
      this.dragging = true;
      this.emit('dragStart', x, y);
    } else if (this.dragging) {
      this.emit('dragMove', x, y);
    }
  }

  pointerUp(x: number, y: number): void {
    if (!this.down) {
      return;
    }

    const kind = classifyPointerUp(
      { x: this.startX, y: this.startY },
      { x, y },
      this.dragging,
      this.threshold,
    );

    if (kind === 'click') {
      this.emit('click', x, y);
    } else {
      this.emit('dragEnd', x, y);
    }

    this.down = false;
    this.dragging = false;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  getStartPosition(): PointerPoint {
    return { x: this.startX, y: this.startY };
  }

  private emit(kind: PointerEventKind, x: number, y: number): void {
    const payload: PointerEventPayload = {
      kind,
      x,
      y,
      startX: this.startX,
      startY: this.startY,
    };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
