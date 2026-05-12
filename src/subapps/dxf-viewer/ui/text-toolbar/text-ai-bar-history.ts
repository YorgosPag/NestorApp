/**
 * ADR-344 Phase 12 — LocalStorage history for TextAIBar.
 *
 * Stores the last MAX_HISTORY recent text AI prompts (personal, per-browser).
 * Key: DXF_TEXT_AI_HISTORY_KEY. Max entries: MAX_HISTORY.
 */

const DXF_TEXT_AI_HISTORY_KEY = 'dxf-text-ai-history';
const MAX_HISTORY = 10;

function safeRead(): string[] {
  try {
    const raw = localStorage.getItem(DXF_TEXT_AI_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export function getAIBarHistory(): readonly string[] {
  return safeRead();
}

export function pushAIBarHistory(entry: string): void {
  const trimmed = entry.trim();
  if (!trimmed) return;
  const current = safeRead().filter((e) => e !== trimmed);
  const next = [trimmed, ...current].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(DXF_TEXT_AI_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (e.g. private browsing quota exceeded) — silently skip
  }
}

export function clearAIBarHistory(): void {
  try {
    localStorage.removeItem(DXF_TEXT_AI_HISTORY_KEY);
  } catch {
    // ignore
  }
}
