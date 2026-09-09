/**
 * level-floorplan-loss — «**έχασε** αυτό το επίπεδο την κάτοψή του;» (ADR-845 Ο-16).
 *
 * ## Η ερώτηση που ρωτιόταν λάθος
 *
 * Ο `useLevelFloorplanSync` ρωτούσε: *«τράπηκε στον κάδο αρχείο στο οποίο δείχνει κάποιο
 * επίπεδο; → καθάρισε τον καμβά του»*. Είναι φτιαγμένος για **εξωτερική διαγραφή** (ο
 * χρήστης σβήνει την κάτοψη από την καρτέλα αρχείων του κτηρίου) και για εκείνη είναι
 * σωστός.
 *
 * Αλλά η **αντικατάσταση** κάτοψης τραβάει κι αυτή το προηγούμενο αρχείο στον κάδο — και
 * το κάνει **μέσα στην ίδια εισαγωγή**, αφού η νέα σκηνή έχει ήδη γραφτεί
 * (`commitImportedScene`: `setLevelScene` βήμα 2 → `linkSceneFileToLevel` βήμα 5). Άρα ο
 * συνδρομητής έσβηνε **τον καμβά που η ίδια η εισαγωγή μόλις είχε γεμίσει**.
 *
 * 🔴 ΜΕΤΡΗΜΕΝΟ (2026-09-09, «Διαμέρισμα 80 τ.μ.»): το `files` έγγραφο ήταν άψογο
 * (`status: ready`, 1169 οντότητες, 6 layers όλα ορατά), το `.scene.json` έγκυρο
 * (272.296 bytes), και το `dxf_viewer_levels` έγγραφο έδειχνε στο **σωστό** αρχείο.
 * Ο καμβάς έμενε κενός. Ο άνθρωπος έβλεπε **δύο toasts που φαίνονταν να διαφωνούν**
 * («ανέβηκε επιτυχώς» + «μεταφέρθηκε στον κάδο») ενώ ήταν **το ίδιο συμβάν**.
 *
 * ## Γιατί δεν αρκούσε να «κοιτάξει καλύτερα» ο συνδρομητής
 *
 * Το `level.sceneFileId` του νέου αρχείου ταξιδεύει μέσω server `PATCH /api/dxf-levels` →
 * `onSnapshot` → React state. Ο κάδος είναι **τοπική** εγγραφή Firestore και εκπέμπει
 * αμέσως. Ο συνδρομητής **δεν μπορεί** να έχει δει τη νέα κατάσταση: το αντίγραφο που
 * διαβάζει είναι δομικά μπαγιάτικο. Κάθε λύση βασισμένη στη σειρά ή σε αναμονή είναι
 * κούρσα — δηλαδή το ίδιο ελάττωμα με άλλη πιθανότητα.
 *
 * **Άρα η πρόθεση ταξιδεύει ΜΕ το γεγονός** (`supersededByFileId`), όχι δίπλα του:
 * event provenance, το ίδιο μοτίβο με το echo-suppression των Figma/Google Docs και με το
 * `hasPendingWrites` του Firestore. ISO 19650 §10.2: το superseded έγγραφο είναι
 * «μη χρησιμοποιήσιμο», **όχι ανύπαρκτο** — και ο διάδοχός του είναι ευρέσιμος.
 *
 * Pure + dependency-free (μόνο structural types) ώστε να δοκιμάζεται αυτόνομο, όπως ο
 * αδελφός φρουρός `cross-floor-link.ts`.
 *
 * @module subapps/dxf-viewer/systems/levels/level-floorplan-loss
 * @see docs/centralized-systems/reference/adrs/ADR-845-public-3d-execution.md §7.9
 */

/** Ό,τι χρειάζεται να ξέρουμε από ένα `FILE_TRASHED` για να κρίνουμε απώλεια. */
export interface TrashedFileNotice {
  readonly fileId: string;
  readonly entityId?: string;
  readonly entityType?: string;
  /** Παρόν ⇒ **αντικατάσταση**: κάποιος πήρε τη θέση του, τίποτα δεν χάθηκε. */
  readonly supersededByFileId?: string;
}

/** Το ελάχιστο πρόσωπο ενός `Level` για την ερώτηση της απώλειας (ISP). */
export interface FloorplanBearingLevel {
  readonly id: string;
  readonly sceneFileId?: string | null;
  readonly floorId?: string | null;
}

/**
 * `true` **μόνο** όταν αυτό το επίπεδο πραγματικά έχασε την κάτοψή του.
 *
 * Συντηρητικό εξ ορισμού — απαντά `false` (μην καθαρίσεις) όταν:
 *  - το γεγονός δηλώνει **διάδοχο** (αντικατάσταση, όχι απώλεια)· ή
 *  - το αρχείο δεν είναι ούτε το αρχείο του επιπέδου, ούτε η κάτοψη του ορόφου του.
 *
 * Το σκέλος «όροφος» μένει όπως ήταν (ADR-237): μια κάτοψη **ορόφου** που σβήνεται
 * εξωτερικά αδειάζει τον όροφο ακόμη κι αν το επίπεδο δεν είχε προλάβει να τη δέσει.
 */
export function didLevelLoseItsFloorplan(
  level: FloorplanBearingLevel,
  notice: TrashedFileNotice,
): boolean {
  // 🔁 Αντικατάσταση: ο διάδοχος υπάρχει και είναι ήδη στη θέση του. Καμία απώλεια.
  // Πρώτος έλεγχος επίτηδες — προηγείται ΚΑΘΕ ταιριάσματος, γιατί η ίδια η αντικατάσταση
  // ταιριάζει πάντα (το επίπεδο δείχνει ακόμα στο παλιό αρχείο τη στιγμή του γεγονότος).
  if (notice.supersededByFileId) return false;

  const matchByFile = !!level.sceneFileId && level.sceneFileId === notice.fileId;
  const matchByFloor =
    notice.entityType === 'floor' &&
    !!notice.entityId &&
    !!level.floorId &&
    level.floorId === notice.entityId;

  return matchByFile || matchByFloor;
}

/**
 * Ποια επίπεδα έχασαν την κάτοψή τους από αυτό το γεγονός.
 *
 * ⚠️ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΜΗΝ ΕΧΕΙ Ο ΕΛΕΓΧΟΣ ΔΙΚΟ ΤΟΥ ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΒΡΟΧΟΥ: ο `useLevelFloorplanSync`
 * και η άγκυρα `level-floorplan-supersede.test.ts` εκτελούν **αυτό ακριβώς το σώμα**. Ένα
 * χειρόγραφο δίδυμο μέσα στο test θα επικύρωνε τον εαυτό του — το ίδιο λάθος που κράτησε
 * το Ο-13 κρυμμένο για μια ολόκληρη φάση (fixture που έγραφε μόνο του την τιμή που
 * υποτίθεται ότι έλεγχε).
 *
 * Καθαρή: δεν μεταλλάσσει την είσοδο, ίδια είσοδος → ίδια έξοδος. Οι παρενέργειες
 * (καθαρισμός σκηνής, υπόβαθρο, ειδοποίηση) ανήκουν στον καλούντα.
 */
export function levelsThatLostTheirFloorplan<L extends FloorplanBearingLevel>(
  levels: readonly L[],
  notice: TrashedFileNotice,
): L[] {
  return levels.filter((level) => didLevelLoseItsFloorplan(level, notice));
}
