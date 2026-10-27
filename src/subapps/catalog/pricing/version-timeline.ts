/**
 * =============================================================================
 * Η ΧΡΟΝΟΓΡΑΜΜΗ ΤΩΝ ΕΚΔΟΣΕΩΝ — ποια έκδοση ισχύει «ως προς» ημερομηνία (ADR-923 §5.11)
 * =============================================================================
 *
 * Μόνο οι **δημοσιευμένες** εκδόσεις (`published` · `superseded`) έχουν ισχύ. Η καθεμία ισχύει
 * από το `validFrom` της **έως** το `validFrom` της επόμενης — το `validTo` **παράγεται**, δεν
 * αποθηκεύεται (SAP: η νέα περίοδος κόβει την προηγούμενη).
 *
 * 🔑 Αμετάβλητο που εγγυάται η δημοσίευση ({@link judgeVersionPublication}): οι δημοσιευμένες
 * εκδόσεις έχουν **γνήσια αύξον** `validFrom` κατά αύξοντα αριθμό. Χωρίς αυτό, η έκδοση 3 με
 * `validFrom` πριν από την 2 θα έκανε την 2 να μην ισχύσει ποτέ — σιωπηλά. Μελλοντική έκδοση
 * επιτρέπεται: η προσφορά της 1/3 βρίσκει την τιμή της 1/3.
 *
 * @module subapps/catalog/pricing/version-timeline
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';
import type { ValidityWindow } from '@/lib/pricing/validity';
import type { CatalogIssueCode } from '../schema/catalog-issues';
import type { PriceListVersionDefinition } from '../types/price-list';
import { isPublishedStatus } from '../vocabulary/pricing';

/** Ό,τι χρειάζεται η χρονογραμμή από μια έκδοση. */
export type PriceVersionRef = Pick<PriceListVersionDefinition, 'number' | 'status' | 'validFrom'> & {
  readonly id: string;
};

export interface TimelineEntry<V extends PriceVersionRef> {
  readonly version: V;
  readonly window: ValidityWindow;
}

/** Οι δημοσιευμένες εκδόσεις σε σειρά αριθμού, με το παραγόμενο παράθυρο ισχύος τους. */
export function publishedTimeline<V extends PriceVersionRef>(versions: readonly V[]): readonly TimelineEntry<V>[] {
  const published = versions
    .filter((version) => isPublishedStatus(version.status))
    .map((version) => ({ version, fromMs: normalizeToMillisOrNull(version.validFrom) }))
    .filter((entry): entry is { version: V; fromMs: number } => entry.fromMs !== null)
    .sort((a, b) => a.version.number - b.version.number);
  return published.map((entry, index) => ({
    version: entry.version,
    window: { fromMs: entry.fromMs, untilMs: published[index + 1]?.fromMs ?? null },
  }));
}

/** Η έκδοση που ισχύει τη στιγμή `atMs`, ή `null` (πριν από την πρώτη δημοσίευση). */
export function versionAt<V extends PriceVersionRef>(versions: readonly V[], atMs: number): V | null {
  let current: V | null = null;
  for (const entry of publishedTimeline(versions)) {
    if (entry.window.fromMs !== null && entry.window.fromMs <= atMs) current = entry.version;
  }
  return current;
}

/**
 * Μπορεί η πρόχειρη έκδοση να δημοσιευτεί; Επιστρέφει κωδικό ευρήματος ή `null`.
 * `versionNotDraft` · `versionValidFromRequired` · `versionValidFromNotAfterPrevious`.
 */
export function judgeVersionPublication(
  candidate: PriceVersionRef,
  versions: readonly PriceVersionRef[],
): CatalogIssueCode | null {
  if (candidate.status !== 'draft') return 'versionNotDraft';
  const fromMs = normalizeToMillisOrNull(candidate.validFrom);
  if (fromMs === null) return 'versionValidFromRequired';
  const timeline = publishedTimeline(versions.filter((version) => version.id !== candidate.id));
  const latest = timeline[timeline.length - 1];
  if (latest?.window.fromMs != null && fromMs <= latest.window.fromMs) return 'versionValidFromNotAfterPrevious';
  return null;
}
