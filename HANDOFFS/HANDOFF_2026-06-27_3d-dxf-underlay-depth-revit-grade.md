# HANDOFF — 3D DXF underlay depth/visibility (Revit/Maxon-grade) + ADR-537 γ/δ/β follow-up

**Ημερομηνία:** 2026-06-27
**ADR:** ADR-537 (3D raw-DXF grip editing) — `docs/centralized-systems/reference/adrs/ADR-537-3d-raw-dxf-grip-editing.md`
**Status:** γ/δ/β IMPLEMENTED + jest GREEN + tsc clean (UNCOMMITTED). **1 ΑΝΟΙΧΤΟ ΠΡΟΒΛΗΜΑ** (κύριο task νέου session).
**Commit:** ΤΟΝ ΚΑΝΕΙ Ο GIORGIO (N.(-1)). ⚠️ **SHARED WORKING TREE** με άλλον agent → **re-read κάθε αρχείο πριν το edit**.

---

## 🎯 ΚΥΡΙΟ TASK ΝΕΟΥ SESSION — 3D DXF underlay depth/visibility (Revit/Maxon-grade, FULL ENTERPRISE + FULL SSoT)

### Το πρόβλημα (Giorgio, browser):
Στην **3D προβολή** (`/dxf/viewer` → κουμπί «3D Προβολή»), οι **ωμές DXF 2D οντότητες** (γραμμές/τόξα/κύκλοι/
πολυγραμμές = το wireframe underlay) **εξαφανίζονται / αλλάζουν χρώμα σε κάποιες γωνίες κάμερας & zoom**.
Είναι το ίδιο φαινόμενο που έκανε τον Giorgio να πει «γι' αυτό δεν εμφανίζονται οι 2D οντότητες στο 3Δ».

### 🔑 ΚΡΙΣΙΜΟ CLUE (από browser test με band-aid `depthTest:false` — τώρα reverted):
> «Όταν κάνω **ζουμ με το ροδάκι**, **κατά την κίνηση γίνονται ΟΛΕΣ ΛΕΥΚΕΣ**, και **όταν σταματάω γίνονται
> ΜΟΥΣΤΑΡΔΙ** σε κάποιες γωνίες/zoom.»

- **Λευκό κατά την κίνηση** = το σωστό/raw χρώμα (DEFAULT_COLOR `0xffffff`).
- **Μουσταρδί στο σταμάτημα** = κάτι τρέχει **στο settle/idle της κάμερας** και τις βάφει/αναμειγνύει.
- ⇒ Ισχυρή ένδειξη ότι **ένα render pass που τρέχει μόνο όταν η κάμερα ηρεμεί** είναι ο ένοχος.
  **ΥΠΟΨΗΦΙΟΙ προς διερεύνηση (κάνε SSoT audit/grep ΠΡΩΤΑ):**
  1. **ADR-366 idle path-trace preview** (`enterPreviewMode` / `autoPreviewEnabled` / IdleDetector) — όταν
     ηρεμεί η κάμερα ίσως μπαίνει σε photorealism preview που αποδίδει το transparent wireframe με GI →
     ζεστή/μουσταρδί απόχρωση. Grep: `enterPreviewMode`, `autoPreview`, `IdleDetector`, `PathTracer`.
  2. **GripDepthOccluder** depth pre-pass (`scene.overrideMaterial = depthMaterial`) που τρέχει on-settle
     (ADR-535) — επιβεβαίωσε ότι ΟΝΤΩΣ κάνει restore το `overrideMaterial`/render target σωστά.
  3. **Post-processing** (bloom/tone-mapping/EDL/SSAO) που ενεργοποιείται on-idle.
  4. **SelectionOutlinePass / hover** (μουσταρδί ≈ gold `0xffd400` face-hover / selection gold). Grep:
     `0xffd400`, `HOVER_HIGHLIGHT`, `SelectionOutlinePass`.

### Η ρίζα (baseline, μετά το revert των band-aids):
Το wireframe (`DxfToThreeConverter.buildColorGroup`) είναι `LineBasicMaterial { transparent:true,
opacity:0.65 }` (depthWrite/depthTest default) και κάθεται **coplanar στο Y=elevation** με τις **βάσεις των
BIM όγκων** (τοίχοι/κολόνες/δοκάρια ξεκινούν από το ίδιο επίπεδο) → **z-fighting** → flicker/εξαφάνιση.

### ❌ FAILED band-aids (ΜΗΝ τα ξαναδοκιμάσεις — αποδείχθηκαν λάθος, έγιναν revert):
1. `depthWrite:false` ΜΟΝΟ στο wireframe → τα fragments που κόβουν στο depth-**test** αναμείχθηκαν
   ημιδιάφανα με το BIM → «μουσταρδί».
2. `depthTest:false` + `depthWrite:false` + `renderOrder` στο wireframe (όπως annotation) → ΠΑΛΙ μουσταρδί
   στο settle + λευκό στην κίνηση (το clue παραπάνω) + «βγαίνει πάνω από τοίχους» (ανεπιθύμητο).
   ⇒ Τα material flags ΔΕΝ λύνουν τη ρίζα· το πρόβλημα είναι **pipeline-level** (settle-triggered pass).

### Τι ζητάει ο Giorgio (αυτολεξεί):
> «Όπως το κάνουν οι μεγάλοι παίχτες όπως η **Revit / Maxon (Cinema 4D)**. **FULL ENTERPRISE + FULL SSOT**.
> **ΠΡΙΝ την υλοποίηση κώδικα, κάνε ΠΡΑΓΜΑΤΙΚΟ SSoT audit (GREP)** για να δεις αν υπάρχει ήδη αντίστοιχος
> κώδικας ώστε να τον χρησιμοποιήσεις και να ΜΗΝ δημιουργήσεις διπλότυπα.»

### ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep ΠΡΙΝ γράψεις κώδικα) — πώς λύνουν ΑΛΛΑ overlays το coplanar depth εδώ:
```
# Υπάρχον depth/render-order handling σε converters/overlays
grep -rn "depthTest\|depthWrite\|renderOrder\|polygonOffset" src/subapps/dxf-viewer/bim-3d
# Πώς αποδίδονται labels/sprites/dimensions/comments (annotation layer pattern)
grep -rn "Sprite\|CanvasTexture\|makeTextSprite\|DimensionLabel\|CommentMarker" src/subapps/dxf-viewer/bim-3d
# Idle/preview/settle pipeline (το ύποπτο pass)
grep -rn "enterPreviewMode\|autoPreview\|IdleDetector\|PathTracer\|overrideMaterial\|useCameraMotionGate" src/subapps/dxf-viewer/bim-3d
# Μουσταρδί/gold πηγή
grep -rn "0xffd400\|HOVER_HIGHLIGHT\|SelectionOutlinePass\|selection.*gold" src/subapps/dxf-viewer/bim-3d
# Πώς ορίζεται το render pipeline / passes
grep -rn "EffectComposer\|RenderPass\|composer\|tone\|exposure" src/subapps/dxf-viewer/bim-3d
```
**Revit/Maxon-grade στόχος:** το DXF underlay να είναι **σταθερά ορατό στο σωστό χρώμα** σε ΟΛΕΣ τις γωνίες/
zoom (όπως ένα DWG link/CAD underlay), **χωρίς z-fight, χωρίς χρωματικό artifact, χωρίς να αλλάζει σε
κίνηση vs settle**. Πιθανές enterprise λύσεις προς αξιολόγηση (ΑΦΟΥ κάνεις audit): polygonOffset SSoT,
dedicated annotation/underlay render-pass με σωστό depth handling, ή εξαίρεση του underlay από το
idle-preview/post-pass — **ΟΧΙ νέο μηχανισμό αν υπάρχει ήδη**.

---

## ✅ ΤΙ ΥΛΟΠΟΙΗΘΗΚΕ (γ/δ/β) — δουλεύει, UNCOMMITTED, μην το ξαναφτιάξεις

Πλήρεις λεπτομέρειες: **ADR-537 changelog** (3 entries: γ, δ, β + β-fixes). Σύνοψη:

| Φάση | Τι | Κατάσταση |
|---|---|---|
| **γ** non-mm units (mm/cm/m/in/ft) | ΕΝΑ SSoT factor `dxfUnitToMm`/`dxfSceneUnitToMm` (`utils/scene-units.ts`). seat/ghost/outline ×unitToMm· pick/commit ÷unitToMm. | ✅ 48 jest |
| **δ** multi-floor («Όλοι οι όροφοι») | ΕΝΑ scope SSoT `bim-3d/scene/dxf-3d-floor-scope.ts` (`getDxfFloorScope`/`findDxfEntityInScope`). `pickDxfEntityAcrossFloors`. seat στο floorElevationMm. | ✅ 56 jest |
| **β** text σε 3D (select/hover/grip) | `dxf-text-3d.ts buildDxfTextMesh` (flat CanvasTexture-on-plane, reuse `text-rendering-config`). pick/outline = bbox SSoT `getEntityBBox`. | ✅ 62 jest (117 σε 16 suites όλα μαζί) |

### β browser-fixes που ΛΥΘΗΚΑΝ & ΚΡΑΤΗΘΗΚΑΝ (επιβεβαιωμένα από Giorgio):
- **Λαβή text δεν φαινόταν:** ήταν **occlusion** (οι λαβές flat-DXF underlay είναι όλες σε ΕΝΑ επίπεδο, ο
  ADR-535 occluder—για BIM top/bottom faces—τις mis-culls). FIX: **skip occlusion για raw-DXF**
  (`dxfGhostEntityId !== null` → `visibility=null`) στο `BimGripOverlay2D.tsx`, όπως ο 2D καμβάς. ✅
- **Text clipping (ΠΕΤΡΟΣ→ΓΕΤΡΟΣ, κοβόταν το Π):** ο canvas διαστασιολογούνταν με εκτίμηση 0.6×h.
  FIX: `ctx.measureText` για ΠΡΑΓΜΑΤΙΚΟ πλάτος + padding (`dxf-text-3d.ts`). ✅ Giorgio: «εμφανίζεται».
- **Text εξαφανιζόταν σε γωνίες:** `depthTest:false` + `renderOrder=999` στο text mesh (`dxf-text-3d.ts`).
  ✅ ΔΟΥΛΕΥΕΙ — **interim**· η ΣΩΣΤΗ λύση depth πρέπει να **ενοποιήσει** text + wireframe (βλ. κύριο task).

### ⚠️ Τι ΕΓΙΝΕ REVERT σε αυτό το session (καθαρή βάση για το κύριο task):
- `DxfToThreeConverter` wireframe material → **πίσω στο αρχικό** `{ color, transparent:true, opacity:WIREFRAME_OPACITY }`
  (αφαιρέθηκαν τα band-aids depthWrite/depthTest/renderOrder). ⇒ Μετά το revert το μουσταρδί φεύγει,
  επιστρέφει η αρχική z-fight συμπεριφορά (= το πρόβλημα να λυθεί σωστά).
- `grip-3d-depth-occluder.ts` (ADR-535) → δεν χρειάστηκε αλλαγή τελικά (επαναφέρθηκε νωρίτερα).

---

## 📁 ΑΡΧΕΙΑ (νέα/τροποποιημένα, UNCOMMITTED)

**Νέα:** `utils/__tests__/scene-units-dxf-unit-to-mm.test.ts`, `bim-3d/scene/dxf-3d-floor-scope.ts`(+test),
`bim-3d/converters/dxf-text-3d.ts`(+test).
**Τροπ.:** `utils/scene-units.ts`, `bim-3d/grips/{dxf-wireframe-hit-test,dxf-entity-outline,dxf-grip-ghost-paint,
grip-3d-dxf-raw-grips,grip-3d-dxf-commit}.ts`(+tests), `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts`,
`bim-3d/viewport/use-bim3d-pointer-handlers.ts`, `bim-3d/viewport/grips/{BimGripOverlay2D,DxfHoverGlowOverlay2D}.tsx`,
`bim-3d/converters/DxfToThreeConverter.ts`, ADR-537.

**Κλειδιά (SSoT για το νέο task):**
- Wireframe render: `bim-3d/converters/DxfToThreeConverter.ts` (`buildColorGroup` — εδώ ζει το πρόβλημα).
- Text render: `bim-3d/converters/dxf-text-3d.ts`.
- Render pipeline / scene: `bim-3d/scene/ThreeJsSceneManager.ts`, `rendering/core/UnifiedFrameScheduler.ts`.
- Coordinate SSoT: `bim-3d/viewport/coordinate-transforms.ts` (`dxfPlanToWorld` mm-based ×0.001).

---

## 🚦 ΤΙ ΜΕΝΕΙ (μετά τη λύση του κύριου task)
1. **Λύσε το underlay depth/visibility** (Revit/Maxon-grade, SSoT audit πρώτα) — text + wireframe ενοποιημένα.
2. **Browser-verify** (Giorgio): γ (cm/m DXF· grips/hover ευθυγραμμισμένα), δ («Όλοι οι όροφοι»· hover/edit
   σωστός όροφος), β (click/hover/drag/undo text), + το underlay σταθερό σε ΟΛΕΣ γωνίες/zoom.
3. **Commit** (Giorgio): stage ADR-537 + τα 3D αρχεία. **CHECK 6B/6D** → το `DxfToThreeConverter.ts` είναι
   perf-critical → υποχρεωτικά stage ADR μαζί. **ΟΧΙ ADR-535** (occluder reverted).

## 🛠️ ΚΑΝΟΝΕΣ
- **FULL SSoT:** grep πρώτα, reuse, μηδέν διπλότυπα. **FULL ENTERPRISE:** no `any`/`as any`/`@ts-ignore`,
  files <500γρ, functions <40γρ.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process πρώτα)· default OOM → `NODE_OPTIONS="--max-old-space-size=8192"`·
  grep μόνο τα δικά σου αρχεία (η app έχει προϋπάρχοντα errors άλλων agents).
- **SHARED TREE:** re-read πριν edit. **Commit → Giorgio**. Jest colocated, pure-first.
- Verify: `npm run dev` → `http://localhost:3000/dxf/viewer` → DXF με γραμμές+τόξα+text+non-mm+πολλούς ορόφους → «3D Προβολή».
