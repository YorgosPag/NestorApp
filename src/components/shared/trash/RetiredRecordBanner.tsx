'use client';

/**
 * RetiredRecordBanner — η ταινία πάνω από το **κλειδωμένο** πλαίσιο μιας αποσυρμένης εγγραφής.
 *
 * Ένα πλαίσιο που δείχνει τα πάντα και δεν δέχεται τίποτα **οφείλει να πει γιατί** (ADR-329 §3.9):
 *   • **πότε / από ποιον** αποσύρθηκε·
 *   • **γιατί δεν διαγράφηκε** (μόνο αρχείο) — ζωντανά από τον φρουρό διαγραφής, ποτέ από μνήμη·
 *   • **πότε εκκαθαρίζεται** (μόνο κάδος) — από την ΙΔΙΑ σταθερά με το purge job·
 *   • **τι θα κάνει η επαναφορά** — από τον πίνακα `reinstate-promises`, που άγκυρα jest δένει με
 *     τη συμπεριφορά του διακομιστή.
 *
 * Η όψη είναι η ΜΙΑ λωρίδα (`TrashNotice`), ίδια με τη μπάρα της λίστας από πάνω.
 *
 * @component
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import type { DependencyCheckResult } from '@/config/deletion-registry';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { normalizeToDate } from '@/lib/date-local';
import { reinstatePromiseOf, type ReinstatePromise, type ReinstatePromiseEntity } from '@/lib/firestore/reinstate-promises';
import { retiredKindOf, TRASH_RETENTION_MS, type MaybeTrashed, type RetiredKind } from '@/lib/firestore/trashed-status';
import { formatDate } from '@/lib/intl-formatting';

import { TrashNotice, type TrashNoticeTone } from './TrashNotice';

/** Ό,τι διαβάζει η ταινία από την εγγραφή. Οι σφραγίδες έρχονται ζωντανές **ή** μέσα από JSON ⇒ `unknown`. */
export interface RetiredRecord extends MaybeTrashed {
  readonly id: string;
  readonly archivedAt?: unknown;
  readonly archivedBy?: string | null;
  readonly deletedAt?: unknown;
  readonly deletedBy?: string | null;
}

interface RetiredRecordBannerProps {
  readonly entityType: ReinstatePromiseEntity;
  readonly record: RetiredRecord;
  /**
   * Η πράξη επιστροφής, δίπλα στην εξήγησή της. Τη δίνει **μόνο** σημείο προσάρτησης που δεν έχει ήδη
   * μπάρα επαναφοράς από πάνω (η σελίδα της εγγραφής)· στη λίστα λείπει, αλλιώς δύο κουμπιά για μία πράξη.
   */
  readonly action?: ReactNode;
}

/** Ό,τι διαφέρει ανάμεσα στις δύο αποσύρσεις **για την ταινία**. Κλειδιά ολόκληρα — ο σαρωτής i18n δεν συνθέτει. */
const BANNER_BY_KIND = {
  archived: {
    tone: 'info',
    dated: 'retiredBanner.archivedOn',
    datedBy: 'retiredBanner.archivedOnBy',
    undated: 'retiredBanner.archivedUndated',
  },
  trashed: {
    tone: 'warning',
    dated: 'retiredBanner.trashedOn',
    datedBy: 'retiredBanner.trashedOnBy',
    undated: 'retiredBanner.trashedUndated',
  },
} as const satisfies Record<RetiredKind, { tone: TrashNoticeTone; dated: string; datedBy: string; undated: string }>;

const PROMISE_KEYS = {
  'returns-off-market': 'listingStaysOffMarketNotice',
  'returns-as-it-was': 'retiredBanner.returnsAsItWas',
} as const satisfies Record<ReinstatePromise, string>;

/** Η στιγμή και ο δράστης της απόσυρσης, από τις σφραγίδες της ΕΝΕΡΓΗΣ απόσυρσης. */
function retirementStampOf(record: RetiredRecord, kind: RetiredKind): { at: Date | null; by: string | null } {
  return kind === 'archived'
    ? { at: normalizeToDate(record.archivedAt), by: record.archivedBy ?? null }
    : { at: normalizeToDate(record.deletedAt), by: record.deletedBy ?? null };
}

/**
 * «Τι το αναφέρει;» — ζωντανά από τον φρουρό διαγραφής.
 *
 * ⚠️ Ο φρουρός ζητά δικαίωμα **διαγραφής**· όποιος δεν το έχει παίρνει 403. Εκεί (και σε κάθε άλλη
 * αποτυχία) η γραμμή **παραλείπεται**: η ταινία δεν μαντεύει λόγο που δεν μπόρεσε να διαβάσει.
 */
function useRetirementReferences(entityType: ReinstatePromiseEntity, entityId: string, enabled: boolean): string | null {
  const [check, setCheck] = useState<DependencyCheckResult | null>(null);

  useEffect(() => {
    setCheck(null);
    if (!enabled) return undefined;

    let current = true;
    apiClient
      .get<DependencyCheckResult>(API_ROUTES.DELETION_GUARD.CHECK(entityType, entityId))
      .then((result) => { if (current) setCheck(result); })
      .catch(() => { /* 403 ή αποτυχία ⇒ καμία γραμμή */ });
    return () => { current = false; };
  }, [enabled, entityId, entityType]);

  return useMemo(() => {
    const blocking = check?.dependencies.filter((dependency) => dependency.count > 0) ?? [];
    return blocking.length === 0
      ? null
      : blocking.map((dependency) => `${dependency.label} (${dependency.count})`).join(' · ');
  }, [check]);
}

export function RetiredRecordBanner({ entityType, record, action }: RetiredRecordBannerProps) {
  const kind = retiredKindOf(record);
  const references = useRetirementReferences(entityType, record.id, kind === 'archived');

  if (kind === null) return null;
  return (
    <RetiredRecordNotice entityType={entityType} record={record} kind={kind} references={references} action={action} />
  );
}

interface RetiredRecordNoticeProps extends RetiredRecordBannerProps {
  readonly kind: RetiredKind;
  readonly references: string | null;
}

function RetiredRecordNotice({ entityType, record, kind, references, action }: RetiredRecordNoticeProps) {
  const { t } = useTranslation('trash');
  const stamp = retirementStampOf(record, kind);
  const names = useUserDisplayNames(stamp.by ? [stamp.by] : []);
  const name = stamp.by ? names.get(stamp.by) : undefined;
  const text = BANNER_BY_KIND[kind];

  const when = stamp.at === null
    ? t(text.undated)
    : name
      ? t(text.datedBy, { date: formatDate(stamp.at), name })
      : t(text.dated, { date: formatDate(stamp.at) });
  const purgeAt = kind === 'trashed' && stamp.at ? new Date(stamp.at.getTime() + TRASH_RETENTION_MS) : null;

  return (
    <section className="px-3 pt-2" aria-label={t('retiredBanner.label')}>
      <TrashNotice tone={text.tone}>
        <p className="font-medium text-foreground">{when}</p>
        {references && <p>{t('retiredBanner.keptBecause', { references })}</p>}
        {purgeAt && <p>{t('retiredBanner.purgeOn', { date: formatDate(purgeAt) })}</p>}
        <p>{t(PROMISE_KEYS[reinstatePromiseOf(entityType, kind)])}</p>
        <p>{t('retiredBanner.readOnly')}</p>
        {action}
      </TrashNotice>
    </section>
  );
}
