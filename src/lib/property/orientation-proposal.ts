/**
 * @fileoverview **ΠΡΟΤΑΣΗ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ (SSoT)** — ό,τι *υπολόγισε* το σύστημα για τις όψεις ενός ακινήτου, χωριστά από
 * ό,τι *δήλωσε* ο άνθρωπος.
 * @related ADR-937 Φάση Β/Γ · `types/property.ts` (`orientationProposal`) · PATCH `/api/properties/[id]` (σχήμα) ·
 *   φόρμα ακινήτου (λωρίδα «Πρόταση … [Εφαρμογή]») · `lib/energy-certificate/pea-proposal.ts` (το ίδιο πρότυπο)
 * @module lib/property/orientation-proposal
 *
 * 🔴 **Η πρόταση ΔΕΝ είναι τιμή.** Ζει σε **δικό της** πεδίο και **ποτέ** δεν γράφει το `orientations`. Το δηλωμένο
 *    γράφεται μόνο όταν ο άνθρωπος πατήσει «Εφαρμογή» και αποθηκεύσει — ο άνθρωπος έχει τον τελευταίο λόγο.
 * 🔑 `northAssumed: true` = το σχέδιο δεν είχε γεωαναφορά, και ο Βορράς θεωρήθηκε «πάνω». Λέγεται στη φόρμα, ώστε ο
 *    άνθρωπος να ξέρει πόσο να εμπιστευτεί την πρόταση (καμία σιωπηλή μαντεψιά).
 */

import { z } from 'zod';

import { Orientation, ORIENTATIONS, type OrientationType } from '@/constants/property-features-enterprise';

export const ORIENTATION_PROPOSAL_SOURCES = ['floorplan', 'map'] as const;
export type OrientationProposalSource = typeof ORIENTATION_PROPOSAL_SOURCES[number];

export interface OrientationProposal {
  readonly values: readonly OrientationType[];
  readonly source: OrientationProposalSource;
  /** Ο Βορράς δεν ήταν γνωστός και θεωρήθηκε «πάνω» (+Y) στο σχέδιο. Στον χάρτη είναι πάντα `false`. */
  readonly northAssumed: boolean;
  /** ISO-8601 — πότε υπολογίστηκε. */
  readonly proposedAt: string;
}

/** Το σχήμα του PATCH — ρητό επειδή το σχήμα της διαδρομής είναι `.passthrough()`. `null` = «σβήσε την πρόταση». */
export const orientationProposalSchema = z.object({
  values: z.array(z.nativeEnum(Orientation)).max(ORIENTATIONS.length),
  source: z.enum(ORIENTATION_PROPOSAL_SOURCES),
  northAssumed: z.boolean(),
  proposedAt: z.string().datetime(),
});

/** Ο ΕΝΑΣ αναγνώστης: ό,τι κι αν είναι αποθηκευμένο, βγαίνει έγκυρη πρόταση ή `null`. */
export function readOrientationProposal(raw: unknown): OrientationProposal | null {
  const parsed = orientationProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Οι τιμές της πρότασης στη σειρά του λεξιλογίου, χωρίς διπλότυπα — ώστε δύο ίσες προτάσεις να συγκρίνονται ίσες. */
export function canonicalOrientations(values: Iterable<OrientationType>): OrientationType[] {
  const set = new Set(values);
  return ORIENTATIONS.filter((o) => set.has(o));
}

/** Συμφωνεί η πρόταση με τη δηλωμένη τιμή; (ως σύνολα) */
export function proposalMatches(proposal: OrientationProposal, declared: readonly OrientationType[]): boolean {
  const a = canonicalOrientations(proposal.values);
  const b = canonicalOrientations(declared);
  return a.length === b.length && a.every((o, i) => o === b[i]);
}
