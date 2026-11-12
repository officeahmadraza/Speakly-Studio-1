import { GenerationHistoryItem, ActiveGenerationTask } from '../types/index.js';

const FAVORITES_KEY = 'speaklystudio_favorites_v1';
const OLD_FAVORITES_KEY = 'voicestudio_favorites_v1';
const HISTORY_KEY = 'speaklystudio_history_v1';
const OLD_HISTORY_KEY = 'voicestudio_history_v1';
const ACTIVE_TASK_KEY = 'speaklystudio_active_task_v1';
const OLD_ACTIVE_TASK_KEY = 'voicestudio_active_task_v1';
const RECENT_VOICES_KEY = 'speaklystudio_recents_v1';
const OLD_RECENT_VOICES_KEY = 'voicestudio_recents_v1';
const ACCESS_CODE_KEY = 'speaklystudio_access_code_v1';
const OLD_ACCESS_CODE_KEY = 'voicestudio_access_code_v1';

// Favorites Storage
export function getSavedFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY) || localStorage.getItem(OLD_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch (e) {
    console.error('Failed to parse favorites from localStorage', e);
  }
  return [];
}

export function saveFavorites(favorites: string[]): void {
  try {
    const unique = Array.from(new Set(favorites));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
  } catch (e) {
    console.error('Failed to save favorites to localStorage', e);
  }
}

export function toggleFavoriteVoice(voiceId: string): boolean {
  const current = getSavedFavorites();
  const exists = current.includes(voiceId);
  const updated = exists ? current.filter(id => id !== voiceId) : [...current, voiceId];
  saveFavorites(updated);
  return !exists;
}

// History Storage (Persist full text locally)
export function getGenerationHistory(): GenerationHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY) || localStorage.getItem(OLD_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load history from localStorage', e);
  }
  return [];
}

export function saveGenerationItem(item: GenerationHistoryItem): void {
  try {
    const current = getGenerationHistory();
    // Prepend new item and keep max 50 items
    const filtered = current.filter(i => i.taskId !== item.taskId);
    const updated = [item, ...filtered].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save history item to localStorage', e);
  }
}

export function removeHistoryItem(id: string): void {
  try {
    const current = getGenerationHistory();
    const updated = current.filter(item => item.id !== id && item.taskId !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to remove history item', e);
  }
}

export function clearGenerationHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Failed to clear generation history', e);
  }
}

// Active Task Storage (Resume polling across page refresh)
export function getActiveTask(): ActiveGenerationTask | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TASK_KEY) || localStorage.getItem(OLD_ACTIVE_TASK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read active task', e);
  }
  return null;
}

export function saveActiveTask(task: ActiveGenerationTask): void {
  try {
    localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(task));
  } catch (e) {
    console.error('Failed to save active task', e);
  }
}

export function clearActiveTask(): void {
  try {
    localStorage.removeItem(ACTIVE_TASK_KEY);
    localStorage.removeItem(OLD_ACTIVE_TASK_KEY);
  } catch (e) {
    console.error('Failed to clear active task', e);
  }
}

// Recently used voice IDs
export function getRecentVoiceIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_VOICES_KEY) || localStorage.getItem(OLD_RECENT_VOICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error('Failed to read recent voice IDs', e);
  }
  return [];
}

export function addRecentVoiceId(voiceId: string): void {
  try {
    const current = getRecentVoiceIds();
    const filtered = current.filter(id => id !== voiceId);
    const updated = [voiceId, ...filtered].slice(0, 8);
    localStorage.setItem(RECENT_VOICES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save recent voice ID', e);
  }
}

// Access Code
export function getStoredAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) || localStorage.getItem(OLD_ACCESS_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAccessCode(code: string): void {
  try {
    if (!code) {
      localStorage.removeItem(ACCESS_CODE_KEY);
      localStorage.removeItem(OLD_ACCESS_CODE_KEY);
    } else {
      localStorage.setItem(ACCESS_CODE_KEY, code.trim());
    }
  } catch (e) {
    console.error('Failed to store access code', e);
  }
}
