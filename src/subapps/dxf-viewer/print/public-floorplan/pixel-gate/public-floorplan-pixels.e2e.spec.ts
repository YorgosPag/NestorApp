import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { PUBLIC_FLOORPLAN_GROUPS } from '@/lib/listings/floorplan-render-recipe';

import { RENDERABLE_ENTITY_TYPES } from '../../../rendering/contract/renderable-entity-type';
import { PUBLIC_FLOORPLAN_PLOT_STYLES } from '../public-floorplan-presets';
import {
  diffPixelGateBaseline,
  judgePixelGate,
  type PixelGateFinding,
  type PixelGateVerdict,
} from './judge-pixel-gate';
import { PIXEL_GATE_RESULTS_ELEMENT_ID } from './pixel-gate-contract';
import type { PixelGateHarnessOutput } from './PublicFloorplanPixelGateHarness';

/**
 * # ΠΥΛΗ PIXELS ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΑΤΟΨΗΣ (CHECK 3.101, ADR-909 §6.7)
 *
 * **«Βγαίνει η δημόσια κάτοψη άχρωμη όταν ζητήθηκε άχρωμη, και διαβάζεται κάθε γραμμή της;»**
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: στις 2026-10-09 μετρήθηκε ζωντανά ότι τα Υδραυλικά έβγαιναν **μπλε** σε «Ασπρόμαυρο»
 * (5.080 px) — ζωγράφοι με ωμό `ctx.strokeStyle`, γραμμένοι για σκούρο καμβά. Το ελάττωμα φάνηκε **μόνο**
 * επειδή το σχέδιο της δοκιμής έτυχε να έχει θερμοσίφωνα. Η εικόνα ήταν «αποδεδειγμένα άχρωμη **για αυτό το
 * σχέδιο**», όχι γενικά.
 *
 * 🔑 **ΓΙΑΤΙ PLAYWRIGHT ΚΑΙ ΟΧΙ JEST**: το jsdom δεν έχει Canvas 2D — δεν ζωγραφίζει, δεν έχει pixels. Η
 * **κρίση** είναι καθαρή συνάρτηση με δικό της jest (`judge-pixel-gate.test.ts`)· η **μέτρηση** θέλει browser.
 *
 * 🔑 **ΜΙΑ ΜΕΤΡΗΣΗ, ΟΛΕΣ ΟΙ ΚΡΙΣΕΙΣ** (ίδια απόφαση με τα CHECK 3.77 / 3.82).
 *
 * ⛔ **ΤΟΠΙΚΑ: ΤΡΕΞΕ ΤΟ ΜΟΝΟ ΑΦΟΥ Ο DEV SERVER ΞΑΝΑΜΕΤΑΓΛΩΤΤΙΣΕ** — πύλη αμέσως μετά από edit κρίνει παλιό bundle.
 *
 * Baseline: `PUBLIC_FLOORPLAN_PIXELS_WRITE_BASELINE=1 npm run test:public-floorplan-pixels`.
 */

const HARNESS = '/test-harness/public-floorplan-pixels';
const BASELINE_FILE = join(process.cwd(), '.public-floorplan-pixels-baseline.json');
const WRITE_BASELINE = process.env.PUBLIC_FLOORPLAN_PIXELS_WRITE_BASELINE === '1';

interface BaselineFile {
  readonly violations: readonly string[];
}

let output: PixelGateHarnessOutput | null = null;
let verdict: PixelGateVerdict = { ratchet: [], zeroTolerance: [] };

function readBaseline(): readonly string[] {
  const parsed = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as BaselineFile;
  return parsed.violations;
}

function lines(findings: readonly PixelGateFinding[]): string[] {
  return findings.map((finding) => `${finding.id} — ${finding.detail}`);
}

function ofCriterion(findings: readonly PixelGateFinding[], criterion: PixelGateFinding['criterion']): string[] {
  return lines(findings.filter((finding) => finding.criterion === criterion));
}

/** Τα `.glb` των δειγμάτων που ζωγραφίζονται από σχήμα 3Δ (`pixel-gate-mesh-samples`). */
const MESH_FIXTURES = '**/test-fixtures/pixel-gate/*.glb';

const EXPECTED = {
  renderableTypes: RENDERABLE_ENTITY_TYPES,
  groups: PUBLIC_FLOORPLAN_GROUPS,
  plotStyles: PUBLIC_FLOORPLAN_PLOT_STYLES,
};

/** Μία πλήρης μέτρηση σε **νέα** σελίδα. `prepare` τρέχει πριν από την πλοήγηση (π.χ. για να κόψει αιτήματα). */
async function measureOnce(browser: Browser, prepare?: (page: Page) => Promise<void>): Promise<PixelGateHarnessOutput> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await prepare?.(page);
    await page.goto(HARNESS);
    const json = page.locator(`#${PIXEL_GATE_RESULTS_ELEMENT_ID}`);
    await expect(json).toBeAttached({ timeout: 240_000 });
    return JSON.parse(await json.innerText()) as PixelGateHarnessOutput;
  } finally {
    await page.close();
  }
}

test.beforeAll(async ({ browser }) => {
  output = await measureOnce(browser);
  if (output.ok) verdict = judgePixelGate(output.measurement, EXPECTED);
});

test.describe('ADR-909 — η δημόσια κάτοψη στα pixels της', () => {
  test('Κ4 ⚠️ η μέτρηση ΕΓΙΝΕ — «κανένα εύρημα» χωρίς μέτρηση σημαίνει «κανείς δεν κοίταξε»', () => {
    expect(output, 'το όργανο δεν δημοσίευσε τίποτα').not.toBeNull();
    expect(output?.ok ? '' : output?.error, 'το όργανο απέτυχε να μετρήσει').toBe('');
    expect(ofCriterion(verdict.zeroTolerance, 'K4')).toEqual([]);
  });

  test('Κ5 δύο λήψεις ⇒ ίδια pixels', () => {
    expect(ofCriterion(verdict.zeroTolerance, 'K5')).toEqual([]);
  });

  test('Κ6 🔴 μετρήθηκε το ΧΕΙΡΟΤΕΡΟ σενάριο — όλες οι ομάδες αναμμένες', () => {
    expect(ofCriterion(verdict.zeroTolerance, 'K6')).toEqual([]);
  });

  test('Μ1 🔴 μάρτυρας: με τα σχήματα 3Δ ΚΟΜΜΕΝΑ, το Κ4 το ονομάζει — και η λήψη μένει ντετερμινιστική', async ({ browser }) => {
    /*
      ADR-909 Γ1β. Πριν, τα `.glb` δεν φόρτωναν ΠΟΤΕ εδώ (το Storage θέλει σύνδεση): η πύλη μετρούσε
      κουτιά-εφεδρεία, έλεγε «μετρήθηκε», και το Κ5 κοκκίνιζε 2 στις 5 (διακεκομμένο → συμπαγές ανάμεσα στις
      δύο λήψεις). Αυτό το test ξαναφτιάχνει εκείνη τη συνθήκη **επίτηδες** και απαιτεί δύο πράγματα:
      (α) η απώλεια έχει όνομα (`K4:fidelity`) — πύλη που δεν μπορεί να κοκκινίσει εδώ δεν φυλάει τίποτα·
      (β) το Κ5 είναι πράσινο ΚΑΙ έτσι — η λήψη περιμένει ώσπου το σχήμα να **καταλήξει** (έστω σε αποτυχία),
          άρα ζωγραφίζει το ίδιο συμπαγές κουτί και τις δύο φορές. Καμία αναμονή μέσα στο όργανο.
    */
    const starved = await measureOnce(browser, (page) => page.route(MESH_FIXTURES, (route) => route.abort()));
    expect(starved.ok ? '' : starved.error, 'το όργανο απέτυχε να μετρήσει').toBe('');
    if (!starved.ok) return;

    const witness = judgePixelGate(starved.measurement, EXPECTED);
    expect(ofCriterion(witness.zeroTolerance, 'K4').map((line) => line.split(' — ')[0])).toEqual(
      PUBLIC_FLOORPLAN_PLOT_STYLES.map((style) => `K4:fidelity:${style}:mesh-shape-missing`),
    );
    expect(ofCriterion(witness.zeroTolerance, 'K5')).toEqual([]);
  });

  test('Κ0–Κ3 🔴 κανένα ΝΕΟ εύρημα, και κανένα διορθωμένο που έμεινε γραμμένο (ratchet κατά ταυτότητα)', () => {
    /*
      Κ0 τύπος που δεν φτάνει στην εικόνα · Κ1 χρώμα σε άχρωμη στάθμη · Κ2 γραμμή με αντίθεση < 3:1 ·
      Κ3 γραμμή κάτω από το δάπεδο πάχους. Η ταυτότητα είναι `κριτήριο:στάθμη:τύπος`, ποτέ πλήθος: με αριθμό,
      η ανταλλαγή «διόρθωσα τον θερμοσίφωνα, έσπασα τον λέβητα» θα περνούσε αθόρυβα (ADR-749).
    */
    if (WRITE_BASELINE) {
      // ⛔ Οι μηδενικής ανοχής ΔΕΝ μπαίνουν ποτέ σε baseline — και με αυτές ανοιχτές δεν γράφεται καν.
      expect(lines(verdict.zeroTolerance), 'άρνηση σποράς: ανοιχτά ευρήματα μηδενικής ανοχής').toEqual([]);
      const violations = verdict.ratchet.map((finding) => finding.id).sort();
      writeFileSync(BASELINE_FILE, `${JSON.stringify({ adr: 'ADR-909 (CHECK 3.101)', violations }, null, 2)}\n`);
      return;
    }
    const diff = diffPixelGateBaseline(verdict, readBaseline());
    expect(lines(diff.added), 'ΝΕΑ ευρήματα — διόρθωσε τον ζωγράφο, μην τα γράψεις στη baseline').toEqual([]);
    expect(diff.fixed, 'διορθώθηκαν — κλείδωσε την πρόοδο ξαναγράφοντας τη baseline').toEqual([]);
  });
});
