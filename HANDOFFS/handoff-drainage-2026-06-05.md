# 🚰 HANDOFF — Σύστημα Αποχέτευσης (ADR-408 Φ14) — 2026-06-05

> **Ρόλος σου σε αυτή τη νέα συνεδρία:** Είσαι ο **agent της ΑΠΟΧΕΤΕΥΣΗΣ**. Ασχολείσαι
> ΑΠΟΚΛΕΙΣΤΙΚΑ με drainage (ADR-408 Φ14). **ΟΧΙ** καλοριφέρ/θέρμανση — αυτό το χειρίζεται
> παράλληλος **codex agent**. Quality bar (εντολή Giorgio): **FULL ENTERPRISE + FULL SSOT,
> Revit-grade («όπως οι μεγάλοι παίκτες»)**.

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ
- **SHARED WORKING TREE** με codex (heating). → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **ΟΧΙ COMMIT, ΟΧΙ PUSH** — ο Giorgio κάνει commit (N.(-1)). Εσύ μόνο προετοιμάζεις.
- Απαντάς **στα Ελληνικά** πάντα.
- N.14: πριν από non-trivial task → δήλωσε μοντέλο + περίμενε «ok».
- Τα shared αρχεία (`ribbon-contextual-config.ts`, `i18n/.../dxf-viewer-shell.json`, `ifc-entity-mixin.ts`)
  τα επεξεργάζεσαι **additive-only** (codex προσθέτει radiator keys στα ίδια αρχεία).

---

## ✅ ΤΙ ΕΧΕΙ ΓΙΝΕΙ

### Ήδη committed (commit `e163d610`)
- Φρεάτιο = `mep-manifold` entity, νέο kind `'drainage-collector'` (N είσοδοι + 1 έξοδος — αντίστροφο
  του συλλέκτη ύδρευσης). Drain pipe tool `mep-drain-pipe`. 2D σύμβολο σχάρα/grating. Τετράγωνο
  footprint default 450mm. Connectors kind-aware. Snap/persistence/discipline ΟΚ. **Browser-verified.**

### Slice #1 — Contextual tab φρεατίου kind-aware — **DONE, UNCOMMITTED** (αυτή η συνεδρία)
FULL SSOT via factory (Revit «κάθε family = δικό του palette, κοινός bridge»). Επιλέγεις φρεάτιο →
tab **«Ιδιότητες Φρεατίου»**, panel **«Είσοδοι»** (όχι «Έξοδοι»), τετράγωνα presets (450 ορατό),
DN διάμετροι (DN100/DN125), χωρίς classification panel. Συλλέκτης ύδρευσης **αμετάβλητος**.
Ποιότητα: **tsc 0 δικά μου** (exit 0) · factory test **7/7** · manifold regression **33/33**.

**Uncommitted αρχεία slice #1 (όλα δικά σου — τα έχει ο Giorgio να κάνει commit):**
- 🆕 `src/subapps/dxf-viewer/ui/ribbon/data/mep-manifold-contextual-tab-factory.ts`
- 🆕 `src/subapps/dxf-viewer/ui/ribbon/data/contextual-drainage-collector-tab.ts`
- 🆕 `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/mep-manifold-contextual-tab-factory.test.ts`
- ✏️ `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-manifold-tab.ts`
- ✏️ `src/subapps/dxf-viewer/app/ribbon-contextual-config.ts` *(SHARED με codex — additive)*
- ✏️ `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepManifoldBridge.ts`
- ✏️ `src/subapps/dxf-viewer/bim/types/mep-manifold-types.ts` *(NEW drainage default consts)*
- ✏️ `src/subapps/dxf-viewer/hooks/drawing/mep-manifold-completion.ts` *(kind-gated defaults)*
- ✏️ `src/i18n/locales/el/dxf-viewer-shell.json` *(SHARED — additive)*
- ✏️ `src/i18n/locales/en/dxf-viewer-shell.json` *(SHARED — additive)*

🔴 **#1 PENDING browser verify** (ο Giorgio διάλεξε να συνεχίσει χωρίς verify). Όταν θες:
επίλεξε φρεάτιο → «Ιδιότητες Φρεατίου»/«Είσοδοι»· επίλεξε συλλέκτη → ίδιος όπως πριν.

---

## 📋 ΤΟ ΣΧΕΔΙΟ ΑΠΟΧΕΤΕΥΣΗΣ (4 items — εγκεκριμένα από Giorgio)

| # | Θέμα | Status | Μοντέλο |
|---|---|---|---|
| #1 | Contextual tab φρεατίου kind-aware | ✅ DONE (uncommitted) | — |
| **#3** | **3D σχάρα φρεατίου** | **⬅️ ΕΠΟΜΕΝΟ** | Sonnet |
| #5+#6 | IFC `IfcFlowStorageDevice` + cosmetics | ⬜ TODO | Sonnet |
| #2 | Πραγματική κλίση σωλήνα (slopePercent→geometry) | ⬜ TODO (βαρύ, τελευταίο) | **Opus** |
| #4 | BOQ/ΑΤΟΕ | 🚫 BLOCKED (χρειάζεται ΗΛΜ code· τα ΑΤΟΕ έχουν μόνο ΟΙΚ) | — |

---

## ⬅️ ΕΠΟΜΕΝΟ: #3 — 3D ΣΧΑΡΑ ΦΡΕΑΤΙΟΥ

**Πρόβλημα:** Στο 2D το φρεάτιο έχει σχάρα/grating· στο **3D είναι σκέτο καφέ extruded box** → 2D/3D ασυνεπή.

**Σημεία-κλειδιά:**
- 3D mesh: `bim-3d/converters/bim-three-point-converters.ts` → `manifoldToMesh` (~γρ.101-130). Για
  `drainage-collector`: `new THREE.Mesh(geo, getSystemTintedMaterial3D('mep-manifold', 0xb45309))` —
  μόνο extruded footprint, **καμία σχάρα**.
- 2D grating SSoT (να το reuse-άρεις): `bim/mep-manifolds/mep-manifold-symbol.ts` →
  `buildDrainageGratingStrokes(v0..v3)` (ήδη exported) + `buildMepManifoldSymbol` (`gratingStrokes`).
- Test (μόνο floor-manifold τώρα): `bim-3d/converters/__tests__/mep-manifold-mesh.test.ts` → πρόσθεσε
  drainage-collector case.
- **Στόχος:** πάνω όψη του basin να δείχνει τις παράλληλες ράβδους σχάρας (lines ή λεπτά extruded bars),
  reuse του ΙΔΙΟΥ `buildDrainageGratingStrokes` (μηδέν διπλή geometry). WYSIWYG με το 2D.
- **ADR-040:** `bim-3d/converters/` είναι **ΕΚΤΟΣ** του micro-leaf list (επιβεβαίωσε με CHECK 6D pattern).
  Πιθανότατα **ΔΕΝ** χρειάζεται ADR-040 staging.

## #5+#6 — IFC + cosmetics (μετά το #3)
- IFC: `bim/types/mep-manifold-types.ts` → `ifcType` fixed `'IfcPipeFitting'` και για τα 2 kinds (~γρ.150).
  Φρεάτιο → `IfcFlowStorageDevice` (sump/catch basin) ή PredefinedType. Δες `bim/types/ifc-entity-mixin.ts`
  (union+values+zod· **SHARED** — codex πρόσθεσε `IfcSpaceHeater`· additive-only).
- Cosmetics: `mep-manifold-symbol.ts` `buildMepManifoldSymbol` τοπικά ονόματα (`inletRoot`, σχόλιο
  "Outlet stubs") παραπλανητικά για φρεάτιο — απλό rename/σχόλια.

## #2 — Πραγματική κλίση σωλήνα (βαρύ, Opus, ΤΕΛΕΥΤΑΙΟ)
- `slopePercent` αποθηκεύεται (`bim/types/mep-segment-types.ts:114`, `DEFAULT_DRAINAGE_SLOPE_PERCENT=1.5`)
  + editable (`contextual-mep-segment-tab.ts`), αλλά **καμία επίδραση** σε geometry/3D:
  `mep-segment-geometry.ts` (`computeMepSegmentGeometry`) το αγνοεί· `mep-segment-to-mesh.ts` διαβάζει
  `resolveSegmentEndpointElevationsMm` (startPoint.z/endPoint.z) απευθείας.
- **Αρχιτεκτονική απόφαση (Revit):** η κλίση παράγεται από τα endpoint elevations Ή τα οδηγεί;
  Θέλει Plan Mode + Opus. **ΜΗΝ ξεκινήσεις χωρίς ρητή έγκριση μοντέλου.**

---

## 🧠 ΤΕΧΝΙΚΟ ΥΠΟΒΑΘΡΟ
- Φρεάτιο = `mep-manifold` με `params.kind === 'drainage-collector'` (guard: `isDrainageCollectorKind`).
- Connector layout kind-aware: `bim/mep-manifolds/mep-manifold-geometry.ts` → `buildMepManifoldConnectors`
  (drainage: 1 outlet `outletDiameterMm` + N branch inlets `inletDiameterMm`· `outletCount` = #εισόδων).
- Drainage defaults: `mep-manifold-types.ts` (`DEFAULT_DRAINAGE_COLLECTOR_*`: SIZE 450, BODY_HEIGHT 300,
  INLET_COUNT 2, INLET_DIAMETER 100, OUTLET_DIAMETER 125).
- Contextual tab factory: `ui/ribbon/data/mep-manifold-contextual-tab-factory.ts` — και τα 2 tabs απ' εδώ.
- Bridge (κοινός): `ui/ribbon/hooks/useRibbonMepManifoldBridge.ts` (routing ανά command key, όχι ανά trigger).

## 📌 TRACKERS να ενημερωθούν στο commit boundary (N.15)
- `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md` (changelog — SHARED, additive)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (master tracker)
- `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` (αν χρειαστεί)
- ΟΧΙ `adr-index.md` (shared tree).

## ✔️ ΕΝΤΟΛΕΣ ΕΛΕΓΧΟΥ
- tsc (own): `npx tsc --noEmit 2>&1 | grep -iE "<touched files>" || echo NO_OWN_TSC_ERRORS`
- tests: `npx jest <path> --silent`
- Pre-existing tsc errors (αγνόησε): `mesh-to-object3d.ts:124` (ADR-411)· τυχόν `mep-radiator` (codex).
