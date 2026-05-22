// ============================================================================
// ANNOUNCEMENT PROTOCOL — event type → politeness + debounce (ADR-366 Phase 9 / C.5.Q1)
// ============================================================================
//
// Wraps aria-live-bus with:
//   - Per-event politeness (polite default, assertive for errors / render-done)
//   - Debounce 250ms to avoid flooding on rapid state changes (WCAG 4.1.3)
//   - Type-safe event parameters — each event type has a declared params shape
//
// Callers inject a TFn from useTranslation('bim3d') so this module stays pure.
// Assertive events bypass debounce (they indicate blocking / critical status).
// ============================================================================

import { ariaLiveBus, type AriaSeverity } from './aria-live-bus';
import type { TFn } from './status-bar-text-generator';

export type AnnouncementEventType =
  | 'entitySelected'
  | 'entityFocused'
  | 'modeChanged'
  | 'cameraSnapped'
  | 'sectionToggled'
  | 'toolActivated'
  | 'renderProgress'
  | 'renderDone'
  | 'floorChanged'
  | 'error';

type AnnouncementParamMap = {
  entitySelected: { type: string; name: string };
  entityFocused: { description: string };
  modeChanged: { mode: string };
  cameraSnapped: { view: string };
  sectionToggled: { state: string };
  toolActivated: { tool: string };
  renderProgress: { current: number; total: number };
  renderDone: Record<string, never>;
  floorChanged: { floor: string };
  error: { message: string };
};

const POLITENESS: Record<AnnouncementEventType, AriaSeverity> = {
  entitySelected: 'polite',
  entityFocused: 'polite',
  modeChanged: 'polite',
  cameraSnapped: 'polite',
  sectionToggled: 'polite',
  toolActivated: 'polite',
  renderProgress: 'polite',
  renderDone: 'assertive',
  floorChanged: 'polite',
  error: 'assertive',
};

const DEBOUNCE_MS = 250;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAnnouncement: { message: string; severity: AriaSeverity } | null = null;

function flushPending(): void {
  if (!pendingAnnouncement) return;
  ariaLiveBus.announce(pendingAnnouncement.message, pendingAnnouncement.severity);
  pendingAnnouncement = null;
  debounceTimer = null;
}

function scheduleAnnouncement(message: string, severity: AriaSeverity): void {
  pendingAnnouncement = { message, severity };
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  // Assertive bypasses debounce — critical/blocking messages fire immediately.
  if (severity === 'assertive') {
    flushPending();
    return;
  }
  debounceTimer = setTimeout(flushPending, DEBOUNCE_MS);
}

export function buildAnnouncementMessage<K extends AnnouncementEventType>(
  type: K,
  params: AnnouncementParamMap[K],
  t: TFn,
): string {
  switch (type) {
    case 'entitySelected': {
      const p = params as AnnouncementParamMap['entitySelected'];
      return t('aria.announcements.entitySelected', { type: p.type, name: p.name });
    }
    case 'entityFocused': {
      const p = params as AnnouncementParamMap['entityFocused'];
      return p.description;
    }
    case 'modeChanged': {
      const p = params as AnnouncementParamMap['modeChanged'];
      return t('aria.announcements.modeChanged', { mode: p.mode });
    }
    case 'cameraSnapped': {
      const p = params as AnnouncementParamMap['cameraSnapped'];
      return t('aria.announcements.cameraSnapped', { view: p.view });
    }
    case 'sectionToggled': {
      const p = params as AnnouncementParamMap['sectionToggled'];
      return t('aria.announcements.sectionToggled', { state: p.state });
    }
    case 'toolActivated': {
      const p = params as AnnouncementParamMap['toolActivated'];
      return t('aria.announcements.toolActivated', { tool: p.tool });
    }
    case 'renderProgress': {
      const p = params as AnnouncementParamMap['renderProgress'];
      return t('aria.announcements.renderProgress', { current: p.current, total: p.total });
    }
    case 'renderDone':
      return t('aria.announcements.renderDone');
    case 'floorChanged': {
      const p = params as AnnouncementParamMap['floorChanged'];
      return t('aria.announcements.floorChanged', { floor: p.floor });
    }
    case 'error': {
      const p = params as AnnouncementParamMap['error'];
      return p.message;
    }
    default:
      return '';
  }
}

export function announceEvent<K extends AnnouncementEventType>(
  type: K,
  params: AnnouncementParamMap[K],
  t: TFn,
): void {
  const message = buildAnnouncementMessage(type, params, t);
  if (!message) return;
  scheduleAnnouncement(message, POLITENESS[type]);
}

/** Cancel any pending debounced announcement (call on viewport unmount). */
export function cancelPendingAnnouncement(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingAnnouncement = null;
}

export function _resetAnnouncementProtocolForTests(): void {
  cancelPendingAnnouncement();
}
