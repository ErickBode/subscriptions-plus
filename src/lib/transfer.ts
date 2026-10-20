// Backup files: the whole app state (subscriptions, categories, cards and settings) as JSON.
import { normalize } from './defaults';
import type { AppData } from './types';

export const exportJson = (d: AppData): string => JSON.stringify(d, null, 2);

export const exportFileName = (today: string): string => `subscriptions-plus-${today}.json`;

/** Reads a backup file. Throws with a user-facing message when the file is not a Subscriptions+ backup. */
export function parseImport(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Partial<AppData>).subscriptions)) {
    throw new Error('This file is not a Subscriptions+ backup.');
  }
  return normalize(raw as Partial<AppData>);
}
