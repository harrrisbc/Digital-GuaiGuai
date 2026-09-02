import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PetRenderer } from './canvas/renderer';
import { PetStateMachine } from './pet/state-machine';
import { PointerTracker } from './input/pointer';
import { Stopwatch } from './stopwatch/timer';
import { isInHitbox } from './input/hitbox';
import {
  CANVAS_WIDTH,
  PET_CANVAS_HEIGHT,
  MENU_ZONE_HEIGHT,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_HEIGHT_MENU,
} from './stopwatch/menu';

interface ScreenBottom {
  bottomY: number;
  monitorId?: string;
}

interface SavedPosition {
  x: number;
  y: number;
  monitorId?: string;
}

interface AppSettings {
  clickThrough: boolean;
  [key: string]: unknown;
}

interface MouseMovePayload {
  x: number;
  y: number;
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

async function setWindowSize(width: number, height: number): Promise<void> {
  await tauriInvoke('set_window_size', { width, height });
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

async function loadSettings(): Promise<AppSettings> {
  return (await tauriInvoke<AppSettings>('load_settings')) ?? { clickThrough: true };
}

async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await invoke('save_settings', { settings });
  } catch {
    // Browser dev
  }
}

function trayStopwatchLabel(stopwatch: Stopwatch): string {
  const state = stopwatch.running ? 'running' : stopwatch.isActive() ? 'paused' : 'stopped';
  return `Stopwatch: ${stopwatch.format()} (${state})`;
}

async function showWindowWhenReady(): Promise<void> {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.show();
  } catch {
    // Browser dev — no Tauri window
  }
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
  let monitorId = 'default';
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let clickThroughEnabled = true;
  let ignoreCursorEvents: boolean | null = null;

  const settings = await loadSettings();
  clickThroughEnabled = settings.clickThrough;

  const screenBottom = await getScreenBottom();
  monitorId = screenBottom.monitorId ?? 'default';

  const current = await getPetPosition();
  if (current) {
    windowX = current.x;
    windowY = current.y;
    monitorId = current.monitorId ?? monitorId;
  } else {
    windowX = Math.max(0, Math.floor((window.screen.width - CANVAS_WIDTH) / 2));
    windowY = screenBottom.bottomY - PET_CANVAS_HEIGHT;
    await setPetPosition(windowX, windowY);
  }

  async function syncWindowPosition(): Promise<void> {
    try {
      const pos = await getCurrentWindow().outerPosition();
      const scale = await getCurrentWindow().scaleFactor();
      windowX = Math.round(pos.x / scale);
      windowY = Math.round(pos.y / scale);
    } catch {
      // Browser dev
    }
  }

  async function setClickThrough(ignore: boolean): Promise<void> {
    const effectiveIgnore = clickThroughEnabled ? ignore : false;
    if (ignoreCursorEvents === effectiveIgnore) {
      return;
    }
    ignoreCursorEvents = effectiveIgnore;
    try {
      await getCurrentWindow().setIgnoreCursorEvents(effectiveIgnore);
    } catch {
      // Browser dev
    }
  }

  async function updateClickThrough(screenX: number, screenY: number): Promise<void> {
    if (!clickThroughEnabled) {
      await setClickThrough(false);
      return;
    }

    if (stateMachine.state === 'drag' || stateMachine.state === 'fall') {
      await setClickThrough(false);
      return;
    }

    await syncWindowPosition();

    const inHitbox = isInHitbox({
      screenX,
      screenY,
      windowX,
      windowY,
      state: stateMachine.state,
      petOffsetY: renderer.getPetOffsetY(),
      canvasHeight: renderer.getCanvasHeight(),
    });

    await setClickThrough(!inHitbox);
  }

  async function expandWindowForMenu(): Promise<void> {
    if (renderer.isMenuExpanded()) {
      return;
    }
    renderer.setMenuExpanded(true);
    await setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT_MENU);
    windowY -= MENU_ZONE_HEIGHT;
    await setPetPosition(windowX, windowY);
    await setClickThrough(false);
  }

  async function collapseWindowFromMenu(): Promise<void> {
    if (!renderer.isMenuExpanded()) {
      return;
    }
    renderer.setMenuExpanded(false);
    await setWindowSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    windowY += MENU_ZONE_HEIGHT;
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
    onMenuClose: () => {
      void collapseWindowFromMenu();
    },
  });

  renderer.setGroundFromScreenBottom(screenBottom);
  void updateTrayStopwatch(trayStopwatchLabel(stopwatch));
  const physics = renderer.getPhysics();
  if (physics) {
    physics.y = windowY;
  }

  await renderer.loadSprites();
  renderer.renderFrame();
  await showWindowWhenReady();
  // Start interactive; click-through only engages once global mouse tracking confirms cursor is outside
  await setClickThrough(false);
  renderer.start();

  const pointer = new PointerTracker();

  pointer.on((event) => {
    switch (event.kind) {
      case 'click':
        if (stateMachine.isMenuOpen()) {
          renderer.handleMenuClick(event.x, event.y);
        } else {
          stateMachine.transition('CLICK');
          void expandWindowForMenu();
        }
        break;

      case 'dragStart':
        if (stateMachine.isMenuOpen()) {
          stateMachine.transition('MENU_CLOSE');
          void collapseWindowFromMenu();
        }
        void setClickThrough(false);
        stateMachine.transition('DRAG_START');
        grabOffsetX = event.x;
        grabOffsetY = event.y;
        break;

      case 'dragMove': {
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
    await listen<MouseMovePayload>('device-mouse-move', (event) => {
      void updateClickThrough(event.payload.x, event.payload.y);
    });

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

    await listen<boolean>('tray-click-through', (event) => {
      clickThroughEnabled = event.payload;
      ignoreCursorEvents = null;
      void saveSettings({ clickThrough: clickThroughEnabled });
      if (!clickThroughEnabled) {
        void setClickThrough(false);
      }
    });
  } catch {
    // Browser dev — no Tauri event bridge
  }
}

void init();
