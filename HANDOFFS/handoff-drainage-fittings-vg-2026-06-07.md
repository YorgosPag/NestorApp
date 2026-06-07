# 🚰 HANDOFF — Αποχέτευση (ADR-408 Φ14): Drainage Fittings V/G + χρώμα consistency — 2026-06-07

> **Ρόλος σου σε αυτή τη νέα συνεδρία:** Είσαι ο **agent της ΑΠΟΧΕΤΕΥΣΗΣ** (ADR-408 Φ14).
> Ασχολείσαι ΑΠΟΚΛΕΙΣΤΙΚΑ με drainage. **ΟΧΙ** καλοριφέρ/θέρμανση — αυτό το χειρίζεται παράλληλος
> **codex agent** στο ίδιο working tree.

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ
- **SHARED WORKING TREE** με codex (heating). → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **ΟΧΙ COMMIT, ΟΧΙ PUSH** — ο Giorgio κάνει commit (N.(-1)). Εσύ μόνο προετοιμάζεις + αναφέρεις.
- Απαντάς **στα Ελληνικά** πάντα.
- Quality bar (εντολή Giorgio): **FULL ENTERPRISE + FULL SSOT, Revit-grade («όπως οι μεγάλοι παίκτες»)**.
- N.14: πριν από non-trivial task → δήλωσε μοντέλο + περίμενε «ok». Αυτό το task = **Plan Mode + Sonnet/Opus**.
- Τα SHARED αρχεία (i18n, `RibbonPanel.tsx`, config enums) → **additive-only** (ο codex co-edits).

---

## ✅ ΤΙ ΕΧΕΙ ΓΙΝΕΙ ΣΤΗΝ ΑΠΟΧΕΤΕΥΣΗ (όλο το σχέδιο 4 items + V/G — uncommitted ή commit από Giorgio)

Το **εγκεκριμένο 4-item σχέδιο ΟΛΟΚΛΗΡΩΘΗΚΕ** + ένα extra V/G slice:

| # | Θέμα | Status |
|---|---|---|
| #1 | Contextual tab φρεατίου kind-aware | ✅ DONE |
| #3 | 3D σχάρα φρεατίου (grating στην πάνω όψη basin) | ✅ DONE |
| #5 | IFC `IfcFlowStorageDevice` για φρεάτιο (kind-dependent, SSoT `resolveManifoldIfcType`) | ✅ DONE |
| #6 | Cosmetics (rename `inletRoot`→`singleStub*` κλπ στο symbol) | ✅ DONE |
| #2 | **Πραγματική κλίση σωλήνα** (slopePercent = derived+invertible projection του per-endpoint z· 3D-aware BOQ length· born-sloped creation· 2D slope arrow) | ✅ DONE |
| — | **V/G toggle «Αποχέτευση»** (νέα `BimCategory 'drain-pipe'` παραγόμενη από classification· View-tab toggle· 2D+3D segment category) | ✅ DONE |
| #4 | BOQ/ΑΤΟΕ | 🚫 BLOCKED (χρειάζεται κωδικός ΗΛΜ· τα ΑΤΟΕ έχουν μόνο ΟΙΚ) |

**Κρίσιμα artifacts από το V/G work (θα τα χρησιμοποιήσεις/επεκτείνεις):**
- NEW `BimCategory 'drain-pipe'` στο `config/bim-object-styles.ts` (union + BIM_CATEGORIES + MODEL_BIM_CATEGORIES + DEFAULT_OBJECT_STYLES).
- `bim-discipline.ts`: `'drain-pipe' → 'plumbing'`. `bim-subcategories.ts`: `'drain-pipe': []`.
- NEW SSoT `resolveSegmentBimCategory(params)` στο `bim/types/mep-segment-types.ts` (`domain==='pipe' && classification==='sanitary-drainage' → 'drain-pipe'`, αλλιώς domain). Χρησιμοποιείται σε 2D `MepSegmentRenderer` + 3D `sync-mep-elements` (`syncMepSegments`).
- NEW `ui/ribbon/components/DrainPipeToggle.tsx` + route στο `RibbonPanel.tsx` + `DRAIN_PIPE_BUTTON` στο `view-tab-bim-settings.ts` + i18n `drainPipe.*` (el/en) + `objectStyles.categories['drain-pipe']`.
- Καφέ χρώμα σωλήνα = `resolveSegmentClassificationColor(classification)` στο `bim/mep-systems/mep-system-color.ts` (drainage `#b45309`).

> Σημ: αν ο Giorgio έχει ήδη κάνει commit, αυτά είναι στο ιστορικό. Αν όχι, είναι uncommitted στο tree.

---

## ⬅️ ΕΠΟΜΕΝΟ TASK: Drainage Fittings — V/G + χρώμα consistency

### Πρόβλημα (2 πλευρές, ίδια ρίζα)
Τα **auto-fittings** (`mep-fitting`: γωνίες/ταυ/συστολές που παράγονται αυτόματα στους κόμβους σωλήνων,
ADR-408 Φ11) **δεν ξέρουν ότι ανήκουν σε δίκτυο αποχέτευσης**:
1. **V/G**: παίρνουν `BimCategory = fitting.params.domain` = `'pipe'` → ένα drainage elbow **ΔΕΝ κρύβεται**
   με το νέο toggle «Αποχέτευση» (ασυνέπεια με τους σωλήνες που μόλις φτιάχτηκαν).
2. **Χρώμα**: render-άρονται με το domain palette **amber/copper**, ΟΧΙ **καφέ** σαν την αποχέτευση.

Τα fittings φέρουν `incidents[].entityId` = FK στα γειτονικά `mep-segment` (βλ. `bim/types/mep-fitting-types.ts`,
helper `incidentEntityId`). Δηλαδή η classification είναι **παραγώγιμη** από τα incident pipes (Revit: «το
fitting ανήκει στο Pipe System των σωλήνων που ενώνει»).

### Συνιστώμενη αρχιτεκτονική (Revit-true, FULL SSOT) — επικύρωσέ την σε Plan Mode
**Approach A — stamp classification στο fitting κατά το auto-reconciliation** (καθαρότερο):
- Ο reconciler που παράγει τα fittings (ψάξε `useMepFittingAutoReconciliation` + `resolveDesiredFittings` /
  `mep-pipe-network-derive`) ΗΔΗ διαβάζει τα incident segments → εκεί που χτίζει το fitting, **κληρονόμησε
  `classification`** από τα incident drainage pipes (αν ≥1 incident είναι `sanitary-drainage` → το fitting
  γίνεται drainage· Revit «source/system owns, fitting inherits»).
- Πρόσθεσε `MepFittingParams.classification?` (zod optional, mirror του `MepSegmentParams.classification`).
- NEW SSoT `resolveFittingBimCategory(params)` (mirror του `resolveSegmentBimCategory`): drainage→'drain-pipe'.
  Χρησιμοποίησέ το σε **2D `MepFittingRenderer`** (αντί `category: fitting.params.domain`, ~γρ.89) **+ 3D
  `syncFittings`** (`sync-mep-elements.ts`, `fitting.params.domain as BimCategory`).
- **Χρώμα**: στο `MepFittingRenderer` χρησιμοποίησε `resolveSegmentClassificationColor(classification)` (ή
  ένα κοινό shared resolver) ώστε drainage fitting = καφέ, ίδιο με τον σωλήνα. Στο 3D, αν χρειάζεται, ίδιο
  pattern (αλλά το 3D material μένει `elem-mep-pipe` — η αλλαγή είναι μόνο visibility/2D-colour· επιβεβαίωσε).

**Approach B (απορρίφθηκε αρχικά)**: render-time scene lookup των incident classifications στον renderer —
οι renderers δεν έχουν εύκολη scene access· λιγότερο SSoT. Προτίμησε A.

⚠️ **Idempotency**: ο reconciler είναι idempotent BY `junctionKey` — η προσθήκη `classification` ΔΕΝ πρέπει
να σπάσει το dedupe/self-heal (μην μπει το classification στο junctionKey). Δες memory
[[project_adr408_phi11_auto_fittings]].

### Key files (research targets)
- `bim/types/mep-fitting-types.ts` — params + `MepFittingIncident` + `incidentEntityId`.
- `bim/types/mep-fitting.schemas.ts` (ή αντίστοιχο) — zod, πρόσθεσε `classification?`.
- Reconciler: `useMepFittingAutoReconciliation` + `resolveDesiredFittings` / `mep-pipe-network-derive` (ψάξε).
- 2D: `bim/renderers/MepFittingRenderer.ts` (~γρ.89 category, + DOMAIN_STROKE/DOMAIN_FILL χρώμα). **STAGE ADR-040** (CHECK 6D — 2D entity renderer).
- 3D: `bim-3d/scene/sync-mep-elements.ts` → `syncFittings` (`fitting.params.domain as BimCategory`, ~γρ.87).
- Πρότυπα προς mirror: `resolveSegmentBimCategory` + `resolveSegmentClassificationColor` (ΗΔΗ υπάρχουν).

### Tests
- NEW `resolveFittingBimCategory` unit (drainage→'drain-pipe', pipe→'pipe', duct→'duct').
- Reconciler test: fitting σε κόμβο drainage pipes → κληρονομεί `classification: 'sanitary-drainage'`·
  idempotency ανέπαφο (ίδιο junctionKey set).
- MEP regression (`bim/mep-segments`, `bim/mep-systems`, `bim/mep-fittings` αν υπάρχει).

### ADR-040
Μόνο το `MepFittingRenderer.ts` είναι 2D entity renderer → **STAGE ADR-040** στο commit (CHECK 6D).
Τα υπόλοιπα (types/schemas/reconciler/3D sync) εκτός.

---

## ✔️ ΕΝΤΟΛΕΣ ΕΛΕΓΧΟΥ
- tsc (own): `npx tsc --noEmit 2>&1 | grep -iE "<touched files>" || echo NO_OWN_TSC_ERRORS`
- tests: `npx jest <path> --silent`
- Pre-existing tsc errors (αγνόησε): `mesh-to-object3d.ts:124` (ADR-411)· τυχόν `mep-radiator`/`mep-boiler` (codex).

## 📌 TRACKERS στο commit boundary (N.15 — κάνει ο Giorgio)
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-408 changelog (SHARED, additive) + memory `project_adr408_phi14_drainage.md`.
**ΟΧΙ** `adr-index.md` (shared tree). git add ΜΟΝΟ δικά σου.

## 🧠 Σχετικές μνήμες
`project_adr408_phi14_drainage` (master), `project_adr408_phi11_auto_fittings` (reconciler/idempotency),
`project_adr408_mep_connectors_systems` (color-by-system).
