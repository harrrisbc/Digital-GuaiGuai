/** Pet behavior states */
export type PetState = 'idle' | 'drag' | 'fall' | 'menuOpen';

/** Events that drive state transitions */
export type PetEvent =
  | 'DRAG_START'
  | 'DRAG_END'
  | 'CLICK'
  | 'LANDED'
  | 'MENU_CLOSE'
  | 'TICK';

/** Sprite animation keys mapped from pet state */
export type PetAnimation = 'idle' | 'drag' | 'fall' | 'focus';

export class PetStateMachine {
  state: PetState = 'idle';
  /** Whether stopwatch is currently running (affects idle vs focus animation) */
  stopwatchRunning = false;

  transition(event: PetEvent): void {
    switch (this.state) {
      case 'idle':
        if (event === 'DRAG_START') {
          this.state = 'drag';
        } else if (event === 'CLICK') {
          this.state = 'menuOpen';
        }
        break;

      case 'drag':
        if (event === 'DRAG_END') {
          this.state = 'fall';
        }
        break;

      case 'fall':
        if (event === 'LANDED') {
          this.state = 'idle';
        } else if (event === 'DRAG_START') {
          this.state = 'drag';
        }
        break;

      case 'menuOpen':
        if (event === 'MENU_CLOSE') {
          this.state = 'idle';
        } else if (event === 'DRAG_START') {
          this.state = 'drag';
        }
        break;
    }
  }

  getCurrentAnimation(): PetAnimation {
    switch (this.state) {
      case 'drag':
        return 'drag';
      case 'fall':
        return 'fall';
      case 'menuOpen':
      case 'idle':
        return this.stopwatchRunning ? 'focus' : 'idle';
      default:
        return 'idle';
    }
  }

  isMenuOpen(): boolean {
    return this.state === 'menuOpen';
  }
}
