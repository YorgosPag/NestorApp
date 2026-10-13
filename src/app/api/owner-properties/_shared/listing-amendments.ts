/**
 * @fileoverview **ΟΙ «ΠΡΑΞΕΙΣ ΜΕΤΑ ΤΗ ΔΗΜΟΣΙΕΥΣΗ» ΤΗΣ ΑΓΓΕΛΙΑΣ ΙΔΙΩΤΗ** — ένας πίνακας, ένα κλειδί σώματος η καθεμία.
 * @related ADR-842 Α2 · ADR-898 Φ3β · ADR-777 §8.93 · §8.94 · `services/owner-property/owner-property-amendment.ts`
 * @module app/api/owner-properties/_shared/listing-amendments
 *
 * 🔴 **Εξήχθη στην ΤΡΙΤΗ πράξη** (ADR-777 §8.94). Η διαδρομή είχε δύο κλάδους με το ίδιο σώμα — «βρες το κλειδί ·
 * πέρασέ το από το σχήμα του · δώσ' το στον γραφέα του» — και το ΠΕΑ θα γινόταν ο τρίτος (N.18). Εδώ κάθε πράξη είναι
 * **μία γραμμή**, και η επόμενη ενότητα του «Βελτίωσε την αγγελία σου» δεν αγγίζει τη διαδρομή.
 *
 * 🔑 **Η σειρά του πίνακα είναι η σειρά ελέγχου**, και σώμα με δύο κλειδιά-πράξεις εκτελεί **μόνο την πρώτη** — όπως
 * πριν. Ο πελάτης στέλνει πάντα ένα (`amendOwnerListing`).
 *
 * ⚠️ **Καμία από αυτές δεν είναι πεδίο του προσχεδίου των 8**: η `/offers/new` δεν μεγαλώνει (ADR-842 Α2).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { NextResponse } from 'next/server';
import type { ZodType, ZodTypeDef } from 'zod';

import { commonChargesPatchSchema } from '@/lib/common-charges/common-charges';
import { energyCertificatePatchSchema } from '@/lib/energy-certificate/energy-certificate';
import { objectiveValueDeclarationsPatchSchema } from '@/lib/objective-value/objective-value-declarations';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { isPlainRecord } from '@/lib/type-guards';
import { setOwnerPropertyCommonCharges } from '@/services/owner-property/owner-property-common-charges.service';
import { setOwnerPropertyObjectiveValueDeclarations } from '@/services/owner-property/owner-property-declarations.service';
import { setOwnerPropertyEnergyCertificate } from '@/services/owner-property/owner-property-energy-certificate.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';

import { respondToMalformed, respondToWrite, type OwnerPropertyResponse } from './respond';

type AmendmentWriter<Patch> = (
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  patch: Patch,
  actor: ListingActor,
) => Promise<OwnerPropertyWriteResult>;

interface ListingAmendment {
  /** Το κλειδί του σώματος που ονομάζει την πράξη — και το μονοπάτι που αναφέρεται όταν το σχήμα αρνηθεί. */
  readonly key: string;
  readonly respond: (
    raw: unknown,
    adminDb: AdminFirestore,
    ownerPropertyId: string,
    actor: ListingActor,
  ) => Promise<NextResponse<OwnerPropertyResponse>>;
}

/** Σχήμα και γραφέας δένονται **εδώ**, με τον ίδιο τύπο διόρθωσης — ο πίνακας από κάτω δεν μπορεί να τα μπερδέψει. */
function amendmentOf<Patch>(
  key: string,
  schema: ZodType<Patch, ZodTypeDef, unknown>,
  write: AmendmentWriter<Patch>,
): ListingAmendment {
  return {
    key,
    respond: async (raw, adminDb, ownerPropertyId, actor) => {
      const patch = schema.safeParse(raw);
      if (!patch.success) return respondToMalformed([key]);
      return respondToWrite(await write(adminDb, ownerPropertyId, patch.data, actor));
    },
  };
}

const LISTING_AMENDMENTS: readonly ListingAmendment[] = [
  // ADR-898 Φ3β — οι δηλώσεις της αντικειμενικής.
  amendmentOf(
    'objectiveValueDeclarations',
    objectiveValueDeclarationsPatchSchema,
    setOwnerPropertyObjectiveValueDeclarations,
  ),
  // ADR-777 §8.93 — τα κοινόχρηστα.
  amendmentOf('commonCharges', commonChargesPatchSchema, setOwnerPropertyCommonCharges),
  // ADR-777 §8.94 — το ενεργειακό πιστοποιητικό (και, στην ίδια εγγραφή, η αξίωση νομιμότητάς του).
  amendmentOf('energy', energyCertificatePatchSchema, setOwnerPropertyEnergyCertificate),
];

/**
 * **Αν το σώμα ονομάζει πράξη μετά τη δημοσίευση, η απάντησή της** — αλλιώς `null`, και η διαδρομή συνεχίζει.
 *
 * ⚠️ Ρητό `undefined` ως «δεν στάλθηκε»: ένα `null` στο κλειδί **είναι** σώμα (και το σχήμα θα το αρνηθεί ονομαστικά).
 */
export function respondToListingAmendment(
  body: unknown,
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  actor: ListingActor,
): Promise<NextResponse<OwnerPropertyResponse>> | null {
  if (!isPlainRecord(body)) return null;
  const amendment = LISTING_AMENDMENTS.find(({ key }) => body[key] !== undefined);
  return amendment ? amendment.respond(body[amendment.key], adminDb, ownerPropertyId, actor) : null;
}
