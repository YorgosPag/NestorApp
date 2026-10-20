/**
 * @fileoverview ADR-915 §35 — το **αίτημα** απόφασης μόνιμης υποχρέωσης και οι αρνήσεις του: ΕΝΑ σχήμα και ΕΝΑΣ πίνακας
 *   κωδικών για route **και** οθόνη (ιδίωμα `facts-declaration.ts`).
 * @related lib/document-validity/property-upkeep.ts (το λεξιλόγιο) · services/document-registry/upkeep-declaration.service.ts
 * @module lib/document-validity/upkeep-declaration-request
 *
 * **Layering**: leaf — zod + σταθερές, μηδέν I/O. Το διαβάζουν ο διακομιστής (σύνορο) και ο πελάτης (μήνυμα άρνησης).
 */

import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { UPKEEP_DECISIONS, UPKEEP_EXEMPTION_REASONS } from './property-upkeep';

/**
 * `decision: null` = «ξανά ρώτα» (η απόφαση σβήνεται, γυρίζει η πρόταση). Εξαίρεση **πάντα** με λόγο· επιβεβαίωση **ποτέ**
 * με λόγο — μια αντίφαση δεν περνά το σύνορο (400), ώστε ο δίσκος να μην την κρατήσει ποτέ.
 */
export const upkeepDeclarationBody = z.object({
  propertyId: z.string().trim().min(1),
  documentKind: z.enum(DOCUMENT_KINDS),
  decision: z.enum(UPKEEP_DECISIONS).nullable(),
  exemptionReason: z.enum(UPKEEP_EXEMPTION_REASONS).nullable(),
}).refine((body) => (body.decision === 'not-required') === (body.exemptionReason !== null), {
  message: 'exemptionReason is required exactly when decision is not-required',
  path: ['exemptionReason'],
});

export type UpkeepDeclarationBody = z.infer<typeof upkeepDeclarationBody>;

/** §36 — η ανάγνωση της καρτέλας ακινήτου: `GET …/upkeep-declarations?propertyId=`. */
export const upkeepPropertyQuery = z.object({ propertyId: z.string().trim().min(1) });

/**
 * Οι αρνήσεις του διακομιστή:
 * - `absent`       — το ακίνητο δεν είναι **του γραφείου** (ξένο ≡ ανύπαρκτο, ποτέ 403)
 * - `retired`      — §36: το ακίνητο είναι στο αρχείο ή στον κάδο (ADR-281) — καμία απόφαση πάνω του
 * - `not-standing` — το είδος **δεν** είναι μόνιμη υποχρέωση στον κατάλογο (ο νόμος αποφασίζει, όχι το αίτημα)
 */
export const UPKEEP_DECLARATION_REFUSALS = ['absent', 'retired', 'not-standing'] as const;
export type UpkeepDeclarationRefusal = (typeof UPKEEP_DECLARATION_REFUSALS)[number];

export const UPKEEP_DECLARATION_ERROR_CODES: Readonly<Record<UpkeepDeclarationRefusal, string>> = {
  absent: 'NOT_FOUND',
  // Ο ίδιος κωδικός με τον φρουρό ακινήτου (`assertNotRetired`, ADR-281): μία λέξη για «αποσυρμένο» σε όλο το API.
  retired: 'ENTITY_RETIRED',
  'not-standing': 'NOT_STANDING_OBLIGATION',
};

/** Ο κωδικός της απόκρισης → η άρνηση· άγνωστος κωδικός ή δίκτυο ⇒ `null` («δεν αποθηκεύτηκε»). */
export function upkeepDeclarationRefusalOfCode(code: string | null): UpkeepDeclarationRefusal | null {
  return UPKEEP_DECLARATION_REFUSALS.find((refusal) => UPKEEP_DECLARATION_ERROR_CODES[refusal] === code) ?? null;
}
