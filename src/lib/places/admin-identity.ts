/**
 * @fileoverview **ΤΑΥΤΟΤΗΤΑ ΑΠΟ ΤΗΝ ΑΛΥΣΙΔΑ ΤΗΣ ΜΗΧΑΝΗΣ** — ο κριτής, χωρίς React.
 * @module lib/places/admin-identity
 * @related ADR-332 D27 Φάση Β′ · lib/places/admin-name-index · lib/places/admin-path
 * @related lib/agency/presence-admin-ids (`deepestContainingEntity` — το ίδιο δόγμα, από τη γεωμετρία)
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 Η ΑΝΑΚΑΛΥΨΗ: Η ΜΗΧΑΝΗ ΣΤΕΛΝΕΙ **ΟΛΟΚΛΗΡΗ** ΤΗ ΔΙΟΙΚΗΤΙΚΗ ΑΛΥΣΙΔΑ — ΚΑΙ ΤΗΝ ΠΕΤΑΓΑΜΕ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Μετρημένο σε **14** πραγματικά σημεία ελληνικών πόλεων *(2026-09-12, ζωντανό Nominatim)*:
 *
 * | κλειδί | βαθμίδα | λύθηκαν **ΑΚΡΙΒΩΣ** |
 * |---|---|---|
 * | `state` «Περιφέρεια …» | 3 | **14/14** |
 * | `county` «Περιφερειακή Ενότητα …» | 4 | 12/14 *(2 λένε «Μητροπολιτική», η ΕΛΣΤΑΤ «Περιφερειακή» ⇒ σωστά «απόν»)* |
 * | `municipality` «Δήμος …» | **5** | **14/14** |
 * | `city` «Δημοτική Ενότητα …» | 6 | 7/14 |
 *
 * ⇒ Ο **δήμος** — η μία από τις **δύο** ταυτότητες που κρατά το `companyAddress` — βγαίνει
 * **ακριβώς, χωρίς καμία ανοχή, σε 14 από 14**. Και το πιο σημαντικό: **και στους αστικούς
 * πυρήνες**, όπου η γεωμετρία δεν αποδεικνύει τίποτα *(Σύνταγμα · κέντρο Ηρακλείου ·
 * Νέα Μαγνησία: κανένα εσωτερικό κάλυμμα)*. Δεν λείπει μηχανή — **δεν διαβαζόταν το κλειδί**.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΙΧΕ ΔΕΙ ΚΑΝΕΙΣ**: το `NominatimReverseAddress` του route δηλώνει
 * **δέκα** κλειδιά και **δεν** περιλαμβάνει ούτε `municipality` ούτε `county`. Ό,τι δεν
 * δηλώνεται, δεν διαβάζεται — και ό,τι δεν διαβάζεται, «δεν υπάρχει».
 *
 * ⚠️ **ΕΜΠΙΣΤΕΥΣΟΥ ΤΟ ΠΡΟΘΕΜΑ, ΟΧΙ ΤΟ ΟΝΟΜΑ ΤΟΥ ΚΛΕΙΔΙΟΥ** *(μετρημένο στον Πύργο)*: εκεί
 * το `municipality` ήρθε **`null`** και το `city` έγραφε **«Δήμος Πύργου»**. Γι' αυτό αυτός ο
 * κριτής δέχεται **ανώνυμες ετικέτες** και ρωτά την καθεμία *«ποια βαθμίδα δηλώνεις;»* —
 * η αντιστοίχιση κλειδιού→βαθμίδας θα ήταν υπόθεση που τα δεδομένα **διαψεύδουν**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 Ο ΚΑΝΟΝΑΣ ΝΙΚΗΤΗ — Ο **ΙΔΙΟΣ** ΜΕ ΤΗ ΓΕΩΜΕΤΡΙΑ, ΚΑΙ ΟΧΙ ΤΥΧΑΙΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το `deepestContainingEntity` *(`lib/agency/presence-admin-ids.ts`)* δεν διαλέγει «τον πιο
 * βαθύ»: διαλέγει **αυτόν που εξηγεί όλους τους άλλους**, και σε αντιφατικές αποδείξεις
 * απαντά `null`. Εδώ ισχύει το **ίδιο**, με τις ετικέτες στη θέση των πολυγώνων — και η
 * ανταμοιβή είναι μετρημένη: το «Δήμος Ηρακλείου» δίνει **ΔΥΟ** εγγραφές *(Κρήτη **και**
 * Ηράκλειο Αττικής)*, και τις ξεχωρίζει το `state` «Περιφέρεια Κρήτης». **Η αλυσίδα
 * αποσαφηνίζει τον εαυτό της**· κανένας Τ.Κ. και καμία γεωμετρία δεν χρειάστηκε.
 *
 * ⛔ **ΜΗΝ προσθέσεις «αν δεν βρεθεί τίποτα, δοκίμασε στο επίπεδο 8».** Είναι η μαντεψιά
 * που παράγει **ΔΗΜΟ ΧΙΟΥ για το Χαλάνδρι** — δες τη μέτρηση στο `admin-name-index`.
 * Αδήλωτη βαθμίδα σημαίνει **αδήλωτη**, και απαντιέται μόνο **μέσα σε αποδεδειγμένη
 * εμβέλεια** ({@link identifyWithin}).
 */

import type { LineageResolver } from '@/lib/agency/coverage-match';
import { declaredAdminLevel } from '@/utils/address/place-name';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';
import {
  exactNameMatches,
  inflectedNameMatchesWithin,
  nearNameMatchesWithin,
  type AdminNameIndex,
  type AdminPlace,
} from './admin-name-index';

/**
 * **Οι ΤΡΕΙΣ αναγνώστες που χρειάζεται ο κριτής** — εγχυόμενοι, ποτέ εισαγόμενοι.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 **ΤΟ ΠΡΟΤΥΠΟ ΕΙΝΑΙ ΤΟ `CoverageResolvers`** *(`lib/agency/coverage-match.ts`)*, και ο
 * λόγος είναι ο ίδιος, γραμμένος εκεί: *«Layering: leaf — καθαρές συναρτήσεις, καμία
 * εξάρτηση από React ή Firestore. Η ιεραρχία **ενίεται**, δεν εισάγεται ως hook.»*
 *
 * Εδώ δεν είναι αισθητική: ο **ίδιος** κριτής τρέχει και στο `api/geocoding/reverse`
 * *(διακομιστής, `services/places/administrative-hierarchy.reader`)* και στη φόρμα
 * *(πελάτης, `useAdministrativeHierarchy`)*. Οι δύο πλευρές έχουν **ήδη** αναγνώστη
 * γενεαλογίας με **ταυτόσημη σύμβαση** — `lineageIdsOf` και `readAdministrativeLineage`,
 * και **οι δύο** «με τον εαυτό πρώτο, κενός πίνακας = δεν ξέρω».
 *
 * ⛔ **ΜΗΝ γράψεις εδώ περίπατο γονέων.** Θα ήταν το **τρίτο** αντίγραφο της ίδιας
 * διαδρομής *(N.18)* — και το `admin-path.ts` το λέει ρητά για τον εαυτό του.
 * ═════════════════════════════════════════════════════════════════════════════
 */
export interface AdminIdentitySources {
  /** Όνομα → τόποι, ανά βαθμίδα. Κενό = **«δεν ρώτησα»**. */
  readonly index: AdminNameIndex;
  /** Ταυτότητα → τόπος. `undefined` = άγνωστη ταυτότητα. */
  readonly placeOf: (id: string) => AdminPlace | undefined;
  /** Γενεαλογία **με τον εαυτό πρώτο** — ίδια σύμβαση στις δύο πλευρές. */
  readonly lineageOf: LineageResolver;
}

// =============================================================================
// Η ΕΤΥΜΗΓΟΡΙΑ
// =============================================================================

/**
 * **Πώς** αποκτήθηκε η ταυτότητα. Ταξιδεύει μαζί της, ώστε ο γραφέας να μπορεί να
 * αρνηθεί μια βαθμίδα που δεν εμπιστεύεται — δες την προειδοποίηση του {@link ADMIN_ID_TRUSTED_VIA}.
 */
export type AdminIdentityVia =
  /** Ακριβές όνομα στη δηλωμένη βαθμίδα, **μοναδικό** στη χώρα. */
  | 'exact'
  /** Ακριβές όνομα, **ομώνυμο**, που αποσαφηνίστηκε από τους προγόνους της ίδιας αλυσίδας. */
  | 'chain'
  /**
   * Ακριβές όνομα, **ομώνυμο**, που αποσαφηνίστηκε από τον **ταχυδρομικό κώδικα**.
   *
   * 🔑 **Ασφαλές εξ ορισμού**: το όνομα ταιριάζει **απόλυτα** και ο Τ.Κ. μόνο **στενεύει** το
   * σύνολο. ⛔ Δεν έχει καμία σχέση με τον παλιό `findByPostalCode`, που εφαρμοζόταν πάνω σε
   * **ανεκτική** αντιστοίχιση — και γι' αυτό διάλεγε «Καλλίστη» για «Καλλιθέα» *(ίδιος Τ.Κ.)*.
   */
  | 'postal'
  /** Ίδιο όνομα σε **άλλη πτώση**, μέσα σε αποδεδειγμένη εμβέλεια («Ελευθερίου»→«Ελευθέριο»). */
  | 'scoped-inflection'
  /** Ανοχή **τυπογραφικού** μέσα σε αποδεδειγμένη εμβέλεια — ποτέ σε όλη τη χώρα. */
  | 'scoped-typo';

/**
 * ⚠️ **ΠΟΙΑ `via` ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΓΙΝΕΙ ΑΠΟΘΗΚΕΥΜΕΝΗ ΤΑΥΤΟΤΗΤΑ — και γιατί ΟΛΕΣ ΤΟΥΣ.**
 *
 * 🔴 **Η ανησυχία είναι αληθινή**: το `CompanyAddress` κρατά `settlementId`/`municipalityId`
 * ως **σκέτα strings**, οπότε τίποτα δεν καταγράφει **πώς** αποκτήθηκαν — ένα id από ανοχή
 * είναι, για κάθε επόμενο αναγνώστη, **ταυτόσημο** με επιλογή ανθρώπου, και ταξιδεύει στο
 * `lineageIdsOf` → `coverage-match`, δηλαδή σε **δημόσιους ισχυρισμούς κάλυψης** γραφείου.
 *
 * 🔑 **Και γι' αυτό ακριβώς οι εμβέλειες είναι ασφαλείς: η εγγύηση είναι ΔΟΜΙΚΗ.**
 * Η εμβέλεια **είναι** πρόγονος του αποτελέσματος *(`containerIdsOf(…).has(scopeId)`)*, άρα
 * μια ανοχή **δεν μπορεί να διαφθείρει καμία ρηχότερη ταυτότητα** — ο δήμος που θα δει το
 * `coverage-match` μένει **αυτός που αποδείχθηκε ακριβώς**. Το υπόλοιπο ρίσκο περιορίζεται
 * στο **βαθύτερο** επίπεδο **μέσα στον σωστό δήμο**, όπου μετρήθηκε αμφισημία απόστασης-1
 * **0,4%** *(έναντι 18–27% χωρίς εμβέλεια)*.
 *
 * ⚠️ **Δεν είναι θεωρητικό — είναι ο κανόνας για την Αθήνα.** Ο ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ έχει
 * **έναν** οικισμό, «**Αθήναι**» *(αρχαΐζουσα)*, ενώ το OSM στέλνει «**Αθήνα**»: απόσταση 1,
 * **μοναδικός μέσα στην εμβέλεια**. Χωρίς αυτή τη βαθμίδα, η πρωτεύουσα δεν αποκτά ποτέ
 * οικισμό — και **2.678 από 13.272** ονόματα *(**20,2%**)* έχουν την ίδια αρχαΐζουσα μορφή.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ `via` χωρίς εμβέλεια.** Η ανοχή **χωρίς** εμβέλεια είναι
 * μετρημένα «ΔΗΜΟΣ ΧΙΟΥ για το Χαλάνδρι» — δες `admin-name-index`. Η λίστα αυτή είναι
 * **δήλωση εμπιστοσύνης**, όχι διακοσμητικό: το πρότυπο είναι το `source: 'dragged'` του
 * `humanPlacedPatch` *(«αίτημα, όχι ισχυρισμός»)*.
 */
export const ADMIN_ID_TRUSTED_VIA: readonly AdminIdentityVia[] = [
  'exact',
  'chain',
  'postal',
  'scoped-inflection',
  'scoped-typo',
];

export type AdminIdentityVerdict =
  | {
      readonly kind: 'identified';
      readonly entity: AdminPlace;
      readonly level: number;
      readonly via: AdminIdentityVia;
    }
  /** Ταιριάζουν πολλές και **καμία δεν αποκλείεται** — ο άνθρωπος αποφασίζει, όχι εμείς. */
  | { readonly kind: 'ambiguous'; readonly level: number; readonly candidates: readonly AdminPlace[] }
  /** Ρωτήθηκε, **δεν υπάρχει** στο μητρώο. Νόμιμη απάντηση: οι συνοικίες δεν είναι τόποι ΕΛΣΤΑΤ. */
  | { readonly kind: 'absent' }
  /**
   * **Δεν ρωτήθηκε** — το ευρετήριο δεν φορτώθηκε.
   *
   * ⚠️ **ΠΟΤΕ μη το συγχέεις με `absent`.** Το `absent` δικαιολογεί **καθάρισμα** της
   * ιεραρχίας· το `unknown` **απαγορεύει να αγγίξεις** τα πεδία ταυτότητας. Η διάκριση
   * τηρείται σε όλο το έργο *(`EMPTY_SNAPSHOT` · `EMPTY_FOOTPRINTS` · `NOT_STORED`)*, και η
   * σύγχυσή τους είναι το σχήμα «πράσινο που σημαίνει: κανείς δεν κοίταξε».
   */
  | { readonly kind: 'unknown' };

// =============================================================================
// ΓΕΝΕΑΛΟΓΙΑ — ΠΑΝΩ ΣΤΟ ΥΠΑΡΧΟΝ SSoT
// =============================================================================

/**
 * Οι ταυτότητες που **περιέχουν** τον τόπο, **με τον εαυτό του μέσα**.
 *
 * ⚠️ **Κενό σύνολο σημαίνει «δεν ξέρω»**, ποτέ «καμία σχέση» — η δηλωμένη σύμβαση του
 * `LineageResolver`. Ο καλών **οφείλει** να το ξεχωρίσει: ένας έλεγχος συνέπειας πάνω σε
 * κενή γενεαλογία θα απέρριπτε **κάθε** υποψήφιο, δηλαδή θα μετέτρεπε «δεν φόρτωσε η
 * ιεραρχία» σε «αντιφατικές αποδείξεις».
 */
function containerIdsOf(lineageOf: LineageResolver, place: AdminPlace): ReadonlySet<string> {
  return new Set<string>(lineageOf(place.id));
}

// =============================================================================
// Η ΑΛΥΣΙΔΑ
// =============================================================================

/** Οι αποδεδειγμένοι τόποι ανά βαθμίδα, και η βαθύτερη ετυμηγορία. */
export interface AdminChainResolution {
  /** Η βαθύτερη βαθμίδα που **αποδείχθηκε** — ή γιατί όχι. */
  readonly verdict: AdminIdentityVerdict;
  /**
   * Κάθε βαθμίδα που προκύπτει από τον νικητή, **παραγόμενη** από τη γενεαλογία του.
   * Κενός χάρτης όταν τίποτα δεν αποδείχθηκε.
   */
  readonly proved: ReadonlyMap<number, AdminPlace>;
}

const NOTHING_PROVED: ReadonlyMap<number, AdminPlace> = new Map();

/** Οι ετικέτες που δήλωσαν βαθμίδα, ομαδοποιημένες — **αδήλωτες αγνοούνται εδώ**. */
function evidenceByLevel(
  labels: readonly string[],
  index: AdminNameIndex,
): Map<number, readonly AdminPlace[]> {
  const evidence = new Map<number, readonly AdminPlace[]>();
  for (const label of labels) {
    const trimmed = label.trim();
    if (trimmed === '') continue;
    const level = declaredAdminLevel(trimmed);
    if (level === null) continue;
    const matches = exactNameMatches(index, level, trimmed);
    // ⚠️ **Καμία απόδειξη ΔΕΝ είναι αντίφαση.** Το «Μητροπολιτική Ενότητα Θεσσαλονίκης»
    //    δεν υπάρχει στην ΕΛΣΤΑΤ· αν το κρατούσαμε ως κενό σύνολο, θα **ακύρωνε** τον
    //    δήμο που αποδείχθηκε ακριβώς. Απουσία στοιχείου ≠ στοιχείο απουσίας.
    if (matches.length > 0) evidence.set(level, matches);
  }
  return evidence;
}

/**
 * **Ταυτότητα από την αλυσίδα ετικετών της μηχανής.**
 *
 * Η βαθύτερη βαθμίδα της οποίας **ένας** υποψήφιος εξηγεί όλες τις **ρηχότερες**
 * αποδείξεις. Αν κανείς δεν τις εξηγεί *(OSM και ΕΛΣΤΑΤ διαφωνούν)*, η βαθμίδα
 * **εγκαταλείπεται** και δοκιμάζεται η επόμενη ρηχότερη — ποτέ δεν διαλέγουμε.
 */
export function resolveAdminChain(
  labels: readonly string[],
  sources: AdminIdentitySources,
): AdminChainResolution {
  if (sources.index.size === 0) return { verdict: { kind: 'unknown' }, proved: NOTHING_PROVED };

  const evidence = evidenceByLevel(labels, sources.index);
  if (evidence.size === 0) return { verdict: { kind: 'absent' }, proved: NOTHING_PROVED };

  const levels = [...evidence.keys()].sort((a, b) => b - a);
  let deepestAmbiguity: AdminIdentityVerdict | null = null;

  for (const level of levels) {
    const shallower = levels.filter((other) => other < level);
    const survivors = (evidence.get(level) ?? []).filter((candidate) => {
      const containers = containerIdsOf(sources.lineageOf, candidate);
      // ⚠️ Κενή γενεαλογία = «δεν ξέρω» ⇒ **καμία απόρριψη**. Αλλιώς μια ιεραρχία που
      //    δεν φόρτωσε θα εμφανιζόταν ως «όλες οι αποδείξεις αντιφατικές».
      if (containers.size === 0) return shallower.length === 0;
      return shallower.every((other) =>
        (evidence.get(other) ?? []).some((ancestor) => containers.has(ancestor.id)),
      );
    });

    if (survivors.length === 1) {
      const winner = survivors[0];
      const via: AdminIdentityVia = (evidence.get(level) ?? []).length === 1 ? 'exact' : 'chain';
      return {
        verdict: { kind: 'identified', entity: winner, level, via },
        proved: provedLevelsOf(sources, winner),
      };
    }
    if (survivors.length > 1 && deepestAmbiguity === null) {
      deepestAmbiguity = { kind: 'ambiguous', level, candidates: survivors };
    }
  }

  return { verdict: deepestAmbiguity ?? { kind: 'absent' }, proved: NOTHING_PROVED };
}

/**
 * Ο νικητής **και όλοι οι πρόγονοί του** — παραγόμενα, όχι ξανα-αντιστοιχισμένα.
 *
 * 🔴 **Εξάγεται επειδή η ζωντανή μέτρηση βρήκε κενό** *(2026-09-12, ALFA → Σταυρούπολις)*:
 * η αλυσίδα της ετικέτας απέδειξε **L5 ΔΗΜΟΣ ΠΑΥΛΟΥ ΜΕΛΑ** και ο οικισμός αποδείχθηκε
 * **μετά**, μέσα σε αυτή την εμβέλεια. Τα **ενδιάμεσα** επίπεδα — L6 ΔΗΜΟΤΙΚΗ ΕΝΟΤΗΤΑ
 * ΣΤΑΥΡΟΥΠΟΛΕΩΣ και L7 — είναι **πρόγονοι του αποδεδειγμένου οικισμού**, δηλαδή
 * **αποδεδειγμένα**· και όμως γράφονταν **κενά**, επειδή ο νικητής της αλυσίδας ήταν ο L5.
 * Αυτό παραβίαζε την ίδια μας την αρχή: *«γράψε ό,τι αποδείχθηκε»*.
 */
export function provedLevelsOfPlace(
  sources: AdminIdentitySources,
  winner: AdminPlace,
): ReadonlyMap<number, AdminPlace> {
  return provedLevelsOf(sources, winner);
}

function provedLevelsOf(
  sources: AdminIdentitySources,
  winner: AdminPlace,
): ReadonlyMap<number, AdminPlace> {
  const proved = new Map<number, AdminPlace>([[winner.level, winner]]);
  for (const ancestorId of sources.lineageOf(winner.id)) {
    const ancestor = sources.placeOf(ancestorId);
    if (ancestor) proved.set(ancestor.level, ancestor);
  }
  return proved;
}

// =============================================================================
// ΜΕΣΑ ΣΕ ΑΠΟΔΕΔΕΙΓΜΕΝΗ ΕΜΒΕΛΕΙΑ — Ο ΟΙΚΙΣΜΟΣ
// =============================================================================

/**
 * **Ταυτότητα αδήλωτης ετικέτας, ΜΟΝΟ μέσα σε αποδεδειγμένη εμβέλεια.**
 *
 * Εδώ απαντιέται ο **οικισμός** *(επίπεδο 8)*: το OSM δεν στέλνει ποτέ οικισμό ΕΛΣΤΑΤ,
 * στέλνει `city`/`town`/`village` χωρίς πρόθεμα *(«Αθήνα», «Λάρισα», «Διαβατά»)*.
 *
 * 🔑 **Η εμβέλεια είναι ό,τι κάνει την ερώτηση απαντήσιμη.** Μετρημένο: **1.284 από τις
 * 1.368** ομάδες ομωνύμων του επιπέδου 8 *(**93,9%**)* έχουν τα μέλη τους σε **διαφορετικούς
 * δήμους** — άρα ένας αποδεδειγμένος δήμος μετατρέπει το «41 Καλλιθέες» σε **μία**.
 *
 * ⚠️ Η **ανοχή τυπογραφικού** επιτρέπεται εδώ *(και μόνο εδώ)*, και **δεν** παράγει
 * αποθηκεύσιμη ταυτότητα — δες {@link ADMIN_ID_TRUSTED_VIA}.
 */
/**
 * **Ακριβές όνομα, ΜΟΝΑΔΙΚΟ στη χώρα — ή τίποτα.** Η μόνη ασφαλής απάντηση όταν **καμία
 * εμβέλεια δεν έχει αποδειχθεί**.
 *
 * 🔑 Αυτή είναι η διαδρομή του **ανθρώπου που πληκτρολογεί** στη φόρμα: δεν υπάρχει σημείο,
 * δεν υπάρχει αλυσίδα, δεν υπάρχει πρόθεμα. Καμία ανοχή και **καμία** αποσαφήνιση με σειρά:
 * ομώνυμα ⇒ `ambiguous`, και τα οκτώ πεδία της φόρμας περιμένουν τον άνθρωπο.
 *
 * ⚠️ **Μετρημένο**: στο επίπεδο 8 το **84,3%** των ονομάτων λύνεται μονοσήμαντα έτσι, και
 * **1.461** είναι ομώνυμα *(«Καλλιθέα» ×41)*. Το 84,3% είναι απόδειξη· το υπόλοιπο είναι
 * ερώτηση προς τον άνθρωπο, όχι κέρμα.
 */
export function identifyExact(
  label: string,
  level: number,
  sources: AdminIdentitySources,
  postalCode?: string,
): AdminIdentityVerdict {
  if (sources.index.size === 0) return { kind: 'unknown' };
  const trimmed = label.trim();
  if (trimmed === '') return { kind: 'absent' };

  const matches = exactNameMatches(sources.index, level, trimmed);
  if (matches.length === 1) return { kind: 'identified', entity: matches[0], level, via: 'exact' };
  if (matches.length === 0) return { kind: 'absent' };

  // 🔑 **Ο Τ.Κ. ΜΟΝΟ ΕΔΩ**: ανάμεσα σε **ΑΚΡΙΒΩΣ** ομώνυμους, όπου το όνομα ταιριάζει
  //    απόλυτα και ο κώδικας μόνο **στενεύει**. Μετρημένο: των 41 «Καλλιθέα» μόνο **μία**
  //    έχει Τ.Κ. 69100 — και είναι η σωστή, στον ΔΗΜΟ ΜΑΡΩΝΕΙΑΣ - ΣΑΠΩΝ.
  const canonical = postalCode === undefined ? '' : toCanonicalGreekPostalCode(postalCode);
  if (canonical !== '') {
    const byPostal = matches.filter(
      (place) => toCanonicalGreekPostalCode(place.postalCode ?? '') === canonical,
    );
    if (byPostal.length === 1) {
      return { kind: 'identified', entity: byPostal[0], level, via: 'postal' };
    }
  }

  return { kind: 'ambiguous', level, candidates: matches };
}

export function identifyWithin(
  label: string,
  level: number,
  scopeId: string,
  sources: AdminIdentitySources,
): AdminIdentityVerdict {
  if (sources.index.size === 0) return { kind: 'unknown' };
  const trimmed = label.trim();
  if (trimmed === '') return { kind: 'absent' };

  const within = (place: AdminPlace): boolean =>
    containerIdsOf(sources.lineageOf, place).has(scopeId);

  const exact = exactNameMatches(sources.index, level, trimmed).filter(within);
  if (exact.length === 1) return { kind: 'identified', entity: exact[0], level, via: 'chain' };
  if (exact.length > 1) return { kind: 'ambiguous', level, candidates: exact };

  // ⚠️ **Η ΣΕΙΡΑ ΤΩΝ ΔΥΟ ΒΑΘΜΙΔΩΝ ΕΙΝΑΙ ΣΗΜΑΣΙΑ, ΟΧΙ ΤΥΧΗ.** Η **πτώση** πρώτα: είναι
  //    **κανονική** γλωσσική σχέση *(«Ελευθερίου» → «Ελευθέριο»)*, δηλαδή **ίδιο όνομα** σε
  //    άλλη μορφή. Το **τυπογραφικό** μετά: είναι **ατύχημα** *(«Θεσαλονίκης», ένα σ)*, και
  //    μπορεί να γεφυρώσει **αληθινές** διακρίσεις *(«Νέα»/«Νέο», «Κομνηνά»/«Κομνίνα»)*.
  //    Με την πτώση πρώτη, το ατύχημα δεν προλαβαίνει να μιλήσει όπου υπάρχει κανόνας.
  const inflected = inflectedNameMatchesWithin(sources.index, level, trimmed, within);
  if (inflected.length === 1 && inflected[0].length === 1) {
    return { kind: 'identified', entity: inflected[0][0], level, via: 'scoped-inflection' };
  }
  if (inflected.length > 1) return { kind: 'ambiguous', level, candidates: inflected.flat() };

  const near = nearNameMatchesWithin(sources.index, level, trimmed, within);
  if (near.length === 1 && near[0].length === 1) {
    return { kind: 'identified', entity: near[0][0], level, via: 'scoped-typo' };
  }
  if (near.length > 1) return { kind: 'ambiguous', level, candidates: near.flat() };

  return { kind: 'absent' };
}
