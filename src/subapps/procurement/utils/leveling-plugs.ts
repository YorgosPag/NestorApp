/**
 * Καλύψεις κενού του PM σε μια προσφορά (ADR-327 §8.5 — BuildingConnected «plug») — ο κανόνας μεταβολής, καθαρός.
 *
 * - **Μία ανά γραμμή RFQ**: νέα τιμή αντικαθιστά την παλιά · `amount: null` = αφαίρεση (επιστροφή στην αυτόματη).
 * - **Ιδεμποτικό**: ίδιο ποσό + ίδια σημείωση ⇒ `changed: false` (καμία εγγραφή, καμία γραμμή ιστορικού).
 * - Καθαρό ποσό, στρογγυλεμένο σε λεπτά — όπως όλο το leveling.
 *
 * @module subapps/procurement/utils/leveling-plugs
 */

import type { QuoteLevelingPlug } from '../types/quote';
import type { AuditCollectionOp, AuditFieldChange } from '@/types/audit-trail';
import { roundMajor } from '@/lib/money/money';

export interface LevelingPlugChange {
  rfqLineId: string;
  /** `null` = αφαίρεση της κάλυψης. */
  amount: number | null;
  note: string | null;
}

export interface LevelingPlugUpsert {
  plugs: QuoteLevelingPlug[];
  changed: boolean;
  previous: QuoteLevelingPlug | null;
}

function cleanNote(note: string | null): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

export function upsertLevelingPlug(
  current: ReadonlyArray<QuoteLevelingPlug>,
  change: LevelingPlugChange,
  stamp: Pick<QuoteLevelingPlug, 'setBy' | 'setAt'>,
): LevelingPlugUpsert {
  const previous = current.find((p) => p.rfqLineId === change.rfqLineId) ?? null;
  const others = current.filter((p) => p.rfqLineId !== change.rfqLineId);
  if (change.amount === null) {
    return { plugs: others, changed: previous !== null, previous };
  }
  const amount = roundMajor(change.amount);
  const note = cleanNote(change.note);
  if (previous && previous.amount === amount && previous.note === note) {
    return { plugs: [...current], changed: false, previous };
  }
  return { plugs: [...others, { rfqLineId: change.rfqLineId, amount, note, ...stamp }], changed: true, previous };
}

/**
 * Η γραμμή του **entity audit** (ADR-195) για μια αλλαγή κάλυψης — ως αλλαγή **συλλογής**, όχι ως ωμό πεδίο.
 *
 * Μετρημένο ζωντανά (2026-10-28, ADR-327): το ιστορικό έγραφε `levelingPlugs.rfqln_…: 150 → —` — διαδρομή πεδίου με
 * αναγνωριστικό μέσα, που κανένα μητρώο ετικετών δεν μπορεί να λύσει, χωρίς τη γραμμή και χωρίς την αιτιολογία.
 * Τώρα: `field` σταθερό (`levelingPlugs` → `audit.fields.quote.levelingPlugs`), η γραμμή ως `itemKey`/`itemLabel`,
 * ποσό + αιτιολογία ως υπο-αλλαγές. Αριθμοί, όχι μορφοποιημένο κείμενο: το ιστορικό είναι αμετάβλητο, η μορφή του
 * θεατή όχι.
 */
export function levelingPlugAuditChange(
  previous: Pick<QuoteLevelingPlug, 'amount' | 'note'> | null,
  next: Pick<QuoteLevelingPlug, 'amount' | 'note'> | null,
  line: { id: string; label: string },
): AuditFieldChange {
  const op: AuditCollectionOp = previous === null ? 'added' : next === null ? 'removed' : 'modified';
  const oldNote = previous?.note ?? null;
  const newNote = next?.note ?? null;
  return {
    field: 'levelingPlugs',
    kind: 'collection',
    op,
    itemKey: line.id,
    itemLabel: line.label,
    oldValue: previous?.amount ?? null,
    newValue: next?.amount ?? null,
    subChanges: [
      { subField: 'levelingPlugAmount', oldValue: previous?.amount ?? null, newValue: next?.amount ?? null },
      ...(oldNote !== newNote ? [{ subField: 'levelingPlugNote', oldValue: oldNote, newValue: newNote }] : []),
    ],
  };
}

/** Γραμμή ιστορικού: `1.200,00 → 950,00` ως μηχανικά σταθερό κείμενο (`1200 → 950`, `— → 950`, `950 → —`). */
export function describePlugValue(plug: Pick<QuoteLevelingPlug, 'amount'> | null): string {
  return plug ? String(plug.amount) : '—';
}
