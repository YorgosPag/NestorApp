/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Ο ΡΕΥΣΤΟΣ ΔΙΑΔΡΟΜΟΣ — τα παράγωγα της κλίμακας, και ο φρουρός του μέτρου
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ΕΞΗΧΘΗ από το `scripts/build-design-tokens.js` (ADR-811): ο γεννήτορας είχε
 * φτάσει **ακριβώς** στις 500 γραμμές, δηλαδή στο ταβάνι του κανόνα N.7.1.
 * Η τομή είναι **κατά ευθύνη**, όχι κατά μέγεθος: εδώ ζει το «πόσο πλατύς ο
 * διάδρομος και πόσο φαρδιά η γραμμή», εκεί το «πώς γράφονται τα αρχεία».
 *
 * ⚠️ ΚΑΜΙΑ αλλαγή συμπεριφοράς: το σώμα μεταφέρθηκε **αυτούσιο**. Ο φρουρός
 * του μέτρου (`MEASURE_CEILING`) και η αιτιολόγησή του μένουν ακέραια — το
 * ADR-797 §Β.11 λέει ρητά «ΜΗΝ τον διαγράψεις».
 *
 * @module scripts/lib/design-tokens/fluid-layout
 */

'use strict';

/**
 * Παράγει τα **παράγωγα** της ρευστής κλίμακας του διαδρόμου.
 *
 * 🔑 **ΓΙΑΤΙ ΠΑΡΑΓΟΝΤΑΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ CSS.** Η ευθεία που ενώνει τους δύο
 * πόλους θέλει `(gmax − gmin) / (pmax − pmin)`, δηλαδή **διαίρεση μήκους με
 * μήκος**. Αυτό είναι *typed arithmetic* (CSS Values 4) και υποστηρίζεται μόνο
 * σε **Chrome 119+ / Safari 17+ / Firefox 116+**. Σε παλαιότερο browser η
 * `calc()` γίνεται **invalid at computed-value time**, οπότε **ολόκληρη η
 * δήλωση πέφτει** και ο διάδρομος γίνεται **0** — δηλαδή ακριβώς το ελάττωμα
 * που αυτό το ADR θεραπεύει, ξαναγεννημένο **σιωπηλά** και μόνο σε ξένη οθόνη.
 *
 * Ο generator είναι Node: κάνει την ίδια αριθμητική **μία φορά, στο build**,
 * και το CSS μένει με `number × length` (Level 3, παντού). Κανείς δεν γράφει
 * τους αριθμούς με το χέρι, άρα **δεν μπορούν να αποκλίνουν** από τους πόλους
 * (ADR-749: μία μηχανή).
 *
 * @param {object} tokens Το πλήρες δέντρο του `design-tokens.json`.
 * @returns {string} Γραμμές CSS custom properties, ή '' αν λείπει η κλίμακα.
 */
function emitFluidLayout(tokens) {
  const layout = tokens?.spacing?.layout;
  if (!layout) return '';

  const num = (node, name) => {
    const raw = Number(node?.value);
    if (!Number.isFinite(raw)) {
      // ⛔ fail-closed: σιωπηλή παράλειψη θα έδινε CSS που «δουλεύει» με
      //    λάθος γεωμετρία — χειρότερο από σφάλμα build.
      throw new Error(`[fluid-layout] Μη αριθμητικός πόλος: spacing.layout.${name}`);
    }
    return raw;
  };

  const gutterMin = num(layout.gutter?.min, 'gutter.min');
  const gutterMax = num(layout.gutter?.max, 'gutter.max');
  const paneMin = num(layout.pane?.min, 'pane.min');
  const paneMax = num(layout.pane?.max, 'pane.max');

  if (paneMax <= paneMin) {
    throw new Error('[fluid-layout] pane.max πρέπει να είναι μεγαλύτερο του pane.min');
  }
  if (gutterMax < gutterMin) {
    throw new Error('[fluid-layout] gutter.max δεν επιτρέπεται να είναι μικρότερο του gutter.min');
  }

  // ── ADR-797 §Β.11: ΤΟ ΤΑΒΑΝΙ ΤΟΥ ΜΕΤΡΟΥ ΩΣ ΣΦΑΛΜΑ BUILD ────────────────
  // Ο ρόλος ζει σε ΕΝΑ αρχείο και τον καταναλώνουν ΟΛΕΣ οι σελίδες που τον
  // ζητούν, άρα ένας κακός αριθμός εδώ είναι κακός ΠΑΝΤΟΥ, ταυτόχρονα και
  // σιωπηλά. Γι' αυτό ο έλεγχος ζει στον ΓΕΝΝΗΤΟΡΑ και όχι σε πύλη: μια πύλη
  // ρωτά «πέρασε κάτι κακό;» ΕΚ ΤΩΝ ΥΣΤΕΡΩΝ· εδώ το κακό είναι ΜΗ ΕΚΦΡΑΣΙΜΟ —
  // το build δεν παράγει CSS που το περιέχει.
  //
  // 🔴 ΤΟ ΤΑΒΑΝΙ ΕΙΝΑΙ ΣΥΜΒΑΣΗ ΣΧΕΔΙΑΣΗΣ — ΔΕΝ ΕΙΝΑΙ ΤΟ WCAG 1.4.8, ΚΑΙ Η
  //    ΔΙΑΦΟΡΑ ΜΕΤΡΗΘΗΚΕ. Δύο ανεξάρτητοι λόγοι:
  //
  //    (α) Το 1.4.8 είναι **AAA** και το κανονιστικό του κείμενο ζητά «a
  //        MECHANISM is available», με Note 1: «Content is NOT REQUIRED to use
  //        these values». Άρα κανένα προεπιλεγμένο πλάτος δεν το ικανοποιεί —
  //        το ικανοποιεί ΕΠΙΛΟΓΗ ΧΡΗΣΤΗ, που δεν υπάρχει σήμερα.
  //    (β) Το `ch` ΔΕΝ είναι χαρακτήρας: είναι το advance του γλύφου «0»
  //        (8,984px, Roboto 16px). Μετρημένο ντετερμινιστικά από το `hmtx` της
  //        γραμματοσειράς πάνω στα locale JSON (458.272 χαρακτήρες):
  //          el 7,895 px/χαρ ⇒ 80ch =  91 χαρακτήρες
  //          en 7,088 px/χαρ ⇒ 80ch = 101 χαρακτήρες
  //        Για 80 ΠΡΑΓΜΑΤΙΚΟΥΣ χαρακτήρες θα χρειαζόταν 70,3ch (el) / 63,1ch (en).
  //
  // ✅ Ο ΦΡΟΥΡΟΣ ΠΑΡΑΜΕΝΕΙ, ΚΑΙ ΕΙΝΑΙ ΧΡΗΣΙΜΟΣ: σταματά πραγματικά ξέφυγες
  //    τιμές, κρατά την κλίμακα σε ΔΥΟ ρόλους αντί για οκτώ χειρόγραφες, και
  //    κλειδώνει τη σύμβαση σε ΕΝΑ σημείο. Αυτό που διορθώθηκε (2026-08-25)
  //    είναι η ΑΙΤΙΟΛΟΓΗΣΗ του, όχι η ύπαρξή του. ΜΗΝ τον διαγράψεις.
  const MEASURE_CEILING = 80;
  const measure = layout.measure;
  if (measure) {
    for (const [role, node] of Object.entries(measure)) {
      if (role.startsWith('_')) continue;
      const chars = num(node, `measure.${role}`);
      if (chars > MEASURE_CEILING) {
        throw new Error(
          `[fluid-layout] spacing.layout.measure.${role} = ${chars}ch· `
          + `η σύμβαση μέτρου του ADR-797 §Β.11 ορίζει ταβάνι ${MEASURE_CEILING}ch. `
          + 'ΜΗΝ ανεβάσεις το ταβάνι για να περάσει — αν η σελίδα θέλει περισσότερο '
          + 'πλάτος, δεν θέλει μεγαλύτερο MEASURE: θέλει ΔΙΑΤΑΞΗ (πολλαπλές στήλες).',
        );
      }
      if (chars < 20) {
        throw new Error(`[fluid-layout] spacing.layout.measure.${role} = ${chars} — αφύσικα στενό.`);
      }
    }
  }

  // Ευθεία μέσα από (paneMin, gutterMin) και (paneMax, gutterMax).
  const slope = (gutterMax - gutterMin) / (paneMax - paneMin);
  const intercept = gutterMin - slope * paneMin;

  const round = (n) => Number(n.toFixed(6));

  return [
    '',
    '  /* ── ADR-797: παράγωγα ρευστής κλίμακας — ΜΗΝ τα γράψεις με το χέρι ── */',
    `  --shell-gutter-slope: ${round(slope)};`,
    `  --shell-gutter-intercept: ${round(intercept)}px;`,
    '',
  ].join('\n');
}

module.exports = { emitFluidLayout };
