# HANDOFF — ADR-514 «Ένας Εγκέφαλος Έλξης» Φ6: face-snap για slab / roof / foundation

**Ημ/νία:** 2026-06-24 · **Στόχος session:** Φ6 του ADR-514 — NEW feature, Revit-grade face-snap στα polygon/footing tools
**Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ πάντα** (CLAUDE.md language rule).

---

## 0. ΚΑΝΟΝΕΣ ΑΥΤΗΣ ΤΗΣ ΔΟΥΛΕΙΑΣ (μη τους παραβείς)

- **COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Εσύ ΠΟΤΕ. Ετοίμασε, σταμάτα, ανέφερε. (N.(-1))
- **Shared working tree με άλλον agent** → άγγιξε ΜΟΝΟ τα αρχεία του Φ6. **ΜΗΝ** κάνεις `git add -A`/μαζικό add. Πριν tsc έλεγξε αν τρέχει ήδη άλλος tsc (N.17 — ΕΝΑ tsc τη φορά· `Get-CimInstance Win32_Process … node.exe … tsc`).
- **ΠΡΙΝ γράψεις ΚΩΔΙΚΑ: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** — βρες υπάρχοντα κώδικα/SSoT να **επαναχρησιμοποιήσεις**, ΜΗΔΕΝ διπλότυπα. (Ρητή εντολή Giorgio. Δες §5.)
- **FULL ENTERPRISE + FULL SSoT, «όπως η Revit».** Ένα σημείο εισόδου (ο εγκέφαλος), preview ≡ commit by construction.
- **ADR-040 architecture-critical:** αν αγγίξεις `systems/cursor/mouse-handler-up.ts` ή drawing/preview canvas files → CHECK 6B/6D μπλοκάρουν commit χωρίς staged ADR → **stage ADR-040 + ADR-514 μαζί**.
- **Lead-with-concrete-example (Giorgio preference):** όταν ζητάς απόφαση σχεδιασμού, ξεκίνα με συγκεκριμένο αριθμητικό/ASCII παράδειγμα, ΟΧΙ αφηρημένη ορολογία.

---

## 1. ΠΟΥ ΕΙΜΑΣΤΕ — ADR-514 Φ1–Φ5 COMMITTED ✅

`docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md` (διάβασέ το ΟΛΟ πρώτα).

- **Φ1**: NEW εγκέφαλος `src/subapps/dxf-viewer/bim/placement/bim-cursor-snap.ts` — `resolveBimCursorSnap(input): BimCursorSnap`.
  Pure, dispatch by `toolKind`, discriminated union return (`member-placement` | `column-placement` | `point`).
- **Φ2**: κολόνα wired (commit `mouse-handler-up.ts` + preview `column-preview-helpers.ts`) → καλούν τον εγκέφαλο.
- **Φ3**: τοίχος + δοκάρι wired (commit `useWallTool`/`useBeamTool` + preview `wall-/beam-preview-helpers`).
- **Φ4**: N/A — audit έδειξε ότι slab/roof/foundation ΔΕΝ έχουν δικό τους snap (κεντρικό OSNAP μόνο).
- **Φ5**: SSoT-lock — registry module `bim-cursor-snap` (`.ssot-registry.json`, tier 4): **κάθε νέο BIM placement tool υποχρεωτικά μέσα από τον εγκέφαλο** (forbidden direct Layer-2 resolver calls). Cross-links σε ADR-378/398/508.

> 🔴 **Εκκρεμεί ακόμα browser-verify Φ2+Φ3** (κολόνα/τοίχος/δοκάρι «ούτε μία διαφορά»). Δεν εμποδίζει το Φ6 αλλά κράτα το υπόψη.

---

## 2. ΤΙ ΕΙΝΑΙ ΤΟ Φ6 (NEW FEATURE — Giorgio 2026-06-24)

**Face-snap στα slab / roof / foundation:** όταν σχεδιάζεις περίγραμμα πλάκας/στέγης ή τοποθετείς θεμέλιο,
μια **κορυφή ή ακμή να κουμπώνει flush σε παρειά** τοίχου / κολόνας / δοκαριού — όπως η Revit «Pick Walls» /
«Draw on Face». Σήμερα αυτά τα tools κουμπώνουν ΜΟΝΟ σε σημεία (endpoint/grid OSNAP), όχι σε παρειές μελών.

**Η ΥΛΟΠΟΙΗΣΗ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΕΓΚΕΦΑΛΟ** (Φ5 registry το επιβάλλει): επέκταση `BimSnapToolKind` + νέο/reused
Layer-2 resolver branch. ΟΧΙ νέο παράλληλο snap subsystem.

### ⚠️ ΑΠΟΦΑΣΗ ΣΧΕΔΙΑΣΜΟΥ — ΡΩΤΑ ΤΟΝ GIORGIO ΠΡΩΤΑ (με συγκεκριμένο παράδειγμα)
Το «face-snap σε polygon» έχει 2 επίπεδα φιλοδοξίας. Ρώτησέ τον ΠΟΙΟ θέλει (ή phased):

- **Φ6a — per-vertex face-snap (απλό, χαμηλό ρίσκο):** κάθε κορυφή που τοποθετείς κουμπώνει flush στην
  πλησιέστερη παρειά μέλους (reuse `resolveMemberGhostSnapFromStore` → κράτα το `.start` = flush σημείο,
  ίδιο pattern με το wall END `resolveWallEndpointSnap`). Άμεση αξία, μηδέν νέα γεωμετρία.
- **Φ6b — edge-flush constraint (Revit-grade, η δύσκολη):** όταν κορυφή V κουμπώσει σε παρειά P, ο επόμενος
  cursor **γλιστράει ΚΑΤΑ ΜΗΚΟΣ της P** (η ακμή μένει flush/parallel στην παρειά). Νέος constraint στο
  hover handler.
- **Φ6c — foundation pad → column face:** το pad (1 κλικ) κουμπώνει flush σε παρειά κολόνας (reuse
  `resolveColumnFaceSnapFromTargets`, ίδιο με column tool).

**Πρόταση:** Φ6a πρώτα (committable μόνο του), μετά Φ6b, μετά Φ6c. ΕΠΙΒΕΒΑΙΩΣΕ με Giorgio με ASCII σκίτσο.

---

## 3. ΚΡΙΣΙΜΟ INSIGHT (μην το ξεχάσεις — αλλιώς double-snap)

Ισχύει ΟΤΙ και στα Φ2/Φ3: **το OSNAP point-snap εφαρμόζεται ΗΔΗ ΚΕΝΤΡΙΚΑ** (`mouse-handler-up` στο click,
`snap-scheduler`→`ImmediateSnapStore` στο preview). Ο cursor που φτάνει στους tools είναι ήδη snapped.
➡️ Στο wiring κάλεσε τον εγκέφαλο **ΧΩΡΙΣ `findSnapPoint`** (το έκανες optional στο Φ2) → ο εγκέφαλος κάνει
ΜΟΝΟ placement dispatch, ΟΧΙ ξανά point-snap. Το `effectiveCursor` = `resolveEffectivePreviewCursor(raw)`.

---

## 4. ΧΑΡΤΟΓΡΑΦΗΣΗ ΥΠΑΡΧΟΝΤΩΝ (recon 2026-06-24) — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ

### Tool δομή (commit click path)
- `hooks/drawing/useSlabTool.ts` & `useRoofTool.ts` = **ταυτόσημο** multi-vertex polygon FSM
  (`idle→awaitingFirstVertex→awaitingNextVertex`→loop→commit). `onCanvasClick(point): boolean` δέχεται
  **αυτούσιο** ήδη-snapped `point`. Slab click pipeline ~`useSlabTool.ts:218-254`, Roof mirror ~`:170-207`.
  Auto-close όταν `vertices.length>=3 && dist(point, vertices[0])<=50`.
- `hooks/drawing/useFoundationTool.ts`: `pad` 1 κλικ (`:232-253`), `strip`/`tie-beam` 2 κλικ (`:320-330`),
  `from-wall` pick τοίχου (`:276-300`, `pickWallEntityAt` hit-test, ΟΧΙ face snap).

### Preview helpers
- `hooks/drawing/slab-preview-helpers.ts:28` `generateSlabPreview(tempPoints, cursorPoint)` — απλό πράσινο
  outline polyline (`vertices=[...tempPoints, cursorPoint]`). **Κοινό SSoT** για slab + roof + floor-finish +
  ceiling (routing στο `drawing-preview-generator.ts:116-117`). Η στέγη ΔΕΝ έχει δικό WYSIWYG preview.
- `hooks/drawing/foundation-preview-helpers.ts:38` `generateFoundationPreview` — WYSIWYG `FoundationEntity`
  (strip/tie-beam) μέσω `buildFoundationEntity` (ίδιος builder με commit).

### Snap σήμερα — ΕΠΙΒΕΒΑΙΩΜΕΝΟ ΚΕΝΟ
Grep στα 3 tools για `findSnapPoint|FaceSnap|GhostSnap|resolveEffectivePreviewCursor|sceneSnapTargetsStore|resolveBimCursorSnap`
→ **0 αποτελέσματα**. Καθαρό κενό· κουμπώνουν μόνο από κεντρικό OSNAP.

### Targets ΗΔΗ διαθέσιμα (μηδέν νέο collection)
`bim/framing/scene-snap-targets.ts` → `SceneSnapTargets`:
`footprints` (κολόνες 4-παρειές) · `wallTargets` · `beamTargets` · **`slabTargets` (ακμές πλάκας)** ·
`lineTargets` · `diskTargets` · `rectTargets` · `wallEntities` · `openings`.
`selectGhostMembers(targets, kinds)` → flat λίστα `LinearMemberSnapTarget[]` (`{id, axis, outline, arc?}`).
Populator: `hooks/drawing/use-scene-snap-target-sync.ts` (ενεργό για wall/beam/column — **ΧΡΕΙΑΖΕΤΑΙ
ΕΝΕΡΓΟΠΟΙΗΣΗ ΚΑΙ για slab/roof/foundation tools**).

### Vertex model
`bim/types/bim-base.ts` `Polygon3D = { vertices: readonly Point3D[] }` — κοινό slab + roof. Foundation:
pad=`position` (1pt), strip/tie-beam=`start`+`end` (2pt), εδαφόπλακα=`SlabEntity` kind='ground'/'foundation'.

---

## 5. SSoT AUDIT (GREP) — ΚΑΝΕ ΤΟ ΠΡΩΤΟ, ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

```
1. grep -rn "BimSnapToolKind\|resolveBimCursorSnap" src/subapps/dxf-viewer        # ο εγκέφαλος + callers
2. grep -rn "resolveLinearMemberFaceSnap\|resolveMemberGhostSnapFromStore" src/subapps/dxf-viewer  # face-snap πυρήνας
3. grep -rn "resolveColumnFaceSnapFromTargets" src/subapps/dxf-viewer            # column face (Φ6c)
4. grep -rn "selectGhostMembers\|sceneSnapTargetsStore" src/subapps/dxf-viewer    # targets + populator
5. grep -rn "use-scene-snap-target-sync\|useSceneSnapTargetSync" src/subapps/dxf-viewer  # πού ενεργοποιείται
6. grep -rn "onCanvasClick" src/subapps/dxf-viewer/systems/cursor/mouse-handler-up.ts  # central commit branch
7. grep -rn "ambient-alignment\|collectAmbientAlignmentAnchors" src/subapps/dxf-viewer  # ΜΗΝ διπλασιάσεις H/V align
8. grep -rn "generateSlabPreview\|drawing-preview-generator" src/subapps/dxf-viewer  # preview routing
```
Στόχος: ΜΗΔΕΝ νέο geometry/store/snap subsystem. Reuse `resolveMemberGhostSnapFromStore` +
`resolveColumnFaceSnapFromTargets` + `scene-snap-targets`. Ο εγκέφαλος = ΕΝΑ σημείο εισόδου.

⚠️ **ΠΡΟΣΟΧΗ διπλότυπο που υπάρχει ήδη:** `systems/tracking/ambient-alignment-source.ts`
(`collectAmbientAlignmentAnchors`) ΗΔΗ τρέχει για slab/foundation στο `drawing-hover-handler.ts` και δίνει
**H/V alignment** δωρεάν. Το Φ6 είναι **face-flush** (διαφορετικό) — ΜΗΝ ξαναγράψεις alignment, συμπλήρωσέ το.

---

## 6. ΥΛΟΠΟΙΗΣΗ Φ6 (μετά το audit + απόφαση Giorgio)

**Βήμα Α — επέκταση εγκεφάλου** (`bim/placement/bim-cursor-snap.ts`):
- `BimSnapToolKind` → πρόσθεσε `'slab' | 'roof' | 'foundation-polygon'` (ή ΕΝΑ `'polygon-vertex'` αν η
  συμπεριφορά είναι κοινή — προτίμησέ το αν δεν διαφέρουν· λιγότερα kinds = λιγότερη επιφάνεια).
- Νέο branch: για αυτά τα kinds → `resolveMemberGhostSnapFromStore(cursor, targets.footprints,
  selectGhostMembers(targets, ['wall','column','beam','slab']), 0, sceneUnits)` και επέστρεψε
  `member-placement` (ή νέο `kind:'vertex-placement'` αν χρειάζεσαι μόνο το flush σημείο χωρίς centerline —
  **απόφαση**: το `member-placement.start` ΕΙΝΑΙ ήδη το flush σημείο, μάλλον αρκεί).
  ⚠️ memberWidthMm=0 για polygon vertex (δεν υπάρχει «πλάτος» — θες σκέτο flush στην παρειά).
- +tests στο `bim/placement/__tests__/bim-cursor-snap.test.ts` (νέα kinds).

**Βήμα Β — ενεργοποίηση targets sync** για slab/roof/foundation (ώστε `sceneSnapTargetsStore` να είναι γεμάτο
όταν ενεργό το tool — δες `use-scene-snap-target-sync.ts` πώς το κάνει το wall/beam/column· ΙΔΙΟ pattern).

**Βήμα Γ — wire commit + preview** (preview ≡ commit, ΙΔΙΟ entry, ΧΩΡΙΣ findSnapPoint):
- **Commit**: ΑΠΟΦΑΣΗ τοποθεσίας — (i) γενίκευσε το column branch στο `mouse-handler-up.ts` ώστε να
  dispatch-άρει by `activeTool`→`toolKind` (κεντρικό, consistent με κολόνα), Ή (ii) μέσα στο `onCanvasClick`
  του tool (consistent με wall/beam). Δες ποιο είναι λιγότερο intrusive· κράτα ADR-040 staging υπόψη.
- **Preview**: στο `generateSlabPreview` (και foundation) — κάλεσε τον εγκέφαλο για να snap-άρεις την
  τρέχουσα κορυφή πριν χτίσεις το ghost outline. ΙΔΙΑ targets/cursor με το commit.

**Βήμα Δ (αν Φ6b) — edge-flush constraint:** όταν προηγούμενη κορυφή flush σε παρειά, ο επόμενος cursor
projection πάνω στην παρειά (slide). Reuse `bim/geometry/shared/polygon-axis-projection.ts`
(`projectPointOnAxis`). Νέος constraint στο hover handler (gated στα polygon tools).

**Βήμα Ε — tests + tsc + ADR.** jest στο placement + τυχόν tool tests. tsc ΜΟΝΟ αν χρειαστεί (N.17).
Ενημέρωσε ADR-514 (Φ6 πίνακας + changelog) + αν είναι μεγάλο feature, σκέψου §νέα στο ADR.

---

## 7. ΥΠΟΨΗΦΙΑ ΓΙΑ REUSE (μηδέν διπλότυπο)

| Αρχείο | Τι προσφέρει |
|--------|--------------|
| `bim/framing/linear-member-face-snap.ts` `resolveLinearMemberFaceSnap` | ΠΥΡΗΝΑΣ: cursor→παρειά→flush start + `MemberGhostSnapResult` + `GhostFaceFrame` |
| `bim/framing/member-ghost-snap.ts` `resolveMemberGhostSnapFromStore` | dispatcher column-priority→member, mm→scene· κάλεσέ τον με `memberKinds` |
| `bim/placement/bim-cursor-snap.ts` | ο εγκέφαλος — **επέκτεινε** `BimSnapToolKind` + branch (ΜΗΝ φτιάξεις άλλο) |
| `bim/columns/column-face-snap.ts` `resolveColumnFaceSnapFromTargets` | column face (Φ6c pad→κολόνα) |
| `bim/framing/scene-snap-targets.ts` | `sceneSnapTargetsStore` + `selectGhostMembers` (έτοιμα targets) |
| `hooks/drawing/use-scene-snap-target-sync.ts` | populator — ενεργοποίησέ τον για τα νέα tools |
| `bim/walls/wall-endpoint-snap.ts` | pattern «κράτα `.start` flush, αγνόησε `.end`» για POINT vertex snap |
| `bim/geometry/shared/polygon-axis-projection.ts` | `projectPointOnAxis` για edge-slide (Φ6b) |
| `systems/tracking/ambient-alignment-source.ts` | ΗΔΗ δίνει H/V alignment σε slab/foundation — ΜΗΝ διπλασιάσεις |
| `hooks/drawing/slab-preview-helpers.ts` `generateSlabPreview` | κοινό polygon ghost (slab/roof/floor-finish) |
| `hooks/drawing/wysiwyg-preview-shared.ts` `resolveEffectivePreviewCursor` | ο ήδη-snapped cursor για preview |

## ΚΕΝΑ (πρέπει να δημιουργηθούν)
1. `BimSnapToolKind` νέα kinds + branch στον εγκέφαλο.
2. Ενεργοποίηση `use-scene-snap-target-sync` για slab/roof/foundation.
3. Wire commit+preview (απόφαση τοποθεσίας §6 Βήμα Γ).
4. (Φ6b) edge-flush constraint slide.
5. (προαιρετικό) snap indicator/listening dims visual για polygon vertex.

---

## 8. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ

| Αρχείο | Ρόλος |
|--------|-------|
| `bim/placement/bim-cursor-snap.ts` | εγκέφαλος — επέκταση toolKind + branch |
| `bim/placement/__tests__/bim-cursor-snap.test.ts` | tests |
| `hooks/drawing/useSlabTool.ts` / `useRoofTool.ts` / `useFoundationTool.ts` | commit click path |
| `hooks/drawing/slab-preview-helpers.ts` / `foundation-preview-helpers.ts` | preview |
| `hooks/drawing/use-scene-snap-target-sync.ts` | targets populator (ενεργοποίηση) |
| `systems/cursor/mouse-handler-up.ts` | central commit (αν διαλέξεις κεντρικό dispatch — ADR-040!) |
| `bim/framing/member-ghost-snap.ts` + `linear-member-face-snap.ts` | reuse face-snap πυρήνας (ΜΗΝ άλλαξεις) |
| `docs/.../adrs/ADR-514-unified-bim-cursor-snap.md` | ADR (Φ6 πίνακας + changelog) |
| `.ssot-registry.json` module `bim-cursor-snap` | ο εγκέφαλος είναι registry-protected — νέα tools ΜΕΣΑ από αυτόν |

---

## 9. BROWSER-VERIFY CHECKLIST (δίνεται στον Giorgio μετά το Φ6)

`http://localhost:3000/dxf/viewer`, εργαλεία **Πλάκα / Στέγη / Θεμέλιο**.
1. Κορυφή πλάκας/στέγης κοντά σε παρειά τοίχου/κολόνας/δοκαριού → **flush κούμπωμα** + (Φ6b) ολίσθηση κατά μήκος παρειάς.
2. Foundation pad κοντά σε κολόνα → flush σε παρειά (Φ6c).
3. Μακριά από μέλη → ελεύθερος cursor (OSNAP/grid) **αμετάβλητος** (μηδέν regression).
4. H/V ambient alignment (ήδη υπάρχον) εξακολουθεί να δουλεύει — δεν το έσπασες.
5. Auto-close πολυγώνου (κλικ κοντά στην 1η κορυφή) δουλεύει κανονικά.

**Επόμενα (όχι τώρα):** ολοκλήρωση Φ6b/Φ6c αν έγινε μόνο Φ6a· browser-verify Φ2+Φ3 που εκκρεμεί.
