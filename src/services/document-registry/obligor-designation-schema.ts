/**
 * @fileoverview ADR-915 §26 — ο **ρητός** υπεύθυνος εγγράφων ενός ακινήτου: ο τύπος, το σχήμα του δίσκου και η ΜΙΑ
 *   ταυτότητα. Καθαρό (χωρίς `server-only`): το διαβάζουν ο αναγνώστης, ο γραφέας και τα τεστ.
 * @related lib/document-validity/obligor-lead.ts (πού μπαίνει στην αλυσίδα) · obligor-designations.server.ts (I/O)
 * @module services/document-registry/obligor-designation-schema
 *
 * Fail-closed, όπως το `document-request-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί **και** το
 * αναφέρει. ⛔ Ποτέ `as DocumentObligorDesignation`: μια χαλασμένη επαφή που «μαντεύεται» θα έδειχνε λάθος άνθρωπο
 * ως υπεύθυνο.
 */

import { z } from 'zod';

import { generateDeterministicDocumentObligorDesignationId } from '@/services/enterprise-id.service';
import { REGISTRY_PROPERTY_SCOPES, type RegistryPropertyScope } from './document-registry.types';

/** Το αποθηκευμένο έγγραφο (`document_obligor_designations`, deny-all, μόνο ο server). Ένα ανά (γραφείο, ακίνητο). */
export interface DocumentObligorDesignation {
  readonly id: string;
  readonly companyId: string;
  readonly propertyId: string;
  readonly scope: RegistryPropertyScope;
  /** Η επαφή (`cont_*`) που όρισε το γραφείο — μετρά **μόνο** όσο είναι ιδιοκτήτης (`obligorLeadOf`). */
  readonly contactId: string;
  readonly designatedByUid: string;
  readonly designatedAt: string;
}

const nonEmpty = z.string().min(1);

const designationSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  propertyId: nonEmpty,
  scope: z.enum(REGISTRY_PROPERTY_SCOPES),
  contactId: nonEmpty,
  designatedByUid: nonEmpty,
  designatedAt: nonEmpty,
});

/** Ωμό έγγραφο → `DocumentObligorDesignation`, ή `null` αν δεν είναι ορισμός που καταλαβαίνουμε. */
export function parseObligorDesignation(raw: unknown): DocumentObligorDesignation | null {
  const parsed = designationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Η ΜΙΑ ταυτότητα ανά (γραφείο, ακίνητο) — ο γραφέας και ο αναγνώστης βρίσκουν το ίδιο έγγραφο χωρίς ερώτημα. */
export function obligorDesignationIdOf(companyId: string, propertyId: string): string {
  return generateDeterministicDocumentObligorDesignationId(`${companyId}:${propertyId}`);
}
