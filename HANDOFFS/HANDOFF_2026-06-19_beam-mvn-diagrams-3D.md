# HANDOFF — Beam M/V/N διαγράμματα στον 3Δ καμβά (mirror των κολωνών, ADR-483 Slice 6)

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent (ADR-499/502/503/504 = structural/codes/sizing). `git add` **ΜΟΝΟ δικά σου**, **ΠΟΤΕ `git add -A`**. **ΜΗΝ αγγίξεις** `bim/structural/codes/*`, `bim/structural/sizing/*`, `bim/structural/organism/*`, `AutoSizeMembersCommand.ts`, `member-auto-size-core.ts`, `ADR-499/502/503/504*`. Το shared tree **επαναφέρει αρχεία** mid-session — αν δεις edit σου να εξαφανίζεται, ξανακάν' το.

---

## 0. ΣΤΟΧΟΣ
Render των **beam M/V/N διαγραμμάτων στον 3Δ καμβά**, **ΑΚΡΙΒΩΣ όπως ήδη εμφανίζονται οι κολώνες σε 3Δ** (ADR-483 Slice 5). Τα beam διαγράμματα **ήδη υπάρχουν σε 2Δ κάτοψη**· λείπει μόνο η 3Δ απόδοση. **Full enterprise + full SSoT, Revit/Robot-grade.** Είναι ρητό **DEFER της ADR-483 §10.5**: «δοκάρια σε 3Δ (ήδη φαίνονται σε κάτοψη)».

**ΟΡΑΜΑ (ADR-487):** η εφαρμογή = «επιβλέπων μηχανικός» — τα M/V/N είναι το κύριο visual feedback. Το ίδιο toggle κρατά το FEM live (ADR-488 `isAnalysisEngaged`), οπότε τα beam-3D ενημερώνονται σε κάθε δομική αλλαγή χωρίς νέα υποδομή.

---

## 1. 🔴 SSoT AUDIT — ΕΓΙΝΕ ΗΔΗ (grep, 2026-06-19). ΕΠΑΛΗΘΕΥΣΕ τα paths με Read πριν γράψεις (shared tree μπορεί να τα μετακίνησε). ΜΗΝ ξαναψάχνεις από το μηδέν — ΜΗΝ δημιουργήσεις διπλότυπα.

### REUSE AS-IS (καμία αλλαγή — import & χρήση):
| SSoT | Τι δίνει |
|---|---|
| `bim/structural/analytical/diagrams/member-diagram-sampling.ts` | **member-generic** (beam ΚΑΙ column): `DiagramComponent`, `DiagramSample`, `clamp01`, `selectCombination`, `dominantMomentKey`, `dominantShearKey`, `stationValue`. Εξήχθη ΑΚΡΙΒΩΣ για 2Δ-beam+3Δ-column SSoT de-dup (ADR-483 §10.1). Ο beam-3D builder το καταναλώνει **ίδια με τον column builder, μηδέν αλλαγή.** |
| `bim/structural/analytical/analytical-model-types.ts` | `AnalyticalPoint3D{xM,yM,zM}`, `AnalyticalModel`, `AnalyticalMember` (`memberType==='beam'`) |
| `bim/structural/analytical/solver/*` (analysis-results-store, solver-types) | `AnalysisResult`, `DiagramStation`, `MemberForceResult.diagram`. **Ίδια πηγή δεδομένων με κολώνες** — `memberType` διακρίνει beam/column. |
| `state/analysis-diagram-view-store.ts` | `showAnalysisDiagrams` (toggle) + `diagramComponent` ('moment'/'shear'/'axial'). **ΚΑΝΕΝΑ νέο toggle/ribbon button/store field.** Το ίδιο toggle οδηγεί 2Δ-beam + 3Δ-column + (νέο) 3Δ-beam. |
| `bim-3d/stores/ViewMode3DStore.ts` | `mode` — gate `mode !== '2d'` (ίδιο με κολώνα· συμπληρωματικό του 2Δ `mode==='2d'`, μηδέν overlap). |
| `bim-3d/diagrams/column-diagram-3d-mesh.ts` → `COLUMN_DIAGRAM_COLORS`, `FILL/OUTLINE/LABEL_RENDER_ORDER (9990/9991/10000)`, `fillMesh`, `makeTextSprite`, `billboardColumnDiagrams` | χρώματα/render-order/helpers/billboard. **Βλ. §3 για το ποια να ΕΞΑΓΕΙΣ σε shared utils.** |
| `bim-3d/systems/section/section-parity-overlay.ts` → `isSectionParityOverlay` | **ΑΥΤΟΜΑΤΑ εξαιρεί** ό,τι έχει `depthTest:false` ή είναι Sprite από τα section stencil-parity passes. Άρα αν ο beam-3D χρησιμοποιεί `depthTest:false` (όπως ΠΡΕΠΕΙ), **δεν χρειάζεται καμία ρύθμιση** — το bug «διαγράμματα αλλάζουν χρώμα με τομή» δεν θα ξανασυμβεί. |
| `rendering/core/UnifiedFrameScheduler.ts` | per-frame billboard register (`RENDER_PRIORITIES.LOW` + camera-dirty predicate). |
| `bim-3d/proposal/ProposalGhost3DOverlay.tsx` | το lifecycle template πάνω στο οποίο χτίστηκε ο column overlay. |

### Το πρότυπο που ΑΝΤΙΓΡΑΦΕΙΣ (column → beam):
- `bim-3d/diagrams/column-diagram-3d-geometry.ts` — pure data→paths. `buildColumnDiagram3DPaths(model,result,opts)`, `ColumnDiagram3DSet/Path`. Φιλτράρει `memberType==='column'`. **Coordinate transform analytical→world γίνεται ΜΟΝΟ στον mesh builder** (`pivotWorld(base) = (base.xM, 0, -base.yM)`).
- `bim-3d/diagrams/column-diagram-3d-mesh.ts` — `buildColumnDiagram3DGroup(set)`, `billboardColumnDiagrams(group,camera)`. depthTest:false opaque fills, pivot ανά μέλος, full-billboard.
- `bim-3d/diagrams/ColumnDiagram3DOverlay.tsx` — micro-leaf overlay (ADR-040). Subs: showAnalysisDiagrams + diagramComponent + mode + AnalysisResultsStore + AnalyticalModelStore. Gate `showDiagrams && mode!=='2d'`. Mount/dispose σε `manager.scene`, billboard register/unregister, `disposeDiagramGroup`.
- Mount point: **`bim-3d/BimViewport3D.tsx` ~γρ.397** `<ColumnDiagram3DOverlay managerRef={managerRef} />` → πρόσθεσε `<BeamDiagram3DOverlay …/>` στην επόμενη γραμμή (1-line).

### 2Δ-beam (πηγή δεδομένων που ΗΔΗ δουλεύει, για αναφορά):
- `components/dxf-layout/StructuralDiagramOverlay.tsx` — 2Δ overlay, `buildMemberDiagramPaths` (`member-diagram-geometry.ts`, φιλτράρει `memberType==='beam'`, **canvas-space, πετάει το zM**). Gate `mode==='2d'`. `COMPONENT_STYLE` χρώματα. mounted: `canvas-layer-stack-2d-overlays-leaf.tsx`.
- ⚠️ Ο 3Δ-beam builder **ΔΕΝ** εξαρτάται από το `buildMemberDiagramPaths` (canvas-only, χωρίς zM). Καταναλώνει κατευθείαν `AnalyticalModel`+`AnalysisResult` (πλήρη 3D node positions με `zM = node.topZmm*0.001`), όπως ο column builder.

### ΥΠΑΡΧΟΝ beam-3D κώδικας: **ΚΑΝΕΝΑΣ** (grep `beam.*diagram.*3d`, `BeamDiagram3D` → 0 hits). Greenfield, καθαρό mirror.

---

## 2. ΝΕΑ ΑΡΧΕΙΑ (mirror columns)
| NEW | Σκοπός |
|---|---|
| `bim-3d/diagrams/beam-diagram-3d-geometry.ts` | pure data→paths (φιλτράρει `memberType==='beam'`, πλήρη 3D i/j nodes με zM) |
| `bim-3d/diagrams/beam-diagram-3d-mesh.ts` | THREE.Group builder (fills/outline/label, pivot στο 3D μέσο δοκαριού) |
| `bim-3d/diagrams/BeamDiagram3DOverlay.tsx` | micro-leaf overlay (scheduler key `'bim-3d-beam-diagrams'`) |
| `bim-3d/diagrams/__tests__/beam-diagram-3d-{geometry,mesh}.test.ts` | jest: beam-only filter, 3D axis, sampling, χρώματα/group |

---

## 3. 🚨 SSoT ΑΠΟΦΑΣΗ ΠΡΙΝ ΓΡΑΨΕΙΣ (μην αφήσεις column-specific duplication):
Πολλά στο `column-diagram-3d-mesh.ts` είναι **member-generic** (όχι column-specific): `COLUMN_DIAGRAM_COLORS`, `FILL/OUTLINE/LABEL_RENDER_ORDER`, `fillMesh`, `makeTextSprite`, η λογική `buildPathFill`/`fillSignedRibbon` (zero-crossing split), `billboardColumnDiagrams`.
**ΣΩΣΤΗ ΚΙΝΗΣΗ (full SSoT):** ΕΞΑΓΕ τα σε **NEW `bim-3d/diagrams/member-diagram-3d-shared.ts`** (π.χ. `MEMBER_DIAGRAM_3D_COLORS`, render-order consts, `fillMesh`, `makeTextSprite`, `buildSignedRibbonFill`, `billboardDiagramPivots`) και κάνε **και** τον column **και** τον beam mesh builder να τα καταναλώνουν. Έτσι ΕΝΑ SSoT, μηδέν διπλότυπο. (Ο Giorgio έκανε ρητό SSoT audit σε προηγούμενο fix — θέλει 1 πηγή αλήθειας, ΟΧΙ copy-paste column→beam.) ⚠️ Το `column-diagram-3d-mesh.ts` είναι browser-verified/ADR-483 — η εξαγωγή πρέπει να είναι byte-for-byte ισοδύναμη (κράτα τα tests πράσινα).

---

## 4. 🚨 ΚΥΡΙΑ ΣΧΕΔΙΑΣΤΙΚΗ ΑΠΟΦΑΣΗ — επίπεδο/προσανατολισμός beam ribbon (ρώτα τον Giorgio αν χρειαστεί):
- **Κολώνα (κάθετη):** ribbon σε κάθετο επίπεδο, lateral offset = σταθερό plan `+East`· **full-billboard** (κοιτά την κάμερα) γιατί αλλιώς γίνεται edge-on στο orbit.
- **Δοκάρι (οριζόντιο):** ο φυσικός Robot/Revit τρόπος = ribbon στο **κάθετο επίπεδο που περιέχει τον άξονα του δοκαριού** (κρέμεται πάνω/κάτω από το δοκάρι, lateral = world **+Y/up**). Άξονας ribbon = κατεύθυνση span στο world `normalize(Δx, 0, -Δy)`.
  - **Billboard ΝΑΙ ή ΟΧΙ;** Revit/Robot = **fixed κάθετο επίπεδο** (όχι billboard) — διαβάζεται καλά από πλάγιο orbit, edge-on μόνο από nadir. Ο column code έλυσε το nadir με full-billboard.
  - **ΣΥΣΤΑΣΗ:** ξεκίνα με **fixed κάθετο επίπεδο** (Revit-style, πιο σωστό για δοκάρι), κράτα διαθέσιμο το `billboardDiagramPivots` helper αν ο Giorgio θέλει nadir readability. ΕΠΙΒΕΒΑΙΩΣΕ οπτικά μαζί του.

---

## 5. GOTCHAS (κρίσιμα)
1. **Coordinate transform:** analytical `(xM=East, yM=North, zM=Up)` → THREE.js `(x=East, y=Up, z=−North)`. Beam i-node world = `(i.xM, i.zM, -i.yM)`. Pivot = 3D μέσο `((i.xM+j.xM)/2, (i.zM+j.zM)/2, -(i.yM+j.yM)/2)`. Άξονας span world = `normalize(j.xM-i.xM, 0, -(j.yM-i.yM))` (οριζόντιο δοκάρι· sloped=DEFER).
2. **`f = xM/length`** στο `DiagramStation.xM` = απόσταση από i-end — ίδια σύμβαση με κολώνα, μηδέν αλλαγή sampling.
3. **Sign convention (ADR-483 4b):** sagging = ΑΡΝΗΤΙΚΟ. Θετικό=hogging=μπλε (tension-top), αρνητικό=sagging=κόκκινο (tension-bottom). Ίδιο σε 2Δ+3Δ-column — κράτα το.
4. **`depthTest:false` + opaque fills = ΥΠΟΧΡΕΩΤΙΚΟ** (όχι transparent — το blending έδινε «μπεζ»). Επίσης ενεργοποιεί το auto-exclude από section parity (§1).
5. **`group.raycast = () => {}`** — μη-pickable, ποτέ δεν μπλοκάρει selection.
6. **ADR-040:** ο overlay subscribe ΜΟΝΟ low-freq stores· billboard μέσω `UnifiedFrameScheduler.LOW` + camera-dirty· `disposeDiagramGroup` deep dispose στο cleanup.
7. **Section-parity SSoT:** μόλις (2026-06-19) έγινε `section-parity-overlay.ts` με 4 consumers — ΜΗΝ προσθέσεις 5ο inline check· ο beam περνά αυτόματα λόγω depthTest:false.

---

## 6. PHASES (πρόταση)
- **A.** NEW `member-diagram-3d-shared.ts` (εξαγωγή generic helpers από column· κράτα column tests πράσινα). 
- **B.** NEW `beam-diagram-3d-geometry.ts` + test (beam filter, 3D nodes, sampling).
- **C.** NEW `beam-diagram-3d-mesh.ts` + test (pivot/axis/lateral world +Y, fixed κάθετο επίπεδο).
- **D.** NEW `BeamDiagram3DOverlay.tsx` + mount στο `BimViewport3D.tsx` (1 γραμμή).
- **E.** Browser-verify με Giorgio (toggle ON, mode 3Δ· M/V/N· beam+column μαζί στο ίδιο view· selection+hatch τομή ενεργά για να μη ξανα-αλλάζουν χρώμα).
- **F.** ADR-483 changelog Slice 6 + ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + memory.

---

## 7. ΚΑΤΑΣΤΑΣΗ ΠΡΟΗΓΟΥΜΕΝΗΣ ΣΥΝΕΔΡΙΑΣ (ΑΣΧΕΤΟ με αυτό το task, μην το αγγίξεις)
UNCOMMITTED, browser-verified, περιμένει commit από Giorgio: ο fix «slab/structural two-tone» = 4 z-fight/render bugs + parity-overlay SSoT (ADR-452/375). Αρχεία: `MaterialCatalog3D.ts`, `cut-plane-3d.ts`, `section-parity-overlay.ts`(NEW), `section-stencil-renderer.ts`, `section-stencil-secondary-passes.ts`, `section-scene-controller.ts`. Βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `reference_structural_coplanar_zfight_and_cut_overlay`.
