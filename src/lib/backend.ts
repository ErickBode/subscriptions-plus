// Bridge to the Rust side. Falls back to localStorage when running in a plain browser (vite dev).
import type { AppData } from './types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function loadData(): Promise<Partial<AppData> | null> {
  if (!isTauri) {
    const raw = localStorage.getItem('subscriptions-plus');
    return raw ? JSON.parse(raw) : null;
  }
  const raw = await call<string | null>('load_data');
  return raw ? JSON.parse(raw) : null;
}

export async function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (!isTauri) {
    localStorage.setItem('subscriptions-plus', json);
    return;
  }
  await call('save_data', { json });
}

/** Asks where to save a backup and writes it. Resolves false when the dialog is cancelled. */
export async function exportFile(json: string, name: string): Promise<boolean> {
  if (!isTauri) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }
  return call<boolean>('export_data', { json, name });
}

/** Asks for a backup file and returns its text, or null when the dialog is cancelled. */
export async function importFile(): Promise<string | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => (input.files?.[0] ? input.files[0].text().then(resolve) : resolve(null));
      input.click();
    });
  }
  return call<string | null>('import_data');
}

export interface FetchedRates { USD: number; BRL: number; date: string }

export async function fetchRates(): Promise<FetchedRates> {
  if (!isTauri) {
    const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,BRL').then((x) => x.json());
    return { USD: r.rates.USD, BRL: r.rates.BRL, date: r.date };
  }
  return call<FetchedRates>('fetch_rates');
}

export interface ToastItem { id: string; title: string; body: string; at: number }

export async function scheduleNotifications(items: ToastItem[]): Promise<void> {
  if (!isTauri) return;
  await call('schedule_notifications', { items });
}

export async function testNotification(): Promise<void> {
  if (!isTauri) return;
  await call('test_notification');
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isTauri) return;
  await call('set_autostart', { enabled });
}

export async function updateTray(tooltip: string): Promise<void> {
  if (!isTauri) return;
  await call('update_tray', { tooltip });
}

export async function windowAction(action: 'minimize' | 'close'): Promise<void> {
  if (!isTauri) return;
  await call('window_action', { action });
}

/** Listens for actions sent from the tray mini-window to the main window. Returns an unsubscribe function. */
export function onTrayAction(handler: (action: string) => void): () => void {
  if (!isTauri) return () => {};
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  import('@tauri-apps/api/event').then(({ listen }) =>
    listen<string>('tray-action', (e) => handler(e.payload)).then((u) => {
      if (cancelled) u(); else unlisten = u;
    }));
  return () => { cancelled = true; unlisten?.(); };
}

/** Fires each time the tray mini-window is shown (so it can reload data). */
export function onTrayShown(handler: () => void): () => void {
  if (!isTauri) return () => {};
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  import('@tauri-apps/api/event').then(({ listen }) =>
    listen('tray-shown', () => handler()).then((u) => {
      if (cancelled) u(); else unlisten = u;
    }));
  return () => { cancelled = true; unlisten?.(); };
}

/** Opens the main window from the tray panel, optionally running an action there ("add", "open:<id>"). */
export async function openMain(action?: string): Promise<void> {
  if (!isTauri) return;
  await call('open_main', { action: action ?? null });
}

export const currentWindowLabel = (): string =>
  isTauri
    ? (window as unknown as { __TAURI_INTERNALS__: { metadata?: { currentWindow?: { label?: string } } } })
      .__TAURI_INTERNALS__.metadata?.currentWindow?.label ?? 'main'
    : new URLSearchParams(location.search).get('view') ?? 'main';
