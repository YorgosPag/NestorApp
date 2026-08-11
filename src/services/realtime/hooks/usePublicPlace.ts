'use client';

/**
 * @fileoverview **Ο ΤΟΠΟΣ, ΔΙΑΒΑΣΜΕΝΟΣ** — η ανάγνωση του επιπέδου Α από τον πελάτη.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §14.2 · §14.4 · types/geo/public-place.ts
 * @module services/realtime/hooks/usePublicPlace
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-08-11 το `grep -rn "usePublicPlace\|readPublicLand\|readPublicBuilding" src`
 * επέστρεφε **0 αποτελέσματα**: το επίπεδο Α **γραφόταν** (Β2) και **κανείς δεν το
 * διάβαζε πίσω**. Η συνέπεια ήταν ορατή στην οθόνη — ο άνθρωπος έβλεπε
 * `pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf` ενώ η γη είχε **ήδη αποθηκευμένο**
 * `displayAddress: "Στέφανου Δραγούμη, 8"`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ **ΕΦΑΠΑΞ** ΑΝΑΓΝΩΣΗ, ΕΝΩ Ο `usePublicListings` ΕΙΝΑΙ **ΖΩΝΤΑΝΟΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν είναι ασυνέπεια — είναι **διαφορετική ερώτηση**. Ο `usePublicListings` είναι
 * ζωντανός επειδή μια αγγελία **αποσύρεται**: ο επισκέπτης θα κοίταζε τιμή που έπαψε
 * να ισχύει. Το επίπεδο Α είναι, κατά γράμμα του §14.1, *«ό,τι θα ήταν αληθές ακόμη κι
 * αν έσβηναν όλοι οι λογαριασμοί»* — δεν αποσύρεται και δεν παύει να ισχύει· το μόνο
 * που του συμβαίνει είναι να **συμπληρωθεί** (§14.3, συγχώνευση από ισχυρότερη πηγή),
 * και μια μπαγιάτικη ανάγνωση εκεί δείχνει **λιγότερα**, ποτέ **λάθος**.
 *
 * ⚠️ Και έχει **μετρήσιμο κόστος**: ένας τόπος = **δύο** έγγραφα. Μια λίστα 20
 * αγγελιών με ζωντανή ανάγνωση θα κρατούσε **40 ανοιχτούς ακροατές** για δεδομένα που
 * δεν αλλάζουν όσο ο άνθρωπος κοιτάζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΔΩ ΔΗΛΩΣΗ `tenant-scope-exempt`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν **διακοσμητική**, και αυτό **επαληθεύτηκε με μετάλλαξη** στη Β2 (SPEC-777A
 * §13.7.2 εύρημα #6): ο σαρωτής της CHECK 3.35 ταξινομεί αυτές τις δύο συλλογές ως
 * `not-tenant-scoped` από το **`mode: 'none'`** του `services/firestore/tenant-config.ts`
 * — δηλαδή η πύλη μένει πράσινη **με ή χωρίς** τη δήλωση. Μια έξοδος διαφυγής που δεν
 * κάνει τίποτα σήμερα γίνεται **ενεργή** τη μέρα που κάποιος αλλάξει τη ρύθμιση,
 * σιωπώντας παραβίαση που **κανείς δεν αποφάσισε** να σιωπήσει.
 *
 * Ο **πραγματικός** μηχανισμός είναι δύο πράγματα, και τα δύο γραμμένα αλλού:
 * `unscopedCategory: 'public-world'` με γραπτό λόγο στο `tenant-config.ts`, και
 * `allow read: if true` / `allow write: if false` στο `firestore.rules`.
 *
 * 🔴 Και από εκεί προκύπτει ο κανόνας που **δεν** επιτρέπεται να σπάσει (§14.4 κανόνας
 * 4 · §21.6): επειδή **κάθε ανώνυμος** διαβάζει αυτά τα έγγραφα, **καμία ταυτότητα
 * χρήστη ή πελάτη δεν γράφεται ποτέ εκεί**. Ο δεσμός ζει στο επίπεδο **Β** και δείχνει
 * προς τα εδώ — ποτέ αντίστροφα.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import type { PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';

const logger = createModuleLogger('usePublicPlace');

// ============================================================================
// ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ — έξι, ρητές, χωρίς σιωπηλή συγχώνευση
// ============================================================================

/**
 * **Τι ξέρουμε για αυτόν τον τόπο.**
 *
 * 🔴 **Το `dangling-building` ΔΕΝ συγχωνεύεται με το `found` + `building: null`**, και
 * η διάκριση είναι ακριβώς το μάθημα του §13.7.2 #5. Το `building: null` σημαίνει
 * *«ο δεσμός δείχνει σε **γη**, χωρίς κτίριο»* — απολύτως νόμιμο (*«ζητώ οικόπεδο για
 * αντιπαροχή»*). Το `dangling-building` σημαίνει *«ο δεσμός **ζήτησε** κτίριο και
 * εκείνο δεν υπάρχει»* — **σπασμένος δεσμός**. Συγχωνευμένα, η οθόνη θα έλεγε ήρεμα
 * «γη χωρίς κτίριο» για κάθε σπασμένο δεσμό, και **κανείς δεν θα το μάθαινε ποτέ**.
 *
 * ⚠️ Το `error` είναι *«δεν μάθαμε»*, **όχι** *«δεν υπάρχει»* — η ίδια διάκριση που
 * κόστισε 11 πράσινες άγκυρες στη Β2.
 */
export type PublicPlaceLookup =
  /** Δεν ζητήθηκε τόπος. **Δεν είναι φόρτωση** — δεν υπάρχει ερώτηση. */
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | {
      readonly state: 'found';
      readonly land: PublicLand;
      /** `null` **μόνο** όταν ο δεσμός δεν ζήτησε κτίριο. */
      readonly building: PublicBuilding | null;
    }
  /** Η **γη** του δεσμού δεν υπάρχει — ο δεσμός δείχνει στο κενό. */
  | { readonly state: 'absent' }
  /** Η γη υπάρχει, το **κτίριο** που ζητήθηκε όχι. */
  | { readonly state: 'dangling-building'; readonly land: PublicLand }
  | { readonly state: 'error'; readonly message: string };

// ============================================================================
// Η ΚΡΙΣΗ — καθαρή, ώστε να ελέγχεται χωρίς Firestore
// ============================================================================

/**
 * **Δύο έγγραφα (ή η απουσία τους) → μία ρητή κατάσταση.**
 *
 * 🔑 **Χωριστά από το hook επίτηδες.** Η κρίση *«τι σημαίνει αυτό που γύρισε η βάση;»*
 * είναι η μόνη λογική εδώ — και μια λογική που ζει μέσα σε `useEffect` μπορεί να
 * ελεγχθεί **μόνο** με προσομοίωση Firestore, δηλαδή σε κόσμο που δεν υπάρχει. Έτσι η
 * `dangling-building` αποκτά **απόδειξη ζωής** (ADR-749 §5) αντί να είναι φρουρός που
 * κανείς δεν πυροδότησε ποτέ.
 *
 * ⚠️ **Κλειστή λογιστική**: κάθε συνδυασμός των τριών εισόδων απαντιέται· δεν υπάρχει
 * κλάδος που πέφτει σιωπηλά σε προεπιλογή.
 */
export function classifyPlaceDocuments(
  ref: PlaceRef,
  land: PublicLand | null,
  building: PublicBuilding | null,
): PublicPlaceLookup {
  if (land === null) return { state: 'absent' };
  if (ref.buildingId === null) return { state: 'found', land, building: null };
  if (building === null) return { state: 'dangling-building', land };
  return { state: 'found', land, building };
}

/**
 * **Η διεύθυνση που δείχνεται στον άνθρωπο, ή `null` όταν δεν υπάρχει.**
 *
 * 🔑 **Η γη κρατά τη διεύθυνση, όχι το κτίριο** (Α1 — *«το τοπογραφικό είναι το
 * Ευαγγέλιο»*). Ένα δεύτερο `displayAddress` στο κτίριο θα ήταν **δεύτερη αλήθεια** για
 * το πού είναι το ίδιο πράγμα.
 *
 * ⚠️ **`null` σημαίνει «δεν λύθηκε» και η οθόνη οφείλει να το ΠΕΙ.** Μετρήθηκε στο
 * Overpass (SPEC-777A §13.7.2 #2) ότι μόλις **46 %** των κτιρίων στο κέντρο της
 * Θεσσαλονίκης έχουν διεύθυνση — δηλαδή **54 %** των τόπων φτάνουν εδώ ανώνυμοι. Δεν
 * είναι σπάνια περίπτωση προς σιωπή· είναι **η μισή αγορά**.
 */
export function placeDisplayAddress(lookup: PublicPlaceLookup): string | null {
  if (lookup.state === 'found' || lookup.state === 'dangling-building') {
    const address = lookup.land.displayAddress;
    return address !== null && address.trim() !== '' ? address : null;
  }
  return null;
}

// ============================================================================
// Η ΑΝΑΓΝΩΣΗ
// ============================================================================

async function readDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

/**
 * **Ο τόπος πίσω από έναν δεσμό.**
 *
 * ⚠️ **Οι εξαρτήσεις είναι οι ΤΑΥΤΟΤΗΤΕΣ, όχι το αντικείμενο.** Οι καταναλωτές
 * περνούν κυριολεκτικό `{ landId, buildingId }` — **νέο αντικείμενο σε κάθε απόδοση**
 * — οπότε ένα `[ref]` θα ξαναζητούσε τα έγγραφα σε **κάθε** πέρασμα. Ίδιο σχήμα με το
 * `selector ?? []` που το `reference_firestore_reactivity_hub` καταγράφει ως αιτία
 * βρόχου, και με τη ρητή επιλογή του `PlaceChooser`.
 */
export function usePublicPlace(ref: PlaceRef | null): PublicPlaceLookup {
  const [lookup, setLookup] = useState<PublicPlaceLookup>({ state: 'idle' });

  const landId = ref?.landId ?? null;
  const buildingId = ref?.buildingId ?? null;

  useEffect(() => {
    if (landId === null) {
      setLookup({ state: 'idle' });
      return;
    }

    // ⚠️ **Η ακύρωση δεν είναι τελετουργικό**: ο άνθρωπος μπορεί να αλλάξει τόπο ενώ
    // ταξιδεύει η προηγούμενη ανάγνωση, και μια αργοπορημένη απάντηση θα έγραφε στην
    // οθόνη τον τόπο που **εγκατέλειψε**.
    let live = true;
    setLookup({ state: 'loading' });

    void (async () => {
      try {
        const [land, building] = await Promise.all([
          readDocument<PublicLand>(COLLECTIONS.PUBLIC_LANDS, landId),
          buildingId === null
            ? Promise.resolve(null)
            : readDocument<PublicBuilding>(COLLECTIONS.PUBLIC_BUILDINGS, buildingId),
        ]);

        if (live) setLookup(classifyPlaceDocuments({ landId, buildingId }, land, building));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Δεν διαβάστηκε ο τόπος', { data: { landId, buildingId }, error: message });
        if (live) setLookup({ state: 'error', message });
      }
    })();

    return () => {
      live = false;
    };
  }, [landId, buildingId]);

  return lookup;
}
