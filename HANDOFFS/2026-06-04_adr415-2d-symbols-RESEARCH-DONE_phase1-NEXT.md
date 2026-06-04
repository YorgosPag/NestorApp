# HANDOFF — ADR-415 Βιβλιοθήκη 2D Αποτυπωμάτων · RESEARCH+DESIGN DONE · ΕΠΟΜΕΝΟ: Φ1 vertical slice

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus 4.8 (cross-cutting — κράτα Opus)
**Γλώσσα:** Ελληνικά πάντα.

---

## 0. ΑΜΕΣΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ

Ο Giorgio ενέκρινε **εκκίνηση Φ1** του ADR-415: βιβλιοθήκη **καθαρά διανυσματικών 2D αποτυπωμάτων** (έπιπλα/sanitary/kitchen/appliances) στον **δισδιάστατο** καμβά του DXF Viewer.

**Ροή (N.0.1):**
1. **PHASE 1 RECOGNITION** — διάβασε ADR-415 (πλήρες) + τα reuse αρχεία (§3 παρακάτω). Επιβεβαίωσε ότι ο κώδικας συμφωνεί με το ADR (code = source of truth).
2. **Plan Mode** — πλήρες plan Φ1 για έγκριση Giorgio. **ΜΗΝ** γράψεις κώδικα χωρίς approved plan (N.8: 5+ αρχεία / 2+ domains).
3. Μετά την έγκριση → υλοποίηση Φ1 vertical slice.

**COMMIT/PUSH: ΜΟΝΟ ο Giorgio (N.(-1)). Εσύ ΔΕΝ κάνεις commit.**
**⚠️ Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ `git add -A`. Άσε τον Giorgio να επιλέξει τι μπαίνει στο commit.

---

## 1. ΑΠΟΦΑΣΕΙΣ ΚΛΕΙΔΩΜΕΝΕΣ (μην τις ξανα-ανοίξεις)

- **Δ1 (Giorgio):** Τα σύμβολα **τα κατασκευάζουμε ΕΜΕΙΣ** (~90% παραμετρικά, pure-vector). CC0 SVG (publicdomainvectors/Openclipart) **μόνο** συμπληρωματικά, offline→path-data. ΟΧΙ import από CAD-block sites (Archweb/Bibliocad/cadblock.org = απαγορεύουν bundling).
- **Δ2 (Giorgio «τι θα έκανε η Revit»):** Ενιαίο **category-driven** entity. Η Revit έχει ΕΝΑ family engine + ΠΟΛΛΕΣ categories. Άρα:
  - **ΕΝΑ** νέο `EntityType` = `'floorplan-symbol'` (το «engine», render-dispatch key + κοινό pipeline = SSoT).
  - Υποχρεωτικό `category` field (`sanitary | kitchen | furniture | appliance | …`) που οδηγεί: **discipline** (ADR-405), **IFC class**, **ΑΤΟΕ/schedule**, **default 2D σύμβολο**.
  - WC → `sanitary` → discipline `plumbing` → `IfcSanitaryTerminal`. ΟΧΙ `IfcFurniture`.
  - **ΑΠΟΡΡΙΦΘΗΚΕ:** reuse του `furniture` type (αντι-Revit: θα έκανε WC «έπιπλο»). **ΑΠΟΡΡΙΦΘΗΚΕ:** type-per-object (αντι-SSoT: διπλασιασμός pipeline).
- **Δ3:** επέκταση ADR-409 με §E (2D vector symbols licensing policy).

---

## 2. ΤΙ ΕΓΙΝΕ ΤΩΡΑ (RESEARCH + DESIGN, pending commit)

- Γράφτηκε **`docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md`** (πλήρες: context, έρευνα app, έρευνα web/licensing, Δ1-Δ3, plan 6 φάσεων, εναλλακτικές, changelog).
- Ενημερώθηκε **`adr-index.md`** (2 πίνακες, entry ADR-415).
- Ενημερώθηκε μνήμη (`project_adr415_2d_floorplan_symbols.md` + MEMORY.md) + **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (ΟΜΑΔΑ ADR-415).
- **Κανένας κώδικας δεν γράφτηκε ακόμα.** Όλα τα παραπάνω είναι docs/memory, pending commit (Giorgio).

### Έρευνα app (συμπεράσματα)
- Το pipeline σημειακών BIM στοιχείων είναι **ΠΛΗΡΩΣ reusable**. Πρότυπα: **mep-fixture (ADR-406)** = pure-vector 2D symbol (ΑΥΤΟ ακολουθούμε), **furniture (ADR-410)** = mesh-based.
- Το `'block'` EntityType υπάρχει αλλά είναι **ΝΕΚΡΟ** (δεν render-άρεται, INSERT αγνοείται, κανένα BlockRecord registry). ΜΗΝ το αναστήσεις.
- **ΚΑΝΕΝΑΣ SVG/DXF importer** στο subapp (δεν χρειάζεται για Φ1-Φ5· μόνο για προαιρετική Φ6).

### Έρευνα web (licensing)
- CAD-block sites (Archweb/Bibliocad/cadblock.org) ❌ bundling. LibreCAD=CC-BY-SA, Sweet Home 3D=GPL, GSStnb/dxfBlocks=CC-BY-NC-SA → ❌.
- CC0 OK: publicdomainvectors.org (400+ SVG), Openclipart, Noun-Project CC0 subset, Kenney (game-art).
- Νομική βάση: απλά γεωμετρικά σχήματα ΟΧΙ copyrightable, διαστάσεις=facts (ADR-409 §C).

---

## 3. ΑΡΧΕΙΑ-ΠΡΟΤΥΠΑ ΓΙΑ REUSE (το pipeline υπάρχει — ΜΗΝ διπλασιάσεις, N.0.2)

| Σκοπός | Πρότυπο αρχείο | Σημείωση |
|---|---|---|
| **EntityType union (SSoT)** | `types/base-entity.ts:21-60` | πρόσθεσε `'floorplan-symbol'` |
| **Renderer registry (SSoT)** | `rendering/core/EntityRendererComposite.ts:73-143` | `this.renderers.set('floorplan-symbol', …)` |
| **Render base** | `rendering/entities/BaseEntityRenderer.ts` | `worldToScreen`, `finalizeRender` |
| **Pure-vector 2D symbol (ΤΟ ΠΡΟΤΥΠΟ)** | `bim/.../mep-fixture-symbol.ts` | γραμμές/τόξα, μηδέν mesh |
| **2D renderer με fallback** | `bim/renderers/FurnitureRenderer.ts` (`:84-106`) | authored-rectangle fallback χωρίς GLB |
| **entity-model conversion** | `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts:116` | πρόσθεσε `case 'floorplan-symbol'` |
| **Drawing tool (state-machine)** | `hooks/drawing/useFurnitureTool.ts` | mirror· `getGhostFootprint()` live preview (ADR-040) |
| **Είσοδος στη σκηνή (SSoT)** | `bim/scene/append-entity-to-scene.ts:41-55` | εκπέμπει `drawing:entity-created` |
| **Persistence host** | `app/FurniturePersistenceHost.tsx` | mirror· mount στο `DxfViewerTopBar` |
| **Catalog SSoT** | `bim/furniture/furniture-catalog.ts` | πρότυπο `FurnitureCatalogPreset` |
| **Types** | `bim/types/furniture-types.ts` | πρότυπο params/geometry |
| **Ribbon button** | `ui/ribbon/data/home-tab-draw.ts` | + contextual tab `ui/ribbon/data/contextual-furniture-tab.ts` |
| **Contextual trigger** | `app/ribbon-contextual-config.ts:150` | `activeTool === 'floorplan-symbol'` |
| **Thumbnail picker** | `ui/ribbon/hooks/useRibbonMepFixtureLibraryBridge.ts:59-96` | για Φ5 (auto 2D previews) |
| **Enterprise ID (N.6)** | `services/enterprise-id-prefixes.ts` | νέο prefix π.χ. `fpsym` + factory |
| **Discipline/Category (ADR-405)** | `config/bim-object-styles.ts` (`BimCategory`) + `bim-discipline.ts` (`DISCIPLINE_BY_CATEGORY`) | νέες categories |

---

## 4. PLAN ΦΑΣΕΩΝ (από ADR-415 §5)

- **Φ1 (ΤΩΡΑ):** Foundation + **1 σύμβολο end-to-end (WC)**. EntityType + `floorplan-symbol-types.ts` (params: `category`, `kind`, `position`, `rotationDeg`, `widthMm`, `depthMm`) + `floorplan-symbol-catalog.ts` (SSoT) + `FloorplanSymbolRenderer.ts` (pure-vector, mirror mep-fixture-symbol) + registry + `useFloorplanSymbolTool.ts` + appendEntityToScene + persistence host + enterprise-id prefix + Firestore collection + rules + index + ribbon button + contextual tab + i18n el+en + tests. tsc 0.
- **Φ2:** Sanitary pack (νιπτήρας/ντουζιέρα/μπανιέρα/μπιντές).
- **Φ3:** Kitchen pack (πάγκος/εστίες/νεροχύτης/ψυγείο).
- **Φ4:** Appliances + furniture footprints (πλυντήρια· κρεβάτι/καναπές/τραπέζι/καρέκλα ως καθαρά 2D).
- **Φ5:** Picker με auto-generated 2D thumbnails.
- **Φ6 (προαιρετικό):** DXF/SVG importer για εξωτερικά CC0 blocks.

---

## 5. ΚΑΝΟΝΕΣ ΠΟΥ ΙΣΧΥΟΥΝ ΕΔΩ

- **ADR-040** (canvas micro-leaf): ο renderer = ZERO store subscriptions. Live preview μέσω `getGhostFootprint()` (όχι state mutation). Αν αγγίξεις τα protected αρχεία → STAGE ADR-040 (CHECK 6B/6D).
- **N.6 enterprise IDs:** `setDoc()` + ID από `enterprise-id.service`. ΟΧΙ `addDoc()`.
- **N.2/N.11:** ΟΧΙ `any`, ΟΧΙ hardcoded strings → i18n keys el+en ΠΡΙΝ τη χρήση.
- **N.7.1:** ≤500 γραμμές/αρχείο, ≤40/συνάρτηση.
- **N.15:** μετά την υλοποίηση → update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-415 changelog + adr-index, ίδιο commit.
- **Tests:** mirror των existing (furniture/mep-fixture έχουν test patterns).

---

## 6. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ git (αρχή προηγ. συνεδρίας)

Modified (άλλος agent): `WallTypePreviewRenderer.ts`, `MepConnectorSnapEngine.ts`, `EditWallTypeDialog.tsx`.
Δικά μου (αυτή η συνεδρία, pending commit Giorgio): `ADR-415-*.md` (νέο), `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, μνήμη.
**ΜΗΝ commit. git add ΜΟΝΟ δικά σου.**
