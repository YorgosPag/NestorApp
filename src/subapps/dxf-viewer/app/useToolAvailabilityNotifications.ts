'use client';

/**
 * useToolAvailabilityNotifications — ΕΝΑΣ ακροατής για «γιατί δεν μπορώ;» (ADR-921).
 *
 * Δύο πηγές, ΙΔΙΟ κείμενο ανά αιτία (`OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS`):
 *  - `tool:activation-blocked` — η πύλη αρνήθηκε ενεργοποίηση (πρόληψη· η συνήθης διαδρομή).
 *  - `overlay:save-error`      — η αποθήκευση απέτυχε (άμυνα σε βάθος / σφάλμα εγγραφής).
 *
 * Όταν η αιτία έχει διόρθωση (π.χ. «χωρίς αναφορά» → εισαγωγή κάτοψης), το toast φέρει κουμπί
 * που την εκτελεί — Figma/Zillow «empty state με CTA» αντί για σκέτη απαγόρευση. Σταθερό `id`
 * ⇒ επαναλαμβανόμενα κλικ δεν στοιβάζουν toasts.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EventBus } from '../systems/events/EventBus';
import type { NotificationContextValue } from '@/types/notifications';
import {
  OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS,
  OVERLAY_DRAWING_REMEDY_ACTIONS,
} from '../overlays/overlay-drawing-readiness';
import { DXF_TIMING } from '../config/dxf-timing';

const BLOCKED_TOAST_DURATION_MS = DXF_TIMING.animation.TOAST_ACTIONABLE;
const PERSIST_FAILED_KEY = 'overlayReadiness.persistFailed';

export function useToolAvailabilityNotifications(
  notifications: NotificationContextValue,
  onRemedyAction: (action: string) => void,
): void {
  const { t } = useTranslation('dxf-viewer-shell');
  const remedyRef = React.useRef(onRemedyAction);
  remedyRef.current = onRemedyAction;

  const notifyBlocked = React.useCallback(
    (id: string, reasonKey: string, remedyAction: string | undefined) => {
      notifications.warning(t(reasonKey), {
        id,
        duration: BLOCKED_TOAST_DURATION_MS,
        ...(remedyAction
          ? { actions: [{ label: t('overlayReadiness.importAction'), onClick: () => remedyRef.current(remedyAction) }] }
          : {}),
      });
    },
    [notifications, t],
  );

  React.useEffect(
    () => EventBus.on('tool:activation-blocked', ({ tool, reasonKey, remedyAction }) => {
      notifyBlocked(`tool-blocked:${tool}`, reasonKey, remedyAction);
    }),
    [notifyBlocked],
  );

  React.useEffect(
    () => EventBus.on('overlay:save-error', ({ reason }) => {
      if (reason === 'persist-failed') {
        notifications.error(t(PERSIST_FAILED_KEY), { id: 'overlay-save-error' });
        return;
      }
      notifyBlocked('overlay-save-error', OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS[reason], OVERLAY_DRAWING_REMEDY_ACTIONS[reason]);
    }),
    [notifications, notifyBlocked, t],
  );
}
