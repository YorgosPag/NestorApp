/**
 * @fileoverview **«ΜΕ +20.000 € ΥΠΑΡΧΟΥΝ 6»** — η υποχώρηση ως αριθμός, όχι ως κείμενο.
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.6 · lib/demand/demand-matching.ts
 * @module lib/demand/demand-concessions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΚΡΙΒΩΣ ΖΗΤΑΕΙ ΤΟ §12.6, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΑΣΗ ΣΕ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **όρος επιβίωσης**: *«η ζήτηση πρέπει να αξίζει και όταν δεν ταιριάζει τίποτα …
 * τι υπάρχει **κοντά** στο αίτημα και **τι το εμποδίζει** — «με +20.000 € υπάρχουν
 * 6»»*. Η μηχανή ταιριάσματος δίνει ήδη τα υλικά: `near-miss` με **μετρημένα κενά**
 * ({@link DemandGaps}). Λείπει η **σύνθεση**: από N κενά σε **μία πρόταση**.
 *
 * 🔑 **Και η σύνθεση είναι κριτήριο, όχι διατύπωση.** Ένα «+20.000 → 6» γραμμένο σε
 * component θα ήταν αριθμός που **κανείς δεν μπορεί να δοκιμάσει** και που θα ξαναγραφόταν
 * διαφορετικά στην επόμενη οθόνη. Εδώ υπολογίζεται, μία φορά, από καθαρές συναρτήσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΑΝΟΝΑΣ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΠΡΟΤΑΣΗ ΑΛΗΘΙΝΗ: **ΕΝΑΣ ΑΞΟΝΑΣ, ΜΟΝΟΣ ΤΟΥ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια αγγελία που είναι **και** ακριβότερη **και** μικρότερη **δεν ξεκλειδώνει** αν ο
 * χρήστης ανεβάσει μόνο τον προϋπολογισμό. Αν τη μετρούσαμε στο «+20.000 → 6», η
 * πρόταση θα ήταν **ψευδής με ακρίβεια δύο δεκαδικών** — και ο χρήστης θα το
 * ανακάλυπτε πατώντας τον σύνδεσμο και βρίσκοντας 4 αντί για 6. Είναι το ίδιο σχήμα
 * με το «0 = κανείς δεν κοίταξε»: αριθμός που φαίνεται απάντηση και είναι θόρυβος.
 *
 * Άρα: **στη σκάλα ενός άξονα μετράνε μόνο όσες αγγελίες έχουν ΑΚΡΙΒΩΣ αυτόν τον
 * άξονα ως μοναδικό εμπόδιο.** Οι υπόλοιπες δεν χάνονται — **λογίζονται ονομαστικά**
 * ({@link DemandConcessionCensus}), γιατί μια σύνθεση που πετά ό,τι δεν της κάνει
 * είναι σύνθεση που επικυρώνει τον εαυτό της.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟ ΠΡΟΤΥΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το RESO δεν έχει έννοια «κοντινού αποτελέσματος» καθόλου: το `SavedSearch` είναι
 * ερώτημα OData και το `Prospecting` στέλνει **μόνο ό,τι ταίριαξε**. Οι πύλες που
 * κάνουν κάτι σχετικό («expand your search») **χαλαρώνουν το φίλτρο και δείχνουν
 * αποτελέσματα** — δηλαδή απαντούν *«να τι υπάρχει αν ζητούσες κάτι άλλο»*, χωρίς
 * ποτέ να πουν **πόσο** άλλο. Η διαφορά δεν είναι υφολογική: το «+20.000 €» είναι
 * ποσό που ο άνθρωπος μπορεί να **κρίνει** πριν πατήσει, και το «δες περισσότερα»
 * είναι πρόσκληση να ξαναρχίσει.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από React/Firestore/ρολόι.
 */

import type { DemandBlocker, DemandGaps, DemandMatch } from './demand-match-vocabulary';
import type { DemandFeatures, PropertyDemand } from '@/types/property-demand';

// =============================================================================
// 1. ΟΙ ΑΞΟΝΕΣ ΥΠΟΧΩΡΗΣΗΣ — ένας ανά μετρήσιμο κενό, κλειστό σύνολο
// =============================================================================

/**
 * Πάνω σε **τι** μπορεί να υποχωρήσει ο άνθρωπος.
 *
 * 🔑 **Ένας προς έναν με τα πεδία του {@link DemandGaps}, και αυτό είναι το σημείο.**
 * Ένα κενό χωρίς άξονα θα ήταν μετρημένη απόσταση που **κανείς δεν προτείνει** — και
 * ένας άξονας χωρίς κενό θα ήταν πρόταση **χωρίς αριθμό**, δηλαδή ακριβώς το «δες
 * περισσότερα» των πυλών. Ο τύπος {@link CONCESSION_OF_GAP} κάνει τη διάσταση
 * **αδύνατη**: είναι `Record` και στους δύο άξονες.
 *
 * ⚠️ **Δεν υπάρχει άξονας για όροφο, χρόνο, πολύγωνο ή γειτονιά** — και είναι σωστό.
 * Τα εμπόδιά τους (`floor-outside` · `not-available-then` · `outside-area` ·
 * `proximity-too-far`) είναι **μετρήσιμα** ως προς την ετυμηγορία (η αγγελία είναι
 * «κοντά»), αλλά **δεν έχουν πεδίο κενού**: το «πόσο λείπει» δεν ορίζεται μονοσήμαντα
 * σε ημερολόγιο ή σε σχήμα. Λογίζονται ρητά ως `unquantified`, ποτέ σιωπηλά.
 */
export const DEMAND_CONCESSIONS = [
  /** Ανέβασε την οροφή τιμής. Το κανονικό «+20.000 €» του §12.6. */
  'price-ceiling',
  /** Κατέβασε το κατώφλι τιμής — «τίποτα κάτω από Χ» που αποκλείει ευκαιρίες. */
  'price-floor',
  /** Κατέβασε το ελάχιστο εμβαδόν. */
  'area-floor',
  /** Ανέβασε το μέγιστο εμβαδόν. */
  'area-ceiling',
  /** Δέξου λιγότερα υπνοδωμάτια. */
  'bedrooms-floor',
  /**
   * Μεγάλωσε τον χωρικό όρο — ακτίνα (**Ζ1**) **ή** βάθος μετώπου (**Ζ4 δομημένη**).
   *
   * 🔑 **Ένας κωδικός για δύο σχήματα ορίου, επίτηδες — ίδιο σκεπτικό με το
   * `distanceOverMetres`** ({@link DemandGaps}): και τα δύο απαντούν την **ίδια**
   * ερώτηση («πόσα μέτρα παραπάνω;»), απλώς πάνω σε άλλο σχήμα ορίου. Δύο κωδικοί θα
   * ήταν δεύτερη αλήθεια για ένα μέγεθος, και η οθόνη θα έπρεπε να διαλέγει ποιον να
   * δείξει — ενώ το `demand.place.kind` ήδη το ξέρει.
   */
  'search-radius',
] as const;

export type DemandConcession = (typeof DEMAND_CONCESSIONS)[number];

/**
 * Ποιο πεδίο κενού τροφοδοτεί ποιον άξονα. **`Record` και στις δύο κατευθύνσεις**:
 * νέο κενό δεν μεταγλωττίζεται χωρίς άξονα, και αντίστροφα.
 */
const CONCESSION_OF_GAP: Readonly<Record<keyof DemandGaps, DemandConcession>> = {
  priceOverBy: 'price-ceiling',
  priceUnderBy: 'price-floor',
  areaShortBy: 'area-floor',
  areaOverBy: 'area-ceiling',
  bedroomsShortBy: 'bedrooms-floor',
  distanceOverMetres: 'search-radius',
};

/**
 * Η **μονάδα** κάθε άξονα — ώστε η οθόνη να μη μαντεύει αν το 20000 είναι ευρώ ή μέτρα.
 *
 * ⚠️ Ονομασμένο λεξιλόγιο, **όχι** ελεύθερο κείμενο: η μονάδα καταλήγει σε κλειδί
 * i18n (N.11), και ένα «€» γραμμένο σε component θα ήταν ωμή συμβολοσειρά σε `.tsx`.
 */
export const CONCESSION_UNITS = ['eur', 'sqm', 'rooms', 'metres'] as const;

export type ConcessionUnit = (typeof CONCESSION_UNITS)[number];

export const CONCESSION_UNIT: Readonly<Record<DemandConcession, ConcessionUnit>> = {
  'price-ceiling': 'eur',
  'price-floor': 'eur',
  'area-floor': 'sqm',
  'area-ceiling': 'sqm',
  'bedrooms-floor': 'rooms',
  'search-radius': 'metres',
};

// =============================================================================
// 2. ΠΟΣΟ ΕΙΝΑΙ «ΛΟΓΙΚΗ» ΥΠΟΧΩΡΗΣΗ — το κατώφλι που κάνει την πρόταση χρήσιμη
// =============================================================================

/**
 * 🔴 **Η ΠΟΛΙΤΙΚΗ ΠΟΥ ΔΙΑΛΕΓΕΙ ΤΟ «+20.000», ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΘΑΙΡΕΤΗ.**
 *
 * Τα κενά μιας σκάλας είναι πολλά: `+5.000 → 1` · `+20.000 → 6` · `+80.000 → 12`.
 * **Κάθε** ένα από αυτά είναι αληθές. Η ερώτηση είναι **ποιο λέγεται πρώτο**, και οι
 * τρεις αφελείς απαντήσεις αποτυγχάνουν με **διαφορετικό** τρόπο η καθεμία:
 *
 * | Πολιτική | Τι δίνει | Γιατί όχι |
 * |---|---|---|
 * | το **μικρότερο** ποσό | `+5.000 → 1` | αληθές και **ανίσχυρο** — δεν αξίζει κλικ |
 * | το **μεγαλύτερο** πλήθος | `+80.000 → 12` | **+32% προϋπολογισμό**· δεν είναι υποχώρηση, είναι άλλο αίτημα |
 * | το **μεσαίο** σκαλί | εξαρτάται από το πλήθος | αριθμός **χωρίς νόημα** — αλλάζει όταν μπει μία αγγελία |
 *
 * 🔑 Άρα: **το μεγαλύτερο πλήθος ΜΕΣΑ σε υποχώρηση που ο άνθρωπος θα δεχόταν** — και
 * το «θα δεχόταν» μετριέται **σχετικά με το ίδιο του το όριο**, όχι σε απόλυτα ευρώ:
 * το +20.000 είναι μικρό σε ζήτηση των 250.000 και **παράλογο** σε ζήτηση των 60.000.
 *
 * **15%** — γιατί με το παράδειγμα του ίδιου του §12.6 (οροφή 250.000) δίνει όριο
 * **37.500**, δηλαδή δέχεται το `+20.000` και απορρίπτει το `+80.000`: η πολιτική
 * **αναπαράγει το γραμμένο παράδειγμα** αντί να το ελπίζει.
 */
export const MAX_RELATIVE_CONCESSION = 0.15;

/**
 * Πόσα **σκαλιά** δέχεται ένας άξονας χωρίς αναλογία — τα υπνοδωμάτια.
 *
 * ⚠️ **Ο μόνος διακριτός άξονας, και γι' αυτό ο μόνος με απόλυτο όριο.** Το 15% πάνω
 * σε «3 υπνοδωμάτια» δίνει **0,45**, δηλαδή **κανένα** σκαλί: η αναλογία εφαρμοσμένη
 * σε μέτρηση που κινείται ανά μονάδα **σβήνει τον άξονα σιωπηλά**. Ένα υπνοδωμάτιο
 * λιγότερο είναι υπαρκτή, συνηθισμένη υποχώρηση· δύο είναι άλλο σπίτι.
 */
export const MAX_ROOMS_CONCESSION = 1;

/**
 * Το ανώτατο ποσό υποχώρησης για **αυτή** τη ζήτηση σε **αυτόν** τον άξονα, ή `null`
 * όταν δεν υπάρχει βάση για αναλογία.
 *
 * ⚠️ **`null` σημαίνει «χωρίς όριο», ΟΧΙ «μηδέν».** Ένας άξονας μπορεί να εμποδίζει
 * χωρίς ο χρήστης να έχει δηλώσει όριο σε αυτόν: η ακτίνα υπάρχει μόνο σε `near`, και
 * μια ζήτηση `anywhere` **δεν έχει** ακτίνα να ξεπεραστεί. Αν το `null` γινόταν 0, ο
 * άξονας θα εξαφανιζόταν από τη σκάλα — σιωπηλά, και μόνο για κάποιες ζητήσεις.
 */
export function concessionCeiling(
  demand: Pick<PropertyDemand, 'features' | 'place'>,
  concession: DemandConcession,
): number | null {
  if (concession === 'bedrooms-floor') return MAX_ROOMS_CONCESSION;

  const base = concessionBase(demand.features, demand.place, concession);
  return base === null ? null : base * MAX_RELATIVE_CONCESSION;
}

/** Το **δηλωμένο όριο** του χρήστη πάνω στο οποίο μετριέται η αναλογία. */
function concessionBase(
  features: DemandFeatures,
  place: PropertyDemand['place'],
  concession: DemandConcession,
): number | null {
  switch (concession) {
    case 'price-ceiling':
      return features.priceMax;
    case 'price-floor':
      return features.priceMin;
    case 'area-floor':
      return features.areaMin;
    case 'area-ceiling':
      return features.areaMax;
    case 'search-radius':
      // **Ζ1** ⇒ μέτρα από km· **Ζ4 δομημένη** ⇒ ήδη μέτρα, καμία μετατροπή. Το
      // ίδιο δηλωμένο όριο που η μηχανή ταιριάσματος ξεπερνά στο `distanceOverMetres`
      // — άρα η ίδια αναλογία 15% ({@link MAX_RELATIVE_CONCESSION}) βγάζει νόημα και
      // στα δύο: «*+15% απόσταση από τον άξονα*» είναι εξίσου λογική υποχώρηση με
      // «*+15% ακτίνα*».
      if (place.kind === 'near') return place.radiusKm * 1000;
      if (place.kind === 'frontage') return place.depthMetres;
      return null;
    case 'bedrooms-floor':
      // Αδιέξοδο εκ κατασκευής: ο διακριτός άξονας απαντήθηκε πριν φτάσει εδώ.
      return null;
  }
}

// =============================================================================
// 3. Η ΣΚΑΛΑ
// =============================================================================

/** Ένα σκαλί: «με **αυτό** το ποσό, ξεκλειδώνουν **τόσες**». Σωρευτικό. */
export interface ConcessionStep {
  /** Πόσο πρέπει να υποχωρήσει, στη μονάδα του άξονα. Πάντα > 0. */
  readonly amount: number;
  /** Πόσες αγγελίες ξεκλειδώνει **αυτό** το ποσό — σωρευτικά. */
  readonly unlocks: number;
}

/** Η πλήρης σκάλα ενός άξονα, με το σκαλί που λέγεται πρώτο ήδη διαλεγμένο. */
export interface ConcessionLadder {
  readonly concession: DemandConcession;
  readonly unit: ConcessionUnit;
  /** Αύξουσα κατά ποσό, σωρευτική κατά πλήθος. **Ποτέ κενή**. */
  readonly steps: readonly ConcessionStep[];
  /**
   * Το σκαλί που λέγεται πρώτο — {@link MAX_RELATIVE_CONCESSION}.
   *
   * ⚠️ `null` όταν **κάθε** σκαλί ξεπερνά το κατώφλι: υπάρχουν κοντινές αγγελίες, αλλά
   * **καμία σε υποχώρηση που αξίζει να προταθεί**. Το `null` εδώ σημαίνει *«δεν σου
   * προτείνω»*, **όχι** *«δεν υπάρχει τίποτα»* — και η οθόνη οφείλει να τα ξεχωρίζει,
   * όπως η Α5 ξεχωρίζει το `never-asked` από το `owner-declined`.
   */
  readonly headline: ConcessionStep | null;
}

/**
 * Ποιος **μοναδικός** άξονας εμποδίζει αυτή την αγγελία, και **πόσο** — ή `null`.
 *
 * 🔴 **Η καρδιά του κανόνα «ένας άξονας, μόνος του».** Επιστρέφει τιμή **μόνο** όταν
 * υπάρχει **ακριβώς ένα** εμπόδιο **και** εκείνο κουβαλά μετρημένο κενό. Δύο εμπόδια
 * ⇒ `null`, γιατί η υποχώρηση στο ένα **δεν** ξεκλειδώνει τίποτα.
 */
export function soleConcessionOf(
  match: DemandMatch,
): { concession: DemandConcession; amount: number } | null {
  if (match.blockers.length !== 1) return null;

  const measured = (Object.keys(CONCESSION_OF_GAP) as (keyof DemandGaps)[])
    .map((key) => ({ key, amount: match.gaps[key] }))
    .filter((entry): entry is { key: keyof DemandGaps; amount: number } => entry.amount !== null);

  // Ένα εμπόδιο μπορεί να μην έχει καθόλου κενό (`floor-outside`, `outside-area`,
  // `not-available-then`, `proximity-too-far`) — τότε δεν προτείνεται τίποτα. Και δύο
  // κενά με ΕΝΑ εμπόδιο θα σήμαινε ασυνεπή μηχανή· η άρνηση είναι ρητή, όχι «το πρώτο».
  if (measured.length !== 1) return null;

  const [only] = measured;
  return only.amount > 0
    ? { concession: CONCESSION_OF_GAP[only.key], amount: only.amount }
    : null;
}

/**
 * Ποσά υποχώρησης ενός άξονα → **σκάλα**.
 *
 * ⚠️ **Τα ίσα ποσά συγχωνεύονται σε ΕΝΑ σκαλί.** Δύο αγγελίες ακριβώς +5.000 € πάνω
 * είναι *«με +5.000 υπάρχουν 2»*, ποτέ δύο σκαλιά με το ίδιο ποσό — αλλιώς η οθόνη θα
 * τύπωνε την ίδια πρόταση δύο φορές με διαφορετικό πλήθος.
 */
export function buildLadder(
  concession: DemandConcession,
  amounts: readonly number[],
  ceiling: number | null,
): ConcessionLadder | null {
  if (amounts.length === 0) return null;

  const steps: ConcessionStep[] = [];
  for (const amount of [...amounts].sort((a, b) => a - b)) {
    const last = steps[steps.length - 1];
    if (last !== undefined && last.amount === amount) {
      steps[steps.length - 1] = { amount, unlocks: last.unlocks + 1 };
    } else {
      steps.push({ amount, unlocks: (last?.unlocks ?? 0) + 1 });
    }
  }

  return {
    concession,
    unit: CONCESSION_UNIT[concession],
    steps,
    headline: pickHeadline(steps, ceiling),
  };
}

/**
 * Το σκαλί που λέγεται πρώτο: **μέγιστο πλήθος μέσα στο κατώφλι**, με το **μικρότερο
 * ποσό** να σπάει την ισοπαλία.
 *
 * ⚠️ Η ισοπαλία **δεν** είναι θεωρητική: όταν δύο σκαλιά ξεκλειδώνουν το ίδιο πλήθος,
 * το ακριβότερο είναι **αυστηρά χειρότερο** για τον άνθρωπο. Χωρίς ρητό tie-break η
 * απάντηση θα εξαρτιόταν από τη σειρά διάσχισης — δηλαδή από τη σειρά που ήρθαν οι
 * αγγελίες από το Firestore.
 */
function pickHeadline(
  steps: readonly ConcessionStep[],
  ceiling: number | null,
): ConcessionStep | null {
  const affordable = ceiling === null ? steps : steps.filter((s) => s.amount <= ceiling);
  if (affordable.length === 0) return null;

  return affordable.reduce((best, step) =>
    step.unlocks > best.unlocks || (step.unlocks === best.unlocks && step.amount < best.amount)
      ? step
      : best,
  );
}

// =============================================================================
// 4. Η ΛΟΓΙΣΤΙΚΗ — κλειστή, fail-closed
// =============================================================================

/**
 * Πού πήγε **κάθε** κοντινή αγγελία.
 *
 * 🔴 **Υπάρχει επειδή η σύνθεση ΠΕΤΑΕΙ πράγματα, και μια σύνθεση που πετάει σιωπηλά
 * επικυρώνει τον εαυτό της.** Το `multiAxis` και το `unquantified` δεν είναι σφάλματα:
 * είναι κοντινές αγγελίες που **δεν επιτρέπεται** να μπουν σε πρόταση. Χωρίς τους
 * κάδους, μια οθόνη που δείχνει «3 κοντά» ενώ η μηχανή βρήκε **11** θα φαινόταν
 * σωστή — και το λάθος θα ήταν **ακριβώς** εκεί όπου η βοήθεια είναι πιο χρήσιμη.
 *
 * ⚠️ **Κάθε κάδος τυπώνεται ακόμη και στο μηδέν** (μάθημα CHECK 3.48 `Κ6`): ένα «0»
 * που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
 */
export interface DemandConcessionCensus {
  /** Κοντινές με **έναν** άξονα και μετρημένο ποσό — αυτές γεννούν σκάλες. */
  readonly ladderedCount: number;
  /** Κοντινές με **δύο** άξονες: αληθινές, μη προτάσιμες. */
  readonly multiAxis: number;
  /** Κοντινές με έναν άξονα **χωρίς** «πόσο» (όροφος · χρόνος · σχήμα · γειτονιά). */
  readonly unquantified: number;
  /** Πόσες κοντινές εξετάστηκαν. */
  readonly considered: number;
}

/** Κλείνει το άθροισμα; Υπάρχει **για να αποτύχει θορυβωδώς**, όχι για να επιβεβαιώνει. */
export function concessionCensusBalances(census: DemandConcessionCensus): boolean {
  return (
    census.ladderedCount + census.multiAxis + census.unquantified === census.considered
  );
}

/** Οι σκάλες **και** η λογιστική τους — ποτέ το ένα χωρίς το άλλο. */
export interface DemandConcessionReport {
  /**
   * Ταξινομημένες κατά **πόσο βοηθούν**: πρώτα όσες έχουν `headline`, κατά φθίνον
   * πλήθος. Η οθόνη διαβάζει την πρώτη· η σειρά **δεν** αποφασίζεται εκεί.
   */
  readonly ladders: readonly ConcessionLadder[];
  readonly census: DemandConcessionCensus;
}

/**
 * **Κοντινές αγγελίες → προτάσεις υποχώρησης.**
 *
 * @param demand — για τα δηλωμένα όρια, πάνω στα οποία μετριέται το «λογικό»
 * @param nearMisses — οι ετυμηγορίες `near-miss` της {@link matchDemand}
 */
export function buildConcessionReport(
  demand: Pick<PropertyDemand, 'features' | 'place'>,
  nearMisses: readonly DemandMatch[],
): DemandConcessionReport {
  const amounts = new Map<DemandConcession, number[]>();
  let multiAxis = 0;
  let unquantified = 0;

  for (const match of nearMisses) {
    if (match.blockers.length > 1) {
      multiAxis += 1;
      continue;
    }
    const sole = soleConcessionOf(match);
    if (sole === null) {
      unquantified += 1;
      continue;
    }
    const bucket = amounts.get(sole.concession);
    if (bucket === undefined) amounts.set(sole.concession, [sole.amount]);
    else bucket.push(sole.amount);
  }

  const ladders = DEMAND_CONCESSIONS.map((concession) =>
    buildLadder(concession, amounts.get(concession) ?? [], concessionCeiling(demand, concession)),
  ).filter((ladder): ladder is ConcessionLadder => ladder !== null);

  return {
    ladders: [...ladders].sort(compareLadders),
    census: {
      ladderedCount: [...amounts.values()].reduce((sum, list) => sum + list.length, 0),
      multiAxis,
      unquantified,
      considered: nearMisses.length,
    },
  };
}

/**
 * Ποια σκάλα λέγεται πρώτη. **Όσες προτείνουν πάνω από όσες δεν προτείνουν**, και
 * μεταξύ τους κατά φθίνον πλήθος· τελικός διαχωριστής το **όνομα**, ώστε η σειρά να
 * μην εξαρτάται από τη σειρά άφιξης των εγγράφων.
 */
function compareLadders(a: ConcessionLadder, b: ConcessionLadder): number {
  const unlocksA = a.headline?.unlocks ?? 0;
  const unlocksB = b.headline?.unlocks ?? 0;
  if (unlocksA !== unlocksB) return unlocksB - unlocksA;
  return a.concession.localeCompare(b.concession);
}

/**
 * Τα εμπόδια που **απέρριψαν** αγγελίες, με πλήθος — «τι μας σταμάτησε».
 *
 * 🔑 **Είναι η κλειστή λογιστική της Α5 εφαρμοσμένη στην άρνηση.** Σήμερα το επίπεδο
 * Α δεν έχει γραμμές και η διαθεσιμότητα δεν αντλείται, οπότε μια ζήτηση **Ζ3** θα
 * απορριφθεί από **κάθε** αγγελία με `place-unresolved`. Χωρίς αυτόν τον πίνακα η
 * οθόνη θα έλεγε σκέτο «κανένα αποτέλεσμα» — δηλαδή θα μετέτρεπε *«δεν ξέρουμε
 * ακόμη»* σε *«δεν υπάρχει»*, τον **ακριβώς** ισχυρισμό που η Α5 απαγορεύει.
 *
 * ⚠️ Επιστρέφει **αραιό** χάρτη: μόνο όσα εμπόδια εμφανίστηκαν. Ένα πλήρες `Record`
 * με 17 μηδενικά θα ανάγκαζε την οθόνη να τα φιλτράρει, και το φιλτράρισμα είναι
 * ακριβώς η στιγμή που κάποιος γράφει λάθος κατώφλι.
 */
export function tallyBlockers(
  matches: readonly DemandMatch[],
): ReadonlyMap<DemandBlocker, number> {
  const tally = new Map<DemandBlocker, number>();
  for (const match of matches) {
    for (const blocker of match.blockers) {
      tally.set(blocker, (tally.get(blocker) ?? 0) + 1);
    }
  }
  return tally;
}
