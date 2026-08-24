# ADR-598 — Production-Readiness Quality Gates (Big-Player Parity Roadmap)

- **Status**: PROPOSED (roadmap — υλοποιείται σταδιακά ανά φάση)
- **Date**: 2026-07-08
- **Owner**: Giorgio + agents
- **Type**: Cross-cutting / CI + pre-commit infrastructure
- **Σχετικά**: ADR-027 (TS error budget), ADR-294 (SSoT ratchet), ADR-314 (SSoT discover), ADR-584 (jscpd), ADR-298 (Firestore rules coverage), ADR-040 (DXF micro-leaf), N.5/N.7.1/N.11/N.17/N.18

---

## 1. Πρόβλημα (Context)

Ο Giorgio ρώτησε: **«τι απαιτείται ώστε η εφαρμογή να συγκρίνεται με των μεγάλων παιχτών, και ποιοι έλεγχοι πρέπει να γίνονται πριν βγει στην παραγωγή;»**

Το repo έχει ήδη **εξαιρετική** υποδομή ratchet (28+ pre-commit checks, 7 CI workflows). Στόχος αυτού του ADR: εντοπισμός των **κενών** (gaps) έναντι Google / Meta / Microsoft / Airbnb / Vercel, με τρεις σκληρούς περιορισμούς:

1. **Μηδέν οικονομικό κόστος** — μόνο open-source, κανένα paid SaaS (όχι SonarCloud/Snyk/FOSSA), κανένας ειδικός εξοπλισμός.
2. **License N.5** — μόνο MIT / Apache-2.0 / BSD. GPL/LGPL/AGPL απαγορεύονται.
3. **N.17** — ο πράκτορας ποτέ δεν τρέχει `tsc`. Ό,τι απαιτεί full type-check → **Layer-2 CI**, ποτέ pre-commit.

Η έρευνα έγινε με orchestrator (5 parallel domain agents, 2026-07-08).

---

## 2. Υπάρχουσα υποδομή (baseline — τι ΗΔΗ ελέγχεται)

**Pre-commit hook**: `scripts/git-hooks/pre-commit` (644 γρ.), ενεργοποιείται μέσω `scripts/install-hooks.sh` (`git config core.hooksPath scripts/git-hooks`, τρέχει από `prepare`). Orchestrator: `scripts/run-checks-parallel.js` (worker-thread pool).

**Ratchet pattern (SSoT — μιμήσου το, μην εφεύρεις νέο)**:
`scripts/check-<topic>-ratchet.js` + `.<topic>-baseline.json` (repo root) + `.github/workflows/<topic>-ratchet.yml` (Layer-2). Το νέο check δηλώνεται στο `run-checks-parallel.js`, ΟΧΙ σε νέο orchestrator.

**Υπάρχοντα checks** (περίληψη): CHECK 3.7–3.28 (SSoT imports, i18n missing/ICU/resolver/option/notification keys, Firestore companyId/index/rules/storage coverage, entity-audit, SSoT-discover, dead-code/knip, native-tooltip, tabs, no-flash, tailwind-palette, dxf-timing, jscpd clones), CHECK 4 (file sizes N.7.1), CHECK 5 (jest), CHECK 6/6B/6C/6D (ADR reminders + DXF ADR-040 guards), CHECK 10 (secret scan — in-house regex), CHECK 11 (conventional commits), CHECK 12 (license — `npx license-checker --direct`), CHECK 13 (heavy-import warning).

**CI workflows (7)**: i18n-governance, ssot-discover, firestore-rules, functions-integration, deadcode-ratchet, jscpd-ratchet, docker-build.

**Εγκατεστημένα αλλά ΑΣΥΝΔΕΤΑ (dormant) εργαλεία** — η μεγαλύτερη ευκαιρία:
- `scripts/enterprise-ts-gate.js` (ADR-027, πλήρες ratchet για tsc-error-count) → **δεν καλείται από κανένα workflow/hook**.
- `scripts/bundle-analyzer.js` + `@next/bundle-analyzer` → μόνο manual `analyze:bundle`, fixed thresholds, χωρίς baseline/ratchet.
- `axe-core` + `jest-axe` + `@types/jest-axe` → installed, αλλά μόνο **2 test files** τα χρησιμοποιούν.
- `pnpm audit` (scripts `enterprise:security`) → 100% manual, σε κανένα CI.

---

## 3. Ανάλυση κενών (Gap Analysis) — τι κάνουν οι μεγάλοι που ΜΑΣ ΛΕΙΠΕΙ

> Package manager = **pnpm**. Όλες οι εντολές με `pnpm`, όχι `npm`.

| # | Έλεγχος | Εργαλείο | License | Κατάσταση | Layer | Effort | Prio | Ποιος μεγάλος |
|---|---------|----------|---------|-----------|-------|--------|------|---------------|
| G1 | **Wire `enterprise-ts-gate.js` σε CI** | in-house (ADR-027) | — | Υπάρχει, orphaned | CI | S | **P0** | Google/MS presubmit tsc |
| G2 | **Dependency-CVE audit** | `pnpm audit` | built-in | **Απόν** παντού | CI | S | **P0** | Vercel/Meta/Dependabot |
| G3 | **Coverage floor ratchet** | Jest built-in | MIT | threshold={0,0,0,0} no-op | CI | S | **P0** | Google/Meta «no decrease» |
| G4 | **jsx-a11y static lint** | `eslint-plugin-jsx-a11y` | MIT | Δεν υπάρχει | both | S | **P0** | Airbnb/Google |
| G5 | **type-coverage ratchet** | `type-coverage` | MIT | Δεν υπάρχει | CI | S | P1 | Airbnb/Slack |
| G6 | **bundle-size ratchet** | evolve `bundle-analyzer.js` | MIT | fixed thresholds, no ratchet | CI | S | P1 | Vercel/Google Lighthouse |
| G7 | **ESLint complexity ratchet** | ESLint core `complexity`/`max-depth` | MIT | Δεν υπάρχει (N.7.1 = μόνο line-count) | both | M | P1 | Airbnb |
| G8 | **SAST security lint** | `eslint-plugin-security` | MIT | Δεν υπάρχει | CI | S | P1 | Netflix/PayPal |
| G9 | **Circular-dependency detection** | `dependency-cruiser` (ή `madge`) | MIT | Δεν υπάρχει | CI | M | P1 | Vercel/Next.js CI |
| G10 | **Architecture boundary rules** | `dependency-cruiser` (ίδιο config) | MIT | Δεν υπάρχει· **112+ ήδη violations** | CI | L | P1 | Google Bazel visibility |
| G11 | **jest-axe adoption ratchet** | `jest-axe` (ήδη dep) | MIT | Dormant (2 files) | CI | M | P1 | MS Fluent/Airbnb |
| G12 | **Secret scan upgrade** | `gitleaks` | MIT | CHECK 10 = regex μόνο, χωρίς git-history/entropy | both | S | P1 | GitHub push-protection |
| G13 | **License hardening** | pin `license-checker` + transitive + CI | MIT | CHECK 12 = `--direct`, npx silent-skip | both | S | P1 | Google/MS full-tree |
| G14 | **type-complexity ratchet** | `tsc --extendedDiagnostics` + `@typescript/analyze-trace` | Apache/MIT | Δεν υπάρχει | CI | M | P2 | MS TypeScript team |
| G15 | **knip scope → dxf-viewer** | knip (ήδη) | MIT | knip αγνοεί `src/subapps/dxf-viewer/**` | both | S | P2 | — |

### Μετρημένα σημερινά νούμερα (grep-based, από την έρευνα)
- **`as any`**: 73 occurrences / 16 files · **`: any`**: 43 · **`@ts-ignore`**: 3 · **`@ts-expect-error`**: 2 → seed για type-coverage (G5).
- **Architecture (G10)**: 13 files `services/**` → `@/components/**` (reverse layering)· 99 files εκτός dxf-viewer/app εισάγουν εσωτερικά του `@/subapps/dxf-viewer/**` (boundary piercing, σπάει το πνεύμα ADR-040).

---

## 4. Αποφάσεις — τι ΔΕΝ κάνουμε (100% ειλικρίνεια)

- ❌ **depcheck**: redundant με knip (superset). Το πραγματικό κενό είναι «knip αγνοεί dxf-viewer» (G15) → επέκταση knip scope, ΟΧΙ νέο εργαλείο.
- ❌ **eslint-plugin-sonarjs** (cognitive-complexity): **LGPL-3.0** → παραβιάζει N.5. Χρησιμοποιούμε ESLint core `complexity` (MIT) — G7.
- ⚠️ **axe-core = MPL-2.0**: permissive & file-level copyleft, **δεν** είναι στο MIT/Apache/BSD allowlist του N.5 αυστηρά. Είναι ήδη installed & dev-only (δεν μπαίνει σε bundle). **Χρειάζεται ρητή έγκριση Giorgio** για να το κρατήσουμε/επεκτείνουμε (G11). Το `jest-axe` wrapper είναι MIT.
- ✅ **gitleaks (G12)**: κρατάμε ΚΑΙ το CHECK 10 (πιάνει project-specific patterns π.χ. Firebase keys) ΚΑΙ το gitleaks (entropy/git-history). Δεν αντικαθιστά — συμπληρώνει.

---

## 5. Roadmap (σταδιακή υλοποίηση — μία φάση/session, ≤70% context)

Σειρά κατά **απόδοση/κόπο** (πρώτα τα «ο κώδικας υπάρχει, μόνο wiring»):

### ΦΑΣΗ 0 — Wiring (μηδέν ρίσκο, τεράστια απόδοση) · P0 · ✅ **DONE (2026-07-08)**
- **G1** ✅: νέο `.github/workflows/ts-error-gate.yml` → `node scripts/enterprise-ts-gate.js` σε PR + push main + dispatch. (ΟΧΙ pre-commit, N.17.) Baseline `.ts-error-baseline.json` ήδη committed (3005) → ratchet κλειδώνει από run #1.
- **G2** ✅: νέο `scripts/check-dependency-audit-ratchet.js` (allowlist ratchet, μίμηση `check-jscpd-ratchet.js`) + `.pnpm-audit-baseline.json` (**GHSA-keyed allowlist**, seed 56 HIGH/CRITICAL) + `.github/workflows/dependency-audit.yml` (PR + weekly cron + dispatch). Ratchet = advisory-ID allowlist (όχι raw count — νέα CVE βγαίνουν σε αμετάβλητες deps). Scripts: `deps-audit:check` / `deps-audit:baseline`.
- **G13** ✅: pin `license-checker@25.0.1` ως devDep (τέλος στο npx silent-skip)· CHECK 12 fire και σε `pnpm-lock.yaml` + `npx`→`pnpm exec` + fail-closed αντί skip· νέο `scripts/check-license-ratchet.js` (full-tree, SPDX OR-any/AND-all + named exceptions, refuse-copyleft seed) + `.license-allowlist.json` + `.github/workflows/license-audit.yml` (Layer-2 full-tree, χωρίς `--direct`). Scripts: `license:check` / `license:baseline`.

### ΦΑΣΗ 1 — ESLint additive (κανένα νέο process, μόνο rules + ratchet) · P0–P1 · ✅ **DONE (2026-07-08)**
> **SSoT ΔΙΟΡΘΩΣΗ:** Τα τρία gates ΔΕΝ γίνονται 3 ξεχωριστά scripts (`check-jsx-a11y-ratchet.js` κ.λπ. όπως σκιαγραφήθηκε αρχικά) — θα ήταν structural clones (ίδιο read-baseline→run-eslint→diff→block σχήμα) και θα έσκαγαν στο δικό μας jscpd gate (CHECK 3.28 / N.18). Αντ' αυτού: **ΕΝΑ** generic engine `scripts/check-eslint-ratchet.js` επιλεγόμενο με `--gate <name>`. Νέο gate = 1 entry στο `GATES` map + 1 standalone flat config `eslint/gates/<gate>.mjs`. Κάθε gate τρέχει ESLint με ΜΟΝΟ το δικό του config (`--no-config-lookup -c`), rules=`warn`, block on rise vs `.eslint-<gate>-baseline.json`. Heavy → Layer-2 CI μόνο (N.17), ΟΧΙ pre-commit.
- **G7** ✅ **DONE**: ESLint core `complexity:['warn',{max:15}]`, `max-depth:4`, `max-params:5` → `eslint/gates/complexity.mjs` + `.eslint-complexity-baseline.json` (seed full-src) + gate `complexity` στο engine. Κανένα νέο dependency (core rules + ήδη-υπάρχων TS parser). CI: `.github/workflows/eslint-ratchet.yml` (matrix, μόνο `complexity` active). Scripts: `eslint-gate:complexity` / `:baseline`.
- **G4** ✅ **DONE**: `eslint-plugin-jsx-a11y@6.10.2` (MIT — πέρασε G13) pinned devDep. `eslint/gates/jsx-a11y.mjs` = recommended flat set (34 rules) → `warn` μέσω κοινού `eslint/gates/_severity.mjs`. Seed `.eslint-jsx-a11y-baseline.json` = **1148 warnings / 415 files** (full-src, μόνο `jsx-a11y/*`). `+jsx-a11y` στο CI matrix. Scripts: `eslint-gate:jsx-a11y` / `:baseline`.
- **G8** ✅ **DONE**: `eslint-plugin-security@4.0.1` (Apache-2.0 — πέρασε G13) pinned devDep. `eslint/gates/security.mjs` = recommended flat set (14 rules) → `warn`, **ΜΕΙΟΝ `detect-object-injection`** (heuristic, ~95% false-positive· Netflix/PayPal/Airbnb το απενεργοποιούν). Seed `.eslint-security-baseline.json` = **208 warnings / 57 files**. `+security` στο CI matrix. Scripts: `eslint-gate:security` / `:baseline`.
- **⚙️ Engine bugfix (ίδια φάση):** ESLint 9's `--config` είναι **additive** με το discovered `eslint.config.mjs` (το `--no-config-lookup` δεν το ακυρώνει όταν συνυπάρχει `--config`) → τα plugin gates με `ruleIds:null` μετρούσαν και ξένους κανόνες (`custom/*`, `design-system/*`). Fix: νέο πεδίο `rulePrefix` στο GATES map + φίλτρο στο `summarize` — τα plugin gates μετρούν ΜΟΝΟ το δικό τους namespace (`jsx-a11y/`, `security/`). Το G7 (exact `ruleIds`) ήταν ήδη robust. +2 Jest tests (σύνολο 25).

### ΦΑΣΗ 2 — Type & bundle ratchets (Layer-2 CI, N.17) · P1–P2 · ✅ **DONE (2026-07-08)**
> **Seeding = CI seed job** (απόφαση Giorgio 2026-07-08): και τα 3 gates τρέχουν βαριά (tsc/build) → ο agent ΔΕΝ τα seed-άρει τοπικά (N.17). Κάθε workflow έχει `workflow_dispatch{seed}` που γράφει το baseline, το ανεβάζει artifact + echo στο summary· ο Giorgio το committ-άρει (ΟΧΙ CI auto-commit). Τα baselines (`.type-coverage/.bundle-size/.type-complexity-baseline.json`) **δεν** committ-άρονται από τον agent — γεννιούνται στο πρώτο seed dispatch. Πλήρες βήμα-βήμα brief: `HANDOFFS/2026-07-08_ADR-598_Phase2-G5-G6-G14_type-bundle-ratchets_handoff.md`.
> **SSoT (N.18):** και τα 3 scripts μοιράζονται `scripts/lib/ratchet-baseline.js` (parseArgs/loadBaseline/writeBaselineFile/isRegression/**runRatchetCli**) — κανένα clone (jscpd:diff clean). Νέο ratchet = ~1 descriptor + gate-specific `measure()`, ίδιο πνεύμα με το ΕΝΑ eslint engine της Φ1.
- **G5** ✅ **DONE**: `type-coverage@2.29.7` (MIT, πέρασε G13 — 114 pkgs) pinned devDep → `.type-coverage-baseline.json` `{percent,typedCount,totalCount}` (ratchet **UP** — typed % μόνο ↑, μηδέν tolerance: το νούμερο είναι deterministic) → `scripts/check-type-coverage-ratchet.js` (parse `N / M P%` bottom-up, fail-closed) + `.github/workflows/type-coverage-ratchet.yml`. Scripts: `type-coverage:check` / `:baseline`.
- **G6** ✅ **DONE**: reuse `analyzeNextBuild()` export του `scripts/bundle-analyzer.js` (**όχι** size-walk clone) → `.bundle-size-baseline.json` `{totalSize,chunksCount,cssSize,tolerancePct}` (ratchet **DOWN** + tolerance **2%** αποθηκευμένο ΣΤΟ baseline = SSoT) → `scripts/check-bundle-size-ratchet.js` (pure consumer του `.next`, δεν κάνει build) + `.github/workflows/bundle-ratchet.yml` (τρέχει `pnpm run build:ci` πρώτα — **ΟΧΙ** `build`: το cross-env του τελευταίου καταπίνει το `NODE_OPTIONS` του workflow, βλ. changelog 2026-08-04). Scripts: `bundle-size:check` / `:baseline`.
- **G14** ✅ **DONE**: `tsc --extendedDiagnostics --noEmit` (κανένα νέο core dep) → parse `Instantiations`/`Types` → `.type-complexity-baseline.json` (ratchet **DOWN** + tolerance **3%** από governance SSoT `config/quality-gates/type-complexity-budget.json`, μίμηση ADR-027 `ts-error-budget.json`) → `scripts/check-type-complexity-ratchet.js` + `.github/workflows/type-complexity-ratchet.yml`. `@typescript/analyze-trace@0.11.1` (MIT) προαιρετικό για hotspots — αναβλήθηκε στη Φ3 (ο ratchet δεν το χρειάζεται). Scripts: `type-complexity:check` / `:baseline`.
- **Tests** ✅: `scripts/__tests__/check-type-ratchets.test.js` (33 tests — shared lib parseArgs/loadBaseline/isRegression + των 3 gates parse/summarize/descriptor). Script: `test:type-ratchets`. Επαληθεύτηκε: 33/33 πράσινα, `jscpd:diff` clean, `license:check` exit 0 (114 pkgs). N.17 τηρήθηκε — κανένα tsc/build τοπικά (τα `measure()` legs τρέχουν μόνο σε CI/seed dispatch).

### ΦΑΣΗ 3 — Graph, coverage, a11y-tests · P0(value)–P2 · ✅ **DONE (2026-07-08)**
> **SSoT (N.18):** τα numeric-ratchet gates (G3/G15) μοιράζονται το `scripts/lib/ratchet-baseline.js` (`runRatchetCli`)· τα gate-parameterized (G9/G10) έχουν ΕΝΑ engine `--gate` (όπως το eslint engine)· jscpd:diff clean σε ΟΛΑ τα engines μαζί (κανένα clone μεταξύ depcruise/eslint/a11y/coverage/knip).
> **Seeding:** τα βαριά (G3/G9/G10/G15 — jest --coverage / depcruise / knip crawl) seed-άρονται via **CI seed dispatch** (N.17, ίδιο μηχανισμό με Φ2)· το **G11 seed-άρεται τοπικά** (γρήγορο string-scan, χωρίς tsc/build) → baseline committed.
- **G3** ✅ **DONE**: `scripts/check-coverage-ratchet.js` διαβάζει `coverage/coverage-summary.json` (πρόσθεσα `coverageReporters: ['json-summary','text-summary','lcov']` στο `jest.config.js`), gate στο **lines %** (headline number· statements/functions/branches καταγράφονται) ratchet **UP** → `.coverage-baseline.json` + `coverage-ratchet.yml` (τρέχει `test:coverage` πρώτα, `continue-on-error`). Το jest `coverageThreshold={0,0,0,0}` μένει ως hard floor· ο ratchet είναι το κινούμενο δάπεδο. Scripts: `coverage-floor:check`/`:baseline`.
- **G9 + G10** ✅ **DONE**: ΕΝΑ `.dependency-cruiser.cjs` (SSoT, rules: `no-circular` + `services-not-to-components` + `not-to-dxf-internals` [πλην public barrel `index.ts[x]`] + `no-test-utils-in-prod`) → **ΕΝΑ** engine `scripts/check-depcruise-ratchet.js --gate cycles|boundaries` (ΟΧΙ 2 clone scripts — SSoT διόρθωση όπως το eslint engine· το ADR αρχικά έλεγε `check-circular-deps-ratchet.js`+`check-arch-boundaries-ratchet.js`) → `.depcruise-{cycles,boundaries}-baseline.json` ratchet **DOWN** (seed υπαρχόντων violations, ΟΧΙ zero-tol) + `depcruise-ratchet.yml` (matrix). `dependency-cruiser@16.10.4` (MIT· **ΟΧΙ v18 — απαιτεί Node≥22, το CI τρέχει Node 20**). Scripts: `depcruise:cycles`/`:boundaries`(+`:baseline`).
- **G11** ✅ **DONE**: `scripts/check-a11y-test-coverage-ratchet.js` — **set-diff ratchet** (όπως dead-code baseline): `.a11y-coverage-baseline.json` grandfather-άρει τα υπάρχοντα uncovered (**143** σε `src/components/ui`+`generic`)· block μόνο σε **ΝΕΟ** uncovered component (zero-tol-on-touch). «Covered» = test file με axe marker που κάνει import το component. SSoT helper `src/test-utils/a11y.tsx` (`expectNoA11yViolations`). `jest-axe`(MIT)+`axe-core`(**MPL-2.0**) ήταν **ήδη** devDeps (το `license:check --production` δεν τα σκανάρει)· πρόσθεσα ρητή MPL-2.0 exception `axe-core` στο `.license-allowlist.json` (dev/test-only, **εγκρίθηκε Giorgio 2026-07-08**). Baseline seeded τοπικά + `a11y-ratchet.yml`. Scripts: `a11y-coverage:check`/`:baseline`.
- **G12** ✅ **DONE**: pre-commit **CHECK 14** (`gitleaks protect --staged` — soft: BLOCK αν το binary υπάρχει & βρει secret, αλλιώς warn· το CI είναι authoritative) + `gitleaks-scan.yml` (full-history, pinned binary v8.18.4, **ΟΧΙ** gitleaks-action για license-free) + `.gitleaks.toml` (built-in rules + allowlist test/locale/lockfile). ΟΧΙ ratchet — secrets = zero-tol. (Το ADR έλεγε «CHECK 10b» — δεν υπήρχε CHECK 10· έγινε **CHECK 14**, N.0.1 code-wins.) · 🔴 **Το gate είναι κόκκινο από 22/07 — σκόπιμα.** 3 γνήσια διαπιστευτήρια στο ιστορικό, rotation **αναβλήθηκε μέχρι το production** (Giorgio 28/07) ⇒ **καμία καταστολή δεν μπαίνει πριν από αυτό** (§0 του runbook). **Remediation record + βήματα: [`docs/security/secret-rotation-runbook.md`](../../../security/secret-rotation-runbook.md)** — ο δείκτης που το ίδιο το `.gitleaks.toml` (γρ. 17-18) υποσχόταν και δεν υπήρχε.
- **G15** ✅ **DONE (scoped)**: `scripts/check-knip-deps-ratchet.js` ratchet-άρει **DOWN** τα knip **dependency** findings (unused deps/devDeps/unlisted/binaries/unresolved, `knip --dependencies --reporter json`) → `.knip-deps-baseline.json` + `knip-deps-ratchet.yml`. **⚠️ ΔΕΝ** επεκτάθηκε το `knip.json` project glob να include dxf-viewer (όπως πρότεινε αρχικά το ADR): verified 2026-06-21 ([[reference_knip_ignores_dxf_viewer]], ADR-357) ότι το dxf-viewer αγνοείται **σκόπιμα** (dynamic registries → false-positive dead code· το CHECK 3.22 baseline βασίζεται σε αυτό). Include = θα φούσκωνε το dead-code ratchet & θα έσπαγε το commit flow → N.0.1 reality-wins: ratchet-άρω μόνο dependency hygiene, file-level scope αμετάβλητο. Scripts: `knip-deps:check`/`:baseline`.

---

## 6. Αρχές υλοποίησης (για κάθε νέο check)

1. **Μίμηση** του `check-jscpd-ratchet.js` / `check-deadcode-ratchet.js` (δομή: read baseline → measure → diff → block-on-regression → `--write-baseline`).
2. **Baseline seed πρώτα** για ό,τι έχει υπάρχουσες violations (G7, G8, G10) — ratchet μειώνεται/αυξάνεται σταδιακά, όχι zero-tolerance shock.
3. **Layer split**: γρήγορο (grep/AST/ESLint-staged) → pre-commit· βαρύ (tsc/build/graph) → CI μόνο (N.17).
4. **Register** το νέο check στο `run-checks-parallel.js` (pre-commit) και/ή νέο `<topic>-ratchet.yml` (CI).
5. **Governance**: baseline updates πίσω από `pnpm run <topic>:baseline` (mirror `ssot:baseline`).
6. Κάθε φάση = δικό της ADR update εδώ (§7 changelog) στο ίδιο commit.

---

## 7. Changelog

- **2026-08-24** — **G2: το CVE δεν μπήκε στην allowlist — ΕΞΑΛΕΙΦΘΗΚΕ. Allowlist 21 → 12, −62 πακέτα από το δέντρο.** Το gate ήταν κόκκινο από τον **εβδομαδιαίο cron** (`0 6 * * 1`), όχι από commit: νέο `GHSA-r292-9mhp-454m` (tar, high, CVE-2026-73566, stack-overflow DoS) σε **αμετάβλητο lockfile** — ακριβώς το σενάριο για το οποίο υπάρχει ο cron. 🔑 **Η ΛΥΣΗ ΔΕΝ ΕΙΝΑΙ ΟΥΤΕ ΑΝΑΒΑΘΜΙΣΗ ΟΥΤΕ ALLOWLIST — ΕΙΝΑΙ ΑΦΑΙΡΕΣΗ ΤΟΥ ΛΟΓΟΥ ΥΠΑΡΞΗΣ**: το `tar` ερχόταν **μόνο** μέσω `canvas` (node-canvas), *optional dependency* του `pdfjs-dist` — ενώ το έργο ζωγραφίζει με **`@napi-rs/canvas`**. Το `pnpm.overrides` δέχεται `"-"` ως τιμή αφαίρεσης (τεκμηριωμένο ρητά για optionalDependencies)· **επαληθεύτηκε ότι η pnpm 9.14.0 το υποστηρίζει** με απομονωμένο install **εκτός** repo, γιατί ένα override που το pnpm αγνοεί σιωπηλά μοιάζει με επιτυχία. Αποτέλεσμα: `pnpm why -r tar|canvas|@mapbox/node-pre-gyp` → **κενό σε όλους τους importers**· allowlist **21 → 12** (κλαδεύτηκαν 8 tar + 1 brace-expansion)· το `tar` έπαψε να είναι το **38%** της allowlist.

  🔴 **Η ΑΡΧΙΚΗ ΔΙΑΓΝΩΣΗ ΗΤΑΝ ΛΑΘΟΣ ΚΑΙ ΘΑ ΕΡΙΧΝΕ ΤΗΝ ΠΑΡΑΓΩΓΗ — η μέτρηση την ανέτρεψε.** Το σκεπτικό «το υποδέντρο είναι αχρησιμοποίητο» στηριζόταν σε **τρεις στατικές** ενδείξεις (μηδέν `import 'canvas'` στο `src/` · όχι άμεση εξάρτηση · `canvas: false` στο `next.config`) — **και οι τρεις είναι bundler-level, ενώ η κατανάλωση είναι runtime μέσα στην ίδια την εξάρτηση**. (α) Το `canvas: false` ζει στο `config.resolve.fallback`, που ενεργοποιείται **μόνο όταν αποτυγχάνει** η κανονική επίλυση — και το canvas επιλυόταν κανονικά, με **χτισμένο native binary**. (β) Το `pdfjs-dist` είναι στα `serverExternalPackages`, άρα **δεν περνά καν από webpack** στον server. (γ) Το legacy build κάνει `import(/*webpackIgnore: true*/"canvas")` — **σχεδιασμένο να είναι αόρατο σε κάθε bundler**, άρα και σε κάθε grep. **Μετρημένο ζωντανά**: εισαγωγή του `pdf.mjs` σε Node γεμίζει το `globalThis.DOMMatrix` **από το node-canvas** (`globalThis.DOMMatrix === canvas.DOMMatrix` → `true`)· ο Node 20 **δεν έχει** native `DOMMatrix`/`Path2D`. Χωρίς αυτά, PDF με **tiling pattern** πέφτει με `ReferenceError: DOMMatrix is not defined` στο `TilingPattern.getPattern` — **σκέτη εξαίρεση, όχι υποβάθμιση**. Δύο ζωντανοί καταναλωτές παραγωγής: `openai-quote-analyzer.ts:194` και `logo-extractor.ts:105`.

  ✅ **Η ΠΡΟΫΠΟΘΕΣΗ ΠΟΥ ΕΛΕΙΠΕ**: το `pdf-rasterize.service.ts` δίνει πλέον `DOMMatrix`/`Path2D` στο global scope **από την ΙΔΙΑ υλοποίηση καμβά που ζωγραφίζει** (`@napi-rs/canvas`), **πριν** φορτώσει το pdf.js. **Είναι backport της απόφασης του upstream**: το pdf.js ≥ 4.8.69 αντικατέστησε το node-canvas με `@napi-rs/canvas` ακριβώς γι᾽ αυτό (ορατό και στο δικό μας δέντρο — το `pdfjs-dist@5.4.296` δηλώνει `@napi-rs/canvas` ως optional). ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ, ΓΙ᾽ ΑΥΤΟ ΖΕΙ ΜΕΣΑ ΣΤΟ `loadPdfjs()`** — ένα `Promise.all([loadPdfjs(), loadCanvas()])` στον καλούντα είναι **αγώνας δρόμου**, και μια εγγύηση που ο καλών πρέπει να θυμάται δεν είναι εγγύηση. **ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ — και οι 4 χρήσεις του πακέτου `canvas` στο `pdf.mjs`**: γρ. 10368 `import` ⇒ `catch {}` · 10386 `DOMMatrix` ⇒ παρακάμπτεται · 10394 `CanvasRenderingContext2D` ⇒ παρακάμπτεται · 10425 `NodeCanvasFactory` ⇒ **ποτέ δεν φτάνει** (γρ. 15845: `src.canvasFactory || new DefaultCanvasFactory` — περνάμε δικό μας).

  🔬 **ΑΠΟΔΕΙΞΗ ΜΗΔΕΝΙΚΗΣ ΠΑΛΙΝΔΡΟΜΗΣΗΣ, PIXEL-ΕΠΙΠΕΔΟΥ**: 4 πραγματικά PDF (ελληνικά · δύο δημόσια έγγραφα · **tiling pattern**) rasterized με τον **πραγματικό** service και το node-canvas **όντως απόν** (νεκρός σύνδεσμος μετά από `pnpm prune`) ⇒ **4/4 ταυτόσημα sha256 των pixels** με τις τιμές πριν την αλλαγή. **Ο παρονομαστής μετρήθηκε ξεχωριστά**: χωρίς τα globals το ίδιο tiling PDF **πέφτει** — άρα το πράσινο δεν σημαίνει «δεν υπήρξε ποτέ βλάβη».

  🔴 **ΔΕΥΤΕΡΗ ΑΝΑΤΡΟΠΗ — Η ΔΙΑΔΡΟΜΗ ΔΕΝ ΗΤΑΝ ΜΟΝΑΔΙΚΗ.** Το `pnpm why` από τη ρίζα **δεν διασχίζει workspace packages**· το `pnpm audit` έδειξε δεύτερο importer: `src/subapps/dxf-viewer → jsdom@24.1.3 → canvas (peer) → node-pre-gyp → tar`. Χρειάστηκε **δεύτερο** override (`"jsdom>canvas": "-"`). ⚠️ **Σε workspace χρησιμοποίησε `pnpm why -r`, ποτέ σκέτο `pnpm why`.** Ασφαλές γιατί το **root** jest τρέχει `jsdom 26/27`, που **δεν φέρνει καθόλου canvas** — τα ~3.400 root tests **ποτέ δεν είχαν** πραγματικό canvas, και ο κώδικας το γράφει ρητά («*το jsdom είναι ΔΟΜΙΚΑ τυφλό*», «*canvas-pill which has no canvas API in jsdom*»). ⚠️ **ΜΗΝ λύσεις τέτοιο drift με `pnpm install --force`**: το `.npmrc` έχει `resolution-mode=highest`, άρα πλήρης επανεπίλυση θα ανέβαζε δεκάδες πακέτα μέσα στα ranges τους — τεράστια, μη ελέγξιμη αλλαγή. Η **ρητή δήλωση** κλαδεύει μόνο την ακμή.

  🔴 **ΤΟ `--write-baseline` ΕΣΒΗΝΕ ΤΗΝ ΑΝΘΡΩΠΙΝΗ ΑΠΟΦΑΣΗ — ΔΙΟΡΘΩΘΗΚΕ.** Καρφωμένο `reason: 'Seeded — …'` σε **κάθε** εγγραφή. Στις **2026-07-26** γράφτηκαν δύο πλήρως αιτιολογημένες εγγραφές και **αυτό ακριβώς το changelog** κατέγραψε ότι η εντολή αποφεύχθηκε **χειροκίνητα** «για να μη σβηστούν» — η επόμενη εκτέλεση τις έσβησε ούτως ή άλλως, και **και οι 21** κατέληξαν να λένε «Seeded». *Μια εγγύηση που απαιτεί από άνθρωπο να θυμάται δεν είναι εγγύηση* — το σχήμα που έχει αποτύχει μετρημένα σε **3.34** (63) · **3.37** (18 vs 26) · **3.49** (60). Πλέον `mergeAllowlistEntry`: τα **ΜΗΧΑΝΙΚΑ** πεδία (`id/severity/title/cves/url`) ανανεώνονται πάντα, η **ΑΠΟΦΑΣΗ** (`reason`/`owner`) **διατηρείται**· κλειστή λογιστική σε 3 κάδους (διατηρήθηκαν · νέες · κλαδεύτηκαν) που **τυπώνεται ΚΑΙ στο μηδέν**. Πρότυπο: Snyk `.snyk` (υποχρεωτικό `reason`) · OWASP dependency-check (`<notes>` διατηρούνται).

  **Άγκυρες**: `src/services/pdf/__tests__/pdf-rasterize-globals-order.test.ts` (5, **4/4 μεταλλάξεις κόκκινες**) + `scripts/__tests__/check-dependency-audit-ratchet.test.js` (6, **5/5 μεταλλάξεις**). ⚠️ **Δύο μεταλλάξεις βγήκαν αρχικά ΠΡΑΣΙΝΕΣ και διορθώθηκε ο ΣΧΕΔΙΑΣΜΟΣ, όχι το test**: η διατήρηση του `owner` ήταν **αφύλακτη** (μισή απόφαση χωρίς φρουρό)· και η πρώτη άγκυρα κειμένου **κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ**, επειδή τα σχόλια του service **ονομάζουν** τη βλάβη ⇒ χρειάστηκε `stripComments` — το μάθημα των **CHECK 3.50 (Κ7β) / 3.56**. **N.5**: κανένα νέο πακέτο· `@napi-rs/canvas` = **MIT**. **N.7.1**: `rasterizePdfPages` **50 → 39** γρ. (εξήχθη `renderPageToPng`) — προϋπάρχουσα παραβίαση, Boy Scout. **CHECK 3.37** (34 πύλες) και **3.47** αμετάβλητα, **επαληθευμένα εκτελώντας τα**.

  🔶 **ΑΝΟΙΧΤΑ — απόφαση Giorgio**: (1) τα **8 jspdf** advisories (4 critical, μαζί με Path Traversal `CVE-2025-68428`) είναι πλέον το **67%** της allowlist και το `jspdf` είναι **άμεση** εξάρτηση ⇒ θέλει **αναβάθμιση**, όχι αφαίρεση· (2) **και οι 12** εγγραφές λένε «Seeded» — allowlist χωρίς αιτιολογία είναι **αναβολή**, όχι απόφαση· (3) το `src/subapps/dxf-viewer/jest.config.ts` **δεν το εκτελεί κανείς** (ούτε npm script, ούτε workflow, ούτε ένα από τα 5 configs του CHECK 3.47) ⇒ το `jsdom@24.1.3` εκεί είναι **νεκρή devDependency**· (4) το `@napi-rs/canvas` είναι σε **devDependencies** ενώ το καλεί **server-only κώδικας παραγωγής** — σήμερα σώζεται από το outputFileTracing του standalone build, αλλά η ταξινόμηση είναι λάθος.

- **2026-08-05** — **🔴 G14 ΚΟΚΚΙΝΟ 9 ΜΕΡΕΣ ΚΑΙ ΔΟΜΙΚΑ ΑΔΙΑΓΝΩΣΤΟ — η πύλη πετούσε την απόδειξη· ένας κοινός εκκινητής `tsc` για τρεις πύλες (ADR-757 ΦΑΣΗ Β, πύλη #1).** Το `type-complexity-ratchet` απέτυχε σε **13 συνεχόμενες εκτελέσεις** (28/07 → 04/08) με **ένα μόνο** μήνυμα: `tsc --extendedDiagnostics had no "Instantiations:" line (build failed?)`. **Δεν ήταν υπέρβαση budget — ήταν μέτρηση που δεν έγινε ποτέ.** Ρίζα της **αδυναμίας διάγνωσης**: το `measure()` έκανε `spawnSync` με `stdio: ['ignore','pipe','pipe']`, **συνένωνε** stdout+stderr σε μια μεταβλητή και μετά **την πετούσε** — αν το `Instantiations:` έλειπε, πετούσε σκέτο `Error` **χωρίς** την έξοδο του μεταγλωττιστή. Επί 9 μέρες κανείς δεν μπορούσε να απαντήσει «OOM; σκοτώθηκε; δεν βρέθηκε το tsc; άλλαξε η μορφή εξόδου;» — **όχι επειδή ήταν δύσκολο, αλλά επειδή η πληροφορία δεν υπήρχε πουθενά**. Τελευταία **αληθινή** μέτρηση (27/07, `e4ec333a`): **3.642.770** instantiations / 1.512.367 types vs baseline 3.587.295, budget 3.694.914 @3% ⇒ **98,6% του budget** (περιθώριο 1,4%). ⚠️ **ΤΟ OOM ΔΕΝ ΑΠΟΔΕΙΧΘΗΚΕ — και η εύκολη εκδοχή του ΚΑΤΑΡΡΙΦΘΗΚΕ**: το handoff της ΦΑΣΗΣ Β το έδινε ως «ισχυρότατη υποψία» (ίδιο σχήμα με το G6 OOM στα 7847 MB), αλλά **φυσικό πείραμα** στα ίδια commits το αντικρούει — το `ts-error-gate.yml` (ADR-027) τρέχει **το ίδιο** `npx tsc --noEmit` στο **ίδιο** root project, στον **ίδιο** runner, **χωρίς κανένα `NODE_OPTIONS`** (default heap), και **ολοκληρώνει σε 2m52s**· το G14 «πεθαίνει» στα **5m17s** με ταβάνι **6144 MB** (η τελευταία επιτυχία του κράτησε 4m07s). Άρα σκέτο `tsc` **χωράει** κάτω από το default ταβάνι, και η αιτία του G14 παραμένει **άγνωστη**. **Γι' αυτό η διόρθωση αυτού του commit ΔΕΝ είναι «σήκωσε τη μνήμη» — είναι «κάνε την πύλη να μιλήσει».** 🔑 **Νέο SSoT: `scripts/lib/tsc-runner.js`** — **μία** μηχανή που εκκινεί `tsc` για πύλη, με **6 ρητές καταστάσεις** (`ran` · `spawn-failed` · `out-of-memory` · `killed` · `output-truncated` · `no-diagnostics`). Το μοντέλο είναι το τετράπτυχο των **Monitoring Plugins/Nagios**, που ξεχωρίζει εδώ και δύο δεκαετίες ακριβώς αυτό: **CRITICAL** = «ο έλεγχος έτρεξε και το πράγμα είναι κακό» · **UNKNOWN** = «ο έλεγχος δεν μπόρεσε να τρέξει». **Και τα δύο κλείνουν την πύλη — αλλά ΔΕΝ είναι το ίδιο μήνυμα**, και η σύγχυσή τους είναι που κόστισε τις 9 μέρες. Κάθε αποτυχία τυπώνει πλέον: κατάσταση, αιτία, **εντολή**, **ταβάνι σε ισχύ**, exit status+signal, και την **ουρά της εξόδου του tsc** (2.000 χαρ., από το **τέλος** — εκεί είναι το `FATAL ERROR`). 🔴 **Η ΣΕΙΡΑ ΤΩΝ ΕΛΕΓΧΩΝ ΕΙΝΑΙ ΦΕΡΟΥΣΑ:** ο V8 τυπώνει `FATAL ERROR: … JavaScript heap out of memory` **και μετά κάνει abort**, άρα το `signal` **είναι γεμάτο** — αν ο έλεγχος σήματος προηγηθεί του κειμένου, **κάθε OOM μεταμφιέζεται σε «killed»** και η πύλη ξαναπέφτει για λάθος λόγο. Φυλάσσεται από ρητό test (Μ2β). 🔴 **ΔΕΥΤΕΡΟ ΕΥΡΗΜΑ — ΨΕΥΔΩΣ ΠΡΑΣΙΝΟ ΣΤΟ ADR-027:** το `enterprise-ts-gate.js` μετρούσε γραμμές `error TS` **μέσα σε `catch`** — μεταγλωττιστής που **καταρρέει** δεν βγάζει καμία, άρα κατάρρευση ήταν **δυσδιάκριτη** από «0 σφάλματα» και η πύλη τύπωνε `✅ GATE PASSED: TypeScript errors DECREASED! Delta: -3005 (you fixed 3005 errors!)` — **ο πιο δυνατός δυνατός πανηγυρισμός για μέτρηση που δεν έγινε**. Είναι το «0 = κανείς δεν κοίταξε» (N.11/N.12) **με γιορτή από πάνω**. Πλέον: μη μηδενική έξοδος **χωρίς** ούτε μία γραμμή `error TS` ⇒ **UNKNOWN, fail closed**. *(Το σημερινό πράσινο του είναι **γνήσιο** — το tsc όντως τερματίζει με 0 σφάλματα· η baseline όμως λέει **3005** από **13/01/2026**, δηλαδή η πύλη είναι μονίμως ικανοποιημένη ⇒ **αδύναμο όργανο, ξεχωριστή δουλειά**.)* 🔑 **ΤΡΙΤΟ: το ταβάνι μνήμης ΠΑΡΑΓΕΤΑΙ, δεν αντιγράφεται.** Είχε γίνει **τέσσερις άσχετοι αριθμοί** (6144 σε env workflow · 8192 hardcoded στο CHECK 3.29 · 8192 στο type-coverage · 12288 στο production build) ενώ **σχόλιο** ισχυριζόταν ότι «mirror» ο ένας τον άλλον — **ποτέ δεν ίσχυσε**. Το `--max-old-space-size` είναι **ταβάνι, όχι δέσμευση**, άρα πρέπει να μετριέται στο **ΜΗΧΑΝΗΜΑ**: `resolveHeapMb()` = `clamp(RAM×75%, 4096, 12288)` ⇒ **12288 στον runner 16 GB** (αποδεδειγμένο από `docker-build`/`bundle-ratchet`), **6144 σε PC 8 GB** — γιατί ταβάνι μεγαλύτερο από τη μνήμη δίνει **SIGKILL από το λειτουργικό** αντί για καθαρό JS OOM (ADR-598 04/08 αρνήθηκε ρητά να ζητά 12 GB το τοπικό build). Override: `TSC_HEAP_MB`. ⚠️ **Το `NODE_OPTIONS` ΑΦΑΙΡΕΘΗΚΕ από το `type-complexity-ratchet.yml` επίτηδες** — αν ξαναμπεί, καπελώνει **μόνο τον γονέα** και ξαναστήνεται η παγίδα της 04/08 (workflow έλεγε 12288, η διεργασία έτρεχε στα 8192 επί 4 εβδομάδες). Φυλάσσεται από test. 🌟 **ΤΕΤΑΡΤΟ — ο γκρεμός γίνεται πλαγιά:** το `tsc --extendedDiagnostics` **ήδη τύπωνε** `Memory used: NNNNK` και κανείς δεν το διάβαζε. Μπαίνει στη baseline ως `memoryUsedKB` και σε **κάθε** εκτέλεση τυπώνεται «X MB από Y MB ταβάνι (Z%)»· πάνω από `heapWarnPct` (**80**, στο `config/quality-gates/type-complexity-budget.json`) **προειδοποιεί δυνατά χωρίς να μπλοκάρει** — γιατί η πίεση μνήμης είναι γεγονός περιβάλλοντος, όχι παλινδρόμηση κώδικα. Μέχρι σήμερα το όργανο ανακάλυπτε το ταβάνι **μόνο πεθαίνοντας πάνω του**. **Απόδειξη:** `npm run test:tsc-runner` — **27 tests**, Μ0 (ζωντανό δέντρο) + **Μ1..Μ6 μία μετάλλαξη ανά ρητή κατάσταση** + Π (η απόδειξη δεν χάνεται) + Κ (παραγωγή ταβανιού) + G14. Σύνολο **100/100** μαζί με `test:type-ratchets` + `test:dxf-tsc`· CHECK 3.37 πράσινο (31 tests). ⚠️ **Η ΠΥΛΗ ΔΕΝ ΕΙΝΑΙ ΑΚΟΜΑ ΠΡΑΣΙΝΗ — ΕΓΙΝΕ ΑΝΑΓΝΩΣΙΜΗ.** Η επόμενη εκτέλεση στο CI θα **ονομάσει** την κατάσταση. Αν βγει `out-of-memory`, το ταβάνι είναι ήδη διπλάσιο. Αν βγει μέτρηση με **υπέρβαση** budget (πιθανό: ήταν στο 98,6% πριν από 80 commits), αυτό είναι **γνήσιο εύρημα προς διερεύνηση** — **ΟΧΙ** αφορμή για reseed. 🔎 **ΠΕΜΠΤΟ, παράπλευρο: το CHECK 3.28 (jscpd) είναι ΔΟΜΙΚΑ ΤΥΦΛΟ σε όλο το `scripts/`** — το `.jscpdrc.json` ορίζει `format: ["typescript","tsx"]`, άρα **κανένα `.js` δεν σαρώθηκε ποτέ**: ο έλεγχος N.18 στα αρχεία αυτού του commit επέστρεψε «0 clones **σε 0 αρχεία**». Με ρητό `--format javascript` βρέθηκε **πραγματικός** κλώνος 9 γραμμών (`runFull`/`runSmoke` στο CHECK 3.29) — εξήχθη σε `requireBaseline()` (N.0.2). **Άλλο ένα «0 = κανείς δεν κοίταξε»**· η επέκταση του jscpd στο `scripts/` είναι >1h ⇒ `.claude-rules/pending-ratchet-work.md`.

- **2026-08-04** — **🔴 Ο ΔΙΑΚΟΠΤΗΣ ΜΝΗΜΗΣ ΤΟΥ CI ΔΕΝ ΕΚΤΕΛΕΙΤΟ ΠΟΤΕ — `pnpm run build` → `pnpm run build:ci` (G6 + docker-build).** Το `Build & Deploy Docker Image` έπεσε στο `c1e5e2b` με `FATAL ERROR: ... JavaScript heap out of memory` ⇒ **δεν χτίστηκε image, δεν έφυγε τίποτα στο Netcup** (η παραγωγή έμεινε στο χθεσινό `cac677f`). **Ρίζα:** και τα δύο workflows έδιναν `NODE_OPTIONS: --max-old-space-size=12288`, αλλά καλούσαν `pnpm run build`, του οποίου το script είναι `… && cross-env NODE_OPTIONS=--max-old-space-size=8192 next build`. **Το `cross-env` ΞΑΝΑΓΡΑΦΕΙ το κληρονομημένο `NODE_OPTIONS`** ⇒ το 12288 πεταγόταν σιωπηλά και το build έτρεχε στα **8192**. **Μετρημένο, όχι εικαζόμενο:** το heap έσκασε στα **7847 MB** — το ταβάνι των 8 GB, όχι των 12. ⚠️ **Η ρύθμιση ήταν νεκρή από τη μέρα που γράφτηκε**: η εγγραφή **2026-07-08** πιο κάτω καταγράφει «G6 bundle `next build` OOM στα 6144 MB → 12288 MB» — η αλλαγή έγινε, **δεν είχε ποτέ αποτέλεσμα**, και δεν φάνηκε επί ~4 εβδομάδες μόνο επειδή το build χωρούσε κάτω από 8 GB. **Δεν φταίει commit:** το G6 έσκαγε με τον **ίδιο** OOM ήδη σε `15579c9` (01/08) και `cac677f` (03/08) ενώ το docker-build περνούσε στο **ίδιο** SHA — κλασικό οριακό κατώφλι, όχι παλινδρόμηση· μετά από **95 commits / +39.549 γραμμές** από το τελευταίο πράσινο docker build πέρασε τη γραμμή και το δεύτερο. **Fix:** νέο script `build:ci` = `build:tokens && next build` (**χωρίς** cross-env) στο `package.json`· `docker-build.yml` + `bundle-ratchet.yml` καλούν αυτό ⇒ το `NODE_OPTIONS` του workflow φτάνει πλέον στη διεργασία. Το `build` μένει **αμετάβλητο στα 8192** — το τοπικό build του Giorgio (αδύναμο PC) δεν πρέπει να ζητά 12 GB. ⚠️ **Νέα παγίδα που εισάγεται συνειδητά:** το `build:ci` **δεν έχει δικό του όριο** ⇒ όποιο workflow το καλεί **ΠΡΕΠΕΙ** να ορίζει `NODE_OPTIONS` μόνο του, αλλιώς παίρνει το default heap του Node (~4 GB) και σκάει· γραμμένο ως σχόλιο-προειδοποίηση **και στα δύο** workflows. Ενεργοί καταναλωτές του `pnpm run build`: **μόνο** αυτά τα δύο (επαληθεύτηκε με grep· το `quality-gates.yml.disabled` είναι ανενεργό). 🔎 **Το γενικό μάθημα:** ρύθμιση περιβάλλοντος σε workflow **δεν είναι απόδειξη** ότι φτάνει στη διεργασία — ένα npm script στη μέση μπορεί να την καταπιεί, και το gate μένει πράσινο/κόκκινο για **λάθος λόγο**. Ίδιο σχήμα με το «0 = κανείς δεν κοίταξε».
- **2026-07-28** — **G12 Secret Scan: πλήρης τριάγη + εκκαθάριση working tree· καμία καταστολή, το gate μένει κόκκινο ΣΚΟΠΙΜΑ.** Το `🔐 gitleaks (full history)` ήταν κόκκινο **από 22/07** με **4 ευρήματα / 3 γνήσια διαπιστευτήρια**: Telegram webhook secret (`telegram-webhook-setup.sh:5` @`10473f11` 16/01 **+** `ADR-263:114` @`e6e16713` 25/03), `META_APP_SECRET` (`BACKUP_SUMMARY.json:35` @`a59bd551` 11/02), Sketchfab API token (`HANDOFFS/2026-06-08_adr408-…:84` @`15fe995f` 08/06). 🔎 **Η τριάγη βρήκε 5ο σημείο που κανείς δεν είχε καταγράψει:** ο Sketchfab token υπάρχει και σε **δεύτερο** handoff (`…adr411-sanitary-mesh-library-expansion_NEXT.md:94`) — ένας ακόμη λόγος που η **value-scoped** επιλογή (§5 runbook) υπερτερεί του `.gitleaksignore`: ένα entry ανά **τιμή** καλύπτει Ν αρχεία, ενώ τα fingerprints είναι ανά (SHA,αρχείο,γραμμή) και θα άφηναν το δεύτερο ακάλυπτο. **ΕΓΙΝΕ (working tree, δεν πρασινίζει το gate — το ιστορικό σαρώνεται):** (α) **διαγραφή** `telegram-webhook-setup.sh` — literal secret + νεκρό `nestor-app.vercel.app` URL· **έχει ήδη αντικατασταθεί από SSoT** `telegram-webhook-client.ts` + `POST /api/admin/telegram/webhook` (**ADR-705**), μηδέν απώλεια δυνατότητας· (β) **redaction ×2** στα handoffs (το `ADR-263` ήταν **ήδη** καθαρό — δείχνει σε env vars)· (γ) **νέο `docs/security/secret-rotation-runbook.md`** — ο φάκελος **δεν υπήρχε**, παρότι το `.gitleaks.toml` γρ. 17-18 έδειχνε εκεί επί 3 εβδομάδες (**dangling pointer** σε ADR-εγκεκριμένη πολιτική). **ΔΕΝ ΕΓΙΝΕ, ΣΚΟΠΙΜΑ:** καμία εγγραφή σε `regexes[]` / `.gitleaksignore`. **Απόφαση Giorgio 28/07: το rotation αναβάλλεται μέχρι η εφαρμογή να βγει στην παραγωγή** ⇒ allowlist **ζωντανού** secret θα παραβίαζε την ίδια την πολιτική του `.gitleaks.toml` («GENUINE secrets are NOT allowlisted — they are rotated») και θα μετέτρεπε το gate από **ειλικρινές κόκκινο** σε **τυφλό πράσινο**. Η σειρά `ROTATE → VERIFY → SUPPRESS → RECORD` (NIST SP 800-61 containment→eradication) είναι μονόδρομη. **Εκκρεμεί (μπλοκαρισμένο σε Giorgio):** §2/§3/§4 rotation → §5 value-scoped entries → §5.2 record εδώ. ⚠️ **Το repo είναι δημόσιο** — τα 3 πρέπει να θεωρούνται γνωστά σε τρίτους από την ημερομηνία του commit· το #1 ήταν εκτεθειμένο **~6,5 μήνες**. **Πρόταση πρόληψης (δεν υλοποιήθηκε):** GitHub **push protection** — το μόνο επίπεδο που μπλοκάρει *πριν* φτάσει στον GitHub (το CHECK 14 είναι soft/warn χωρίς binary· το CI πιάνει *μετά* το push)· + fail-closed CHECK 14· + κανόνας «τα HANDOFFS/ADR γράφουν μόνο **όνομα** env var» (**2 από τις 4 διαρροές ήρθαν από τεκμηρίωση, όχι από κώδικα**).
- **2026-07-26** — **G2 Dependency-CVE: 15 → 0 παραβιάσεις· το gate ξαναέγινε σήμα.** Ήταν κόκκινο **από 15/07**. **Δύο σκέλη.** **(α) Πραγματική διόρθωση** (commits `c91faea6`, `86e71896`, `02425c7c`, `e9385e3d`): `next` **15.5.12 → 15.5.22** ⇒ έκλεισαν **3 CVE ζωντανά στην παραγωγή** — CVE-2026-64641 (DoS σε Server Actions), CVE-2026-64649 + CVE-2026-64645 (**SSRF**)· `next` advisories **24 → 0**, σύνολο advisories **155 → 40**. 🔴 **Η ρίζα που δεν φαινόταν: `pnpm update next` ΔΕΝ έκανε τίποτα** — υπάρχει hard pin `pnpm.overrides.next`, και το `save-exact=true` του `.npmrc` είχε επιπλέον καρφώσει το `dependencies.next` από `^15.5.12` σε `15.5.12`. **Χρειάζεται αλλαγή ΚΑΙ ΣΤΑ ΔΥΟ σημεία.** +27 transitive πακέτα με **range-scoped** overrides (`minimatch@3/5/9/10`, `brace-expansion@1/2/5`, `ws@7/8`, `form-data@2/4`, `js-yaml@3/4`) — ⚠️ **σκέτο override θα έσπαγε**: ένα `"minimatch": "^10"` θα πίεζε και το `minimatch@3` του `glob@7`. Παγίδα: το range-syntax `"@grpc/grpc-js@1.14"` **δεν έπιασε** (χρειάστηκε σκέτο `"^1.14.4"`)· το `sharp` ερχόταν μέσω `next` ⇒ ρητό pin. Επαλήθευση: **94/94 jest** στους καταναλωτές των `dompurify`/`postcss`. **(β) Allowlist των 3 που απέμειναν — τεκμηριωμένη απόφαση «ΟΧΙ upgrade», όχι σιωπηλό rebaseline.** `tar` ×2 (GHSA-23hp-3jrh-7fpw critical, GHSA-8x88-c5mf-7j5w high): διαδρομή `pdfjs-dist > canvas > @mapbox/node-pre-gyp@1.0.11`, που **δηλώνει `tar: "^6.1.11"`** (επαληθεύτηκε στο `package.json` του πακέτου) ενώ κάθε patched range είναι **>=7.5.x** ⇒ override σε tar@7 σπάει το node-pre-gyp ⇒ **σπάει το `pnpm install` σε καθαρό clone ⇒ σπάει CI ΚΑΙ deploy**· το tar τρέχει **μόνο install-time** (unpack prebuilt binaries), δεν βλέπει user input σε runtime. `brace-expansion` (GHSA-mh99-v99m-4gvg): patched **μόνο >=5.0.8**, ενώ οι ευάλωτες εγκατεστημένες είναι **1.1.16 και 2.1.2** — και οι δύο **τελευταίες δημοσιευμένες** στα branches τους (επαληθεύτηκε με `npm view versions`) ⇒ **δεν υπάρχει backport**, μόνο major bump σε `minimatch@3/5/9` κάτω από `exceljs`/`@typescript-eslint`. **Το ρίσκο της αλλαγής ξεπερνά το ρίσκο του CVE — ακριβώς η περίπτωση που το ίδιο το gate προβλέπει allowlist.** Allowlist **56 → 21** entries (18 kept · **3 added με πλήρες σκεπτικό+επανεξέταση** · **38 stale pruned** — advisories που το `pnpm audit` δεν αναφέρει πια). ⚠️ **ΔΕΝ χρησιμοποιήθηκε `--write-baseline`**: ισοπεδώνει **όλα** τα `reason` σε generic «Seeded — pre-existing» ⇒ θα έσβηνε το σκεπτικό των 3 τη στιγμή που γράφεται. Το refresh έγινε διατηρώντας τα υπάρχοντα reasons. Αποτέλεσμα: `deps-audit:check` **✅ OK — 21 advisories, all allowlisted**.
- **2026-07-16** — **RATCHET CATCH-UP RESEED + ROOT-CAUSE CONCURRENCY FIX (G6/G9/G10/G14/G15 CI-red στο main @ `ab602a35`).** Πρώτο **πλήρες** run των βαρέων ratchets μετά από **204 commits / +125.312 γραμμές** νόμιμης ανάπτυξης (topo / point-cloud / WebGL / BIM / AI sheet-set) — τελευταίο πράσινο ήταν το `19d69601`. **VERIFY πρώτα (ΟΧΙ τυφλό reseed):** `depcruise src` full crawl → οι **+878** νέοι κύκλοι (421→**1299**) είναι **~91% (~1.190) μέσα στο `dxf-viewer`**, διάχυτοι σε **15+ subfolders** (bim 567 / core 164 / systems 123 / rendering 75 …), με cycle-length 15–25 (barrel-file over-coupling) → **legit growth, ΟΧΙ single-import regression**· εκτός subapp μόλις ~73 κύκλοι. **LOCK (reseed via CI seed dispatch, N.17 — ΟΧΙ τοπικό build):** `.depcruise-cycles` 421→**1299**, `.depcruise-boundaries` 327→**361**, `.type-complexity` 3.453.474→**3.587.295**, `.knip-deps` 450→**456**, `.bundle-size` 41.63→**42.79 MB** *(seed run 29455644913)*. **ROOT CAUSE (γιατί μαζεύτηκε σιωπηλά):** τα 20 push→main gate workflows είχαν `concurrency.group: <name>-${{ github.ref }}` + `cancel-in-progress: true` → σε **real-time πυκνά commits** κάθε νέο push **ακύρωνε** το προηγούμενο in-progress run πριν ολοκληρωθεί (bundle build ~11′· απόδειξη: 3/10 bundle runs cancelled) → τα βαριά gates σχεδόν ποτέ δεν ολοκληρώνονταν → drift αόρατο. **Fix (big-players practice — per-SHA gating):** και στα **20** workflows (a11y/bundle/coverage/deadcode/depcruise/dependency-audit/dxf-tsc/eslint/firestore-rules/functions-integration/gitleaks-scan/i18n-governance/jscpd/knip-deps/license-audit/ssot-discover/storage-rules/ts-error-gate/type-complexity/type-coverage) → `group: <name>-${{ github.event_name == 'pull_request' && github.ref || github.sha }}` + `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`: PR κρατά ref-based cancel (νέο push ακυρώνει stale)· **push→main = per-SHA, ΟΧΙ cancel** → κάθε commit gate-άρεται ολόκληρος, drift δεν ξαναχάνεται. **Debt καταγράφηκε** (dxf-viewer barrel over-coupling → σταδιακή μείωση) στο `.claude-rules/pending-ratchet-work.md`. **Εκτός scope:** G12 gitleaks (leaked Sketchfab token σε `HANDOFFS/2026-06-08_…md:84`, commit `15fe995f`) — ο Giorgio το χειρίζεται χωριστά. **SSoT Discover (ADR-314/3.18)** ήταν κόκκινο **και πριν** τα 204 commits (χρόνιο) — ξεχωριστό investigation.
- **2026-07-08** — **SEED-DISPATCH SCAFFOLDING FIX (G5/G6/G9/G10/G14 CI-red στο main).** Πρώτο seed dispatch αποκάλυψε **δύο bugs** στα gate workflows (μπήκαν την ίδια μέρα): **(1)** `actions/upload-artifact@v4` εξαιρεί hidden files by default (≥v4.4) → όλα τα baseline JSON είναι **dotfiles** (`.type-*`, `.depcruise-*`, `.bundle-size-*`, `.coverage-*`) → «no files found» (soft-warn, το step περνά success) → **κανένα artifact** για download παρότι το write-baseline πέτυχε· fix: `include-hidden-files: true` και στα **7** seed uploads (type-complexity/type-coverage/depcruise/bundle/coverage + round-2: knip-deps/a11y). **(2)** `type-coverage-ratchet.yml` seed/check step **χωρίς** `NODE_OPTIONS` → το type-coverage (TS compiler API) OOM στα ~4 GB default heap· fix: `--max-old-space-size=8192` (mirror των υπόλοιπων gates). Επίσης **G6 bundle** `next build` OOM στα 6144 MB → 12288 MB (ευθυγράμμιση με `docker-build.yml`, τον canonical production build· ubuntu-latest=16 GB). Seed runs που πέρασαν πριν το fix (depcruise cycles+boundaries, type-complexity) υπολογίστηκαν σωστά αλλά το artifact χάθηκε λόγω (1) → re-dispatch μετά το merge. **Round 2 (μετά το merge c39024ca):** το include-hidden-files δούλεψε (depcruise+complexity baselines κατέβηκαν & committed)· αποκαλύφθηκαν **2 ακόμη βαθύτερα bugs**: **(3)** `check-type-coverage-ratchet.js` parser regex `(\d+)/(\d+)\s+P%` δεν έπιανε το νέο type-coverage output `(N / M) P%` (παρενθέσεις) → fail-closed «no summary line» παρότι 99.40% typed· fix: `\(?…\)?` optional parens + regression test (`(1817536 / 1828437) 99.40%`). **(4)** G6 build χωρίς Firebase env → `auth/invalid-api-key` στο static page-data collection (`/api/admin/migrations/execute`)· fix: mirror του `NEXT_PUBLIC_*` block από `docker-build.yml` (browser-exposed public config, όχι secret) στο bundle build step. **Εκκρεμεί:** re-seed G5+G6 → commit τα 2 τελευταία baselines. G12 (gitleaks) χειρίζεται χωριστά ο Giorgio.
- **2026-07-08** — **ΦΑΣΗ 3 ΟΛΟΚΛΗΡΩΘΗΚΕ (G3+G9+G10+G11+G12+G15).** SSoT audit πρώτα: `dependency-cruiser`/`gitleaks`/coverage-summary reporter απόντα· `jest-axe`+`axe-core`(MPL-2.0)+`@types/jest-axe` **ήδη** devDeps (installed)· `knip.json` αγνοεί dxf-viewer **σκόπιμα**. Νέα αρχεία: `scripts/check-{coverage,depcruise,a11y-test-coverage,knip-deps}-ratchet.js`, `src/test-utils/a11y.tsx`, `.dependency-cruiser.cjs`, `.gitleaks.toml`, `.a11y-coverage-baseline.json` (seeded τοπικά, 143), `.github/workflows/{coverage,depcruise,a11y,knip-deps,gitleaks-scan}-ratchet.yml` (το gitleaks-scan χωρίς `-ratchet`), `scripts/__tests__/check-phase3-ratchets.test.js` (18 tests). Τροποποιήθηκαν: `package.json` (+`dependency-cruiser@16.10.4` MIT — **v18 απορρίφθηκε: Node≥22, CI=Node20**· +10 gate scripts +`test:phase3-ratchets`), `pnpm-lock.yaml`, `jest.config.js` (+`coverageReporters` json-summary), `.license-allowlist.json` (+`axe-core` MPL-2.0 vetted exception, Giorgio-approved), `scripts/git-hooks/pre-commit` (+CHECK 14 gitleaks soft-scan). **Δύο reality-wins αποκλίσεις από το ADR draft (N.0.1):** (1) G9/G10 = ΕΝΑ `--gate` engine, όχι 2 clone scripts (CHECK 3.28/N.18)· (2) G15 = μόνο dependency-hygiene ratchet, **ΟΧΙ** include dxf-viewer στο knip project (verified dead-code blindspot [[reference_knip_ignores_dxf_viewer]] — θα έσπαγε το commit flow). Επαληθεύτηκε: `test:phase3-ratchets` **18/18**, `jscpd:diff` clean σε 6 engines μαζί (κανένα clone), `license:check` exit 0 (114 pkgs), G11 `--check` OK (143/143). Βαριά gates (G3/G9/G10/G15) seed-άρονται via CI dispatch· G11 baseline committed. Uncommitted batch (Φ0/Φ1/Φ2/Φ3), commit Giorgio. **Εκκρεμεί seed dispatch + commit baselines από Giorgio** για τα CI-seeded gates.
- **2026-07-08** — Δημιουργία ADR. Orchestrator research (5 agents) πάνω στην υπάρχουσα υποδομή vs big players. Καταγραφή 15 gaps (G1–G15) σε 4 φάσεις. Καμία υλοποίηση ακόμη — roadmap μόνο, εκκρεμεί έγκριση Giorgio για σειρά προτεραιότητας + MPL-2.0 (axe-core) απόφαση.
- **2026-07-08** — **ΦΑΣΗ 0 υλοποιήθηκε (G1+G2+G13).** SSoT audit πρώτα: επιβεβαιώθηκε ότι `enterprise-ts-gate.js` + `.ts-error-baseline.json` (committed, 3005) υπάρχουν, `license-checker` ΑΠΩΝ από devDeps (silent-skip risk επιβεβαιωμένος), `quality-gates.yml.disabled` κάνει raw typecheck (όχι ratchet — αγνοήθηκε). Νέα αρχεία: `.github/workflows/{ts-error-gate,dependency-audit,license-audit}.yml`, `scripts/check-{dependency-audit,license}-ratchet.js`, `.pnpm-audit-baseline.json` (56 GHSA), `.license-allowlist.json`. Τροποποιήθηκαν: `package.json` (+license-checker@25.0.1 devDep, +4 scripts), `scripts/git-hooks/pre-commit` (CHECK 12: +pnpm-lock trigger, npx→pnpm exec, fail-closed). Όλα με pnpm· repo public → CI δωρεάν. N.17 τηρήθηκε (κανένα tsc τοπικά· ο ts-gate τρέχει μόνο σε CI).
- **2026-07-08** — **ΦΑΣΗ 2 ΟΛΟΚΛΗΡΩΘΗΚΕ (G5+G6+G14).** SSoT audit πρώτα: επιβεβαιώθηκε ότι `type-coverage`/`.bundle-size-baseline`/`.type-complexity` απόντα, `analyzeNextBuild()` export + `ts-error-budget.json` policy υπάρχουν για reuse. **Κοινός helper** `scripts/lib/ratchet-baseline.js` (parseArgs/loadBaseline/writeBaselineFile/**isRegression** direction-aware/**runRatchetCli**) — τα 3 gates θα ήταν structural clones (CHECK 3.28/N.18) → ΕΝΑ shared engine + per-gate descriptor+`measure()`. Νέα αρχεία: `scripts/check-{type-coverage,bundle-size,type-complexity}-ratchet.js`, `scripts/lib/ratchet-baseline.js`, `config/quality-gates/type-complexity-budget.json` (tolerance 3% governance SSoT), `.github/workflows/{type-coverage,bundle,type-complexity}-ratchet.yml` (seed-dispatch mechanism — seed=true → write baseline + upload artifact + echo summary, ΟΧΙ auto-commit· Giorgio committ-άρει το JSON), `scripts/__tests__/check-type-ratchets.test.js` (33 tests). Τροποποιήθηκαν: `package.json` (+`type-coverage@2.29.7` MIT pinned devDep, +6 gate scripts, +`test:type-ratchets`), `pnpm-lock.yaml`. Ratchet directions: G5 **UP** (typed % μόνο ↑, μηδέν tolerance), G6/G14 **DOWN** + tolerance (2%/3%). **Baselines ΔΕΝ committ-αρίστηκαν** — γεννιούνται στο πρώτο CI seed dispatch (N.17: ο agent δεν τρέχει tsc/build/type-coverage τοπικά). Επαληθεύτηκε: `test:type-ratchets` 33/33, `jscpd:diff` clean (κανένα clone στα 4 νέα scripts), `license:check` exit 0 (114 pkgs, type-coverage MIT). Τα gates παραμένουν inert (fail-closed «seed it») μέχρι ο Giorgio τρέξει το seed dispatch + committ-άρει τα baselines. Επόμενο: ΦΑΣΗ 3 (G3/G9-G12/G15 — εκκρεμεί απόφαση MPL-2.0 axe-core για G11).
- **2026-07-08** — **ΦΑΣΗ 2 HANDOFF ετοιμάστηκε (G5+G6+G14).** SSoT audit: `type-coverage`/`@typescript/analyze-trace`/`dependency-cruiser` απόντα (όλα MIT — περνούν G13)· `@next/bundle-analyzer@16.1.0` + `scripts/bundle-analyzer.js` (εξάγει `analyzeNextBuild()`) υπάρχουν· `config/quality-gates/ts-error-budget.json` = policy pattern για reuse (G14). Απόφαση Giorgio: **seeding via CI dispatch** (ο agent δεν τρέχει tsc/build τοπικά, N.17). Δεν υλοποιήθηκε κώδικας — πλήρες βήμα-βήμα brief στο `HANDOFFS/2026-07-08_ADR-598_Phase2-G5-G6-G14_type-bundle-ratchets_handoff.md` (ratchet directions, CI seed-job template, N.18 shared-helper προειδοποίηση, file list). Επόμενο session υλοποιεί με καθαρό context.
- **2026-07-08** — **ΦΑΣΗ 1 ΟΛΟΚΛΗΡΩΘΗΚΕ — G4 + G8 DONE.** SSoT audit πρώτα: επιβεβαιώθηκε ότι τα gate entries `jsx-a11y`/`security` υπάρχουν ήδη στο engine (fail-closed), το `.eslintrc.semantic.js` είναι legacy/un-wired (δεν αγγίχτηκε), κανένα plugin installed. Νέα αρχεία: `eslint/gates/jsx-a11y.mjs`, `eslint/gates/security.mjs`, `eslint/gates/_severity.mjs` (κοινός `downgradeToWarn` — SSoT, αποφεύγει clone μεταξύ των 2 gates / CHECK 3.28), `.eslint-jsx-a11y-baseline.json` (1148/415), `.eslint-security-baseline.json` (208/57). G4 = `eslint-plugin-jsx-a11y@6.10.2` (MIT), G8 = `eslint-plugin-security@4.0.1` (Apache-2.0) — και τα δύο pinned devDeps, πέρασαν το G13 license gate (114 pkgs, exit 0). G8 recommended ΜΕΙΟΝ `detect-object-injection` (big-players practice). Τροποποιήθηκαν: `package.json` (+2 pinned devDeps, +4 scripts), `pnpm-lock.yaml`, `.github/workflows/eslint-ratchet.yml` (matrix → `[complexity, jsx-a11y, security]` + baseline paths), `scripts/check-eslint-ratchet.js` (**engine bugfix**: `--config` additive σε ESLint 9 → νέο `rulePrefix` namespace-filter ώστε plugin gates να μη μετρούν ξένους κανόνες), `scripts/__tests__/check-eslint-ratchet.test.js` (+2 tests → 25). Επαληθεύτηκε: `test:eslint-ratchet` 25/25, `--check` exit 0 και για τα δύο, `license:check` exit 0. Heavy ESLint → CI μόνο (N.17).
- **2026-07-08** — **ΦΑΣΗ 1 ξεκίνησε — G7 DONE, generic engine.** SSoT απόφαση: αντί για 3 ξεχωριστά ratchet scripts (structural clones → θα έσκαγαν στο CHECK 3.28/N.18), **ΕΝΑ** engine `scripts/check-eslint-ratchet.js` με `--gate <name>` (GATES map: complexity+jsx-a11y+security· τα 2 τελευταία fail-closed μέχρι install plugin). Νέα αρχεία: `scripts/check-eslint-ratchet.js`, `eslint/gates/complexity.mjs`, `.eslint-complexity-baseline.json` (seed full-src), `.github/workflows/eslint-ratchet.yml` (matrix, μόνο `complexity` active). `package.json` +2 scripts (`eslint-gate:complexity` / `:baseline`). G7 = ESLint core rules (complexity/max-depth/max-params) → μηδέν νέο dependency. Heavy ESLint run → CI μόνο (N.17), ΟΧΙ pre-commit. Επαληθεύτηκε τοπικά: check-pass (exit 0) + regression-block (exit 1) + fatal-parse guard. G4/G8 PENDING (θέλουν pin plugin devDep → περνούν από το G13 license gate).

---

### 2026-08-25 — G2: **η επιφάνεια του `jspdf` μετρήθηκε· και τα 8 advisories είναι ΜΗ ΠΡΟΣΠΕΛΑΣΙΜΑ**

🔴 **Τρεις αριθμοί που κυκλοφορούσαν ήταν λάθος. Μετρημένοι από το ίδιο το JSON / δέντρο:**

| ισχυρισμός | πού γραφόταν | **μετρημένο** |
|---|---|---|
| «`jspdf` **4** critical» | `.claude-rules/pending-ratchet-work.md` | **2** critical + 6 high |
| «**10** καταναλωτές» | handoff 25/08 | **31** αρχεία παραγωγής (+8 tests) |
| `reason: "pre-existing **transitive** advisory"` | και στις 12 εγγραφές | το `jspdf` είναι **ΑΜΕΣΗ** εξάρτηση ⇒ ο λόγος δεν είναι απλώς κενός, είναι **ψευδής** για τα 8 |

#### Η επιφάνεια που ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ, έναντι αυτής που ονομάζουν τα CVE

Μετρημένο στα **31** αρχεία παραγωγής: η χρήση είναι **αποκλειστικά ο πυρήνας σχεδίασης** —
`text` (179) · `setFontSize` (121) · `setFont` (92) · `setTextColor` (88) · `line` · `rect` ·
`addImage` (13) · `output` (10) · `GState` · `Matrix` · `addFont`/`addFileToVFS` · `splitTextToSize`.

| CVE | επιφάνεια | δική μας χρήση |
|---|---|---|
| **CVE-2025-68428** *(critical, LFI/Path Traversal)* | `loadFile` / fs σε Node | **0** — μηδέν `.loadFile(`, μηδέν `allowFsRead` |
| **CVE-2026-31938** *(critical, HTML Injection «New Window»)* | `output('dataurlnewwindow')` | **0** — μόνο `blob` (9) και `arraybuffer` (3) |
| CVE-2026-24737 · CVE-2026-25940 *(AcroForm)* | AcroForm fields | **0** |
| CVE-2026-25755 *(addJS injection)* | `addJS` | **0** |
| CVE-2026-31898 *(FreeText color)* | FreeText annotation | **0** |
| CVE-2026-24133 *(BMP DoS)* | BMP decoder | **0** — `addImage` δέχεται **PNG (12)** και **JPEG (1)** |
| CVE-2026-25535 *(GIF DoS)* | GIF dimensions | **0** |

⇒ **Αυτός είναι ΠΡΑΓΜΑΤΙΚΟΣ λόγος allowlist**, όχι σφραγίδα: απαντά και τα τρία ερωτήματα
(*γιατί δεν μας φτάνει* = μηδέν χρήση των επτά επιφανειών· *γιατί δεν αναβαθμίζουμε ΑΚΟΜΗ* =
γράφει το κοινό `pnpm-lock.yaml`, απόφαση Giorgio· *πότε ξανακοιτάμε* = με την πρώτη χρήση
AcroForm/`addJS`/`html()`/BMP-GIF ή `output` σε νέο παράθυρο).

⚠️ **Το «μη προσπελάσιμο» ΔΕΝ σημαίνει «μην αναβαθμίσεις»** — σημαίνει ότι δεν είναι **επείγον**,
άρα η αναβάθμιση γίνεται **με τους όρους μας** και όχι βιαστικά.

#### Η αναβάθμιση: **μία γραμμή, μηδέν αλλαγές κώδικα** *(ερευνημένο στην πηγή)*

`jspdf ^3.0.3` (εγκατεστημένο **3.0.4**) → **`^4.2.1`** κλείνει **και τα 8** = **67%** της allowlist.

* **4.0.0** — *«File system access is now restricted by default … There are **no other breaking
  changes**»* + κατάργηση IE. **Το μοναδικό πραγματικό breaking change, και δεν μας αγγίζει**
  (μηδέν `loadFile`).
* **4.1.0 / 4.2.0 / 4.2.1** — **κανένα** breaking change· μόνο διορθώσεις ασφαλείας.
* **Τύποι ακέραιοι** (επαληθεύτηκε στο `jspdf@4.2.1/types/index.d.ts`): `export class jsPDF` +
  `export default jsPDF` · `export interface Matrix` · `export class TilingPattern` ·
  `export class GState` — **ακριβώς** οι τέσσερις μορφές που εισάγει το repo.
* **N.5 — ΑΔΕΙΑ: MIT** ✅, και **μηδέν νέες εξαρτήσεις**: τα σύνολα v3.0.4/v4.2.1 είναι
  **ταυτόσημα** (`@babel/runtime`, `fflate`, `fast-png`), με μόνη διαφορά το **προαιρετικό**
  `dompurify` 3.2.4 → 3.3.1 — που αφορά το `.html()`, **που δεν καλούμε**.

#### Παρονομαστής πριν την αλλαγή *(ώστε το «πράσινο μετά» να σημαίνει κάτι)*

`npx jest src/services/pdf src/services/report-engine src/subapps/dxf-viewer/print
src/subapps/dxf-viewer/bim/structural/detail-sheet src/subapps/dxf-viewer/bim/schedule`
⇒ **52 σουίτες / 656 tests / 10 snapshots — όλα πράσινα στο 3.0.4** (2026-08-25).

⚠️ Τα **10 snapshots** είναι το ευαίσθητο σημείο: αν το v4 αλλάξει έστω byte στη σειριοποίηση
του PDF, θα το πουν **αυτά** και όχι ο μεταγλωττιστής. Είναι ο λόγος που ο παρονομαστής
καταγράφηκε **πριν**.

#### ⛔ Εκκρεμεί απόφαση Giorgio — γράφει το κοινό `pnpm-lock.yaml`

Δεν εκτελέστηκε καμία αλλαγή σε `package.json`/lockfile (§0 του handoff· κανόνας Giorgio).

### 2026-08-25 — G2: **allowlist 12 → 4 μετρημένοι λόγοι + 8 υπό αίρεση** *(το #3, στο μέρος του που ΔΕΝ εξαρτάται από το #2)*

🔑 **Το #3 ΔΕΝ είναι ένα πράγμα — είναι δύο**, και μόνο το ένα εξαρτάται από την απόφαση jspdf:

* **8 εγγραφές `jspdf`** — **υπό αίρεση**: αν γίνει η αναβάθμιση σε `^4.2.1`, **εξαφανίζονται**.
  Παραμένουν σκόπιμα `Seeded`· οκτώ αιτιολογήσεις για εγγραφές που ίσως δεν υπάρξουν αύριο είναι
  δουλειά για πέταμα. Η **μέτρηση** τους όμως ζει παραπάνω σε αυτό το ADR, άρα δεν χάνεται
  ό,τι κι αν αποφασιστεί.
* **4 εγγραφές** (`fast-xml-parser` ×3 · `serialize-javascript` ×1) — **μένουν ό,τι κι αν γίνει**
  ⇒ αιτιολογήθηκαν **τώρα**, με μέτρηση.

#### `fast-xml-parser` ×3 — **μη προσπελάσιμο, δομικά**

Μοναδική διαδρομή (`pnpm why -r`): `firebase-admin 12.7.0 → @google-cloud/storage 7.18.0 →
fast-xml-parser 4.5.3`. **Μηδέν** άμεση χρήση `XMLParser`/`XMLBuilder` στο `src/`. Και μέσα στο
ίδιο το `@google-cloud/storage` ο **ΜΟΝΟΣ** καταναλωτής είναι το **`transfer-manager.js`**
(multipart XML API) — ενώ εμείς καλούμε **αποκλειστικά** το JSON API (`save` 408 · `delete` 480 ·
`copy` 136 · `download` 18 · streams) και **μηδέν** `TransferManager` / `uploadManyFiles` /
`downloadManyFiles`.

✅ **Και ο δρόμος διόρθωσης είναι έτοιμος και ελεγμένος**: override `"fast-xml-parser@4": "^4.5.7"`.
Το `@google-cloud/storage` δηλώνει **`^4.4.1`** ⇒ το `^4.5.7` είναι **εντός** ⇒ **δεν σπάει
καθαρό `pnpm install`** (ο έλεγχος που το ADR-598 απαιτεί ρητά). `legacy` dist-tag = **4.5.7**,
**MIT**. Εκκρεμεί μόνο επειδή γράφει το κοινό lockfile.

#### `serialize-javascript` ×1 — **build-time, και override ΑΠΑΓΟΡΕΥΕΤΑΙ**

devDependency, μοναδική διαδρομή `copy-webpack-plugin 13.0.1`. Τρέχει στο `next.config.js:261`
αντιγράφοντας **δύο σταθερά** αρχεία `pdfjs-dist` από το `node_modules` — μηδέν είσοδος
ελεγχόμενη από επιτιθέμενο, καμία εκτέλεση σε runtime παραγωγής.

🔴 **Το override ΕΛΕΓΧΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ**: patched **`>=7.0.3`** ενώ το `copy-webpack-plugin`
δηλώνει **`^6.0.2`** ⇒ ένα `^7` **παραβιάζει** το δηλωμένο range και **σπάει καθαρό
`pnpm install`** — **ακριβώς** το λάθος που αυτό το ADR απέρριψε ρητά για το `tar@7`.
Ξανακοιτάμε όταν το `copy-webpack-plugin` δηλώσει `>=7.0.3`.

⚠️ Οι λόγοι είναι **ανθεκτικοί**: το `mergeAllowlistEntry` (γρ. 166) κρατά `reason`/`owner` και
ανανεώνει μόνο τα μηχανικά πεδία. Επαληθεύτηκε ότι το diff είναι **4 γραμμές, όλες `reason`** —
καμία αναμόρφωση αρχείου. Πύλη **πράσινη** μετά (12 allowlisted).

### 2026-08-25 — G2 #4: **ο χαρακτηρισμός «νεκρό jest config» ΗΤΑΝ ΛΑΘΟΣ· το εύρημα είναι ΜΕΓΑΛΥΤΕΡΟ**

🔴 **Μετρήθηκε πριν διαγραφεί οτιδήποτε — και καλά που μετρήθηκε.**
Το `src/subapps/dxf-viewer/jest.config.ts` όντως **δεν το τρέχει καμία πύλη** (ούτε npm script,
ούτε workflow, ούτε ένα από τα 5 configs του CHECK 3.47). Αλλά «δεν το τρέχει **πύλη**» **δεν
είναι** «δεν το τρέχει **κανείς**»: **δύο handoffs** (2026-07-29 · 2026-07-30, εκστρατεία
pan-lag) το ορίζουν ρητά ως **χειροκίνητη εντολή πριν το «done»**:
`npx jest --config src/subapps/dxf-viewer/jest.config.ts <scope>`.

**Και δουλεύει.** Εκτελέστηκε το ίδιο αρχείο test και με τα δύο configs: **40/40 και στα δύο,
ταυτόσημα.** ⇒ **ΔΕΝ διαγράφεται.** Είναι thin extension της ρίζας (ADR-552, 29/06) και συμφωνεί.

#### 🔴 Το πραγματικό εύρημα: **δεύτερο manifest εφαρμογής, σε απόκλιση ολόκληρης major**

Το `src/subapps/dxf-viewer/package.json` **δεν** είναι βοηθητικό αρχείο — είναι **κανονικό pnpm
workspace package** (το `pnpm-workspace.yaml` περιλαμβάνει `src/subapps/*`), με **9 dependencies,
30 devDependencies και 46 npm scripts**. Και έχει **αποκλίνει**:

| πακέτο | ρίζα | subapp |
|---|---|---|
| `next` | **15.5.22** | **^14.2.32** |
| `react` / `react-dom` | **^19.2.1** | **^18.3.1** |
| `jest` | **^30.2.0** | **^29.7.0** |
| `jsdom` | **^27.0.0** | **^24.1.0** |
| `ts-jest` · `@napi-rs/canvas` · `@playwright/test` | νεότερα | παλαιότερα |

⇒ Το `jsdom@24.1.3` **δεν είναι απλώς «νεκρή devDependency»** — είναι **τρίτο** αντίγραφο του
jsdom στο δέντρο (ρίζα **27.3.0** · `jest-environment-jsdom` **26.1.0** · subapp **24.1.3**), και
ήταν η **δεύτερη διαδρομή** προς το ευάλωτο `tar` που έμεινε αόρατη επειδή **το `pnpm why` από τη
ρίζα δεν διασχίζει workspaces** — γι' αυτό **πάντα `pnpm why -r`**.

⚠️ Τα **46 scripts** είναι αντιγραμμένα από τη ρίζα και δείχνουν σε `scripts/seedUnits.ts`,
`scripts/generate-i18n-types.js` κ.λπ. — μονοπάτια που **δεν υπάρχουν** στο subapp.

🔶 **ΑΝΟΙΧΤΟ — απόφαση Giorgio, ΟΧΙ πράξη πράκτορα**: το ερώτημα δεν είναι «να σβήσω ένα αρχείο;»
αλλά «**πρέπει το dxf-viewer να είναι workspace package;**». Και οι δύο απαντήσεις γράφουν το
κοινό `pnpm-lock.yaml`. **Καμία αλλαγή δεν έγινε.**

#### ✅ Boy Scout που ΕΓΙΝΕ (μηδέν επίδραση σε lockfile)

`next.config.js` — αφαιρέθηκε το **`@mapbox/node-pre-gyp`** από το `serverExternalPackages`:
επαληθεύτηκε ότι **δεν υπάρχει** στο `node_modules` (έφυγε με το node-canvas, `19fbc2cc`).
Ακίνδυνη αλλά **ψευδής** εγγραφή. Το config επαληθεύτηκε ότι φορτώνει κανονικά.

### 2026-08-25 — G2: **ΕΚΤΕΛΕΣΤΗΚΕ — allowlist 12 → 1**, και το κρυμμένο εύρημα που παραλίγο να φτάσει στην παραγωγή

| | πριν | μετά |
|---|---|---|
| advisories σε allowlist | **12** (2 critical + 10 high) | **1** (high) |
| `jspdf` | 3.0.4 | **4.2.1** ⇒ −8 |
| `fast-xml-parser` | 4.5.3 | **4.5.7** (override) ⇒ −3 |
| εγγραφές με **μετρημένο** λόγο | 0 | **1/1 — καμία «Seeded»** |

Ο μηχανισμός `mergeAllowlistEntry` δούλεψε ακριβώς όπως σχεδιάστηκε: *διατηρήθηκαν 1 · seeded 0 ·
κλαδεύτηκαν 11*.

#### 🔴 ΤΟ ΕΥΡΗΜΑ: `jspdf-autotable` δήλωνε ρητά ότι **ΔΕΝ** υποστηρίζει jspdf 4

Το `pnpm install` το ανέφερε ως **απλή προειδοποίηση** — `unmet peer jspdf@"^2 || ^3": found 4.2.1`
— επειδή το `.npmrc` έχει **`strict-peer-dependencies=false`**. Δηλαδή **πέρασε αθόρυβα**.

🔴 **Και ΚΑΜΙΑ από τις 52 σουίτες / 656 tests δεν θα το έβλεπε ΠΟΤΕ**, γιατί **όλες κάνουν mock**:
`builder-pdf-exporter.test.ts` κάνει `jest.mock('jspdf')` **ΚΑΙ** `jest.mock('jspdf-autotable')`·
τα `pdf-assembler.test.ts` και `detail-pdf-renderer.test.ts` κάνουν `jest.mock('jspdf')`.
⇒ **Ο παρονομαστής για «δουλεύει η βιβλιοθήκη;» ήταν ΜΗΔΕΝ.** Τα 656 πράσινα ήταν αληθινά και
**άσχετα**: ένα mock αποδεικνύει ότι *ο δικός μας κώδικας καλεί σωστά*, **ποτέ** ότι *η
βιβλιοθήκη απαντά*. Σε αναβάθμιση **major** το δεύτερο **είναι** το ερώτημα.

Θεραπεία: `jspdf-autotable ^5.0.2 → ^5.0.8`, που δηλώνει **`"^2 || ^3 || ^4"`**. **MIT** (N.5).
Μετά τη διόρθωση η προειδοποίηση **εξαφανίστηκε** (μένει μόνο η προϋπάρχουσα, άσχετη, του `zod`).

#### ✅ Η άγκυρα που έλειπε: `src/services/pdf/__tests__/jspdf-runtime-parity.test.ts`

**8 tests, `@jest-environment node`, ΜΗΔΕΝ mocks** — ασκεί το **πραγματικό** jspdf στις μορφές
κλήσης του κώδικα παραγωγής: πυρήνας σχεδίασης · `getTextWidth`/`splitTextToSize` ·
`pdf.GState({…})` · **`addFileToVFS`+`addFont(Identity-H)`** (η διαδρομή ελληνικών του
`greek-font-loader`) · `addImage('PNG')` · **`autoTable` που ΖΩΓΡΑΦΙΖΕΙ** · έγκυρη έξοδος PDF ·
**το peer συμβόλαιο**.

⚠️ **Ο έλεγχος του autoTable απαιτεί ότι το `finalY` ΠΡΟΧΩΡΗΣΕ** — είναι ο μόνος τρόπος να
ξεχωρίσεις «έτρεξε χωρίς να πετάξει» από «ζωγράφισε».
⚠️ **Ο parser του peer range είναι FAIL-CLOSED**: καταλαβαίνει διάζευξη caret ranges και **ΠΕΤΑ**
σε ό,τι άλλο. **ΜΗΝ** τον κάνεις ανεκτικό και **ΜΗΝ** τον αντικαταστήσεις με `require('semver')`:
το `semver` **δεν είναι δηλωμένη εξάρτηση** (το `require.resolve` από τη ρίζα **αποτυγχάνει** —
λύνεται μόνο επειδή το κουβαλά το jest) και η άδειά του είναι **ISC**, εκτός της λίστας του N.5.

**Μεταλλάξεις 2/2 κόκκινες** (Μ0 πράσινο πριν ΚΑΙ μετά), στις **ΕΙΣΟΔΟΥΣ**:
Μ1 `peer → "^2 || ^3"` ⇒ **κόκκινο** (θα είχε πιάσει το πραγματικό πρόβλημα) ·
Μ2 `peer → ">=2"` ⇒ **πετά** αντί να περάσει.
⚠️ Η πρώτη απόπειρα μετάλλαξης **δεν άλλαξε τίποτα** (χάθηκε το path στο escaping του shell) και
τα «8 passed» θα διαβάζονταν ως απόδειξη — γι' αυτό ο μεταλλάκτης **ΟΥΡΛΙΑΖΕΙ** πλέον αν η τιμή
δεν άλλαξε.

⚠️ Η πρώτη γραφή της άγκυρας έγραφε `new jsPDF.GState(...)` και **έσκασε** — λάθος **του test**,
όχι breaking change: ο κώδικας παραγωγής γράφει `pdf.GState({…})`, **μέθοδο στιγμιοτύπου**.
*Άγκυρα που επινοεί δική της μορφή κλήσης καταγγέλλει τη βιβλιοθήκη για κάτι που κανείς δεν κάνει.*

#### Επαλήθευση

* **52 σουίτες / 656 tests / 10 snapshots** — πράσινα **πριν (3.0.4) και μετά (4.2.1)**, **μηδέν
  μετατόπιση snapshot**.
* **201 σουίτες / 3421 tests** σε ολόκληρο το `src/services` — πράσινα.
* Η νέα άγκυρα: **8/8**, PDF **89.051 bytes**, έγκυρη κεφαλίδα `%PDF-` και `%%EOF`.
* `@napi-rs/canvas` **devDependencies → dependencies** (το καλεί server-only κώδικας παραγωγής).

### 2026-08-25 — G2 #4 (συνέχεια): **το subapp manifest μετρήθηκε ΠΛΗΡΩΣ — δύο μηχανές, δύο απαντήσεις**

**Μετρημένο, όχι υποτεθειμένο** (`require.resolve` από τον φάκελο του subapp vs τη ρίζα):

| πακέτο | δηλώνει το subapp | **λύνεται όντως από subapp** | ρίζα | |
|---|---|---|---|---|
| `react` | ^18.3.1 | **19.2.1** | 19.2.1 | δήλωση **αγνοείται** |
| `next` | ^14.2.32 | **15.5.22** | 15.5.22 | δήλωση **αγνοείται** |
| `firebase` | ^12.2.1 | 12.7.0 | 12.7.0 | δήλωση **αγνοείται** |
| 🔴 `jsdom` | ^24.1.0 | **24.1.3** | **27.3.0** | **ΑΛΛΗ major** |
| 🔴 `jest` | ^29.7.0 | **29.7.0** | **30.2.0** | **ΑΛΛΗ major** |

🔑 **Το manifest είναι ΔΙΑΚΟΣΜΗΤΙΚΟ για τα τρία πρώτα** (ο κατάλογος του `pnpm-workspace.yaml` +
`dedupe-peer-dependents` δίνουν την έκδοση της ρίζας) **και ΠΡΑΓΜΑΤΙΚΟ για τα δύο τελευταία**.
Και το ίδιο manifest δηλώνει script **`"test": "jest"`** ⇒ όποιος τρέξει tests **από μέσα** τον
φάκελο παίρνει **jest 29 + jsdom 24**, δηλαδή **άλλη μηχανή από το CI**. Είναι το σχήμα του
**ADR-749** («δύο μηχανές, δύο αριθμοί») σε επίπεδο **εργαλείου δοκιμών**, και εξηγεί γιατί το
`jsdom@24.1.3` ήταν η **δεύτερη, αόρατη** διαδρομή προς το ευάλωτο `tar`.

#### Η ανωμαλία έχει πληθυσμό **1 στα 5**

| subapp | workspace package; |
|---|---|
| `accounting` · `geo-canvas` · `osm-building-snap` · `procurement` | **όχι** — απλοί φάκελοι, δουλεύουν κανονικά |
| **`dxf-viewer`** | **ΝΑΙ** — το μόνο |

Και **κανείς δεν το εισάγει ως πακέτο**: μηδέν αναφορές στο `nextn-dxf-viewer` σε ολόκληρο το
δέντρο. Έχει δικό του `node_modules` (**34 πακέτα / 328K**) που δεν εξυπηρετεί κανέναν
καταναλωτή.

#### 🔶 ΠΡΟΤΑΣΗ (εκκρεμεί εκτέλεση) — ευθυγράμμιση με τα τέσσερα αδέλφια του

Αφαίρεση του `src/subapps/dxf-viewer/package.json` ⇒ το subapp γίνεται απλός φάκελος όπως τα
άλλα τέσσερα· εξαφανίζονται τα **δύο** αποκλίνοντα εργαλεία (`jest 29`, `jsdom 24`) και τα **46
scripts** που δείχνουν σε ανύπαρκτα μονοπάτια.

⚠️ **ΠΡΟΫΠΟΘΕΣΕΙΣ ΠΟΥ ΕΧΟΥΝ ΗΔΗ ΕΠΑΛΗΘΕΥΤΕΙ**: το `jest.config.ts` του subapp **δουλεύει μέσω
του jest της ρίζας** (μετρημένο: 40/40 ταυτόσημα με τη διαμέριση) ⇒ **δεν εξαρτάται** από το
manifest· κανείς δεν εισάγει το πακέτο· react/next/firebase **ήδη** λύνονται από τη ρίζα.
⚠️ **ΔΕΝ ΕΚΤΕΛΕΣΤΗΚΕ**: γράφει το κοινό `pnpm-lock.yaml` και είναι **απόφαση αρχιτεκτονικής**.
⚠️ **ΜΗΝ διαγράψεις το `jest.config.ts`** — είναι τεκμηριωμένο χειροκίνητο εργαλείο (δύο handoffs)
και **δουλεύει**.

