/**
 * @fileoverview **Νέα στοιχεία των εμπορικών όρων** — οι προεπιλογές, καθαρές (ADR-928 §5.4 · Φ3γ-2 απόφαση 6).
 * @module subapps/procurement/subcontracts/terms/term-edits
 *
 * 🔑 Μια προεπιλογή δεν «αποφασίζει» για τον άνθρωπο. Ό,τι πρέπει να γράψει (ρόλος, περιγραφή, ποσότητα) μένει κενό ή
 *    μηδέν, και ο επικυρωτής το ζητά στη θέση του. Ό,τι έχει λογική αφετηρία (50/50 στον επιμερισμό, όπως ο γερανός του
 *    2009· «πριν από κάθε πληρωμή» για τα έγγραφα της αλληλέγγυας ευθύνης) ξεκινά από εκεί.
 */

import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import type { AgreementLine } from '../types/agreement-line';
import {
  REQUIRED_DOCUMENT_KINDS,
  type CostSharingItem,
  type CrewMember,
  type CrewTerms,
  type MinimumOutput,
  type PenaltyTerms,
  type RequiredDocument,
} from '../types/commercial-terms';

export const NEW_PENALTY: PenaltyTerms = { perDay: 0, capOfContractValue: 0 };

export const NEW_CREW: CrewTerms = { minimumHeadcount: 1, members: [] };

export function newCrewMember(): CrewMember {
  return { role: { el: '' }, trade: null, ratioParts: 1, dailyWage: null };
}

/** Επιμερισμός εξ ημισείας εργοδότη / υπεργολάβου — η πιο συχνή μορφή (2009: γερανός 50/50). */
export function newCostSharingItem(): CostSharingItem {
  const half = BP_PER_WHOLE / 2;
  return { description: { el: '' }, shares: [{ party: 'employer', share: half }, { party: 'subcontractor', share: half }] };
}

/** Το πρώτο είδος εγγράφου που δεν ζητείται ακόμη· `null` όταν ζητούνται όλα. */
export function newRequiredDocument(existing: readonly RequiredDocument[]): RequiredDocument | null {
  const present = new Set(existing.map((document) => document.kind));
  const kind = REQUIRED_DOCUMENT_KINDS.find((candidate) => !present.has(candidate));
  return kind ? { kind, when: { kind: 'before_each_payment' } } : null;
}

/** Ελάχιστη απόδοση για την πρώτη γραμμή που δεν έχει ακόμη· `null` όταν δεν μένει καμία. */
export function newMinimumOutput(lines: readonly AgreementLine[], existing: readonly MinimumOutput[]): MinimumOutput | null {
  const present = new Set(existing.map((output) => output.lineId));
  const line = lines.find((candidate) => !present.has(candidate.id));
  return line ? { lineId: line.id, milliUnitsPerDay: 0 } : null;
}
