# HANDOFF — ADR-417 BIM «Στέγη» (Roof) · Research+Design DONE → Φάση 1 NEXT

- **Ημερομηνία**: 2026-06-04
- **Από**: Opus 4.8 (συνεδρία έρευνας/σχεδίασης)
- **Status**: 🟢 Έρευνα + Σχεδίαση ΟΛΟΚΛΗΡΩΘΗΚΑΝ · ⏳ Υλοποίηση Φάσης 1 ΔΕΝ έχει ξεκινήσει
- **Κύριο έγγραφο (διάβασέ το ΠΡΩΤΟ)**: `docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md`

---

## ⚠️⚠️ ΚΡΙΣΙΜΟ: SHARED WORKING TREE

Το working tree **μοιράζεται με άλλον agent** αυτή τη στιγμή. ΣΥΝΕΠΩΣ:
- **ΠΟΤΕ** `git add -A` / `git add .` — **ΜΟΝΟ** specific αρχεία που έγραψες εσύ.
- Πριν αγγίξεις shared αρχεία (π.χ. `enterprise-id-prefixes.ts`, `firestore-collections.ts`, `firestore.rules`, `bim-base.ts`, i18n JSONs, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`) → πρόσεξε μη σβήσεις αλλαγές του άλλου agent. Κάνε targeted edits, ΟΧΙ overwrite.
- **ΜΗΝ** πειράξεις το `adr-index.md` αν βλέπεις ότι ο άλλος agent το επεξεργάζεται (shared-tree κανόνας μνήμης).
- **COMMIT το κάνει ο Giorgio**, ΟΧΙ ο agent (N.(-1)).

---

## 🎯 ΤΙ ΑΠΟΦΑΣΙΣΤΗΚΕ (κλειδωμένο από Giorgio — μη το ξανα-ρωτήσεις)

Directive: **«σαν Revit — FULL ENTERPRISE + FULL SSOT»**.

| # | Απόφαση |
|---|---------|
| Q1 δομή | Νέο BimElementType **`'roof'`** = ΠΑΡΑΜΕΤΡΙΚΟ entity (footprint + κλίσεις ανά ακμή) + engine `computeRoofGeometry()`. ΟΧΙ literal child-slabs (μία οντότητα = ένα lifecycle = SSoT). |
| Q2 μορφές | Και οι 4: `flat` + `mono-pitch (shed)` + `gable` + `hip`. **Hip → Φ2**. |
| Q3 σχεδίαση | **Footprint + per-edge slopes** (Revit-style): polygon κλικ-κλικ, ανά ακμή `{ definesSlope, slope, overhang }`. |
| Q4 υλικό | Μέσω **Roof Types** (ADR-412 family types). Built-ins: «Μπετονένιο δώμα» (reuse `createDefaultRoofBuildup()`) + «Κεραμοσκεπή». Στρώσεις μέσω `LayeredBuildup` SSoT. |
| Q5 μονάδες κλίσης | **Μοίρες ΚΑΙ ποσοστό**, εναλλάξιμα στο UI. |
| Q6 wall-attach | **ΑΡΓΟΤΕΡΑ** (Φ4). |
| Q8 family types | **ΝΑΙ, «Τύπος Στέγης»** (πλήρες ADR-412 plug-in). |

---

## 🗺️ ROADMAP

- **Φάση 1 (NEXT)**: flat + mono-pitch + gable · entity+engine+2D+3D+tool+grips+persistence+RoofTypes+BOQ+ribbon+i18n
- **Φάση 2**: hip (straight-skeleton solver — ridges/valleys/hips)
- **Φάση 3**: γείσο/μετώπη/ψευδοροφή, υδρορροές, grips ανά ακμή
- **Φάση 4**: wall attach-top (ADR-401/404)
- **Φάση 5**: φεγγίτες (roof-hosted openings)
- **Φάση 6**: mansard/gambrel/barrel (extrusion), dormers, freeform

---

## 🔑 ΚΡΙΣΙΜΑ ΤΕΧΝΙΚΑ ΕΥΡΗΜΑΤΑ (από επαληθευμένη έρευνα — λεπτομέρειες §2 ADR)

1. **IFC**: `IfcRoofTypeEnum` = κανονική λίστα (FLAT/SHED/GABLE/HIP/HIPPED_GABLE/GAMBREL/MANSARD/BARREL/RAINBOW/BUTTERFLY/PAVILION/DOME/FREEFORM). `IfcRoof` = container που ή αγρεγκάρει `IfcSlab` planes ή φέρει μονολιθική γεωμετρία (αμοιβαία αποκλειόμενα). → Export-ready στόχος.
2. **Revit**: κλίση/overhang/offset = ιδιότητες **ΑΝΑ ΑΚΜΗ** (flag `Defines Roof Slope`). Από ΕΝΑ footprint βγαίνουν gable/hip/shed ανάλογα ποιες ακμές είναι slope-defining.
3. **BOQ — ΠΡΟΣΟΧΗ**: επικάλυψη μετριέται με **κεκλιμένο εμβαδό (GrossArea)** = projected/cos(κλίση), ΟΧΙ με κάτοψη. Χρειαζόμαστε ΚΑΙ τα δύο (GrossArea + ProjectedArea). Η υπάρχουσα `slab-geometry.ts` δίνει μόνο projected.

---

## 🏗️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ — ΠΡΟΤΥΠΟ = SLAB (πλάκα)

Η ΠΛΑΚΑ είναι το πλησιέστερο πρότυπο (έχει footprint, στρώσεις/DNA, κλίση, 3D, grips, BOQ, family-types). **Κλώνοποίησε το pattern της.**

### 🚪 6 ΠΥΛΕΣ ΚΑΤΑΓΡΑΦΗΣ νέου 2D BIM entity (ΑΝ ΞΕΧΑΣΤΕΙ ΜΙΑ → silent drop / no hover / no select):
1. `bim/types/bim-base.ts` — `BimElementType` += `'roof'` (+ guard στο `types/entities.ts`)
2. `hooks/canvas/dxf-scene-entity-converter.ts` — `case 'roof':` (**ΚΡΙΣΙΜΟ** — αλλιώς silent-drop)
3. `rendering/core/EntityRendererComposite.ts` — register `RoofRenderer`
4. `types/entity-bounds.ts` — `case 'roof':` (culling/zoom-extents)
5. `bim/utils/bim-bounds.ts` — `case 'roof':` (marquee select)
6. `rendering/hitTesting/Bounds.ts` — `case 'roof':` (spatial index/hit-test)

### Χάρτης αρχείων-προτύπων (αντίστοιχα roof):
| Αντικείμενο | Πρότυπο (slab) |
|---|---|
| types/schema | `bim/types/slab-types.ts`, `slab.schemas.ts` |
| στρώσεις | `bim/types/slab-dna-types.ts` (`createDefaultRoofBuildup`!), `layered-buildup.ts` |
| 2D renderer | `bim/renderers/SlabRenderer.ts` |
| 2D geometry | `bim/geometry/slab-geometry.ts`, `slab-slope.ts` |
| 3D mesh | `bim-3d/converters/BimToThreeConverter.ts` (`slabToMesh`), `slab-multilayer-solid-3d.ts`, `mesh-slope-shear.ts` |
| drawing tool | `hooks/drawing/useSlabTool.ts`, `slab-completion.ts` |
| factory | `src/services/factories/slab.factory.ts` |
| grips | `bim/slabs/slab-grips.ts` |
| persistence | `bim/slabs/slab-firestore-service.ts`, `hooks/data/useSlabPersistence.ts` |
| enterprise id | `src/services/enterprise-id-prefixes.ts` (prefix), `enterprise-id-convenience.ts` |
| collection | `src/config/firestore-collections.ts` (`FLOORPLAN_SLABS` → νέο `FLOORPLAN_ROOFS`) |
| BOQ | `bim/config/bim-to-atoe-mapping.ts`, `hooks/data/slab-boq-feed.ts` |
| ribbon | `ui/ribbon/data/home-tab-draw.ts`, `contextual-slab-tab.ts` |
| family types | `bim/types/bim-family-type.ts`, `bim/family-types/built-in-types.ts`, `slab-type-auto-assign.ts`, `edit-slab-type-store.ts`, `useSlabTypeReresolution.ts` |
| i18n | `src/i18n/locales/{el,en}/dxf-viewer-shell.json`, `tool-hints.json` |

### Sibling reference (path-based parametric, μηχανή γεωμετρίας):
- **ADR-407 Railings** — `computeRailingGeometry` engine = το ΠΡΟΤΥΠΟ για `computeRoofGeometry` (pure SSoT engine που παράγει γεωμετρία από path+type).

---

## ✅ ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (project-specific)

- **N.6**: Firestore writes ΜΟΝΟ με `setDoc()` + enterprise-id (νέο generator `generateRoofId`, prefix `roof`). ΟΧΙ `addDoc`.
- **N.7.1**: αρχεία ≤500 γραμμές, functions ≤40 γραμμές.
- **N.11**: ΟΧΙ hardcoded strings — όλα μέσω `t()`, κλειδιά πρώτα σε `el` + `en`.
- **N.2/N.3**: ΟΧΙ `any`, ΟΧΙ inline styles.
- **ADR-040**: τα 2D renderer/scene-converter/bounds αγγίζουν canvas pipeline → **STAGE ADR-040** (CHECK 6B/6D blocking).
- **ADR-001**: dropdowns = `@/components/ui/select` (Radix). Option «χωρίς τύπο»/parametric = `SELECT_CLEAR_VALUE`, ΟΧΙ `''`.
- Νέα index Firestore × όσα queries → deploy.

---

## 📌 ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — όλα στο ίδιο commit με κώδικα):
1. ADR-417 changelog + status → IMPLEMENTED
2. `adr-index.md` (αν δεν το πειράζει άλλος agent)
3. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
4. `~/.claude/projects/C--Nestor-Pagonis/memory/MEMORY.md` (entry ADR-417)

---

## ▶️ ΕΚΤΕΛΕΣΗ
- **N.8**: Φάση 1 = ~30–40 αρχεία, 2+ domains → **Orchestrator** (εγκεκριμένο από Giorgio στο handoff prompt). Ή Plan Mode αν προτιμηθεί.
- **N.14**: Opus 4.8 (σωστό μοντέλο για cross-cutting υλοποίηση).
- **Status ADR-417 πριν ξεκινήσεις**: ACCEPTED (design), έρευνα+αποφάσεις έτοιμες.
