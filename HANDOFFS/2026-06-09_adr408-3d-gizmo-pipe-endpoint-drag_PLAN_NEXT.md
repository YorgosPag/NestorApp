# 🧠 HANDOFF — ADR-408 «3D Gizmo: μετακίνηση ΑΚΡΩΝ σωλήνα» (per-endpoint drag στο 3D, Revit shape-handles): PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας: PLAN MODE → υλοποίηση.** Σήμερα, όταν επιλέγεις σωλήνα (`mep-segment`) στο 3D, το gizmo εμφανίζεται στο **κέντρο** και μπορείς μόνο να μετακινήσεις/περιστρέψεις **ολόκληρο** τον σωλήνα. Ο Giorgio θέλει να μπορεί να **σέρνει το κάθε ΑΚΡΟ** του σωλήνα ξεχωριστά στο 3D (ο σωλήνας τεντώνει από τη μία άκρη, η άλλη μένει), όπως η Revit.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **Plan Mode πρώτα** (~8-10 αρχεία, 1 domain=3D gizmo) → σχεδίασε & ζήτα έγκριση plan **ΠΡΙΝ** κώδικα. Πάρε εσύ τις Revit αποφάσεις.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος πριν ξεκινήσεις.
- **N.15:** μετά την υλοποίηση → update ADR-408 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` στο ΙΔΙΟ commit (ο Giorgio committάρει).
- **N.11 i18n:** αν χρειαστούν strings (μάλλον όχι — gizmo geometry/commands), keys el+en ΠΡΙΝ τη χρήση.
- **ADR-040:** τα gizmo αρχεία (`bim-3d/gizmo/`, `bim-3d/animation/`) **ΔΕΝ** είναι στη λίστα canvas micro-leaf (CHECK 6B/6D). **Δεν χρειάζεται staging ADR-040** — αλλά **επιβεβαίωσέ το** vs CLAUDE.md λίστα πριν το commit.

---

## 0) ΚΑΤΑΣΤΑΣΗ REPO (τι δουλεύει ΗΔΗ — ΜΗΝ το ξαναγγίξεις)

**🟢 ΟΛΟΚΛΗΡΩΜΕΝΟ (Opus, 2026-06-08→09· ο Giorgio κάνει commit):**
1. **ADR-408 Φ-C «Connectivity-Preserving Move»** — `bim/mep-segments/mep-move-propagation.ts` (ΕΝΑΣ agnostic resolver: anchors OLD→NEW connector/endpoint world poses → retarget coincident pipe ends XY+Z) + `build-connectivity-host-update.ts` + `getConnectorHostPlanTransform`. 2D grips (host XY+rotation + pipe) wired.
2. **Φ-C (3D gizmo)** — η περιστροφή + κάθετη/οριζόντια μετακίνηση **persistάρουν** πλέον (NEW `rotateMepSegment`/`rotateMepPointHost` στο `bim/transforms/bim-rotate-geometry.ts`· `computeMepHostVerticalMove`/`computeMepSegmentVerticalMove` στο `bim-3d/gizmo/bim3d-vertical-move.ts`) **ΚΑΙ** οι συνδεδεμένοι σωλήνες ακολουθούν — commit **και** live preview (NEW `bim-3d/animation/bim3d-pipe-follow-preview-rebuild.ts` + `capturePipes`/`applyPipes` στο `Bim3DEditLivePreview` + `withConnectedPipeFollow` wrapper στο `bim3d-edit-command-builders.ts`). 80/80 jest, tsc καθαρό.

**🔴 ΤΟ ΝΕΟ TASK (αυτό το handoff): per-endpoint drag του σωλήνα στο 3D gizmo.**

---

## 1) ΤΙ ΚΑΝΕΙ Η REVIT (η σωστή συμπεριφορά-στόχος)
- Επιλέγεις σωλήνα → εμφανίζονται **shape-handles / drag controls (μπλε τελείες)** στα **δύο άκρα**.
- Σέρνεις ένα άκρο → ο σωλήνας **τεντώνει/κονταίνει από εκείνο το άκρο** (το άλλο μένει σταθερό). Σε κάτοψη **και** υψόμετρο (constrained translation ενός node).
- Το συνδεδεμένο άκρο **παρασέρνει** ό,τι είναι κουμπωμένο εκεί (fitting / άλλος σωλήνας) — Revit «connected». Snap σε άλλους connectors («Connect To»). Αποσύνδεση μόνο αν γεωμετρικά αδύνατο (+ warning).
- **Το κέντρο/περιστροφή gizmo μένουν** για ολική μετακίνηση — τα endpoint handles είναι ΕΠΙΠΛΕΟΝ.

---

## 2) ΑΡΧΙΤΕΚΤΟΝΙΚΗ 3D GIZMO (reuse surface — επιβεβαιωμένο με κώδικα)

**Handle registry / geometry / hit-test:**
- `bim-3d/gizmo/bim-gizmo-overlay.ts` — `BASE_HANDLES` (axis-x/y/z, plane-xz, center, rotate-y)· `RESIZE_HANDLES_BY_TYPE`· `TILT_HANDLES_BY_TYPE`· `activeHandlesFor(bimType)`· `applyActiveHandles()`· `setHoverHandle`/`paintHandle`/`defaultColorOf`. **ΚΑΝΕΝΑ entity δεν έχει σήμερα endpoint handle** (το length editing beam/wall «αφέθηκε στα 2D grips» — σχόλιο γρ.52).
- `bim-3d/gizmo/gizmo-types.ts` — `GizmoHandleId` (flat string union· γρ.~26)· `parseHandleId()` (γρ.~47)· `handleToConstraint()` (γρ.~57)· `GizmoDragConstraint`.
- `bim-3d/gizmo/gizmo-geometry.ts` — `createGizmoMeshes()` (γρ.~55): κάθε handle = `visual` + `hitbox`, **παιδιά του `root`, θέση ΣΧΕΤΙΚΗ ως προς το anchor** (όχι absolute world). `buildResizeHandle()` = τετράγωνο wireframe (ταιριάζει οπτικά με το 2D endpoint square).
- `bim-3d/gizmo/gizmo-hit-test.ts` — `testGizmoHit()` + `HANDLE_PRIORITY` (rotate5>resize4>center3>plane2>axis1). Νέο `endpoint-*` → priority 4.

**Anchor + endpoint world θέσεις:**
- `bim3d-edit-interaction-handlers.ts:computeEditAnchor` (γρ.~68) → `findBimEntityWorldBox` → gizmo στο **κέντρο bbox**. Το anchor ΜΕΝΕΙ στο κέντρο· τα endpoint handles τοποθετούνται ως **offset children** = `endpointWorld − anchorWorld`.
- **Endpoint world formula (SSoT, αντιγραφή verbatim):** `bim-3d/converters/mep-segment-to-mesh.ts:91-103` →
  `startW = (startPoint.x·sceneToM, elev.startMm·MM_TO_M + baseElevationM, −(startPoint.y·sceneToM))`. `sceneToM = sceneUnitsToMeters(params.sceneUnits)`· `elev = resolveSegmentEndpointElevationsMm(params)`· `baseElevationM = resolveEntityBuilding(entity, floors, buildings)?.baseElevation ?? 0`.

**Drag bridge / controller / command / preview (closest analog = RESIZE):**
- `bim-3d/gizmo/bim-gizmo-drag-bridge.ts` — `BridgeOutcome` union (move/rotate/resize/tilt/none, γρ.~30). Το `resize` branch (γρ.~221-234) = constrained translation ενός handle (`projectConstrained` → `deltaMm`/`deltaUpMm`/`cursorMm`). **Το endpoint-move είναι ΑΚΡΙΒΩΣ constrained translation ενός node → ίδιο code path.**
- `bim-3d/gizmo/bim-gizmo-controller.ts` — `beginDrag`/`updateDrag`/`endDrag`/`getActiveConstraint`/`getLivePreview` (union move/rotate/resize/tilt). Το constraint ορίζεται από το parsed handle id. Στο resize ο root ΔΕΝ ακολουθεί τον κέρσορα (ίδιο για endpoint).
- `bim-3d/animation/bim3d-edit-command-builders.ts` — `buildEditCommand` (dispatch outcome→command)· `buildResizeCommand` (per-type). **`withConnectedPipeFollow` (γρ.~139) = reuse αυτούσιο** (τυλίγει σε CompoundCommand + connected-pipe patches).
- **2D endpoint SSoT (μηδέν νέα math):** `bim/mep-segments/mep-segment-grips.ts:183` `applyMepSegmentGripDrag('mep-segment-start'|'mep-segment-end', {originalParams, delta})` → `moveStart`/`moveEnd` (γρ.207/219· **ΠΡΟΣΟΧΗ: σήμερα κρατούν το z αμετάβλητο** → για 3D drag πρόσθεσε `z += deltaUpMm` ή νέο `moveStartWithZ`).
- **Connectivity:** `resolveSegmentMoveConnectedPipePatches` (`mep-move-propagation.ts`) — μετακινείς ένα endpoint → ΜΟΝΟ ο γείτονας σε εκείνο το άκρο ακολουθεί (το άλλο anchor from==to → no-op). Αυτόματα σωστό.
- **Live preview resize:** `bim3d-preview-rebuild.ts:buildResizePreviewObject` (rebuild single entity via converter SSoT)· **follower pipes live:** `bim3d-pipe-follow-preview-rebuild.ts:buildPipeFollowPreviewObjects` (ΗΔΗ υπάρχει).

---

## 3) ΤΟ ΖΗΤΟΥΜΕΝΟ ΣΧΕΔΙΟ (πρότεινε στο Plan Mode — Revit-grade, max reuse, mirror του resize)

**Πυρήνας:** νέο constraint/handle kind `endpoint` («constrained translation ενός node»), για **single-select `mep-segment`** (multi-select κρατά το κεντρικό gizmo). Βήματα:

1. **Types** (`gizmo-types.ts`): `GizmoHandleId += 'endpoint-start'|'endpoint-end'`· `GizmoDragConstraint += {kind:'endpoint', endpoint:'start'|'end'}`· επέκταση `parseHandleId`/`handleToConstraint`.
2. **Geometry** (`gizmo-geometry.ts`): `buildEndpointHandle()` (reuse `buildResizeHandle` square)· 2 instances· καταχώρηση σε visuals+hitboxes.
3. **Overlay** (`bim-gizmo-overlay.ts`): νέο `ENDPOINT_HANDLES_BY_TYPE` (ή row στο RESIZE) `{'mep-segment':['endpoint-start','endpoint-end']}`· **NEW `setEndpointOffsets(startW, endW)`** που επανατοποθετεί τα 2 endpoint children μέσα στο `root` σε `world−anchor` (η ΜΟΝΗ νέα υποδομή — όλα τα άλλα handles έχουν στατικό offset)· `defaultColorOf` += `endpoint-*`· `HANDLE_PRIORITY` += endpoint=4.
4. **Bridge** (`bim-gizmo-drag-bridge.ts`): `BridgeOutcome += {kind:'endpoint-move', endpoint, deltaMm, deltaUpMm, cursorMm}`· branch στο `getOutcome` ίδιο με resize (γρ.221-231) με `constraint.endpoint`· snap = `makeResizeSnapFn` (έτοιμο).
5. **Controller** (`bim-gizmo-controller.ts`): `GizmoLivePreview += {kind:'endpoint-move', endpoint, outcome}`· branch στο `getLivePreview` (mirror resize)· στο `updateDrag` ο root ΔΕΝ ακολουθεί (guard όπως resize).
6. **Command** (`bim3d-edit-command-builders.ts`): NEW `buildEndpointMoveCommand` → `applyMepSegmentGripDrag('mep-segment-start'|'mep-segment-end', {originalParams, delta: mmΣεcanvas})` **+ z από deltaUpMm** → `UpdateMepSegmentParamsCommand` → **`withConnectedPipeFollow`** (reuse)· case στο `buildEditCommand`.
7. **Preview** (`bim3d-preview-rebuild.ts`): NEW `buildEndpointMovePreviewObject(entityId, endpoint, deltaMm, deltaUpMm)` → `mepSegmentToMesh` με patched params. + follower pipes via `buildPipeFollowPreviewObjects` (ίδια next-params).
8. **Handlers** (`bim3d-edit-interaction-handlers.ts`): pointerdown endpoint constraint (όπως resize capture)· μετά το `computeEditAnchor` → `overlay.setEndpointOffsets(startW, endW)` για mep-segment (ΚΑΙ ανά drag frame, γιατί το άκρο κινείται)· `applyLivePreview` endpoint branch (buildEndpointMovePreviewObject + pipe-follow).

**Αποφάσεις Revit (πάρ' τες εσύ):** endpoint handles μόνο σε single-select linear· σχήμα = square (όπως 2D)· drag = constrained translation σε κάτοψη+υψόμετρο· snap «Connect To» μέσω resize-snap· connectivity follow υποχρεωτικό (reuse)· το άλλο άκρο ΠΑΝΤΑ σταθερό· κέντρο/rotate παραμένουν.

**Γενίκευση (μελλοντικό, ΟΧΙ τώρα):** ίδιο pattern → beam/wall/duct endpoint (length) editing. Σχεδίασέ το ώστε το `endpoint` kind να ΜΗΝ είναι pipe-specific (registry-driven).

---

## 4) ΤΕΣΤ
- `bim3d-edit-command-builders` / νέο builder: `buildEndpointMoveCommand` → σωστό start/end param update + z + connectivity wrap (unit-aware mmToEntityUnitFactor).
- Geometry/anchor: `setEndpointOffsets` math (world−anchor) — pure, testable.
- Reuse: `applyMepSegmentGripDrag` start/end + `resolveSegmentMoveConnectedPipePatches` ΗΔΗ tested.
- tsc background (N.17 serialize). Browser-verify με Giorgio (3D — δεν επαληθεύεται headless).

## 5) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ ξαναγγίξεις τα DONE του §0 (Φ-C resolver / 3D rotate/vertical / live preview).
- ΜΗΝ commit/push/adr-index (Giorgio). ΜΗΝ `git add -A`.
- ΜΗΝ σπάσεις το κεντρικό move/rotate gizmo (τα endpoint handles είναι ΠΡΟΣΘΗΚΗ, single-select only).
- ΜΗΝ τρέξεις 2ο tsc αν τρέχει ήδη (N.17).

## 6) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + `bim-3d/gizmo/bim-gizmo-overlay.ts` + `gizmo-types.ts` + `gizmo-geometry.ts` + `bim-gizmo-drag-bridge.ts` + `bim-gizmo-controller.ts` + `bim3d-edit-command-builders.ts` (resize path) + `bim-3d/converters/mep-segment-to-mesh.ts` (endpoint world formula).
2. Επιβεβαίωσε signatures (parseHandleId/handleToConstraint, BridgeOutcome resize branch, getLivePreview resize branch, buildResizeCommand, applyMepSegmentGripDrag start/end, withConnectedPipeFollow, buildPipeFollowPreviewObjects).
3. **Μπες Plan Mode** → σχεδίασε τα 8 βήματα (handle kind + setEndpointOffsets + outcome + command + preview) + ζήτα έγκριση.
4. Μετά έγκριση → υλοποίηση + tests + ADR-408 changelog + N.15. Browser-verify με Giorgio.

## 7) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
Συνέχεια με το **ADR-423** (MEP Auto-Design framework) — επόμενες disciplines μετά την ύδρευση pilot (ADR-426). Μνήμες: `project_adr423_mep_auto_design`, `project_adr426_water_supply_auto_design`, `project_adr425_stage0_recognition`, `project_adr408_connectivity_preserving_move`.
