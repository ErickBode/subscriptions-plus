import { buildReminders } from './reminders';
import type { AppData } from './types';

/** All reminder ids must be unique and at most 16 characters (Windows scheduled toast limit). */
export function reminderSafe(data: AppData): boolean {
  const items = buildReminders(data, new Date(2026, 0, 1, 8, 0));
  const ids = new Set(items.map((i) => i.id));
  return items.length > 0 && ids.size === items.length && items.every((i) => i.id.length <= 16);
}
