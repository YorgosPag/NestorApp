/**
 * @fileoverview ADR-915 §35 — η **απόφαση** μόνιμης υποχρέωσης ακινήτου: ο τύπος, το σχήμα του δίσκου και η ΜΙΑ
 *   ταυτότητα. Καθαρό (χωρίς `server-only`): το διαβάζουν ο αναγνώστης, ο γραφέας και τα τεστ.
 * @related lib/document-validity/property-upkeep.ts (το λεξιλόγιο · η απαίτηση) · upkeep-declarations.server.ts (I/O)
 * @module services/document-registry/upkeep-declaration-schema
 *
 * Fail-closed, όπως το `obligor-designation-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί **και**
 * το αναφέρει. ⛔ Ποτέ `as StoredUpkeepDeclaration`: μια χαλασμένη απόφαση που «μαντεύεται» θα έλεγε «λείπει ΥΔΕ» σε
 * ακίνητο που κανείς δεν επιβεβαίωσε.
 */

import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import { PROPERTY_CLASSES } from '@/constants/property-types';
import {
  UPKEEP_DECISIONS,
  UPKEEP_EXEMPTION_REASONS,
  UPKEEP_PROPOSAL_REASONS,
  UPKEEP_PROPOSAL_VERDICTS,
  type UpkeepDeclaration,
} from '@/lib/document-validity/property-upkeep';
import { generateDeterministicPropertyUpkeepDeclarationId } from '@/services/enterprise-id.service';
import { REGISTRY_PROPERTY_SCOPES, type RegistryPropertyScope } from './document-registry.types';

/** Το αποθηκευμένο έγγραφο (`property_upkeep_declarations`, deny-all, μόνο ο server). Ένα ανά (γραφείο, ακίνητο, είδος). */
export interface StoredUpkeepDeclaration extends UpkeepDeclaration {
  readonly id: string;
  readonly companyId: string;
  readonly scope: RegistryPropertyScope;
}

const nonEmpty = z.string().min(1);

const proposalSchema = z.object({
  verdict: z.enum(UPKEEP_PROPOSAL_VERDICTS),
  reason: z.enum(UPKEEP_PROPOSAL_REASONS),
  propertyClass: z.enum(PROPERTY_CLASSES).nullable(),
  phase: z.enum(OPERATIONAL_STATUSES).nullable(),
});

const declarationSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  propertyId: nonEmpty,
  scope: z.enum(REGISTRY_PROPERTY_SCOPES),
  documentKind: z.enum(DOCUMENT_KINDS),
  decision: z.enum(UPKEEP_DECISIONS),
  exemptionReason: z.enum(UPKEEP_EXEMPTION_REASONS).nullable(),
  proposalAtDecision: proposalSchema,
  declaredByUid: nonEmpty,
  declaredAt: nonEmpty,
}).refine(
  // Εξαίρεση **πάντα** με λόγο· επιβεβαίωση **ποτέ** με λόγο εξαίρεσης — ο δίσκος δεν κρατά αντιφάσεις.
  (value) => (value.decision === 'not-required') === (value.exemptionReason !== null),
);

/** Ωμό έγγραφο → `StoredUpkeepDeclaration`, ή `null` αν δεν είναι απόφαση που καταλαβαίνουμε. */
export function parseUpkeepDeclaration(raw: unknown): StoredUpkeepDeclaration | null {
  const parsed = declarationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Η ΜΙΑ ταυτότητα ανά (γραφείο, ακίνητο, είδος) — ο γραφέας βρίσκει το ίδιο έγγραφο χωρίς ερώτημα. */
export function upkeepDeclarationIdOf(companyId: string, propertyId: string, documentKind: string): string {
  return generateDeterministicPropertyUpkeepDeclarationId(`${companyId}:${propertyId}:${documentKind}`);
}
