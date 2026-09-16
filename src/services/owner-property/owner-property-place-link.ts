import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { PLACE_REF_TREATMENT, verifyPlaceRef } from '@/services/places/public-place-read.service';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';

/**
 * @fileoverview **Ο ΔΕΣΜΟΣ ΠΡΟΣ ΤΟ ΕΠΙΠΕΔΟ Α** — εξήχθη από τον γραφέα (ADR-864 Φ3 · N.7.1).
 * @module services/owner-property/owner-property-place-link
 *
 * ⚠️ Εξαγωγή **χωρίς** αλλαγή σώματος: ο γραφέας έφτασε τις 491 γραμμές και η Φ3 προσθέτει τον
 * κριτή της κλειστής διάθεσης σε τρεις πράξεις του. Μόνος καλών: `owner-property-write.service`.
 */

// =============================================================================
// Ο ΔΕΣΜΟΣ ΠΡΟΣ ΤΟ ΕΠΙΠΕΔΟ Α — «δείχνει κάπου;», μία φορά για τις ΤΡΕΙΣ πόρτες
// =============================================================================

/**
 * **Αρνείται η γραφή εξαιτίας του δεσμού;** `null` = προχώρα.
 *
 * 🔑 **ΖΕΙ ΕΔΩ, ΚΑΙ ΓΙ' ΑΥΤΟ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ.** Οι **τρεις** πόρτες γραφής
 * (`POST /api/owner-properties` · `POST /api/owner-properties/brokered` ·
 * `PATCH /api/owner-properties/[id]`) περνούν **όλες** από τη
 * {@link createOwnerProperty} ή την {@link updateOwnerProperty} — η μεσιτική
 * μάλιστα καλεί την πρώτη. Γραμμένος στις διαδρομές, ο έλεγχος θα ήταν **τρία**
 * αντίγραφα και η επόμενη πόρτα θα γεννιόταν **χωρίς** αυτόν.
 *
 * 🔑 **Ο κριτής είναι ο ΥΠΑΡΧΩΝ {@link verifyPlaceRef}** — ο ίδιος που ρωτά ήδη η
 * πόρτα του επαγγελματία (`building-update.handler.ts`). Καμία νέα μηχανή, και η
 * **σημασία** των ετυμηγοριών διαβάζεται από το **ένα** {@link PLACE_REF_TREATMENT}.
 *
 * ⚠️ **Η ΑΠΟΥΣΙΑ ΔΕΣΜΟΥ ΔΕΝ ΕΙΝΑΙ ΣΦΑΛΜΑ, ΚΑΙ ΕΙΝΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: το `link:
 * null` σημαίνει *«δεν έδειξα κτίριο»* — **επιλογή, ποτέ προϋπόθεση** (ίδιος κανόνας
 * με το τοπογραφικό, §21.4). Και το `declined` **δεν έχει καν πεδίο** να ελεγχθεί:
 * ο τύπος το κάνει αδύνατο.
 *
 * ⚠️ **Δεν επαληθεύει ΑΛΗΘΕΙΑ, μόνο ΥΠΑΡΞΗ** (§14.3): το αν το ακίνητο του ανθρώπου
 * **είναι** μέσα σε εκείνο το κτίριο είναι **ισχυρισμός** του, και κανένα ερώτημα
 * βάσης δεν τον κρίνει. Αυτό που κρίνεται είναι αν ο δεσμός δείχνει **κάπου**.
 */
export async function placeLinkRefusal(
  adminDb: AdminFirestore,
  draft: OwnerPropertyDraft,
): Promise<OwnerPropertyWriteResult | null> {
  // ⚠️ **`?? null` και ΟΧΙ `=== null` σκέτο** — και το βρήκε **εκτέλεση**, όχι ανάγνωση
  //    (2026-08-27): με το `link` προσωρινά βγαλμένο από το σχήμα, το `undefined`
  //    δεν είναι `null`, ο έλεγχος **περνούσε**, και ο επαληθευτής έπαιρνε
  //    `undefined.landId` ⇒ **500**. Δηλαδή μια μελλοντική υποχώρηση του σχήματος θα
  //    γινόταν *«δικό μας λάθος»* αντί για ήπια απουσία δεσμού. Η απουσία και η ρητή
  //    άρνηση **είναι το ίδιο πράγμα εδώ**: «δεν έδειξε κτίριο».
  if (draft.place.kind !== 'declared' || (draft.place.link ?? null) === null) return null;

  const verdict = await verifyPlaceRef(adminDb, draft.place.link);

  // ⚠️ Κλειστό σύνολο, **χωρίς `default`**: μια τέταρτη θεραπεία δεν μεταγλωττίζεται
  //    μέχρι κάποιος να αποφασίσει τι σημαίνει για τη γραφή.
  switch (PLACE_REF_TREATMENT[verdict]) {
    case 'accept':
      return null;
    case 'reject':
      return { kind: 'invalid-place-link', verdict };
    case 'retry':
      return { kind: 'place-link-unverified' };
  }
}
