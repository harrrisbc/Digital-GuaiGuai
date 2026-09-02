import type { Stopwatch } from './timer';

/** Canvas dimensions for the pet sprite */
export const CANVAS_WIDTH = 96;
export const PET_CANVAS_HEIGHT = 128;
export const MENU_ZONE_HEIGHT = 40;
export const EXPANDED_CANVAS_HEIGHT = PET_CANVAS_HEIGHT + MENU_ZONE_HEIGHT;

/** @deprecated use PET_CANVAS_HEIGHT */
export const CANVAS_HEIGHT = PET_CANVAS_HEIGHT;

export const WINDOW_WIDTH = CANVAS_WIDTH;
export const WINDOW_HEIGHT = PET_CANVAS_HEIGHT;
export const WINDOW_HEIGHT_MENU = EXPANDED_CANVAS_HEIGHT;

/** Menu panel rendered above the pet bag */
export interface MenuLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  startButton: HitRegion;
  resetButton: HitRegion;
}

export interface HitRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  id: 'start' | 'reset';
}

export type MenuAction = 'start' | 'reset' | 'close';

const MENU_WIDTH = 88;
const MENU_HEIGHT = 36;
const MENU_TOP_Y = 4;
const BUTTON_WIDTH = 36;
const BUTTON_HEIGHT = 12;
const BUTTON_GAP = 8;

/** Vertical offset for pet sprite when menu zone is visible */
export function getPetDrawOffset(menuExpanded: boolean): number {
  return menuExpanded ? MENU_ZONE_HEIGHT : 0;
}

/** Compute menu layout relative to canvas origin */
export function getMenuLayout(menuExpanded = true): MenuLayout {
  const y = menuExpanded ? MENU_TOP_Y : -MENU_ZONE_HEIGHT;
  const buttonsY = y + 20;
  const totalButtonsWidth = BUTTON_WIDTH * 2 + BUTTON_GAP;
  const buttonsX = (CANVAS_WIDTH - MENU_WIDTH) / 2 + (MENU_WIDTH - totalButtonsWidth) / 2;

  return {
    x: (CANVAS_WIDTH - MENU_WIDTH) / 2,
    y,
    width: MENU_WIDTH,
    height: MENU_HEIGHT,
    startButton: {
      x: buttonsX,
      y: buttonsY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      id: 'start',
    },
    resetButton: {
      x: buttonsX + BUTTON_WIDTH + BUTTON_GAP,
      y: buttonsY,
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      id: 'reset',
    },
  };
}

export function pointInRegion(px: number, py: number, region: HitRegion): boolean {
  return (
    px >= region.x &&
    px < region.x + region.width &&
    py >= region.y &&
    py < region.y + region.height
  );
}

export function pointInMenu(px: number, py: number, layout: MenuLayout = getMenuLayout()): boolean {
  return (
    px >= layout.x &&
    px < layout.x + layout.width &&
    py >= layout.y &&
    py < layout.y + layout.height
  );
}

/** Resolve a canvas click while menu is open */
export function hitTestMenu(
  px: number,
  py: number,
  layout: MenuLayout = getMenuLayout(),
): MenuAction {
  if (pointInRegion(px, py, layout.startButton)) {
    return 'start';
  }
  if (pointInRegion(px, py, layout.resetButton)) {
    return 'reset';
  }
  if (!pointInMenu(px, py, layout)) {
    return 'close';
  }
  return 'close';
}

/** Draw pixel-style stopwatch menu above the pet */
export function drawMenu(
  ctx: CanvasRenderingContext2D,
  stopwatch: Stopwatch,
  layout: MenuLayout = getMenuLayout(),
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#2A2A2A';
  ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  ctx.strokeStyle = '#F8F8F8';
  ctx.lineWidth = 1;
  ctx.strokeRect(layout.x + 0.5, layout.y + 0.5, layout.width - 1, layout.height - 1);

  ctx.fillStyle = '#F8F8F8';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`⏱ ${stopwatch.format()}`, layout.x + layout.width / 2, layout.y + 10);

  drawButton(ctx, layout.startButton, stopwatch.running ? 'Pause' : 'Start');
  drawButton(ctx, layout.resetButton, 'Reset');

  ctx.restore();
}

function drawButton(ctx: CanvasRenderingContext2D, region: HitRegion, label: string): void {
  ctx.fillStyle = '#4A9E2E';
  ctx.fillRect(region.x, region.y, region.width, region.height);
  ctx.strokeStyle = '#F8F8F8';
  ctx.strokeRect(region.x + 0.5, region.y + 0.5, region.width - 1, region.height - 1);
  ctx.fillStyle = '#F8F8F8';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, region.x + region.width / 2, region.y + region.height / 2);
}
