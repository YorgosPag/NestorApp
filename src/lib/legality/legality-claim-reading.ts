/**
 * @fileoverview **Ανάγνωση αποθηκευμένων αξιώσεων νομιμότητας** — το σύνορο ανάμεσα στη βάση και στο κανάλι.
 * @related ADR-838 · ADR-777 §8.94 · ./legality-claim.ts · services/listings/legality-projection.ts
 * @module lib/legality/legality-claim-reading
 *
 * 🔑 **Γεννήθηκε μαζί με τον πρώτο γραφέα** (η δήλωση του ΠΕΑ, ADR-777 §8.94). Όσο κανείς δεν έγραφε αξιώσεις, το
 * `property.legality ?? []` δεν μπορούσε να φέρει τίποτα κακό· από τη στιγμή που γράφονται, ένα δύσμορφο στοιχείο θα
 * έφτανε ως «δηλωμένο» στη δημόσια αγγελία.
 *
 * ⚠️ **Δύσμορφη αξίωση ⇒ ΠΕΤΙΕΤΑΙ, ποτέ «διορθώνεται»**: η απουσία αξίωσης διαβάζεται `undeclared`, που είναι η
 * αλήθεια για κάτι που δεν μπορούμε να διαβάσουμε. Μια μισή αξίωση θα δήλωνε προέλευση που κανείς δεν δήλωσε.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 */

import type { SpaceRef } from '@/lib/spaces/space-ref';
import { isPlainRecord } from '@/lib/type-guards';

import {
  LEGALITY_CLAIM_KINDS,
  claimAuthorityIsWellFormed,
  claimSubjectIsWellFormed,
  type LegalityClaim,
  type LegalityClaimKind,
} from './legality-claim';
import { LEGALITY_TIERS, type LegalityTier } from './legality-tier';

function isClaimKind(raw: unknown): raw is LegalityClaimKind {
  return LEGALITY_CLAIM_KINDS.some((kind) => kind === raw);
}

function isTier(raw: unknown): raw is LegalityTier {
  return LEGALITY_TIERS.some((tier) => tier === raw);
}

function isStringOrNull(raw: unknown): raw is string | null {
  return raw === null || typeof raw === 'string';
}

function spaceRefOf(raw: unknown): SpaceRef | null {
  if (!isPlainRecord(raw) || typeof raw.propertyId !== 'string' || !isStringOrNull(raw.spaceId)) return null;
  return { propertyId: raw.propertyId, spaceId: raw.spaceId };
}

/** Όλοι οι χώροι, ή τίποτα: ένα αδιάβαστο μέλος κάνει **όλο** το υποκείμενο άγνωστο. */
function subjectOf(raw: unknown): readonly SpaceRef[] | null {
  if (!Array.isArray(raw)) return null;
  const spaces = raw.map(spaceRefOf);
  return spaces.every((space): space is SpaceRef => space !== null) ? spaces : null;
}

function claimOf(raw: unknown): LegalityClaim | null {
  if (!isPlainRecord(raw) || !isClaimKind(raw.kind) || !isTier(raw.tier)) return null;
  const subject = subjectOf(raw.subject);
  if (subject === null || typeof raw.assertedAt !== 'string') return null;
  if (!isStringOrNull(raw.value) || !isStringOrNull(raw.authority) || !isStringOrNull(raw.validUntil)) return null;

  const claim: LegalityClaim = {
    kind: raw.kind,
    subject,
    tier: raw.tier,
    value: raw.value,
    authority: raw.authority,
    assertedAt: raw.assertedAt,
    validUntil: raw.validUntil,
  };
  return claimSubjectIsWellFormed(claim) && claimAuthorityIsWellFormed(claim) ? claim : null;
}

/** Ό,τι είναι αποθηκευμένο (ή λείπει) → οι **καλοσχηματισμένες** αξιώσεις, με τη σειρά του εγγράφου. */
export function readLegalityClaims(raw: unknown): readonly LegalityClaim[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(claimOf).filter((claim): claim is LegalityClaim => claim !== null);
}
