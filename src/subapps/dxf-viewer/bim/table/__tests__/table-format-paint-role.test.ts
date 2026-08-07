/**
 * 🔴 **ADR-768 Δ2 — Ο ΔΕΙΚΤΗΣ ΤΟΥ ΠΙΝΕΛΟΥ ΑΛΛΑΖΕΙ ΑΚΡΙΒΩΣ ΕΚΕΙ ΠΟΥ ΤΟ ΠΑΤΗΜΑ ΒΑΦΕΙ.**
 *
 * ## Η ερώτηση που ρωτούν αυτά τα anchors
 * Όχι «τι επιστρέφει η συνάρτηση για τρεις ρόλους» — αλλά **«για ΟΛΟΥΣ τους ρόλους της ένωσης,
 * ποιοι αλλάζουν;»**. Η διαφορά είναι όλη η αξία: ένας νέος ρόλος αύριο (ο δέκατος τέταρτος) θα
 * περάσει σιωπηλά από ένα test που δοκιμάζει ονομαστικά τρεις περιπτώσεις, ενώ εδώ οφείλει να
 * περάσει από τη λίστα — και ο **τύπος** δεν τον αφήνει να ξεχαστεί.
 *
 * ## 🔴 Γιατί το «ποιοι ΔΕΝ αλλάζουν» είναι το σημαντικό μισό
 * Ο §31 έχει έναν αναλλοίωτο κανόνα: *ο δείκτης δείχνει ό,τι θα κάνει το πάτημα*. Το πινέλο δεν
 * βάφει από τις λωρίδες (Βήμα 6), δεν βάφει πάνω στο ⊕/⊖ (εκεί το πάτημα εισάγει/σβήνει), δεν
 * βάφει πάνω στη λαβή συμπλήρωσης (εκεί συμπληρώνει) και δεν βάφει στα διαχωριστικά (εκεί σέρνει
 * πλάτος). Αν η συνάρτηση «απλοποιούνταν» σε «όσο είμαι οπλισμένος, όλα γίνονται πινέλο», και τα
 * **δέκα** αυτά σημεία θα υπόσχονταν βάψιμο που δεν συμβαίνει.
 *
 * @see bim/table/table-indicator-cursor-role.ts — η συνάρτηση και το σύνολο των τριών
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import {
  tableFormatPaintRoleOf,
  type TableIndicatorCursorRole,
} from '../table-indicator-cursor-role';

/**
 * 🔴 **ΟΛΟΙ οι ρόλοι, γραμμένοι μία φορά** — και ο τύπος από κάτω απαγορεύει να μείνει κάποιος έξω.
 *
 * Χωρίς τη λίστα, «εξαντλητικά» θα σήμαινε «όσους θυμήθηκε ο συγγραφέας του test».
 */
const ALL_ROLES = [
  'column-select',
  'row-select',
  'column-resize',
  'row-resize',
  'cell-select',
  'range-move',
  'range-copy',
  'range-refuse',
  'insert-control',
  'delete-control',
  'fill-handle',
  'select-all',
  'format-paint',
] as const satisfies readonly TableIndicatorCursorRole[];

/**
 * 🔴 **Ο ΦΥΛΑΚΑΣ ΣΕ ΕΠΙΠΕΔΟ ΤΥΠΟΥ**: αν προστεθεί ρόλος στην ένωση και δεν μπει εδώ, το
 * `Exclude` δεν είναι `never` και η γραμμή **δεν μεταγλωττίζεται**.
 *
 * Είναι το αντίστοιχο του exhaustive `switch` του `useCrosshairCursor`, στη μεριά της δοκιμής:
 * ένα test που «ξέχασε» τον νέο ρόλο θα ήταν πράσινο και άχρηστο.
 */
type MissingRole = Exclude<TableIndicatorCursorRole, (typeof ALL_ROLES)[number]>;
const _NO_ROLE_LEFT_BEHIND: MissingRole[] = [];

/** Οι τρεις που το πάτημά τους καταλήγει σε **κελί**. Δες την κεφαλίδα του module. */
const PAINTABLE: readonly TableIndicatorCursorRole[] = ['cell-select', 'range-move', 'range-copy'];

describe('🔴 ADR-768 Δ2 — tableFormatPaintRoleOf', () => {
  it('🔴 ΑΛΛΑΖΕΙ ακριβώς τους τρεις ρόλους που καταλήγουν σε κελί — κανέναν άλλον', () => {
    // Το κριτήριο είναι «**άλλαξε**», όχι «ισούται με `format-paint`»: ο ίδιος ο ρόλος
    // `format-paint` περνά ήδη ίσος (ιδεμποτής), και θα μολύναινε κάθε μέτρηση ισότητας.
    const changed = ALL_ROLES.filter((role) => tableFormatPaintRoleOf(role) !== role);
    expect([...changed].sort()).toEqual([...PAINTABLE].sort());
    for (const role of changed) expect(tableFormatPaintRoleOf(role)).toBe('format-paint');
  });

  it('🔴 αφήνει ΑΝΕΓΓΙΧΤΟΥΣ και τους δέκα υπόλοιπους — ο δείκτης δεν ψεύδεται (§31)', () => {
    for (const role of ALL_ROLES) {
      if (PAINTABLE.includes(role)) continue;
      // Ταυτότητα, όχι «κάτι άλλο»: πάνω στο ⊕ το πάτημα εισάγει, πάνω στη λαβή συμπληρώνει,
      // πάνω στη λωρίδα μαρκάρει. Και οι τρεις πράξεις εκτελούνται κανονικά με οπλισμένο πινέλο.
      expect(tableFormatPaintRoleOf(role)).toBe(role);
    }
  });

  it('`null` (κανένας ρόλος) μένει `null` — το σταυρόνημα του σχεδίου δεν διεκδικείται', () => {
    // Έξω από τον πίνακα δεν υπάρχει τίποτα να βαφτεί, άρα ούτε δείκτη να υποσχεθεί κάτι.
    expect(tableFormatPaintRoleOf(null)).toBeNull();
  });

  it('ιδεμποτής: το ίδιο το `format-paint` μένει `format-paint`', () => {
    // Αδιάφορο σήμερα (ο καλών ρωτά με γεωμετρικό ρόλο), αλλά κλειδώνει ότι η συνάρτηση είναι
    // **προβολή** και όχι διακόπτης — δεύτερη κλήση δεν μπορεί να αναιρέσει την πρώτη.
    expect(tableFormatPaintRoleOf('format-paint')).toBe('format-paint');
  });

  it('η λίστα των ρόλων καλύπτει ΟΛΗ την ένωση (φύλακας τύπου, μηδέν runtime κόστος)', () => {
    expect(_NO_ROLE_LEFT_BEHIND).toHaveLength(0);
    expect(ALL_ROLES).toHaveLength(13);
  });
});
