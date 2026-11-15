import { app, BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { SettingsRepository } from '../db/repositories/settings-repository'
import {
  clampPointToRect,
  parseStoredPosition,
  serializePosition,
  type Point
} from './widget-position'

/**
 * The floating progress widget: a frameless, transparent, always-on-top
 * mini window rendered by the compact widget renderer entry. It shares the
 * same secure webPreferences and narrow preload as the main window.
 *
 * Position and visibility are persisted in the settings table; the renderer
 * controls nothing about window geometry except dragging (CSS drag regions).
 */

export const WIDGET_SIZE = { width: 300, height: 372 } as const

const POSITION_KEY = 'widget.position'
const VISIBILITY_KEY = 'widget.visible'

let widgetWindow: BrowserWindow | null = null
let settingsRef: SettingsRepository | null = null

function defaultPosition(): Point {
  const workArea = screen.getPrimaryDisplay().workArea
  return {
    x: workArea.x + workArea.width - WIDGET_SIZE.width - 24,
    y: workArea.y + 48
  }
}

function clampToNearestDisplay(point: Point): Point {
  const display =
    screen.getDisplayMatching({ x: point.x, y: point.y, width: WIDGET_SIZE.width, height: WIDGET_SIZE.height }) ??
    screen.getPrimaryDisplay()
  return clampPointToRect(point, WIDGET_SIZE, display.workArea)
}

function loadWidgetPage(window: BrowserWindow): void {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(`${devServerUrl}/widget/index.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/widget/index.html'))
  }
}

function createWidgetWindow(settings: SettingsRepository): BrowserWindow {
  const stored = parseStoredPosition(settings.get(POSITION_KEY))
  const position = clampToNearestDisplay(stored ?? defaultPosition())

  const widget = new BrowserWindow({
    width: WIDGET_SIZE.width,
    height: WIDGET_SIZE.height,
    x: position.x,
    y: position.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'soloLeving Widget',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  widget.setAlwaysOnTop(true, 'floating')
  loadWidgetPage(widget)
  widget.once('ready-to-show', () => widget.show())

  // Persist the position after each user drag (rounded, clamped to work area).
  widget.on('moved', () => {
    const bounds = widget.getBounds()
    const clamped = clampToNearestDisplay({ x: bounds.x, y: bounds.y })
    settingsRef?.set(POSITION_KEY, serializePosition(clamped))
  })

  widget.on('closed', () => {
    widgetWindow = null
  })

  return widget
}

/** Shows the widget, creating it (and restoring its saved position) if needed. */
export function showWidget(settings: SettingsRepository): void {
  settingsRef = settings
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show()
    return
  }
  widgetWindow = createWidgetWindow(settings)
}

export function hideWidget(): void {
  widgetWindow?.hide()
}

export function isWidgetVisible(): boolean {
  return widgetWindow !== null && !widgetWindow.isDestroyed() && widgetWindow.isVisible()
}

export function setWidgetVisible(visible: boolean, settings: SettingsRepository): void {
  settings.set(VISIBILITY_KEY, visible ? '1' : '0')
  if (visible) {
    showWidget(settings)
  } else {
    hideWidget()
  }
}

/** Reads the persisted visibility preference; defaults to shown. */
export function widgetVisibilitySetting(settings: SettingsRepository): boolean {
  return settings.get(VISIBILITY_KEY) !== '0'
}

/** Widget pages live at widget/index.html in the production output. */
export function widgetPagePath(): string {
  return join('widget', 'index.html')
}
