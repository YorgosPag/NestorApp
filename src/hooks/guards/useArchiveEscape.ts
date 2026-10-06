/**
 * 🗄️ useArchiveEscape — η έξοδος «Αρχειοθέτηση αντί για διαγραφή» ενός μπλοκαρίσματος
 *
 * Όταν ο φύλακας διαγραφής αρνείται επειδή η εγγραφή **αναφέρεται** από άλλες, η διαγραφή
 * δεν είναι ποτέ η απάντηση: ο κάδος έχει προθεσμία οριστικής διαγραφής. Η απάντηση είναι το
 * αρχείο (ADR-329 §3.9). Αυτό το hook δίνει στο `useDeletionGuard` την έξοδο προς αυτό.
 *
 * 🔑 Το **αν** προσφέρεται το αποφασίζει ο διακομιστής (`DependencyCheckResult.archivable`):
 * η οθόνη δεν μαντεύει ποια μπλοκαρίσματα λύνονται με αρχειοθέτηση (π.χ. ακίνητο με αγοραστή
 * δεν αρχειοθετείται).
 *
 * @module hooks/guards/useArchiveEscape
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { DependencyGuardSpec } from '@/hooks/guards/useDependencyGuard';
import type { DeletionBlockedEscape } from '@/components/shared/DeletionBlockedDialog';
import { TrashService } from '@/services/trash.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

const logger = createModuleLogger('useArchiveEscape');

export interface ArchiveEscapeSpec {
  /** Η οντότητα όπως τη γνωρίζει η μηχανή κύκλου ζωής. */
  readonly kind: SoftDeletableEntityType;
  /** Καλείται αφού η εγγραφή μπει στο αρχείο — ο καλών κλείνει τον διάλογο και ανανεώνει. */
  readonly onArchived: (entityId: string) => void;
  /**
   * Ό,τι **άλλο** συνεπάγεται η αρχειοθέτηση για αυτή την οντότητα (π.χ. η αγγελία ενός
   * ακινήτου κατεβαίνει) — ήδη μεταφρασμένο, μπαίνει μετά τη γενική εξήγηση.
   */
  readonly consequence?: string;
}

/** Η τελευταία έξοδος που δόθηκε — ΣΤΑΘΕΡΗ ταυτότητα όσο δεν αλλάζει τίποτα (βλ. `useDependencyGuard`). */
interface EscapeCache {
  readonly entityId: string;
  readonly pending: boolean;
  readonly escape: DeletionBlockedEscape;
}

export function useArchiveEscape(spec: ArchiveEscapeSpec): NonNullable<DependencyGuardSpec['escapeFor']> {
  const { t } = useTranslation(['trash']);
  const { notify } = useNotifications();
  const [archiving, setArchiving] = useState(false);

  // Ο spec έρχεται ως inline literal → ref, ώστε το `archive` να κρατά σταθερή ταυτότητα.
  const specRef = useRef(spec);
  specRef.current = spec;
  const cache = useRef<EscapeCache | null>(null);

  const archive = useCallback(async (entityId: string) => {
    const { kind, onArchived } = specRef.current;
    setArchiving(true);
    try {
      await TrashService.archive(kind, entityId);
      notify(t('archiveSuccess'), { type: 'success' });
      onArchived(entityId);
    } catch (error) {
      logger.error('Failed to archive blocked entity', { kind, entityId, error });
      notify(t('archiveFailed'), { type: 'error' });
    } finally {
      setArchiving(false);
    }
  }, [notify, t]);

  return (result, entityId) => {
    if (!result.archivable) return undefined;

    const cached = cache.current;
    if (cached && cached.entityId === entityId && cached.pending === archiving) return cached.escape;

    const { consequence } = specRef.current;
    const escape: DeletionBlockedEscape = {
      label: t('archiveInstead'),
      hint: consequence ? `${t('archiveHint')} ${consequence}` : t('archiveHint'),
      pending: archiving,
      onAction: () => { void archive(entityId); },
    };
    cache.current = { entityId, pending: archiving, escape };
    return escape;
  };
}
