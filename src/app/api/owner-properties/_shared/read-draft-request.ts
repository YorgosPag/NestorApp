/**
 * @fileoverview **ΤΟ ΚΟΙΝΟ ΑΝΟΙΓΜΑ ΚΑΘΕ ΓΡΑΦΗΣ ΠΡΟΣΦΟΡΑΣ** — σώμα, ταυτότητα, προσχέδιο.
 * @related ADR-777 §7 (Α14 · Α22) · ADR-832 · CLAUDE.md N.18 (CHECK 3.28)
 * @module app/api/owner-properties/_shared/read-draft-request
 *
 * ⚠️ **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: οι δύο πόρτες γραφής (`/owner-properties` του ιδιώτη ·
 * `/owner-properties/brokered` του μεσίτη) άνοιγαν με **κατά λέξη το ίδιο** τρίπτυχο,
 * και η CHECK 3.28 το μέτρησε ως κλώνο (6 γραμμές / 56 tokens) **μέσα στο ίδιο
 * commit**. Δύο δίδυμα σημαίνουν δύο ευκαιρίες να αποκλίνει η **σειρά** — και η
 * σειρά **είναι** συμβόλαιο, βλ. παρακάτω.
 *
 * 🔑 **Η ΣΕΙΡΑ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ Η ΑΦΑΙΡΕΣΗ ΑΞΙΖΕΙ.** Ένα έγκυρο προσχέδιο με
 * **άκυρη** ταυτότητα δεν έχει πού να γραφτεί· αν κρινόταν πρώτο το περιεχόμενο, ο
 * άνθρωπος θα διάβαζε λάθος πεδίο στο μήνυμα. Με **μία** διατύπωση, η σειρά παύει να
 * είναι σύμβαση που κάποιος θυμάται και γίνεται **ιδιότητα της διαδρομής**.
 *
 * ⚠️ **ΤΟ ΩΜΟ ΣΩΜΑ ΤΑΞΙΔΕΥΕΙ ΠΙΣΩ**, επίτηδες: η πόρτα του μεσίτη διαβάζει από αυτό
 * και το `mandate`, που ο ιδιώτης **δεν έχει**. Χωρίς αυτό θα το ξαναδιάβαζε — και
 * `request.json()` καταναλώνει το ρεύμα: η δεύτερη κλήση πετά.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΠΟΚΡΙΣΗ ΕΔΩ.** Επιστρέφει **κρίση**, όχι `NextResponse` — ώστε κάθε
 * πόρτα να απαντά με το δικό της σχήμα. Η μετάφραση σε απόκριση ζει στο
 * {@link module:app/api/owner-properties/_shared/respond}.
 */

import type { NextRequest } from 'next/server';

import {
  ownerPropertyDraftFromRequest,
  ownerPropertyIdFromRequest,
} from '@/lib/owner-property/owner-property-draft-schema';
import type { OwnerPropertyDraft } from '@/types/owner-property';

/**
 * Τι διαβάστηκε από το αίτημα — ρητές καταστάσεις, ποτέ εξαίρεση ως ροή ελέγχου.
 *
 * 🔑 Το `malformed` είναι **λίστα ονομάτων πεδίων**, όχι κείμενο: τα ονόματα γίνονται
 * κλειδιά i18n στην απόκριση (N.11), ώστε ο άνθρωπος να δει **ποιο** πεδίο φταίει.
 */
export type ReadDraftRequestResult =
  | {
      readonly ok: true;
      /** Το ωμό σώμα — για όποια πόρτα διαβάζει **κι άλλα** πεδία από αυτό. */
      readonly body: unknown;
      readonly id: string;
      readonly draft: OwnerPropertyDraft;
    }
  | { readonly ok: false; readonly malformed: readonly string[] };

/**
 * Διαβάζει **σώμα → ταυτότητα → προσχέδιο**, με αυτή τη σειρά.
 *
 * ⚠️ Το `json()` πετά σε κατεστραμμένο σώμα, και ένα ακάλυπτο `throw` εδώ θα γινόταν
 * **500** — δηλαδή *«δικό μας λάθος»* για κάτι που έστειλε ο πελάτης. Γι' αυτό
 * `catch(() => null)`: το `null` πέφτει στους ελέγχους παρακάτω ως **άκυρη είσοδος**.
 */
export async function readOwnerPropertyDraftRequest(
  request: NextRequest,
): Promise<ReadDraftRequestResult> {
  const body: unknown = await request.json().catch(() => null);

  const id = ownerPropertyIdFromRequest((body as { id?: unknown } | null)?.id);
  if (id === null) return { ok: false, malformed: ['id'] };

  const parsed = ownerPropertyDraftFromRequest(body);
  if (!parsed.ok) return { ok: false, malformed: parsed.malformed };

  return { ok: true, body, id, draft: parsed.draft };
}
