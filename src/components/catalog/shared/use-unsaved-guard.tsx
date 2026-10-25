'use client';

/**
 * @fileoverview **Φύλακας μη αποθηκευμένων αλλαγών** — καμία σιωπηλή απώλεια προχείρου (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/use-unsaved-guard
 *
 * Δύο πόρτες εξόδου, δύο φρουροί:
 *  - **μέσα στη σελίδα** (επιλογή άλλης εγγραφής, κλείσιμο φύλλου): `guard(action)` ⇒ αν το πρόχειρο είναι βρώμικο,
 *    επιβεβαίωση («Απόρριψη αλλαγών;») με το SSoT `ConfirmDialog` — Akeneo/Notion.
 *  - **έξω από τη σελίδα** (κλείσιμο καρτέλας, ανανέωση): δήλωση στο `unsaved-work-registry`, όσο είναι βρώμικο —
 *    τον `beforeunload` τον δίνει ο ΕΝΑΣ φύλακας της εφαρμογής (ADR-860 §Ε3γ).
 * Ο επεξεργαστής δηλώνει μόνος του αν είναι βρώμικος (`reportDirty`)· η σελίδα δεν ξέρει τίποτα για πρόχειρα.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clearUnsavedWork, markUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import { useCatalogText } from './catalog-ui-hooks';

export interface UnsavedGuard {
  readonly reportDirty: (dirty: boolean) => void;
  readonly guard: (action: () => void) => void;
  readonly dialog: React.ReactNode;
}

export function useUnsavedGuard(): UnsavedGuard {
  const { t } = useCatalogText();
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [waiting, setWaiting] = useState<(() => void) | null>(null);

  const reportDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirty(next);
  }, []);

  const guard = useCallback((action: () => void) => {
    if (!dirtyRef.current) action();
    else setWaiting(() => action);
  }, []);

  // Η προειδοποίηση στο κλείσιμο δεν ζει εδώ: τη δίνει ο ΕΝΑΣ listener της `unsaved-work-guard` (ADR-860 §Ε3γ)
  // από το μητρώο — εδώ μόνο δηλώνεται ο ιδιοκτήτης.
  const ownerId = `catalog-editor:${useId()}`;
  useEffect(() => {
    if (dirty) markUnsavedWork(ownerId);
    else clearUnsavedWork(ownerId);
    return () => clearUnsavedWork(ownerId);
  }, [dirty, ownerId]);

  const dialog = (
    <ConfirmDialog
      open={waiting !== null}
      onOpenChange={(open) => { if (!open) setWaiting(null); }}
      variant="warning"
      title={t('editor.unsavedTitle')}
      description={t('editor.unsavedDescription')}
      confirmText={t('common.discard')}
      onConfirm={() => {
        const action = waiting;
        reportDirty(false);
        setWaiting(null);
        action?.();
      }}
    />
  );
  return { reportDirty, guard, dialog };
}
