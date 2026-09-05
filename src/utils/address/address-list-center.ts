/**
 * @fileoverview **ΠΟΥ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΠΡΑΓΜΑ** — ποιο σημείο εκπροσωπεί μια λίστα διευθύνσεων.
 * @related ADR-332 D23 · types/project/addresses · components/shared/addresses/editor
 * @module utils/address/address-list-center
 *
 * Ένα έργο, ένα κτίριο, μια επαφή **δεν έχουν συντεταγμένη** — έχουν *διευθύνσεις*, και
 * κάποιες από αυτές έχουν συντεταγμένη. Η μετάφραση από το ένα στο άλλο είναι **μία**
 * ερώτηση, και γι' αυτό έχει ένα σπίτι.
 *
 * 🔑 **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΓΝΩΣΤΟ `find(isPrimary) ?? [0]`** — και η διαφορά είναι
 * ολόκληρη: εκείνο απαντά *«ποια διεύθυνση εκπροσωπεί;»*, αυτό απαντά *«ποιο **σημείο**
 * εκπροσωπεί;»*. **Μια κύρια διεύθυνση χωρίς συντεταγμένες δεν είναι κέντρο.** Αν
 * επιστρεφόταν, ο καλών θα έπαιρνε `undefined` και θα νόμιζε ότι *καμία* διεύθυνση δεν
 * έχει θέση — ενώ η δεύτερη της λίστας μπορεί να έχει. Η υποχώρηση εδώ δεν είναι
 * συμβιβασμός· είναι η **μόνη αληθινή** απάντηση.
 *
 * ⚠️ **Δηλωμένη παράλειψη**: δεν υπολογίζεται *μέσος όρος* συντεταγμένων. Ο μέσος όρος
 * δύο υπαρκτών διευθύνσεων είναι ένα σημείο **που δεν υπάρχει** — και για ένα έργο με
 * μετωπικές διευθύνσεις σε δύο δρόμους θα έπεφτε **μέσα στο οικοδομικό τετράγωνο**. Η
 * χρήση εδώ είναι «πόσο κοντά είναι αυτός ο υποψήφιος», όπου ένα υπαρκτό σημείο
 * απαντά σωστά και ένα φανταστικό εισάγει σφάλμα που κανείς δεν μπορεί να ελέγξει.
 */

/** Το σημείο, όπως το εννοεί κάθε γεωγραφικός καταναλωτής του έργου. */
export interface CoordinatePoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Το ελάχιστο που χρειάζεται μια διεύθυνση για να κριθεί.
 *
 * Δηλωμένο **δομικά** — όχι `ProjectAddress` — ώστε να δέχεται και τη διεύθυνση επαφής
 * και τη διεύθυνση ακινήτου χωρίς μετατροπή. Η μετατροπή θα ήταν το σημείο απόκλισης.
 */
export interface AddressWithOptionalPosition {
  readonly isPrimary?: boolean;
  readonly coordinates?: { readonly lat: number; readonly lng: number } | null;
}

/**
 * ⚠️ **`NaN` δεν είναι συντεταγμένη.** Ο έλεγχος δεν είναι διακοσμητικός: τιμές από
 * `parseFloat` σε άδειο πεδίο, ή από παλιά έγγραφα, φτάνουν ως `NaN` και περνούν κάθε
 * έλεγχο `typeof === 'number'`. Ένα `NaN` κέντρο μολύνει **κάθε** απόσταση που μετριέται
 * από αυτό, και οι συγκρίσεις με `NaN` είναι όλες ψευδείς ⇒ η κατάταξη θα κατέρρεε
 * σιωπηλά στη σειρά του παρόχου, χωρίς κανένα σφάλμα πουθενά.
 *
 * Εξάγεται ώστε **κάθε** καταναλωτής σημείου να ρωτά τον ίδιο κριτή.
 */
export function usablePoint(
  point: { readonly lat: number; readonly lng: number } | null | undefined,
): CoordinatePoint | undefined {
  if (!point) return undefined;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return undefined;
  return { lat: point.lat, lng: point.lng };
}

/**
 * Η ίδια ερώτηση, για μια **διεύθυνση** αντί για σκέτο ζεύγος.
 *
 * ⚠️ **Αναθέτει, δεν ξαναγράφει** *(ADR-332 D25 §πινέζα)*: όταν προστέθηκε δεύτερος
 * καταναλωτής του «είναι αυτό χρησιμοποιήσιμο σημείο;» *(η πινέζα που έσυρε ο άνθρωπος)*,
 * η εύκολη κίνηση ήταν ένας δεύτερος έλεγχος `Number.isFinite`. Δύο έλεγχοι για την ίδια
 * ερώτηση αποκλίνουν — και η απόκλιση **δεν φαίνεται**, γιατί και οι δύο επιστρέφουν
 * κάτι εύλογο.
 */
function usablePosition(address: AddressWithOptionalPosition): CoordinatePoint | undefined {
  return usablePoint(address.coordinates);
}

/**
 * Το σημείο που εκπροσωπεί αυτή τη λίστα: **η κύρια διεύθυνση που έχει θέση**, αλλιώς
 * **η πρώτη που έχει θέση**, αλλιώς `undefined`.
 *
 * `undefined` σημαίνει «δεν ξέρουμε πού είναι» — **δεδομένο**, όχι σφάλμα. Ο καλών
 * οφείλει να συμπεριφερθεί σαν να μην υπήρχε η πληροφορία, ποτέ να μαντέψει σημείο.
 */
export function addressListCenter(
  addresses: readonly AddressWithOptionalPosition[] | undefined | null,
): CoordinatePoint | undefined {
  if (!addresses?.length) return undefined;
  for (const address of addresses) {
    if (address.isPrimary) {
      const position = usablePosition(address);
      if (position) return position;
    }
  }
  for (const address of addresses) {
    const position = usablePosition(address);
    if (position) return position;
  }
  return undefined;
}
