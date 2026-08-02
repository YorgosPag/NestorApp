/**
 * ADR-748 Φάση 2 — ΔΙΑΚΟΠΤΗΣ ΕΙΔΙΚΟΤΗΤΑΣ: ποιες ribbon καρτέλες βλέπω.
 *
 * Ο DXF viewer ανήκει σε **μία** δουλειά — το «Σχέδιο» (ADR-748 §14.3). Μέσα
 * της, ένας διακόπτης ειδικότητας ορίζει ποιες από τις **15** μόνιμες καρτέλες
 * είναι ενεργές: **7 / 7 / 12 / 7 / 5 / 15**.
 *
 * 🔴 ΔΕΚΑΠΕΝΤΕ, ΟΧΙ 16. Το ADR-748 γράφει «16» σε πέντε σημεία, αλλά ο ίδιος ο
 * πίνακας του §2.5 απαριθμεί 15 (1 home + 1 structural + 1 architecture + 6 ΗΛΜ
 * + 1 topography + 5 κοινά). Λάθος άθροιση, αντιγραμμένη από έγγραφο σε έγγραφο.
 * Το βρήκε το anchor test την πρώτη φορά που έτρεξε — κανόνας N.12: άνοιξε το
 * αρχείο, μην αντιγράψεις τον αριθμό. Τα πλήθη ανά θέση (7/7/12/7/5) ήταν σωστά.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΤΥΠΟ — Revit, και μάλιστα ΔΥΟ ΞΕΧΩΡΙΣΤΑ ΠΡΑΓΜΑΤΑ
 *
 *   Revit «Options → User Interface → *tab and tools*» = ποια ΕΡΓΑΛΕΙΑ έχω.
 *      → αυτό εδώ. Ρύθμιση **του χρήστη**, όχι της όψης, όχι του ρόλου.
 *
 *   Revit «View Discipline» (halftone) = τι ΠΕΡΙΕΧΟΜΕΝΟ βλέπω στην όψη.
 *      → υπάρχει ΗΔΗ: `DisciplineVisibilityToggle` (ADR-405 §4, καρτέλα
 *        «Προβολή»), που κρύβει ΟΝΤΟΤΗΤΕΣ μέσω `disciplineVisibility`.
 *
 * ⚠️ ΜΗΝ ΤΑ ΕΝΩΣΕΙΣ. Απαντούν σε διαφορετικά ερωτήματα και το Revit τα κρατά
 * χωριστά. Γι' αυτό διαφέρουν και στην οθόνη: εκείνο λέγεται «Ειδικότητα»
 * (περιεχόμενο), αυτό «Εργαλεία» (καρτέλες).
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ Η ΑΝΑΘΕΣΗ ΕΙΝΑΙ **ΑΝΑ ΚΑΡΤΕΛΑ** ΚΑΙ ΟΧΙ «λίστα καρτελών ανά θέση»
 *
 * Λίστα ανά θέση θα ήταν **δεύτερη λίστα καρτελών** δίπλα στο
 * `DEFAULT_RIBBON_TAB_ORDER` — δηλαδή διπλότυπο που αποκλίνει σιωπηλά.
 * Έτσι όπως είναι, κάθε καρτέλα δηλώνει **μία φορά** πού ανήκει, και το
 * anchor test (`ribbon-tab-specialty-coverage.test.ts`) μπλοκάρει τη 17η
 * αδήλωτη καρτέλα — πρότυπο ADR-587 capability anchors, όπως ζητά το Υ-4:
 * «νέο ribbon tab χωρίς ανάθεση ⇒ το gate μπλοκάρει».
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΦΙΛΤΡΟ ΠΟΤΕ ΔΕΝ ΠΡΟΣΘΕΤΕΙ ΔΙΚΑΙΩΜΑ — μόνο αφαιρεί θόρυβο (ADR-748 §5).
 * Τον διακόπτη τον γυρνά **ο χρήστης** (Α-1, Ε7.ιβ: ρόλος ≠ δουλειά ≠
 * ειδικότητα). Καμία σχέση με auth — γι' αυτό το subapp παραμένει με μηδέν
 * αναφορές `useAuth` (§2.4).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §5.1
 */

import type { Discipline } from '../../../bim/discipline/bim-discipline';
import { DEFAULT_RIBBON_TAB_ORDER } from './ribbon-default-tabs';

// =============================================================================
// ΤΑΥΤΟΤΗΤΑ
// =============================================================================

/**
 * Οι πέντε θέσεις εργασίας του διακόπτη (ADR-748 §5.1).
 *
 * ⚠️ ΔΕΝ είναι νέο λεξιλόγιο ειδικοτήτων: το λεξιλόγιο είναι το `Discipline`
 * του ADR-405 και ζει στο `bim/discipline/bim-discipline.ts`. Οι τιμές εδώ
 * είναι **ομαδοποιήσεις** πάνω σε εκείνο (βλ. SPECIALTY_DISCIPLINES) — γι' αυτό
 * υπάρχει το `mep` (η ελληνική «ΗΛΜ» = τέσσερις disciplines μαζί) και το
 * `presentation` (τρόπος εργασίας, καμία discipline).
 */
export type RibbonSpecialtyId =
  | 'architectural'
  | 'structural'
  | 'mep'
  | 'topographic'
  | 'presentation';

/** Η σημερινή συμπεριφορά: καμία απόκρυψη. Είναι σκόπιμα η **προεπιλογή**. */
export const RIBBON_SPECIALTY_ALL = 'all' as const;

/** Ό,τι μπορεί να δείχνει ο διακόπτης. */
export type RibbonSpecialtySelection =
  | RibbonSpecialtyId
  | typeof RIBBON_SPECIALTY_ALL;

/** Σειρά εμφάνισης στον διακόπτη. «Όλα» τελευταίο — είναι η έξοδος, όχι θέση. */
export const RIBBON_SPECIALTY_ORDER: readonly RibbonSpecialtySelection[] = [
  'architectural',
  'structural',
  'mep',
  'topographic',
  'presentation',
  RIBBON_SPECIALTY_ALL,
] as const;

/** i18n keys (namespace `dxf-viewer-shell`). Στατικά ⇒ ορατά στον analyzer. */
export const RIBBON_SPECIALTY_LABEL_KEY: Readonly<
  Record<RibbonSpecialtySelection, string>
> = {
  architectural: 'ribbon.specialty.names.architectural',
  structural: 'ribbon.specialty.names.structural',
  mep: 'ribbon.specialty.names.mep',
  topographic: 'ribbon.specialty.names.topographic',
  presentation: 'ribbon.specialty.names.presentation',
  all: 'ribbon.specialty.names.all',
};

/**
 * Η ΓΕΦΥΡΑ με το υπάρχον λεξιλόγιο του ADR-405 — ο λόγος που αυτό το αρχείο
 * ΔΕΝ φτιάχνει πέμπτο λεξιλόγιο. Μονόδρομη σχέση: θέση διακόπτη → disciplines.
 *
 * `presentation` = **κενό** επίτηδες: δεν είναι ειδικότητα αλλά τρόπος εργασίας
 * (πρότυπο Figma Dev Mode / Cinema 4D layouts) — παρουσιάζεις ό,τι υπάρχει,
 * δεν συντάσσεις μελέτη.
 */
export const SPECIALTY_DISCIPLINES: Readonly<
  Record<RibbonSpecialtyId, readonly Discipline[]>
> = {
  architectural: ['architectural', 'interior'],
  structural: ['structural'],
  // «ΗΛΜ» = οι Η/Μ μελέτες μαζί (ADR-444: 6 καρτέλες, 4 disciplines).
  mep: ['electrical', 'mechanical', 'plumbing', 'fire', 'telecom'],
  // Τοπογραφικά = `civil` στο ADR-405 (ADR-662 «Τοπογραφικό»).
  topographic: ['civil'],
  presentation: [],
};

// =============================================================================
// Η ΑΝΑΘΕΣΗ — μία δήλωση ανά καρτέλα, ΟΛΙΚΗ πάνω στο DEFAULT_RIBBON_TAB_ORDER
// =============================================================================

/**
 * Σε ποιες θέσεις του διακόπτη εμφανίζεται κάθε καρτέλα.
 *
 * ⚠️ ΟΛΙΚΟΤΗΤΑ: κάθε id του `DEFAULT_RIBBON_TAB_ORDER` πρέπει να υπάρχει εδώ,
 * και κάθε id εδώ πρέπει να υπάρχει εκεί. Το anchor test το επιβάλλει και προς
 * τις δύο κατευθύνσεις — μια αδήλωτη καρτέλα δεν «περνά σιωπηλά ως κοινή».
 *
 * ⚠️ ΤΑ CONTEXTUAL TABS ΔΕΝ ΜΠΑΙΝΟΥΝ ΕΔΩ (~57). Εμφανίζονται μόνο όταν
 * επιλεγεί η αντίστοιχη οντότητα· απόκρυψή τους θα σήμαινε «διάλεξες κάτι και
 * δεν μπορείς να το επεξεργαστείς», που είναι σφάλμα, όχι φίλτρο.
 */
export const RIBBON_TAB_SPECIALTIES: Readonly<
  Record<string, readonly RibbonSpecialtyId[]>
> = {
  // ── Κοινές σε κάθε μελέτη ──────────────────────────────────────────────────
  home: ['architectural', 'structural', 'mep', 'topographic', 'presentation'],
  insert: ['architectural', 'structural', 'mep', 'topographic', 'presentation'],
  view: ['architectural', 'structural', 'mep', 'topographic', 'presentation'],
  annotate: ['architectural', 'structural', 'mep', 'topographic', 'presentation'],
  // «Ανάλυση» + «Ρυθμίσεις»: εκτός Παρουσίασης — δεν συντάσσεις ούτε ρυθμίζεις
  // όταν δείχνεις (ο διακόπτης μένει πάντα προσιτός, ζει στη γραμμή καρτελών).
  analyze: ['architectural', 'structural', 'mep', 'topographic'],
  settings: ['architectural', 'structural', 'mep', 'topographic'],

  // ── Καρτέλες μελέτης (ADR-443/444/662) ─────────────────────────────────────
  architecture: ['architectural', 'presentation'],
  structural: ['structural'],
  electrical: ['mep'],
  water: ['mep'],
  drainage: ['mep'],
  heating: ['mep'],
  hvac: ['mep'],
  'fire-gas': ['mep'],
  topography: ['topographic'],
};

// =============================================================================
// ΚΑΘΑΡΕΣ ΣΥΝΑΡΤΗΣΕΙΣ — μηδέν I/O, μηδέν React, πλήρως testable (Ε5.ζ)
// =============================================================================

/** Type guard για τιμή που ήρθε από `localStorage` (ποτέ εμπιστοσύνη σε string). */
export function isRibbonSpecialtySelection(
  value: string,
): value is RibbonSpecialtySelection {
  return (RIBBON_SPECIALTY_ORDER as readonly string[]).includes(value);
}

/**
 * Οι καρτέλες που μένουν ορατές για την επιλεγμένη θέση.
 *
 * FAIL-OPEN ΕΠΙΤΗΔΕΣ (πρότυπο `decideAssetPackAccess`, αλλά ανάποδη φορά —
 * και εδώ είναι το σωστό): άγνωστο id ⇒ **παραμένει ορατό**. Το φίλτρο είναι
 * UX, όχι ασφάλεια (§5, Ε5.η)· fail-closed εδώ θα εξαφάνιζε σιωπηλά μια νέα
 * καρτέλα που κάποιος ξέχασε να δηλώσει — δηλαδή θα έκρυβε το λάθος (Α-3).
 * Το λάθος το πιάνει το anchor test, όχι ο χρήστης στην οθόνη.
 */
export function resolveVisibleTabIds(
  tabIds: readonly string[],
  specialty: RibbonSpecialtySelection,
): readonly string[] {
  if (specialty === RIBBON_SPECIALTY_ALL) return tabIds;
  return tabIds.filter((id) => {
    const owners = RIBBON_TAB_SPECIALTIES[id];
    if (owners === undefined) return true; // αδήλωτη ⇒ ορατή (βλ. παραπάνω)
    return owners.includes(specialty);
  });
}

/**
 * Πόσες μόνιμες καρτέλες κρύβει η τρέχουσα θέση.
 *
 * Τροφοδοτεί τον **μόνιμο δείκτη** «Χ κρυμμένες» (Α-3, Υ-2): ποτέ σιωπηλή
 * απόκρυψη — το μάθημα του Office 2000. Μετρά πάντα πάνω στις μόνιμες καρτέλες,
 * ώστε ο αριθμός να μην αναπηδά όταν εμφανίζεται contextual καρτέλα.
 */
export function countHiddenTabs(specialty: RibbonSpecialtySelection): number {
  return (
    DEFAULT_RIBBON_TAB_ORDER.length -
    resolveVisibleTabIds(DEFAULT_RIBBON_TAB_ORDER, specialty).length
  );
}
