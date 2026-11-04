/**
 * @fileoverview **Τα στάδια της ροής πωλήσεων — η ΜΙΑ ρίζα του λεξιλογίου** (ADR-929 · ADR-812).
 * @module config/crm/opportunity-stages
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: ως τις 2026-11-04 ζούσαν **δύο ασύμβατα** λεξιλόγια — ο τύπος/η οθόνη/τα δεδομένα με
 *    `initial_contact … closed_won/closed_lost` και ο server με `lead/qualified/…/won/lost`. Ο server **απέρριπτε
 *    κάθε πραγματικό στάδιο**. Τώρα κάθε άλλη δήλωση είναι **δεμένη** εδώ (CHECK 3.73).
 *
 * 🔑 **Το `kind` είναι η αλήθεια, το `status` παράγεται**: `open` ⇒ `active`, `won` ⇒ `won`, `lost` ⇒ `lost`.
 *    Δύο ανεξάρτητα πεδία για το ίδιο γεγονός θα απέκλιναν (κάρτα «Κλειστό (Επιτυχία)» με `status: 'active'`).
 * 🔑 **Η σειρά του πίνακα = η σειρά του πίνακα αυτού.** Καμία δεύτερη λίστα στηλών.
 *
 * Καθαρό αρχείο — χωρίς `'use client'`, χωρίς I/O: το διαβάζουν και ο browser και ο server.
 */

import { toCatalogKey } from '@/lib/string/catalog-key';

export type OpportunityStageKind = 'open' | 'won' | 'lost';

/** Η ΡΙΖΑ (CHECK 3.73): τα στάδια με τη σειρά του πίνακα. Καμία δεύτερη λίστα στηλών. */
export const OPPORTUNITY_STAGE_IDS = [
  'initial_contact',
  'qualification',
  'viewing',
  'proposal',
  'negotiation',
  'contract',
  'closed_won',
  'closed_lost',
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGE_IDS)[number];

export interface OpportunityStageSpec {
  readonly id: OpportunityStage;
  readonly kind: OpportunityStageKind;
  /** Πιθανότητα κλεισίματος (%) — για το σταθμισμένο σύνολο. Η αλλαγή σταδίου τη θέτει (Salesforce Stage → Probability). */
  readonly defaultProbability: number;
  /**
   * Μέρες στο ίδιο στάδιο πριν η κάρτα δηλωθεί «παγωμένη» (Pipedrive rotting). `null` ⇒ δεν παγώνει
   * (τα κλειστά στάδια είναι τελικά).
   */
  readonly staleAfterDays: number | null;
}

type StageTraits = Omit<OpportunityStageSpec, 'id'>;

/** Οι ιδιότητες κάθε σταδίου — `Record` πάνω στη ρίζα: στάδιο χωρίς ιδιότητες = σφάλμα μεταγλώττισης. */
const STAGE_TRAITS: Readonly<Record<OpportunityStage, StageTraits>> = {
  initial_contact: { kind: 'open', defaultProbability: 10, staleAfterDays: 7 },
  qualification: { kind: 'open', defaultProbability: 20, staleAfterDays: 10 },
  viewing: { kind: 'open', defaultProbability: 35, staleAfterDays: 14 },
  proposal: { kind: 'open', defaultProbability: 50, staleAfterDays: 14 },
  negotiation: { kind: 'open', defaultProbability: 70, staleAfterDays: 21 },
  contract: { kind: 'open', defaultProbability: 90, staleAfterDays: 30 },
  closed_won: { kind: 'won', defaultProbability: 100, staleAfterDays: null },
  closed_lost: { kind: 'lost', defaultProbability: 0, staleAfterDays: null },
};

/** Τα στάδια με τις ιδιότητές τους, με τη σειρά του πίνακα. */
export const OPPORTUNITY_STAGES: readonly OpportunityStageSpec[] = OPPORTUNITY_STAGE_IDS.map((id) => ({ id, ...STAGE_TRAITS[id] }));

/** Η τιμή του `status` που αντιστοιχεί σε κάθε είδος σταδίου (παράγωγο, ποτέ ανεξάρτητο). */
export const STATUS_OF_STAGE_KIND = {
  open: 'active',
  won: 'won',
  lost: 'lost',
} as const satisfies Record<OpportunityStageKind, string>;

export function isOpportunityStage(value: unknown): value is OpportunityStage {
  return typeof value === 'string' && (OPPORTUNITY_STAGE_IDS as readonly string[]).includes(value);
}

export function stageSpec(stage: OpportunityStage): OpportunityStageSpec {
  return { id: stage, ...STAGE_TRAITS[stage] };
}

export function stageKind(stage: OpportunityStage): OpportunityStageKind {
  return stageSpec(stage).kind;
}

/** Το (μοναδικό) στάδιο κλεισίματος ενός είδους — `closed_won` / `closed_lost`. */
export function closingStageOf(kind: Exclude<OpportunityStageKind, 'open'>): OpportunityStage {
  const stage = OPPORTUNITY_STAGES.find((spec) => spec.kind === kind);
  if (!stage) throw new Error(`No opportunity stage of kind: ${kind}`);
  return stage.id;
}

export function isClosedStage(stage: OpportunityStage): boolean {
  return stageKind(stage) !== 'open';
}

/** `closed_won` → `closedWon` — το κλειδί του καταλόγου ιστορικού (CHECK 3.14: μόνο camelCase). */
export function stageCatalogKey(stage: OpportunityStage): string {
  return toCatalogKey(stage);
}
