/**
 * @fileoverview ADR-915 §35 · §37 — η **απόφαση** μόνιμης υποχρέωσης ακινήτου: ο τύπος, το σχήμα του δίσκου και η ΜΙΑ
 *   ταυτότητα. Καθαρό (χωρίς `server-only`): το διαβάζουν ο αναγνώστης, ο γραφέας και τα τεστ.
 * @related lib/document-validity/property-upkeep.ts (το λεξιλόγιο · η απαίτηση) · upkeep-declarations.server.ts (I/O) ·
 *   lib/workspace/custody-scope.ts (σε ΠΟΙΟΥ το βιβλίο — το ΙΔΙΟ με ιστορικό και αρχεία, ADR-866 §5.2)
 * @module services/document-registry/upkeep-declaration-schema
 *
 * Fail-closed, όπως το `obligor-designation-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί **και**
 * το αναφέρει. ⛔ Ποτέ `as StoredUpkeepDeclaration`: μια χαλασμένη απόφαση που «μαντεύεται» θα έλεγε «λείπει ΥΔΕ» σε
 * ακίνητο που κανείς δεν επιβεβαίωσε.
 *
 * 🔑 §37 — **το βιβλίο της απόφασης είναι ο χώρος που διαχειρίζεται το ακίνητο** (`CustodyScope`): γραφείο
 *    `{ companyId }` ή ιδιώτης χωρίς μεσίτη `{ userId }` — **ακριβώς ένα**. Το έγγραφο εταιρείας μένει **ταυτόσημο** στον
 *    δίσκο (ίδιο πεδίο, ίδια ταυτότητα) ⇒ καμία μετανάστευση· το ερώτημα του μητρώου (`companyId ==`) δεν αλλάζει.
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
import { custodyScopeFromData, type CustodyScope } from '@/lib/workspace/custody-scope';
import { generateDeterministicPropertyUpkeepDeclarationId } from '@/services/enterprise-id.service';
import { REGISTRY_PROPERTY_SCOPES, type RegistryPropertyScope } from './document-registry.types';

/**
 * Το αποθηκευμένο έγγραφο (`property_upkeep_declarations`, deny-all, μόνο ο server). Ένα ανά (χώρος, ακίνητο, είδος)·
 * ο χώρος είναι **ακριβώς ένα** από `companyId` · `userId` (ένωση του `CustodyScope`, ποτέ και τα δύο).
 */
export type StoredUpkeepDeclaration = UpkeepDeclaration & CustodyScope & {
  readonly id: string;
  readonly scope: RegistryPropertyScope;
};

const nonEmpty = z.string().min(1);

const proposalSchema = z.object({
  verdict: z.enum(UPKEEP_PROPOSAL_VERDICTS),
  reason: z.enum(UPKEEP_PROPOSAL_REASONS),
  propertyClass: z.enum(PROPERTY_CLASSES).nullable(),
  phase: z.enum(OPERATIONAL_STATUSES).nullable(),
});

const declarationSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty.optional(),
  userId: nonEmpty.optional(),
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

/** Ωμό έγγραφο → `StoredUpkeepDeclaration`, ή `null` αν δεν είναι απόφαση που καταλαβαίνουμε (ή δεν έχει ΕΝΑ βιβλίο). */
export function parseUpkeepDeclaration(raw: unknown): StoredUpkeepDeclaration | null {
  const parsed = declarationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { companyId, userId, ...rest } = parsed.data;
  // Ο ΙΔΙΟΣ κριτής «ακριβώς ένα βιβλίο» με ιστορικό και αρχεία — κανένα δεύτερο refine εδώ.
  const owner = custodyScopeFromData({ companyId, userId });
  return owner === null ? null : { ...rest, ...owner };
}

/**
 * Η ΜΙΑ ταυτότητα ανά (χώρος, ακίνητο, είδος) — ο γραφέας βρίσκει το ίδιο έγγραφο χωρίς ερώτημα. ⚠️ Το seed του γραφείου
 * είναι **αμετάβλητο** από το §35 (`<companyId>:…`): κάθε υπάρχουσα απόφαση βρίσκεται στην ίδια διεύθυνση. Ο ιδιώτης
 * παίρνει διακριτό πρόθεμα (`user:`), ώστε καμία ταυτότητα εταιρείας να μη συμπέσει ποτέ με ταυτότητα χρήστη.
 */
export function upkeepDeclarationIdOf(owner: CustodyScope, propertyId: string, documentKind: string): string {
  const ledger = owner.userId !== undefined ? `user:${owner.userId}` : owner.companyId;
  return generateDeterministicPropertyUpkeepDeclarationId(`${ledger}:${propertyId}:${documentKind}`);
}
