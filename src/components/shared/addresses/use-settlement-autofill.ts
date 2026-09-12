'use client';
/**
 * @fileoverview **Ο ΟΙΚΙΣΜΟΣ ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΜΟΝΟΣ ΤΟΥ** — δύο δρόμοι, μία ευθύνη.
 * @module components/shared/addresses/use-settlement-autofill
 * @related ADR-332 (ο επεξεργαστής διεύθυνσης) · ADR-332 D27 Ζ5 (η μνήμη της μηχανής)
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1)**: το `AddressWithHierarchy.tsx` απαντά *«πώς
 * δείχνει και πώς επεξεργάζεται μια διεύθυνση;»*. Αυτό εδώ απαντά *«πώς βρίσκεται ο
 * οικισμός όταν ο άνθρωπος δεν τον έγραψε;»* — δεύτερη ευθύνη, καθαρά ασύγχρονη, με
 * **δικές της** παγίδες χρόνου. Η εξαγωγή έγινε όταν το component πέρασε τις 500
 * γραμμές· δεν άλλαξε **καμία** συμπεριφορά.
 *
 * ── ΔΥΟ ΔΡΟΜΟΙ, ΟΧΙ ΕΝΑΣ ──
 * 1. **Γεωκωδικοποίηση** (οδός + Τ.Κ. → πόλη): ο άνθρωπος πληκτρολογεί, εμείς ρωτάμε.
 * 2. **Ανάλυση ιεραρχίας** (όνομα → id + πλήρης διαδρομή): το όνομα ήρθε **από αλλού**
 *    (σύρσιμο πινέζας στον χάρτη) χωρίς id, και πρέπει να δέσει στα δικά μας δεδομένα.
 *
 * ⚠️ **ΚΑΙ ΟΙ ΔΥΟ ΜΟΝΟ ΓΙΑ ΕΛΛΗΝΙΚΗ ΔΙΕΥΘΥΝΣΗ**: η ελληνική διοικητική ιεραρχία είναι
 * κρυμμένη στις υπόλοιπες, οπότε το ερώτημα δεν έχει υποκείμενο.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  HIERARCHY_SOURCE,
  lineageIdsOf,
  useAdministrativeHierarchy,
} from '@/hooks/useAdministrativeHierarchy';
import { geocodeAddress } from '@/lib/geocoding/geocoding-service';
import {
  identifyExact,
  identifyWithin,
  type AdminIdentitySources,
} from '@/lib/places/admin-identity';
import { buildAdminNameIndex } from '@/lib/places/admin-name-index';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import { stripGreekAdminPrefix } from '@/utils/address/place-name';

import { type AddressWithHierarchyValue } from './address-with-hierarchy-config';
import { applyResolvedPath } from './address-hierarchy-field-ops';

/** Πόσο περιμένουμε μετά το τελευταίο πλήκτρο πριν ρωτήσουμε τη μηχανή. */
const AUTOFILL_DEBOUNCE_MS = 1500;

/** Ελάχιστο μήκος οδού πριν το ερώτημα έχει νόημα. */
const MIN_STREET_LENGTH = 2;

/** Το επίπεδο του οικισμού στην ελληνική διοικητική ιεραρχία. */
const SETTLEMENT_LEVEL = 8;

export interface SettlementAutoFillInput {
  readonly current: AddressWithHierarchyValue;
  readonly onChange: (next: AddressWithHierarchyValue) => void;
  readonly disabled: boolean;
  readonly isGreekAddress: boolean;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 **ΕΔΩ ΖΟΥΣΕ Ο ΑΝΤΙΣΤΟΙΧΙΣΤΗΣ, ΚΑΙ ΕΔΕΝΕ ΤΟ 33% ΤΩΝ ΟΝΟΜΑΤΩΝ ΛΑΘΟΣ.**
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Ήταν `makeNameMatcher` *(ακριβές **ή** κοινό πρόθεμα 5 χαρακτήρων)* + `findByPostalCode`,
 * σαρωμένα με `settlements.find(...)` — δηλαδή σε **σειρά αρχείου**, όπου η **ακριβής**
 * αντιστοίχιση **δεν είχε προτεραιότητα**. Μετρημένο στο πραγματικό μητρώο, 2026-09-12:
 *
 * - **3.067 από 9.294** ονόματα *(**33,0%**)* έδεναν σε **ΑΛΛΟΝ** οικισμό.
 * - Το χειρότερο δείγμα δεν το έσωζε **ούτε** ο Τ.Κ.: «Καλλιθέα» και «Καλλίστη» έχουν
 *   **τον ίδιο** Τ.Κ. 69100 ⇒ διεύθυνση στην **Καλλιθέα Ροδόπης** αποθηκευόταν με δήμο
 *   **ΚΟΜΟΤΗΝΗΣ**, και το όνομα στην οθόνη γινόταν σιωπηλά «Καλλίστη».
 * - Και η αποσαφήνιση με Τ.Κ. έβλεπε μόνο **949 από τους 13.272** οικισμούς *(**7,2%**)*.
 *
 * 🔑 **Ο κανόνας ήταν σωστός στο ΚΙΝΗΤΡΟ** *(η γενική πτώση: «Ελευθερίου» ≠ «Ελευθέριο»)*
 * **και επικίνδυνος στην ΕΚΤΕΛΕΣΗ**. Το κίνητρο ζει: ο πυρήνας κρατά ανοχή — αλλά **μόνο
 * μέσα σε αποδεδειγμένη εμβέλεια**, όπου η αμφισημία μετρήθηκε **0,4%** αντί 18–27%.
 *
 * ⛔ **ΜΗΝ τον ξαναγράψεις εδώ.** Ο κριτής ζει στο `lib/places/admin-identity.ts`, είναι
 * καθαρός, δέχεται εγχυόμενους αναγνώστες, και τρέχει **και** στον διακομιστή — όπου η
 * αλυσίδα του Nominatim έχει ακόμη τα προθέματά της, δηλαδή **δηλωμένη βαθμίδα**.
 */

/**
 * Και οι δύο δρόμοι της αυτόματης συμπλήρωσης, σε ένα σημείο.
 *
 * ⚠️ **Η ΤΙΜΗ ΔΕΝ ΕΠΙΣΤΡΕΦΕΤΑΙ — εφαρμόζεται μέσω `onChange`**, ακριβώς όπως όταν ο
 * κώδικας ζούσε μέσα στο component. Ένα hook που επέστρεφε «προτεινόμενη τιμή» θα
 * ζητούσε από κάθε καλούντα να θυμηθεί να την εφαρμόσει — ευθύνη πίσω έξω.
 *
 * 🔴 **ΕΠΙΣΤΡΕΦΕΙ ΟΜΩΣ ΤΗΝ ΑΚΥΡΩΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΗ.** Όταν ο άνθρωπος επιλέγει
 * οικισμό ή επίπεδο ιεραρχίας, κάθε auto-fill σε πτήση πρέπει να **πεθάνει**: η ρητή
 * πρόθεση νικά πάντα μια εξωτερική πηγή (πειθαρχία `buildSelected`, ADR-601). Χωρίς
 * αυτό, μια απάντηση που έφτασε **μετά** την επιλογή θα την έσβηνε — και αυτό είναι
 * ακριβώς το περιστατικό που περιγράφει το σχόλιο των refs παρακάτω.
 *
 * ⛔ **ΜΗΝ την κάνεις `useEffect` σε dependency**: η ακύρωση είναι **γεγονός**
 * (ο άνθρωπος πάτησε), όχι κατάσταση — ένα effect θα την έτρεχε και σε επαναποδόσεις
 * που κανείς δεν ζήτησε.
 */
export function useSettlementAutoFill({
  current,
  onChange,
  disabled,
  isGreekAddress,
}: SettlementAutoFillInput): { readonly cancelPendingAutoFill: () => void } {
  const { isLoading, resolvePath, findById } = useAdministrativeHierarchy();

  /**
   * Οι **τρεις** αναγνώστες που ζητά ο κριτής, από τη μεριά του πελάτη.
   *
   * 🔑 **Η ταυτότητα κρέμεται από το `findById`, και ΜΟΝΟ από αυτό** — δηλαδή από το
   * στιγμιότυπο *(ADR-846)*. Όταν φτάσουν τα 3,7 MB, η ταυτότητα αλλάζει και το ευρετήριο
   * **ξαναχτίζεται**· ⛔ **ΜΗΝ** βάλεις `[]` «για σταθερότητα» — αυτό ήταν ακριβώς το
   * σφάλμα που άφηνε τον επιλογέα περιοχής **άδειο** σε πρώτο φόρτωμα.
   */
  const sources = useMemo<AdminIdentitySources>(
    () => ({
      // ⚠️ **`peek()` και όχι όρισμα**, ίδιο ιδίωμα με το `lineageIdsOf`: το στιγμιότυπο
      //    δεν εκτίθεται από το hook. Η **ορθότητα** έρχεται από τη λίστα εξαρτήσεων
      //    παρακάτω — το `findById` αλλάζει ταυτότητα **ακριβώς όταν** φτάνουν τα δεδομένα.
      index: buildAdminNameIndex(HIERARCHY_SOURCE.peek()?.entities.values() ?? []),
      placeOf: findById,
      lineageOf: lineageIdsOf,
    }),
    [findById],
  );

  // ---------------------------------------------------------------------------
  // 🔴 ΑΜΥΝΑ ΕΝΑΝΤΙ STALE CLOSURES ΣΕ ΚΑΘΥΣΤΕΡΗΜΕΝΑ ΑΠΟΤΕΛΕΣΜΑΤΑ GEOCODING.
  //    *(Μετακόμισε εδώ μαζί με τον κώδικά του — 2026-09-12, N.7.1.)*
  //
  // Το `clearTimeout` ακυρώνει τον χρονιστή, ΟΧΙ ένα fetch που έχει ήδη φύγει.
  // Όταν το promise λυνόταν αργότερα, διάβαζε το closure της στιγμής που ξεκίνησε
  // — δηλαδή κατάσταση ΠΡΙΝ την επιλογή του χρήστη — και (α) περνούσε τον έλεγχο
  // «δεν υπάρχει οικισμός», (β) με το stale spread πετούσε το μόλις τεθέν
  // `settlementId` και όλη την ιεραρχία. Αποτέλεσμα: γραφόταν το διοικητικό όνομα
  // του geocoder αντί για την ετικέτα που είχε επιλέξει ο χρήστης.
  //
  // `currentRef`       → ζωντανή κατάσταση τη στιγμή της άφιξης του αποτελέσματος.
  // `autoFillEpochRef` → κάθε νέα ενέργεια ακυρώνει ό,τι είναι σε πτήση.
  // ---------------------------------------------------------------------------
  const currentRef = useRef(current);
  currentRef.current = current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const autoFillEpochRef = useRef(0);
  const autoFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── ΔΡΟΜΟΣ 1: οδός + Τ.Κ. → πόλη, μέσω γεωκωδικοποίησης ──
  useEffect(() => {
    // Κάθε επαναξιολόγηση ακυρώνει προηγούμενο αίτημα σε πτήση.
    const epoch = ++autoFillEpochRef.current;

    const hasStreet = current.street.trim().length > MIN_STREET_LENGTH;
    const hasPostalCode = toCanonicalGreekPostalCode(current.postalCode).length === 5;
    const hasSettlement = current.settlementName.trim().length > 0;

    if (!hasStreet || !hasPostalCode || hasSettlement || disabled || !isGreekAddress) {
      return;
    }

    if (autoFillTimerRef.current) {
      clearTimeout(autoFillTimerRef.current);
    }

    autoFillTimerRef.current = setTimeout(async () => {
      try {
        const atRequest = currentRef.current;
        const streetWithNumber = [atRequest.street, atRequest.number].filter(Boolean).join(' ');
        const result = await geocodeAddress({
          street: streetWithNumber,
          postalCode: atRequest.postalCode,
          country: 'gr',
        });

        // ⚠️ Από εδώ και κάτω μπορεί να έχουν περάσει δευτερόλεπτα και ο χρήστης να
        // έχει ήδη επιλέξει οικισμό. ΠΟΤΕ μην διαβάσεις το closure — μόνο ζωντανή
        // κατάσταση, και μόνο αν το αίτημα είναι ακόμη το τρέχον.
        if (epoch !== autoFillEpochRef.current) return;

        const live = currentRef.current;
        if (!result?.resolvedCity || live.settlementName.trim()) return;

        onChangeRef.current({
          ...live,
          settlementName: stripGreekAdminPrefix(result.resolvedCity),
        });
      } catch {
        // Σιωπηλή αστοχία — η αυτόματη συμπλήρωση είναι best-effort, ποτέ φραγμός.
      }
    }, AUTOFILL_DEBOUNCE_MS);

    return () => {
      if (autoFillTimerRef.current) {
        clearTimeout(autoFillTimerRef.current);
      }
    };
  }, [
    current.street,
    current.number,
    current.postalCode,
    current.settlementName,
    disabled,
    current,
    isGreekAddress,
  ]);

  // ── ΔΡΟΜΟΣ 2: όνομα χωρίς ταυτότητα (το έγραψε άνθρωπος, ή ήρθε από σύρσιμο) → ιεραρχία ──
  useEffect(() => {
    if (isLoading || !current.settlementName.trim() || current.settlementId || !isGreekAddress) {
      return;
    }

    // 🔑 **Αν υπάρχει ΑΠΟΔΕΔΕΙΓΜΕΝΟΣ δήμος, η ερώτηση γίνεται απαντήσιμη**: μέσα σε δήμο οι
    //    41 ομώνυμες «Καλλιθέα» γίνονται μία (**93,9%** των ομωνύμων ζουν σε άλλον δήμο).
    //    Χωρίς δήμο, η **μόνη** ασφαλής απάντηση είναι «ακριβές και μοναδικό στη χώρα».
    // ⚠️ **ΔΥΝΑΤΟΤΗΤΑ ΠΟΥ ΑΦΑΙΡΕΘΗΚΕ ΕΠΙΤΗΔΕΣ, ΜΕ ΜΕΤΡΗΣΗ — ΜΗΝ ΤΗΝ «ΕΠΑΝΑΦΕΡΕΙΣ» ΩΜΑ.**
    //    Εδώ γινόταν αποσαφήνιση με τον **Τ.Κ.** σε τρία σκαλιά. Έφυγε γιατί ήταν
    //    **ενεργά επιβλαβής**: εφαρμοζόταν πάνω σε **ανεκτική** αντιστοίχιση ονόματος, και
    //    «Καλλιθέα»/«Καλλίστη» έχουν **τον ίδιο** Τ.Κ. 69100 ⇒ διάλεγε τη λάθος. Και
    //    κάλυπτε μόνο **949 από 13.272** οικισμούς (**7,2%**)· βοηθούσε σε **305 από 1.368**
    //    ομάδες ομωνύμων.
    //    ✅ Αν χρειαστεί ξανά, ο **ασφαλής** τρόπος είναι: αποσαφήνιση με Τ.Κ. **μόνο ανάμεσα
    //    σε ΑΚΡΙΒΕΙΣ ομώνυμους** — απαιτεί `postalCode` στο `AdminPlace`. Δεν μπήκε τώρα
    //    επειδή ο διακομιστής αποδεικνύει πλέον τον δήμο (μετρημένο 14/14), οπότε η διαδρομή
    //    του συρσίματος έχει **σχεδόν πάντα** εμβέλεια — που είναι αυστηρά ισχυρότερη.
    const label = current.settlementName.trim();
    const verdict = current.municipalityId
      ? identifyWithin(label, SETTLEMENT_LEVEL, current.municipalityId, sources)
      : identifyExact(label, SETTLEMENT_LEVEL, sources, current.postalCode);

    // ⚠️ **Μόνο `identified` γράφει.** `ambiguous` / `absent` / `unknown` αφήνουν την οθόνη
    //    **ακριβώς** όπως την έγραψε ο άνθρωπος: το κείμενό του μένει, η ταυτότητα δεν
    //    επινοείται, και τα οκτώ πεδία της φόρμας περιμένουν να αποσαφηνίσει.
    if (verdict.kind !== 'identified') return;

    const updated = { ...current };
    // Ταυτότητα και ετικέτα **δεν επιτρέπεται να αποκλίνουν** — έχουμε id, άρα το δικό μας όνομα.
    updated.settlementName = verdict.entity.name;
    applyResolvedPath(updated, resolvePath(verdict.entity.id));
    onChange(updated);
  }, [
    current.settlementName,
    current.settlementId,
    current.municipalityId,
    current.postalCode,
    isLoading,
    isGreekAddress,
  ]);

  // Η ακύρωση είναι **αύξηση του epoch**, όχι `clearTimeout`: ο χρονιστής μπορεί να έχει
  // ήδη λήξει και το αίτημα να ταξιδεύει. Ό,τι επιστρέψει, θα βρει το epoch αλλαγμένο
  // και θα το πετάξει μόνο του — ίδιο ιδίωμα και στους δύο δρόμους.
  const cancelPendingAutoFill = useCallback(() => {
    autoFillEpochRef.current += 1;
  }, []);

  return { cancelPendingAutoFill };
}
