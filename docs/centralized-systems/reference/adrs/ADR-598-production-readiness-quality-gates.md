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

### ΦΑΣΗ 1 — ESLint additive (κανένα νέο process, μόνο rules + ratchet) · P0–P1 · 🚧 **IN PROGRESS (2026-07-08)**
> **SSoT ΔΙΟΡΘΩΣΗ:** Τα τρία gates ΔΕΝ γίνονται 3 ξεχωριστά scripts (`check-jsx-a11y-ratchet.js` κ.λπ. όπως σκιαγραφήθηκε αρχικά) — θα ήταν structural clones (ίδιο read-baseline→run-eslint→diff→block σχήμα) και θα έσκαγαν στο δικό μας jscpd gate (CHECK 3.28 / N.18). Αντ' αυτού: **ΕΝΑ** generic engine `scripts/check-eslint-ratchet.js` επιλεγόμενο με `--gate <name>`. Νέο gate = 1 entry στο `GATES` map + 1 standalone flat config `eslint/gates/<gate>.mjs`. Κάθε gate τρέχει ESLint με ΜΟΝΟ το δικό του config (`--no-config-lookup -c`), rules=`warn`, block on rise vs `.eslint-<gate>-baseline.json`. Heavy → Layer-2 CI μόνο (N.17), ΟΧΙ pre-commit.
- **G7** ✅ **DONE**: ESLint core `complexity:['warn',{max:15}]`, `max-depth:4`, `max-params:5` → `eslint/gates/complexity.mjs` + `.eslint-complexity-baseline.json` (seed full-src) + gate `complexity` στο engine. Κανένα νέο dependency (core rules + ήδη-υπάρχων TS parser). CI: `.github/workflows/eslint-ratchet.yml` (matrix, μόνο `complexity` active). Scripts: `eslint-gate:complexity` / `:baseline`.
- **G4** ⏳ PENDING: `eslint-plugin-jsx-a11y` (recommended, `warn`). Απαιτεί pin devDep (MIT — περνά G13) + `eslint/gates/jsx-a11y.mjs` + seed `.eslint-jsx-a11y-baseline.json` + `+jsx-a11y` στο CI matrix. Gate entry ΥΠΑΡΧΕΙ ήδη στο engine (fail-closed μέχρι να εγκατασταθεί το plugin).
- **G8** ⏳ PENDING: `eslint-plugin-security` (`warn`, noisy). Ίδια δομή με G4 (`eslint/gates/security.mjs`, `.eslint-security-baseline.json`). Gate entry ΥΠΑΡΧΕΙ ήδη στο engine.

### ΦΑΣΗ 2 — Type & bundle ratchets (Layer-2 CI, N.17) · P1–P2
- **G5**: `type-coverage` → `.type-coverage-baseline.json` (ratchet **αυξάνεται**) → `check-type-coverage-ratchet.js`.
- **G6**: εξέλιξη `bundle-analyzer.js` → `.bundle-size-baseline.json` → `check-bundle-size-ratchet.js` + `bundle-ratchet.yml`.
- **G14**: `tsc --extendedDiagnostics` (`Instantiations`) → `.type-complexity-baseline.json`. Reuse `config/quality-gates/*.json` policy pattern του ADR-027.

### ΦΑΣΗ 3 — Graph, coverage, a11y-tests · P0(value)–P2
- **G3**: `check-coverage-ratchet.js` (διαβάζει `coverage-summary.json`, block αν `%` πέσει) + `coverage:baseline`. Seed baseline μέσω one-time CI run.
- **G9 + G10**: ΕΝΑ `.dependency-cruiser.cjs` για **και τα δύο** (cycles + boundaries). `check-circular-deps-ratchet.js` + `check-arch-boundaries-ratchet.js`. **Seed baseline με 112+ violations** — ΟΧΙ zero-tolerance από μέρα 1. Rules: `services/** ↛ components/**`, external `↛ subapps/dxf-viewer internals` (πλην public barrel), `test-utils ↛ prod`.
- **G11**: `check-a11y-test-coverage-ratchet.js` — zero-tolerance-on-touch για ΝΕΑ `src/components/ui/**` & `generic/**` (όχι canvas renderers).
- **G12**: `gitleaks protect --staged` (pre-commit CHECK 10b) + `gitleaks-scan.yml` (full history).
- **G15**: επέκταση `knip.json` project globs να include `src/subapps/dxf-viewer/**`· προαγωγή dep rules `warn→error` πίσω από `check-knip-deps-ratchet.js`.

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

- **2026-07-08** — Δημιουργία ADR. Orchestrator research (5 agents) πάνω στην υπάρχουσα υποδομή vs big players. Καταγραφή 15 gaps (G1–G15) σε 4 φάσεις. Καμία υλοποίηση ακόμη — roadmap μόνο, εκκρεμεί έγκριση Giorgio για σειρά προτεραιότητας + MPL-2.0 (axe-core) απόφαση.
- **2026-07-08** — **ΦΑΣΗ 0 υλοποιήθηκε (G1+G2+G13).** SSoT audit πρώτα: επιβεβαιώθηκε ότι `enterprise-ts-gate.js` + `.ts-error-baseline.json` (committed, 3005) υπάρχουν, `license-checker` ΑΠΩΝ από devDeps (silent-skip risk επιβεβαιωμένος), `quality-gates.yml.disabled` κάνει raw typecheck (όχι ratchet — αγνοήθηκε). Νέα αρχεία: `.github/workflows/{ts-error-gate,dependency-audit,license-audit}.yml`, `scripts/check-{dependency-audit,license}-ratchet.js`, `.pnpm-audit-baseline.json` (56 GHSA), `.license-allowlist.json`. Τροποποιήθηκαν: `package.json` (+license-checker@25.0.1 devDep, +4 scripts), `scripts/git-hooks/pre-commit` (CHECK 12: +pnpm-lock trigger, npx→pnpm exec, fail-closed). Όλα με pnpm· repo public → CI δωρεάν. N.17 τηρήθηκε (κανένα tsc τοπικά· ο ts-gate τρέχει μόνο σε CI).
- **2026-07-08** — **ΦΑΣΗ 1 ξεκίνησε — G7 DONE, generic engine.** SSoT απόφαση: αντί για 3 ξεχωριστά ratchet scripts (structural clones → θα έσκαγαν στο CHECK 3.28/N.18), **ΕΝΑ** engine `scripts/check-eslint-ratchet.js` με `--gate <name>` (GATES map: complexity+jsx-a11y+security· τα 2 τελευταία fail-closed μέχρι install plugin). Νέα αρχεία: `scripts/check-eslint-ratchet.js`, `eslint/gates/complexity.mjs`, `.eslint-complexity-baseline.json` (seed full-src), `.github/workflows/eslint-ratchet.yml` (matrix, μόνο `complexity` active). `package.json` +2 scripts (`eslint-gate:complexity` / `:baseline`). G7 = ESLint core rules (complexity/max-depth/max-params) → μηδέν νέο dependency. Heavy ESLint run → CI μόνο (N.17), ΟΧΙ pre-commit. Επαληθεύτηκε τοπικά: check-pass (exit 0) + regression-block (exit 1) + fatal-parse guard. G4/G8 PENDING (θέλουν pin plugin devDep → περνούν από το G13 license gate).
