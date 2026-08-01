/**
 * ⚓ ADR-742 §7quaterdecies.3 — **ένα gate δεν επιτρέπεται να γεννηθεί κόκκινο**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΦΥΛΑΕΙ (μετρημένο 2026-08-01)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κανόνας του SSoT ratchet λέει *«New files = zero tolerance»*. Παρ' όλα
 * αυτά, μια σάρωση βρήκε **13 παραβάσεις σε 13 αρχεία** που κανείς δεν είχε
 * γράψει πρόσφατα. Η απόδοση ευθύνης έδειξε γιατί:
 *
 * | | ημερομηνία |
 * |---|---|
 * | `.ssot-violations-baseline.json` παρήχθη | **2026-07-20** |
 * | `public-showcase-token-surface` καταχωρήθηκε | **2026-07-25** (commit: **μόνο** το μητρώο) |
 * | `chart-card-shell` καταχωρήθηκε | **2026-07-26** (μητρώο + i18n, **καμία** ανανέωση baseline) |
 * | τα «παραβατικά» αρχεία άλλαξαν τελευταία | **2026-03-28 → 2026-05-25** |
 *
 * Δηλαδή: **κανείς δεν παρέβη τον κανόνα.** Ο ratchet απλώς **άνοιξε τα μάτια
 * του** σε παλιό κώδικα και κανείς δεν συμφιλίωσε τη baseline. Το gate
 * **γεννήθηκε ήδη κόκκινο** — και έμεινε έτσι δώδεκα ημέρες, ορατό μόνο σε
 * όποιον έτρεχε το dry-run με το χέρι.
 *
 * 🔴 **Δεν είναι παράβαση· είναι κενό ΔΙΑΔΙΚΑΣΙΑΣ** — και το κενό είναι το
 * πραγματικό εύρημα. Καταχωρείς module ⇒ μεγαλώνει το οπτικό πεδίο του ratchet
 * ⇒ **οφείλεις** στην ίδια δέσμευση είτε καθαρό δέντρο, είτε ρητή allowlist με
 * λόγο, είτε ανανεωμένη baseline. Αλλιώς το επόμενο commit κάποιου άσχετου
 * μπλοκάρεται από χρέος που δεν δημιούργησε.
 *
 * ⚠️ **Επαναλήφθηκε ΕΞΙ φορές, όχι δύο** (μετρημένο): επτά modules φέρουν
 * `addedDate` νεότερη της baseline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ **ΔΕΝ** ΒΛΕΠΕΙ (δηλωμένο)
 * ─────────────────────────────────────────────────────────────────────────────
 * - **Αν το module όντως συνεισφέρει παραβάσεις.** Αυτό θέλει πλήρη σάρωση
 *   (~27s) και το κάνει το Layer 2 (`ssot-discover.yml` + `ssot:baseline`
 *   dry-run). Εδώ ελέγχεται η **διαδικασία**, όχι το πλήθος.
 * - **Modules χωρίς `addedDate`.** Είναι **319 από 407** — ιστορικό χρέος, όχι
 *   κάτι που φτιάχνεται εδώ. Φυλάσσεται με **ratchet**: ο αριθμός μόνο πέφτει.
 *   *Χωρίς αυτό, η παράλειψη της ημερομηνίας θα ήταν η δίοδος διαφυγής όλου
 *   του ελέγχου* — και μια δίοδος που κανείς δεν μετρά είναι σιωπηλή.
 *
 * @module scripts/__tests__/registry-baseline-reconciliation
 * @see adrs/ADR-742 §7quaterdecies · ADR-294 (SSoT ratchet) · ADR-710
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY = JSON.parse(fs.readFileSync(path.join(ROOT, '.ssot-registry.json'), 'utf8'));
const BASELINE = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.ssot-violations-baseline.json'), 'utf8'),
);

/** Η ημερομηνία της canonical baseline, ως `YYYY-MM-DD`. */
const BASELINE_DATE = BASELINE._meta.generated.slice(0, 10);

const MODULES = Object.entries(REGISTRY.modules);

/**
 * 🔴 Modules καταχωρημένα **μετά** την τελευταία baseline, με ρητή απόδειξη
 * συμφιλίωσης. Μια εγγραφή εδώ σημαίνει *«το κοίταξα και να τι βρήκα»* — όχι
 * *«το προσπέρασα»*.
 *
 * ⚠️ **Δεν είναι allowlist που μεγαλώνει άνετα**: κάθε προσθήκη απαιτεί
 * πρόταση που λέει **τι μετρήθηκε**. Αν δεν έχεις τι να γράψεις, δεν το
 * μέτρησες.
 */
const RECONCILED_AFTER_BASELINE = {
  'chart-card-shell':
    'ΣΥΜΦΙΛΙΩΘΗΚΕ 2026-08-01 (ADR-742 §7quaterdecies): 12 αρχεία μεταναστεύθηκαν σε <ChartCard>/<ChartPlot>· ' +
    'το ReportSparkline μπήκε στο allowlist με μετρημένο λόγο (80×32px γλυφικό vs 224–288px shell). ' +
    'Συνεισφορά στη baseline: 0.',
  'public-showcase-token-surface':
    'ΣΥΜΦΙΛΙΩΘΗΚΕ 2026-08-01 (ADR-742 §7quaterdecies): οι 11 παραβάσεις στο UnifiedShareDialog ήταν ' +
    'ψευδώς θετικές του pattern (React component, μηδέν αναζήτηση share) αλλά έκρυβαν πραγματικό ' +
    'διπλότυπο — ο πεντάπτυχος χάρτης επιφανειών ήταν γραμμένος 4 φορές. Κεντρικοποιήθηκε σε ' +
    'services/sharing/showcase-surfaces.ts. Συνεισφορά στη baseline: 0.',
  'numeric-field':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-25) — δεν συμφιλιώθηκε σε αυτή τη συνεδρία. Το dry-run της 2026-08-01 ' +
    'δεν του απέδωσε παραβάσεις, αλλά αυτό ΔΕΝ ελέγχθηκε ανά module. Εκκρεμεί ρητή μέτρηση.',
  'modal-keyboard-scope':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-26) — ίδια κατάσταση με το numeric-field. Εκκρεμεί ρητή μέτρηση.',
  'topo-source-cascade':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-28) — άλλου πράκτορα (topo). Εκκρεμεί ρητή μέτρηση.',
  'topo-point-elevation':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-28) — άλλου πράκτορα (topo). Εκκρεμεί ρητή μέτρηση.',
  'elevation-assignment-from-surface':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-29) — άλλου πράκτορα (topo). Εκκρεμεί ρητή μέτρηση.',
  'table-layout-engine':
    'ΠΡΟΫΠΑΡΧΟΝ (2026-07-31) — άλλου πράκτορα (ADR-739 πίνακες). Εκκρεμεί ρητή μέτρηση.',
};

/**
 * Πόσα modules δεν φέρουν `addedDate`. **Ratchet: μόνο μειώνεται.**
 * Μετρημένο 2026-08-01 σε σύνολο 407 modules — 319 πριν, 318 αφού το
 * `public-showcase-token-surface` απέκτησε τη μετρημένη του ημερομηνία (commit
 * `077fc772`, 2026-07-25). Το ίδιο το gate το βρήκε: **η παράλειψη ημερομηνίας
 * ΕΙΝΑΙ η δίοδος διαφυγής**, και ήταν ήδη σε χρήση.
 */
const UNDATED_MODULES_BASELINE = 318;

/**
 * 🔴 Ο **μάρτυρας** (ADR-742 μάθημα #7). Αν το parsing σπάσει ή το σχήμα του
 * μητρώου αλλάξει, ο πίνακας αδειάζει και **όλοι** οι έλεγχοι γίνονται κενά
 * αληθείς. Αυτό το module **πρέπει** να βρίσκεται, με ημερομηνία.
 */
const WITNESS_MODULE = 'chart-card-shell';

describe('⚓ ADR-742 — το μητρώο και η baseline δεν επιτρέπεται να αποκλίνουν', () => {
  describe('φύλακας κατά της άδειας ανάγνωσης', () => {
    test('το μητρώο έχει τουλάχιστον 300 modules', () => {
      expect(MODULES.length).toBeGreaterThanOrEqual(300);
    });

    test(`ο μάρτυρας «${WITNESS_MODULE}» υπάρχει και φέρει addedDate`, () => {
      const witness = REGISTRY.modules[WITNESS_MODULE];

      expect(witness).toBeDefined();
      expect(witness.addedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('η baseline δηλώνει ημερομηνία παραγωγής', () => {
      expect(BASELINE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('κάθε module νεότερο της baseline είναι ρητά συμφιλιωμένο', () => {
    const newerThanBaseline = MODULES.filter(
      ([, mod]) => typeof mod.addedDate === 'string' && mod.addedDate > BASELINE_DATE,
    ).map(([id]) => id);

    test('🔴 κανένα ασυμφιλίωτο module (νέα καταχώρηση ⇒ κόκκινο)', () => {
      const unreconciled = newerThanBaseline.filter(
        (id) => !(id in RECONCILED_AFTER_BASELINE),
      );

      // Το μήνυμα λέει ΤΙ να κάνεις, όχι μόνο ότι απέτυχες: ένα gate που δεν
      // ονομάζει τη διόρθωση αναγκάζει τον επόμενο να ξαναβρεί το ADR.
      expect({
        unreconciled,
        fix: 'Καταχώρησες module μετά την τελευταία baseline. Στην ΙΔΙΑ δέσμευση: '
          + '(α) καθάρισε τις παραβάσεις στον κώδικα, ή (β) βάλε ρητή allowlist με λόγο, '
          + 'ή (γ) ανανέωσε τη baseline — και γράψε ΤΙ ΜΕΤΡΗΣΕΣ στο RECONCILED_AFTER_BASELINE.',
      }).toEqual({ unreconciled: [], fix: expect.any(String) });
    });

    test('καμία μπαγιάτικη συμφιλίωση (module που έφυγε ή παλιώθηκε ⇒ κόκκινο)', () => {
      const stale = Object.keys(RECONCILED_AFTER_BASELINE).filter(
        (id) => !newerThanBaseline.includes(id),
      );

      expect(stale).toEqual([]);
    });

    test.each(Object.entries(RECONCILED_AFTER_BASELINE))(
      '%s: η συμφιλίωση λέει ΤΙ μετρήθηκε, όχι μόνο «εντάξει»',
      (_id, note) => {
        // Σημείωμα κάτω από 60 χαρακτήρες δεν περιγράφει μέτρηση· περιγράφει βιασύνη.
        expect(note.length).toBeGreaterThanOrEqual(60);
      },
    );
  });

  describe('ratchet: modules χωρίς addedDate μόνο μειώνονται', () => {
    const undated = MODULES.filter(([, mod]) => typeof mod.addedDate !== 'string');

    test(`🔴 το πλήθος δεν ξεπερνά το ${UNDATED_MODULES_BASELINE}`, () => {
      expect({
        count: undated.length,
        baseline: UNDATED_MODULES_BASELINE,
        fix: 'Νέο module ΧΩΡΙΣ addedDate. Χωρίς ημερομηνία, ο έλεγχος συμφιλίωσης '
          + 'δεν μπορεί να δει ότι καταχωρήθηκε μετά τη baseline — δηλαδή η παράλειψη '
          + 'της ημερομηνίας είναι η δίοδος διαφυγής όλου του gate. Πρόσθεσε addedDate.',
      }).toEqual({
        count: expect.any(Number),
        baseline: UNDATED_MODULES_BASELINE,
        fix: expect.any(String),
      });
      expect(undated.length).toBeLessThanOrEqual(UNDATED_MODULES_BASELINE);
    });

    test('η baseline του ratchet δεν είναι μπαγιάτικη προς τα κάτω (>10% ⇒ ενημέρωσέ τη)', () => {
      // Ένας ratchet που έχει μείνει πολύ πίσω παύει να φυλάει: επιτρέπει
      // «νέα» χρέη μέχρι το παλιό ταβάνι. Το ίδιο μάθημα με το «91» του N.12.
      const drift = UNDATED_MODULES_BASELINE - undated.length;

      expect(drift).toBeLessThanOrEqual(Math.ceil(UNDATED_MODULES_BASELINE * 0.1));
    });
  });
});
