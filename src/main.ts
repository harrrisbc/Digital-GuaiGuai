import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PetRenderer } from './canvas/renderer';
import { PetStateMachine } from './pet/state-machine';
import { PointerTracker } from './input/pointer';
import { Stopwatch } from './stopwatch/timer';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvas/renderer';

interface ScreenBottom {
  bottomY: number;
  monitorId?: string;
}

interface SavedPosition {
  x: number;
  y: number;
  monitorId?: string;
}

/** Tauri IPC with graceful fallback for browser-only dev */
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

async function getScreenBottom(): Promise<ScreenBottom> {
  const result = await tauriInvoke<ScreenBottom>('get_screen_bottom');
  if (result) {
    return result;
  }
  return { bottomY: window.innerHeight, monitorId: 'browser' };
}

async function setPetPosition(x: number, y: number): Promise<void> {
  await tauriInvoke('set_pet_position', { x, y });
}

async function savePosition(x: number, y: number, monitorId: string): Promise<void> {
  await tauriInvoke('save_position', { x, y, monitorId });
}

async function getPetPosition(): Promise<SavedPosition | null> {
  return tauriInvoke<SavedPosition>('get_pet_position');
}

async function updateTrayStopwatch(label: string): Promise<void> {
  await tauriInvoke('update_tray_stopwatch', { label });
}

function trayStopwatchLabel(stopwatch: Stopwatch): string {
  const state = stopwatch.running ? 'running' : stopwatch.isActive() ? 'paused' : 'stopped';
  return `Stopwatch: ${stopwatch.format()} (${state})`;
}

async function init(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) {
    throw new Error('#app mount point not found');
  }

  const stateMachine = new PetStateMachine();
  const stopwatch = new Stopwatch();
  let windowX = 0;
  let windowY = 0;
  let monitorId: string | undefined;
  let grabOffsetX = 0;
  let grabOffsetY = 0;

  const screenBottom = await getScreenBottom();
  monitorId = screenBottom.monitorId ?? 'default';

  // Rust setup restores saved position; read current window coords from backend
  const current = await getPetPosition();
  if (current) {
    windowX = current.x;
    windowY = current.y;
    monitorId = current.monitorId ?? monitorId;
  } else {
    windowX = Math.max(0, Math.floor((window.screen.width - CANVAS_WIDTH) / 2));
    windowY = screenBottom.bottomY - CANVAS_HEIGHT;
    await setPetPosition(windowX, windowY);
  }

  const renderer = new PetRenderer({
    mount,
    stateMachine,
    stopwatch,
    getWindowY: () => windowY,
    setWindowY: (y) => {
      windowY = y;
      void setPetPosition(windowX, windowY);
    },
    onLanded: () => {
      void savePosition(windowX, windowY, monitorId);
    },
    onStopwatchChange: () => {
      void updateTrayStopwatch(trayStopwatchLabel(stopwatch));
    },
  });

  renderer.setGroundFromScreenBottom(screenBottom);
  void updateTrayStopwatch(trayStopwatchLabel(stopwatch));
  const physics = renderer.getPhysics();
  if (physics) {
    physics.y = windowY;
  }

  await renderer.loadSprites();
  renderer.start();

  const pointer = new PointerTracker();

  pointer.on((event) => {
    switch (event.kind) {
      case 'click':
        if (stateMachine.isMenuOpen()) {
          renderer.handleMenuClick(event.x, event.y);
        } else {
          stateMachine.transition('CLICK');
        }
        break;

      case 'dragStart':
        if (stateMachine.isMenuOpen()) {
          stateMachine.transition('MENU_CLOSE');
        }
        stateMachine.transition('DRAG_START');
        grabOffsetX = event.x;
        grabOffsetY = event.y;
        break;

      case 'dragMove': {
        // Position frameless window so cursor stays at grab point on sprite
        const screenX = window.screenX + (event.x - grabOffsetX);
        const screenY = window.screenY + (event.y - grabOffsetY);
        windowX = Math.round(screenX);
        windowY = Math.round(screenY);
        void setPetPosition(windowX, windowY);
        if (renderer.getPhysics()) {
          renderer.getPhysics()!.y = windowY;
        }
        break;
      }

      case 'dragEnd':
        stateMachine.transition('DRAG_END');
        renderer.startFall();
        void savePosition(windowX, windowY, monitorId);
        break;
    }
  });

  const canvas = renderer.canvas;

  canvas.addEventListener('mousedown', (e) => {
    pointer.pointerDown(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('mousemove', (e) => {
    pointer.pointerMove(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('mouseup', (e) => {
    pointer.pointerUp(e.offsetX, e.offsetY);
  });

  canvas.addEventListener('mouseleave', (e) => {
    if (pointer.isDragging()) {
      pointer.pointerUp(e.offsetX, e.offsetY);
    }
  });

  try {
    await listen('tray-pause', () => {
      if (stopwatch.running) {
        stopwatch.pause();
      } else if (stopwatch.isActive()) {
        stopwatch.start();
      } else {
        stopwatch.start();
      }
      stateMachine.stopwatchRunning = stopwatch.running;
      renderer.notifyStopwatchChange();
    });

    await listen('tray-reset', () => {
      stopwatch.reset();
      stateMachine.stopwatchRunning = false;
      renderer.notifyStopwatchChange();
    });
  } catch {
    // Browser dev — no Tauri event bridge
  }
}

void init();
