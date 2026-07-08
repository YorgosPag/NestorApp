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
- **G6** ✅ **DONE**: reuse `analyzeNextBuild()` export του `scripts/bundle-analyzer.js` (**όχι** size-walk clone) → `.bundle-size-baseline.json` `{totalSize,chunksCount,cssSize,tolerancePct}` (ratchet **DOWN** + tolerance **2%** αποθηκευμένο ΣΤΟ baseline = SSoT) → `scripts/check-bundle-size-ratchet.js` (pure consumer του `.next`, δεν κάνει build) + `.github/workflows/bundle-ratchet.yml` (τρέχει `pnpm run build` πρώτα). Scripts: `bundle-size:check` / `:baseline`.
- **G14** ✅ **DONE**: `tsc --extendedDiagnostics --noEmit` (κανένα νέο core dep) → parse `Instantiations`/`Types` → `.type-complexity-baseline.json` (ratchet **DOWN** + tolerance **3%** από governance SSoT `config/quality-gates/type-complexity-budget.json`, μίμηση ADR-027 `ts-error-budget.json`) → `scripts/check-type-complexity-ratchet.js` + `.github/workflows/type-complexity-ratchet.yml`. `@typescript/analyze-trace@0.11.1` (MIT) προαιρετικό για hotspots — αναβλήθηκε στη Φ3 (ο ratchet δεν το χρειάζεται). Scripts: `type-complexity:check` / `:baseline`.
- **Tests** ✅: `scripts/__tests__/check-type-ratchets.test.js` (33 tests — shared lib parseArgs/loadBaseline/isRegression + των 3 gates parse/summarize/descriptor). Script: `test:type-ratchets`. Επαληθεύτηκε: 33/33 πράσινα, `jscpd:diff` clean, `license:check` exit 0 (114 pkgs). N.17 τηρήθηκε — κανένα tsc/build τοπικά (τα `measure()` legs τρέχουν μόνο σε CI/seed dispatch).

### ΦΑΣΗ 3 — Graph, coverage, a11y-tests · P0(value)–P2 · ✅ **DONE (2026-07-08)**
> **SSoT (N.18):** τα numeric-ratchet gates (G3/G15) μοιράζονται το `scripts/lib/ratchet-baseline.js` (`runRatchetCli`)· τα gate-parameterized (G9/G10) έχουν ΕΝΑ engine `--gate` (όπως το eslint engine)· jscpd:diff clean σε ΟΛΑ τα engines μαζί (κανένα clone μεταξύ depcruise/eslint/a11y/coverage/knip).
> **Seeding:** τα βαριά (G3/G9/G10/G15 — jest --coverage / depcruise / knip crawl) seed-άρονται via **CI seed dispatch** (N.17, ίδιο μηχανισμό με Φ2)· το **G11 seed-άρεται τοπικά** (γρήγορο string-scan, χωρίς tsc/build) → baseline committed.
- **G3** ✅ **DONE**: `scripts/check-coverage-ratchet.js` διαβάζει `coverage/coverage-summary.json` (πρόσθεσα `coverageReporters: ['json-summary','text-summary','lcov']` στο `jest.config.js`), gate στο **lines %** (headline number· statements/functions/branches καταγράφονται) ratchet **UP** → `.coverage-baseline.json` + `coverage-ratchet.yml` (τρέχει `test:coverage` πρώτα, `continue-on-error`). Το jest `coverageThreshold={0,0,0,0}` μένει ως hard floor· ο ratchet είναι το κινούμενο δάπεδο. Scripts: `coverage-floor:check`/`:baseline`.
- **G9 + G10** ✅ **DONE**: ΕΝΑ `.dependency-cruiser.cjs` (SSoT, rules: `no-circular` + `services-not-to-components` + `not-to-dxf-internals` [πλην public barrel `index.ts[x]`] + `no-test-utils-in-prod`) → **ΕΝΑ** engine `scripts/check-depcruise-ratchet.js --gate cycles|boundaries` (ΟΧΙ 2 clone scripts — SSoT διόρθωση όπως το eslint engine· το ADR αρχικά έλεγε `check-circular-deps-ratchet.js`+`check-arch-boundaries-ratchet.js`) → `.depcruise-{cycles,boundaries}-baseline.json` ratchet **DOWN** (seed υπαρχόντων violations, ΟΧΙ zero-tol) + `depcruise-ratchet.yml` (matrix). `dependency-cruiser@16.10.4` (MIT· **ΟΧΙ v18 — απαιτεί Node≥22, το CI τρέχει Node 20**). Scripts: `depcruise:cycles`/`:boundaries`(+`:baseline`).
- **G11** ✅ **DONE**: `scripts/check-a11y-test-coverage-ratchet.js` — **set-diff ratchet** (όπως dead-code baseline): `.a11y-coverage-baseline.json` grandfather-άρει τα υπάρχοντα uncovered (**143** σε `src/components/ui`+`generic`)· block μόνο σε **ΝΕΟ** uncovered component (zero-tol-on-touch). «Covered» = test file με axe marker που κάνει import το component. SSoT helper `src/test-utils/a11y.tsx` (`expectNoA11yViolations`). `jest-axe`(MIT)+`axe-core`(**MPL-2.0**) ήταν **ήδη** devDeps (το `license:check --production` δεν τα σκανάρει)· πρόσθεσα ρητή MPL-2.0 exception `axe-core` στο `.license-allowlist.json` (dev/test-only, **εγκρίθηκε Giorgio 2026-07-08**). Baseline seeded τοπικά + `a11y-ratchet.yml`. Scripts: `a11y-coverage:check`/`:baseline`.
- **G12** ✅ **DONE**: pre-commit **CHECK 14** (`gitleaks protect --staged` — soft: BLOCK αν το binary υπάρχει & βρει secret, αλλιώς warn· το CI είναι authoritative) + `gitleaks-scan.yml` (full-history, pinned binary v8.18.4, **ΟΧΙ** gitleaks-action για license-free) + `.gitleaks.toml` (built-in rules + allowlist test/locale/lockfile). ΟΧΙ ratchet — secrets = zero-tol. (Το ADR έλεγε «CHECK 10b» — δεν υπήρχε CHECK 10· έγινε **CHECK 14**, N.0.1 code-wins.)
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

- **2026-07-08** — **SEED-DISPATCH SCAFFOLDING FIX (G5/G6/G9/G10/G14 CI-red στο main).** Πρώτο seed dispatch αποκάλυψε **δύο bugs** στα gate workflows (μπήκαν την ίδια μέρα): **(1)** `actions/upload-artifact@v4` εξαιρεί hidden files by default (≥v4.4) → όλα τα baseline JSON είναι **dotfiles** (`.type-*`, `.depcruise-*`, `.bundle-size-*`, `.coverage-*`) → «no files found» (soft-warn, το step περνά success) → **κανένα artifact** για download παρότι το write-baseline πέτυχε· fix: `include-hidden-files: true` και στα **7** seed uploads (type-complexity/type-coverage/depcruise/bundle/coverage + round-2: knip-deps/a11y). **(2)** `type-coverage-ratchet.yml` seed/check step **χωρίς** `NODE_OPTIONS` → το type-coverage (TS compiler API) OOM στα ~4 GB default heap· fix: `--max-old-space-size=8192` (mirror των υπόλοιπων gates). Επίσης **G6 bundle** `next build` OOM στα 6144 MB → 12288 MB (ευθυγράμμιση με `docker-build.yml`, τον canonical production build· ubuntu-latest=16 GB). Seed runs που πέρασαν πριν το fix (depcruise cycles+boundaries, type-complexity) υπολογίστηκαν σωστά αλλά το artifact χάθηκε λόγω (1) → re-dispatch μετά το merge. **Round 2 (μετά το merge c39024ca):** το include-hidden-files δούλεψε (depcruise+complexity baselines κατέβηκαν & committed)· αποκαλύφθηκαν **2 ακόμη βαθύτερα bugs**: **(3)** `check-type-coverage-ratchet.js` parser regex `(\d+)/(\d+)\s+P%` δεν έπιανε το νέο type-coverage output `(N / M) P%` (παρενθέσεις) → fail-closed «no summary line» παρότι 99.40% typed· fix: `\(?…\)?` optional parens + regression test (`(1817536 / 1828437) 99.40%`). **(4)** G6 build χωρίς Firebase env → `auth/invalid-api-key` στο static page-data collection (`/api/admin/migrations/execute`)· fix: mirror του `NEXT_PUBLIC_*` block από `docker-build.yml` (browser-exposed public config, όχι secret) στο bundle build step. **Εκκρεμεί:** re-seed G5+G6 → commit τα 2 τελευταία baselines. G12 (gitleaks) χειρίζεται χωριστά ο Giorgio.
- **2026-07-08** — **ΦΑΣΗ 3 ΟΛΟΚΛΗΡΩΘΗΚΕ (G3+G9+G10+G11+G12+G15).** SSoT audit πρώτα: `dependency-cruiser`/`gitleaks`/coverage-summary reporter απόντα· `jest-axe`+`axe-core`(MPL-2.0)+`@types/jest-axe` **ήδη** devDeps (installed)· `knip.json` αγνοεί dxf-viewer **σκόπιμα**. Νέα αρχεία: `scripts/check-{coverage,depcruise,a11y-test-coverage,knip-deps}-ratchet.js`, `src/test-utils/a11y.tsx`, `.dependency-cruiser.cjs`, `.gitleaks.toml`, `.a11y-coverage-baseline.json` (seeded τοπικά, 143), `.github/workflows/{coverage,depcruise,a11y,knip-deps,gitleaks-scan}-ratchet.yml` (το gitleaks-scan χωρίς `-ratchet`), `scripts/__tests__/check-phase3-ratchets.test.js` (18 tests). Τροποποιήθηκαν: `package.json` (+`dependency-cruiser@16.10.4` MIT — **v18 απορρίφθηκε: Node≥22, CI=Node20**· +10 gate scripts +`test:phase3-ratchets`), `pnpm-lock.yaml`, `jest.config.js` (+`coverageReporters` json-summary), `.license-allowlist.json` (+`axe-core` MPL-2.0 vetted exception, Giorgio-approved), `scripts/git-hooks/pre-commit` (+CHECK 14 gitleaks soft-scan). **Δύο reality-wins αποκλίσεις από το ADR draft (N.0.1):** (1) G9/G10 = ΕΝΑ `--gate` engine, όχι 2 clone scripts (CHECK 3.28/N.18)· (2) G15 = μόνο dependency-hygiene ratchet, **ΟΧΙ** include dxf-viewer στο knip project (verified dead-code blindspot [[reference_knip_ignores_dxf_viewer]] — θα έσπαγε το commit flow). Επαληθεύτηκε: `test:phase3-ratchets` **18/18**, `jscpd:diff` clean σε 6 engines μαζί (κανένα clone), `license:check` exit 0 (114 pkgs), G11 `--check` OK (143/143). Βαριά gates (G3/G9/G10/G15) seed-άρονται via CI dispatch· G11 baseline committed. Uncommitted batch (Φ0/Φ1/Φ2/Φ3), commit Giorgio. **Εκκρεμεί seed dispatch + commit baselines από Giorgio** για τα CI-seeded gates.
- **2026-07-08** — Δημιουργία ADR. Orchestrator research (5 agents) πάνω στην υπάρχουσα υποδομή vs big players. Καταγραφή 15 gaps (G1–G15) σε 4 φάσεις. Καμία υλοποίηση ακόμη — roadmap μόνο, εκκρεμεί έγκριση Giorgio για σειρά προτεραιότητας + MPL-2.0 (axe-core) απόφαση.
- **2026-07-08** — **ΦΑΣΗ 0 υλοποιήθηκε (G1+G2+G13).** SSoT audit πρώτα: επιβεβαιώθηκε ότι `enterprise-ts-gate.js` + `.ts-error-baseline.json` (committed, 3005) υπάρχουν, `license-checker` ΑΠΩΝ από devDeps (silent-skip risk επιβεβαιωμένος), `quality-gates.yml.disabled` κάνει raw typecheck (όχι ratchet — αγνοήθηκε). Νέα αρχεία: `.github/workflows/{ts-error-gate,dependency-audit,license-audit}.yml`, `scripts/check-{dependency-audit,license}-ratchet.js`, `.pnpm-audit-baseline.json` (56 GHSA), `.license-allowlist.json`. Τροποποιήθηκαν: `package.json` (+license-checker@25.0.1 devDep, +4 scripts), `scripts/git-hooks/pre-commit` (CHECK 12: +pnpm-lock trigger, npx→pnpm exec, fail-closed). Όλα με pnpm· repo public → CI δωρεάν. N.17 τηρήθηκε (κανένα tsc τοπικά· ο ts-gate τρέχει μόνο σε CI).
- **2026-07-08** — **ΦΑΣΗ 2 ΟΛΟΚΛΗΡΩΘΗΚΕ (G5+G6+G14).** SSoT audit πρώτα: επιβεβαιώθηκε ότι `type-coverage`/`.bundle-size-baseline`/`.type-complexity` απόντα, `analyzeNextBuild()` export + `ts-error-budget.json` policy υπάρχουν για reuse. **Κοινός helper** `scripts/lib/ratchet-baseline.js` (parseArgs/loadBaseline/writeBaselineFile/**isRegression** direction-aware/**runRatchetCli**) — τα 3 gates θα ήταν structural clones (CHECK 3.28/N.18) → ΕΝΑ shared engine + per-gate descriptor+`measure()`. Νέα αρχεία: `scripts/check-{type-coverage,bundle-size,type-complexity}-ratchet.js`, `scripts/lib/ratchet-baseline.js`, `config/quality-gates/type-complexity-budget.json` (tolerance 3% governance SSoT), `.github/workflows/{type-coverage,bundle,type-complexity}-ratchet.yml` (seed-dispatch mechanism — seed=true → write baseline + upload artifact + echo summary, ΟΧΙ auto-commit· Giorgio committ-άρει το JSON), `scripts/__tests__/check-type-ratchets.test.js` (33 tests). Τροποποιήθηκαν: `package.json` (+`type-coverage@2.29.7` MIT pinned devDep, +6 gate scripts, +`test:type-ratchets`), `pnpm-lock.yaml`. Ratchet directions: G5 **UP** (typed % μόνο ↑, μηδέν tolerance), G6/G14 **DOWN** + tolerance (2%/3%). **Baselines ΔΕΝ committ-αρίστηκαν** — γεννιούνται στο πρώτο CI seed dispatch (N.17: ο agent δεν τρέχει tsc/build/type-coverage τοπικά). Επαληθεύτηκε: `test:type-ratchets` 33/33, `jscpd:diff` clean (κανένα clone στα 4 νέα scripts), `license:check` exit 0 (114 pkgs, type-coverage MIT). Τα gates παραμένουν inert (fail-closed «seed it») μέχρι ο Giorgio τρέξει το seed dispatch + committ-άρει τα baselines. Επόμενο: ΦΑΣΗ 3 (G3/G9-G12/G15 — εκκρεμεί απόφαση MPL-2.0 axe-core για G11).
- **2026-07-08** — **ΦΑΣΗ 2 HANDOFF ετοιμάστηκε (G5+G6+G14).** SSoT audit: `type-coverage`/`@typescript/analyze-trace`/`dependency-cruiser` απόντα (όλα MIT — περνούν G13)· `@next/bundle-analyzer@16.1.0` + `scripts/bundle-analyzer.js` (εξάγει `analyzeNextBuild()`) υπάρχουν· `config/quality-gates/ts-error-budget.json` = policy pattern για reuse (G14). Απόφαση Giorgio: **seeding via CI dispatch** (ο agent δεν τρέχει tsc/build τοπικά, N.17). Δεν υλοποιήθηκε κώδικας — πλήρες βήμα-βήμα brief στο `HANDOFFS/2026-07-08_ADR-598_Phase2-G5-G6-G14_type-bundle-ratchets_handoff.md` (ratchet directions, CI seed-job template, N.18 shared-helper προειδοποίηση, file list). Επόμενο session υλοποιεί με καθαρό context.
- **2026-07-08** — **ΦΑΣΗ 1 ΟΛΟΚΛΗΡΩΘΗΚΕ — G4 + G8 DONE.** SSoT audit πρώτα: επιβεβαιώθηκε ότι τα gate entries `jsx-a11y`/`security` υπάρχουν ήδη στο engine (fail-closed), το `.eslintrc.semantic.js` είναι legacy/un-wired (δεν αγγίχτηκε), κανένα plugin installed. Νέα αρχεία: `eslint/gates/jsx-a11y.mjs`, `eslint/gates/security.mjs`, `eslint/gates/_severity.mjs` (κοινός `downgradeToWarn` — SSoT, αποφεύγει clone μεταξύ των 2 gates / CHECK 3.28), `.eslint-jsx-a11y-baseline.json` (1148/415), `.eslint-security-baseline.json` (208/57). G4 = `eslint-plugin-jsx-a11y@6.10.2` (MIT), G8 = `eslint-plugin-security@4.0.1` (Apache-2.0) — και τα δύο pinned devDeps, πέρασαν το G13 license gate (114 pkgs, exit 0). G8 recommended ΜΕΙΟΝ `detect-object-injection` (big-players practice). Τροποποιήθηκαν: `package.json` (+2 pinned devDeps, +4 scripts), `pnpm-lock.yaml`, `.github/workflows/eslint-ratchet.yml` (matrix → `[complexity, jsx-a11y, security]` + baseline paths), `scripts/check-eslint-ratchet.js` (**engine bugfix**: `--config` additive σε ESLint 9 → νέο `rulePrefix` namespace-filter ώστε plugin gates να μη μετρούν ξένους κανόνες), `scripts/__tests__/check-eslint-ratchet.test.js` (+2 tests → 25). Επαληθεύτηκε: `test:eslint-ratchet` 25/25, `--check` exit 0 και για τα δύο, `license:check` exit 0. Heavy ESLint → CI μόνο (N.17).
- **2026-07-08** — **ΦΑΣΗ 1 ξεκίνησε — G7 DONE, generic engine.** SSoT απόφαση: αντί για 3 ξεχωριστά ratchet scripts (structural clones → θα έσκαγαν στο CHECK 3.28/N.18), **ΕΝΑ** engine `scripts/check-eslint-ratchet.js` με `--gate <name>` (GATES map: complexity+jsx-a11y+security· τα 2 τελευταία fail-closed μέχρι install plugin). Νέα αρχεία: `scripts/check-eslint-ratchet.js`, `eslint/gates/complexity.mjs`, `.eslint-complexity-baseline.json` (seed full-src), `.github/workflows/eslint-ratchet.yml` (matrix, μόνο `complexity` active). `package.json` +2 scripts (`eslint-gate:complexity` / `:baseline`). G7 = ESLint core rules (complexity/max-depth/max-params) → μηδέν νέο dependency. Heavy ESLint run → CI μόνο (N.17), ΟΧΙ pre-commit. Επαληθεύτηκε τοπικά: check-pass (exit 0) + regression-block (exit 1) + fatal-parse guard. G4/G8 PENDING (θέλουν pin plugin devDep → περνούν από το G13 license gate).
