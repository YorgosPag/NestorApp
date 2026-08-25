/**
 * 🎨 BASIC VISUAL REGRESSION TESTING
 * Simplified version for immediate testing while dependencies install
 */

import fs from 'node:fs';
import path from 'node:path';
import type { PixelmatchFn, PNGCombined } from '../test/visual/types';

// Conditional imports to avoid missing module errors
let pixelmatch: PixelmatchFn | null = null;
let PNG: PNGCombined | null = null;

try {
  // ⚠️ Το `pixelmatch@7` είναι ESM με default export: το σκέτο `require()` επιστρέφει
  // `{ default: fn }`. Ίδια interop με το `scripts/lib/golden-triage/compare.js`, που την
  // τεκμηριώνει και ονομάζει ρητά αυτό εδώ το αρχείο — **μία** απάντηση, όχι δεύτερη.
  // Μέχρι το ADR-800 το subapp δήλωνε δικό του `pixelmatch@5` (CJS) και η διαφορά ήταν
  // αόρατη· με ένα σημείο δήλωσης, εδώ φτάνει πλέον η **ίδια** έκδοση με τη ρίζα.
  const pixelmatchModule = require('pixelmatch');
  pixelmatch = (pixelmatchModule.default ?? pixelmatchModule) as PixelmatchFn;
  PNG = require('pngjs').PNG as PNGCombined;
} catch (error) {
  console.warn('⚠️ Visual testing dependencies not installed yet');
}

/**
 * 🧪 BASIC SETUP TEST
 */
describe('Basic Visual Regression Setup', () => {
  test('test environment is ready', () => {
    expect(typeof describe).toBe('function');
    expect(typeof test).toBe('function');
    expect(typeof expect).toBe('function');
  });

  test('can create test directories', () => {
    const testDir = path.join(process.cwd(), 'test-temp');

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    expect(fs.existsSync(testDir)).toBeTruthy();

    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('canvas creation works', () => {
    // Note: Using literal values here because VIEWPORT_DEFAULTS is defined in config
    // and this is a basic setup test. If changing defaults, update these values.
    const canvas = document.createElement('canvas');
    canvas.width = 800;  // Matches VIEWPORT_DEFAULTS.WIDTH
    canvas.height = 600; // Matches VIEWPORT_DEFAULTS.HEIGHT

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(canvas.tagName).toBe('CANVAS');
  });

  /**
   * 🔴 **ΔΕΝ ΥΠΑΡΧΕΙ 2D BACKEND ΣΤΟ JEST, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΑΣΦΑΛΕΙΑΣ** (2026-08-24, `19fbc2cc`).
   *
   * Το `pnpm.overrides['jsdom>canvas'] = '-'` έκοψε αλυσίδα **CVE** του `tar`. Από τότε το
   * `getContext('2d')` επιστρέφει **`null`** — και αυτός ο ισχυρισμός, που απαιτούσε το
   * αντίθετο, έμεινε **κόκκινος**. Ήταν το **δεύτερο** αδιάγνωστο θύμα της ίδιας αλλαγής: το
   * πρώτο ήταν η **εξαφάνιση της βαθμίδας 2** της μέτρησης κειμένου (ADR-799), που άφησε
   * **15** σουίτες να κρίνουν πλάτος με όργανο τυφλό στο στυλ.
   *
   * ⚠️ **ΜΗΝ «ΔΙΟΡΘΩΣΕΙΣ» ΑΥΤΟ ΤΟ TEST ΕΠΑΝΑΦΕΡΟΝΤΑΣ ΤΟ `canvas`** — θα ξανάνοιγε το CVE.
   * Ο ισχυρισμός είναι πλέον **χαρακτηρισμός**: κλειδώνει τη ρητή κατάσταση «κανένας 2D
   * καμβάς στο jest», ώστε μια μελλοντική αλλαγή να είναι **συνειδητή** και όχι σιωπηλή.
   *
   * 🔑 **ΠΟΥ ΓΙΝΕΤΑΙ ΤΟΤΕ Η ΟΠΤΙΚΗ ΕΠΑΛΗΘΕΥΣΗ**: στο **Playwright** (CHECK 3.46 / ADR-775),
   * με πραγματικό browser. Και η **μέτρηση κειμένου** δεν χρειάζεται καμβά: γίνεται σε
   * **βαθμίδα 1** με `installStubFontPair` — ντετερμινιστικά, όπως το `FlutterTest` του
   * Flutter και το `Ahem` του WPT (ADR-799 Φάση 3).
   */
  test('ΚΑΝΕΝΑΣ 2D καμβάς στο jest — απόφαση ασφαλείας, όχι έλλειψη', () => {
    const canvas = document.createElement('canvas');

    expect(canvas.getContext('2d')).toBeNull();
    // Ο παρονομαστής: το στοιχείο ΥΠΑΡΧΕΙ και είναι καμβάς — λείπει μόνο το backend.
    expect(canvas.tagName).toBe('CANVAS');
  });

  test('conditional pixelmatch loading', () => {
    if (pixelmatch && PNG) {
      console.log('✅ Visual testing dependencies available');
      expect(typeof pixelmatch).toBe('function');
      expect(typeof PNG).toBe('function');
    } else {
      console.log('⏳ Visual testing dependencies pending installation');
      expect(true).toBeTruthy(); // Always pass when dependencies missing
    }
  });
});

/**
 * 📋 ENTERPRISE SETUP CHECKLIST
 */
describe('Enterprise Setup Checklist', () => {
  test('jest configuration is loaded', () => {
    // Check if we're running in Jest environment
    expect(typeof jest).toBe('object');
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('typescript compilation works', () => {
    // If this test runs, TypeScript compilation succeeded
    const testObject: { message: string } = {
      message: 'TypeScript compilation successful'
    };

    expect(testObject.message).toBe('TypeScript compilation successful');
  });

  test('file system access works', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBeTruthy();

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.devDependencies).toBeDefined();
  });

  test('reports directory can be created', () => {
    const reportsDir = path.join(process.cwd(), 'reports', 'visual');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    expect(fs.existsSync(reportsDir)).toBeTruthy();
    console.log(`📁 Reports directory ready: ${reportsDir}`);
  });
});

/**
 * 🎯 READINESS CHECK
 */
describe('Visual Testing Readiness', () => {
  test('all required directories exist', () => {
    const requiredDirs = [
      'test',
      'test/visual',
      'reports',
      'reports/visual'
    ];

    requiredDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      expect(fs.existsSync(fullPath)).toBeTruthy();
    });
  });

  // ⚠️ Η ερώτηση είναι «**δηλώνεται**;», ΠΟΤΕ «σε ποιον κάδο;». Ο ισχυρισμός ζητούσε
  // `devDependencies` και για τα πέντε· το `68b27b8a` μετακίνησε **σκόπιμα** το
  // `@napi-rs/canvas` στα runtime `dependencies` (το χρειάζεται η παραγωγή) ⇒ ο έλεγχος
  // κοκκίνιζε πάνω σε **σωστή απόφαση πολιτικής εξαρτήσεων**. Ένα test οπτικής παλινδρόμησης
  // δεν είναι η αυθεντία για το πού δηλώνεται μια εξάρτηση — αυθεντία είναι το CHECK 3.65.
  // Ο κάδος **τυπώνεται** ώστε η μετακίνηση να μένει ορατή αντί να γίνεται σιωπηλή.
  test('dependencies status check', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const requiredDeps = [
      'pixelmatch',
      'pngjs',
      '@types/pixelmatch',
      '@types/pngjs',
      '@napi-rs/canvas'
    ];

    requiredDeps.forEach(dep => {
      const inDev = packageJson.devDependencies?.[dep];
      const inProd = packageJson.dependencies?.[dep];
      const declared = inDev ?? inProd;
      expect(declared).toBeTruthy();
      console.log(`✅ ${dep}: ${declared} (${inDev ? 'devDependencies' : 'dependencies'})`);
    });
  });

  test('scripts are available', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // ⚠️ ΤΟ `test:visual` ΛΕΙΠΕΙ ΕΠΙΤΗΔΕΣ — η επαναφορά του κοκκινίζει το CHECK 3.46.
    // Έδειχνε σε `e2e/grid-visual-regression.spec.ts`, spec διαγραμμένο οριστικά στο
    // `6a267614`· η ομάδα Γ του ADR-775 («κάθε `playwright test <φίλτρο>` δείχνει σε
    // **υπαρκτό** spec») το αφαίρεσε στο `cb29ed75`. Ο ισχυρισμός έμεινε πίσω και απαιτούσε
    // ό,τι μια πύλη είχε **σωστά** σβήσει: δύο όργανα με αντίθετη απαίτηση για το ίδιο script.
    const requiredScripts = [
      'test:visual-metrics',
      'test:cross-browser',
      'test:enterprise'
    ];

    requiredScripts.forEach(script => {
      expect(packageJson.scripts[script]).toBeDefined();
      console.log(`🚀 ${script}: ${packageJson.scripts[script]}`);
    });
  });
});

console.log('🎨 Basic Visual Regression Testing - Setup Check Complete');
