# HANDOFF — Commit Coordinator για 2 παράλληλους πράκτορες (2026-07-05)

> **Ρόλος:** Είσαι ο **commit coordinator**. Δύο πράκτορες (A, B) γράφουν ταυτόχρονα αρχεία στο ίδιο git working tree. Εσύ **ξεχωρίζεις ανά domain**, περιμένεις να **σταθεροποιηθεί** η ομάδα του κάθε πράκτορα, τρέχεις τους pre-commit ελέγχους, και κάνεις **ξεχωριστό commit ανά πράκτορα**.
> **Εντολή Giorgio (μόνιμη):** commit αυτόνομα μόλις σταθεροποιείται μια ομάδα (ΔΕΝ περιμένεις ρητή εντολή commit ανά ομάδα). Γλώσσα: **Ελληνικά πάντα**.

## Κατάσταση: tree ΚΑΘΑΡΟ, 18 commits done, tip πράσινο (main, ahead of origin — ΚΑΝΕΝΑ push)

## Διαχωρισμός ανά DOMAIN
- **Agent A — «Store-factory family»** (Sessions 2-3): `stores/`, `bim/{grid,hatch,stores,columns,family-types,beams}`, `systems/{dimensions,layers}`, `ui/panels/dimensions`, `ui/ribbon/hooks/bridge/`, `hooks/`, `bim-3d/{scene,library}`. Factories: `createExternalStore` / `createConfirmStore` / `createToolBridgeStore`. Registry guards: create-confirm-store, create-tool-bridge-store.
- **Agent B — «Alignment-tracking / geometry / snapping SSoT»** (ADR-572/363): `systems/tracking`, `systems/cursor/GripAlignmentTrackingStore`, `snapping/`, `canvas-v2/preview-canvas`, `rendering/entities/shared/geometry-utils.ts`, `bim/*projection`, engine renames. Registry guard: alignment-tracking.

## 🔴🔴 ΚΡΙΣΙΜΟ ΠΡΩΤΟΚΟΛΛΟ (χωρίς αυτό επανέρχονται race/broken commits)
1. **PATH-LIMITED COMMITS ΠΑΝΤΑ:** `git commit -m ... -- <specific paths>`. Οι πράκτορες τρέχουν **`git mv` και STAGE-άρουν μόνοι τους** στο index → ένα σκέτο `git commit` σαρώνει agent-staged αρχεία που δεν διάλεξες (αυτό έσπασε το commit #8 `1997c2be` → χρειάστηκε heal `45998a0f`). Για **untracked** αρχεία: `git add <paths>` πρώτα, μετά `git commit -- <ίδια paths>`.
2. **ATOMIC renames/moves:** πριν το commit ενός rename/move, `git grep` για dangling old-name/old-path refs στο working tree (πρέπει CLEAN). Commit rename **+ ΟΛΟΥΣ τους consumers μαζί** — ποτέ σκέτο το rename.
3. **SHARED αρχείο (`.ssot-registry.json`) & 2 πράκτορες** → **hunk-split**: `git diff -- <file> | awk '/^@@ /{h++; if(h>=2) exit} {print}' > /tmp/reg-A.patch; git apply --cached /tmp/reg-A.patch; git commit -m ... ; git add <file>; git commit -m ...` (2ος agent = υπόλοιπο diff).
4. **CHECK 6D:** αρχεία σε `rendering/entities/`, `canvas-v2/dxf-canvas/DxfCanvas`, `canvas-v2/layer-canvas/LayerCanvas`, `systems/{cursor,hover,rulers-grid,snap}/`, `hooks/useKeyboardShortcuts`, `app/DxfViewer*` → απαιτούν **staged ADR** (docs/ ή ADR-*.md· το `.claude-rules/*.md` ΔΕΝ μετράει). Για step/geometry/snap → **ADR-363**. Πρόσθεσε γνήσια changelog γραμμή, μην κοροϊδεύεις το hook.
5. **N.17:** ΠΟΤΕ tsc. Jest επιτρέπεται (targeted). Ο hook τρέχει jest σε geometry areas αυτόματα.
6. **Registry guard νέο module** → `git grep` το forbiddenPattern· μηδέν matches εκτός allowlist πριν commit.

## Watcher (σκοπιά)
Script: **`/tmp/git-watch.sh`** — μπλοκάρει, ανιχνεύει αλλαγή, περιμένει **30s ησυχίας (6 samples)**, τυπώνει σταθερό snapshot. Τρέξ' το `run_in_background: true`. Μόλις χτυπήσει: σύγκρινε `stabilized` vs `live` (drift check!), attribute ανά domain, checks, path-limited commit. **Re-arm** μετά από κάθε commit.
> Προσοχή στο **drift**: αρχεία εμφανίζονται ΜΕΤΑ το σταθερό snapshot — πάντα `git status` ξανά πριν stage, και stage ΜΟΝΟ τα verified.

## Έλεγχοι ανά ομάδα (πριν commit)
Domain attribution · sizes ≤500 (config/ εξαιρείται) · μηδέν `any`/`as any`/`@ts-ignore` σε added lines · μηδέν hardcoded strings σε .tsx · CHECK 6D triggers · registry forbidden-pattern clean · rename consistency.

## Εκκρεμότητες
- **Agent A:** WAVE 2.5 (extra single-state stores + tool stores + stair-status-store) — δες `.claude-rules/pending-ratchet-work.md`.
- **Agent B:** WI-6 rotate-polar-line-paint (δες `HANDOFFS/2026-07-05_WI6-rotate-polar-line-paint.md`).
- Πιθανά νέα κύματα και από τους δύο. Κράτα τη σκοπιά.

## Git
Windows git: `"C:\Program Files\Git\cmd\git.exe"`. **ΠΟΤΕ push** (Giorgio μόνο). ΠΟΤΕ `--no-verify`. Commit co-author: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## 18 commits (νεότερο πρώτο)
d41d39aa B WI6 handoff · 1c85409e A ADR-404+backlog · 0e51a577 B ADR-572 · 7c0b8aaa B SSoT test specs · b910626d A reg tool-bridge · fea1b7a9 A 16 bridge→SSoT(−600) · b3cb... κ.λπ. (δες `git log --oneline -20`).
