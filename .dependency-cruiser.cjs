/**
 * ADR-598 G9 + G10 — dependency-cruiser rule set (SSoT for BOTH graph gates).
 *
 * ONE config drives two ratchets, selected in scripts/check-depcruise-ratchet.js
 * by rule name:
 *   • G9  cycles     — `no-circular`
 *   • G10 boundaries — the architectural `not-*` rules below
 *
 * All rules are `warn` (never `error`): the gate is a RATCHET, not a flag-day.
 * The committed baselines (.depcruise-{cycles,boundaries}-baseline.json) seed the
 * current violation counts (the ADR budgeted 112+); the ratchet only lets them
 * fall. Heavy graph analysis → Layer-2 CI only (N.17).
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- G9: cycles ---------------------------------------------------------
    {
      name: 'no-circular',
      comment: 'Circular import chain — refactor to a one-directional dependency.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },

    // --- G10: architectural boundaries -------------------------------------
    {
      name: 'services-not-to-components',
      comment: 'Domain services must not import UI components (services are UI-agnostic).',
      severity: 'warn',
      from: { path: '^src/services/' },
      to: { path: '^src/components/' },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // ⚰️ ΑΠΟΣΥΡΘΗΚΕ — `not-to-dxf-internals` (ADR-796, 2026-08-24)
    //
    // 🔴 ΕΠΕΒΑΛΛΕ ΘΕΡΑΠΕΙΑ ΠΟΥ ΔΕΝ ΥΠΗΡΞΕ ΠΟΤΕ. Ζητούσε «import it only through its
    // public barrel `src/subapps/dxf-viewer/index.ts`» — και αυτό το αρχείο ΔΕΝ
    // ΥΠΗΡΞΕ ΠΟΤΕ στην ιστορία του repo (`git log --all -- src/subapps/dxf-viewer/
    // index.ts*` ⇒ ΚΕΝΟ). Μετρημένο: 163 αρχεία εισάγουν βαθιά, 0 μέσω barrel, και
    // ακόμη και η ΙΔΙΑ η σελίδα της εφαρμογής (`o/[workspace]/dxf/viewer/page.tsx:19`)
    // εισάγει `@/subapps/dxf-viewer/DxfViewerApp`, δηλαδή ΠΑΡΑΒΙΑΖΕΙ. Με baseline 335
    // και ratchet DOWN-only, ήταν φρουρός ΕΝΕΡΓΟΣ (μπλόκαρε PR) που απαιτούσε μείωση
    // προς το μηδέν μέσω διαδρομής ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ — χειρότερο από τους 606 αδρανείς
    // του ADR-749 §5, γιατί εκείνοι τουλάχιστον δεν πυροδοτούν.
    //
    // 🏆 ΚΑΙ Η ΘΕΡΑΠΕΙΑ ΗΤΑΝ ΛΑΘΟΣ, ΟΧΙ ΜΟΝΟ ΑΠΟΥΣΑ. Το Atlassian ΑΦΑΙΡΕΣΕ τα barrel
    // files από το Jira (90.000 αρχεία, codemod): 75% ταχύτερα builds, unit tests
    // 1600→200, TS highlighting +30%. Το Next.js έχει `optimizePackageImports` για να
    // τα ΠΑΡΑΚΑΜΠΤΕΙ. Ένα barrel εδώ θα ξαναεξήγαγε 432 σύμβολα — ακριβώς το τέρας.
    //
    // ✅ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ ΑΠΟ ΤΟ **CHECK 3.62** (`scripts/check-public-surface.js`),
    // που κάνει το ΙΔΙΟ ερώτημα σωστά: μανιφέστο δημόσιας επιφάνειας ΑΝΑ ΣΥΜΒΟΛΟ
    // (`.dxf-viewer-public-api.json`), zero-tolerance, με ΥΠΟΧΡΕΩΤΙΚΟ λόγο ανά εγγραφή.
    // Η ενθυλάκωση γίνεται ΔΕΔΟΜΕΝΟ αντί για MODULE ⇒ μηδέν κόμβος στον γράφο
    // εισαγωγών, άρα το όφελος του Atlassian ΚΑΙ η εγγύηση του Revit (`internal`).
    //
    // ⚠️ ΜΗΝ τον επαναφέρεις χωρίς να φτιάξεις ΠΡΩΤΑ το barrel και να μεταναστεύσεις
    // τα 163 αρχεία — και διάβασε πρώτα γιατί αυτό είναι μετρημένα λάθος κίνηση.
    // ─────────────────────────────────────────────────────────────────────────
    {
      name: 'no-test-utils-in-prod',
      comment: 'Production code must not import test utilities / testing scaffolding.',
      severity: 'warn',
      from: {
        pathNot: '(\\.(test|spec)\\.[jt]sx?$|__tests__/|/test-utils/|/testing/|\\.stories\\.)',
      },
      to: { path: '(/test-utils/|/testing/)' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|\\.next|dist|coverage|\\.d\\.ts$)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    },
  },
};
