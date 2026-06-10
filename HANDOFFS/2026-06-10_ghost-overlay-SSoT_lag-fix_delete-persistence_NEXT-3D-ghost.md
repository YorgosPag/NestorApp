# 🧠 HANDOFF — MEP proposal-ghost SSoT (2Δ persistence + zero-lag) + delete-persistence fix · NEXT: 3Δ ghost wiring + tests + ADR

> **Σύνταξη:** Opus 4.8, 2026-06-10 (live verification session με Giorgio).
> **Working tree μοιράζεται με ΑΛΛΟΝ agent** → `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ `-A`**. **Commit/push κάνει ΜΟΝΟ ο Giorgio.** **ΜΗΝ αγγίξεις το `adr-index`.**
> **Dev server:** `http://localhost:3000/dxf/viewer`. **ΠΡΟΣΟΧΗ: νέα αρχεία/scheduler αλλαγές → χρειάζεται RESTART dev server (όχι μόνο refresh) για να πιάσει το turbopack.**

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ
1. Διάβασε αυτό το handoff + το εγκεκριμένο plan: `C:\Users\user\.claude\plans\lazy-weaving-shell.md`.
2. ADR-040 (preview-canvas architecture) — θα χρειαστεί changelog entry (βλ. ΕΚΚΡΕΜΗ).

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ + BROWSER-VERIFIED (live Giorgio) — **ΜΗΝ το ξαναγράψεις**

### 1. 2Δ proposal-ghost persistence (SSoT) — DONE+VERIFIED
**Bug:** τα 7 proposal ghosts (water/drainage/heating/electrical/hvac/fire/gas) ζωγράφιζαν στον **κοινό transient `PreviewCanvas`** (`getCanvas()`) που σκουπίζεται κάθε dirty frame → το ghost εξαφανιζόταν μόλις σταματούσε το ποντίκι.
**Fix (SSoT):** NEW `ProposalGhostOverlay.tsx` = generic **αποκλειστικός** `<canvas>` (mount μόνο όταν active) — τίποτα δεν τον σκουπίζει. Τα 7 mounts έγιναν thin (store-sub + `paint` closure). NEW `proposal-ghost-paint.ts` = SSoT `paintGhostSegments` (κοινός segment loop για τα 6 pipe/duct/fuel· electrical → `drawCircuitWires`).

### 2. Zero-lag pan (ghost **+** committed wires) — DONE+VERIFIED
**Bug:** το repaint γινόταν στο React `transform` prop (throttled) ενώ ο καμβάς κινείται με το **immediate transform** (60fps) → τα καλώδια έμεναν πίσω στο pan.
**Fix (SSoT):** NEW `rendering/core/immediate-transform-frame.ts` → `subscribeImmediateTransformFrame(id, name, onFrame)` + `immediateTransformSignature()` = register LOW-priority `UnifiedFrameScheduler` subsystem gated σε transform-signature, διαβάζοντας `getImmediateTransform()`. **3 καταναλωτές μετανάστευσαν** (αφαιρέθηκε τριπλοτυπία): `ProposalGhostOverlay`, `HomeRunWiresOverlay` (committed καλώδια — ήταν React-transform, τώρα zero-lag), `canvas-layer-stack-clash-overlay` (boy-scout). 3Δ camera overlay μένει χωριστό εσκεμμένα (camera sig, όχι 2Δ).

### 3. Delete-persistence (σωλήνες ύδρευσης επανεμφανίζονταν μετά reload) — DONE+VERIFIED
**Root cause (ground-truth από console diagnostics):** το `deleteDoc` πετύχαινε (`deleteDoc OK`) ΑΛΛΑ race: η Αποδοχή δημιουργεί δεκάδες σωλήνες → παράλληλα in-flight first-save `setDoc`· delete πριν ολοκληρωθεί το `setDoc` → `deleteDoc` σβήνει ανύπαρκτο doc → το `setDoc` ολοκληρώνεται **μετά** = **zombie doc** → reconciliation το ξαναφέρνει στο reload.
**Fix (belt-and-suspenders, `useMepSegmentPersistence.ts`):** (1) delete-listener: `deletedIdsRef.add(segmentId)` **συγχρόνως** πριν το async delete· (2) `persist` pre-write guard: skip αν ήδη deleted· (3) `persist` post-write: αν deleted ενώ in-flight → **compensating `deleteSegment`** (σβήνει το zombie). Μηδέν regression σε undo (restore effect γρ.75 καθαρίζει `deletedIdsRef`). **ΤΑ TEMP DIAGNOSTICS ΑΦΑΙΡΕΘΗΚΑΝ** (silent catch επανήλθε).

> Όλα τα παραπάνω: **diagnostics καθαρά (IDE getDiagnostics μηδέν errors)**. tsc full ΔΕΝ έτρεξε (N.17). jest ΔΕΝ γράφτηκε ακόμα (βλ. ΕΚΚΡΕΜΗ).

---

## 📁 ΑΡΧΕΙΑ (commit awareness — ΟΛΑ δικά μου)
**NEW:** `components/dxf-layout/ProposalGhostOverlay.tsx` · `components/dxf-layout/proposal-ghost-paint.ts` · `rendering/core/immediate-transform-frame.ts` · `bim-3d/proposal/proposal-ghost-3d-builders.ts` *(3Δ — builders ΜΟΝΟ, δεν είναι wired ακόμα)*
**MOD:** 7× `components/dxf-layout/canvas-layer-stack-{water,drainage,heating,electrical,hvac,fire,gas}-proposal-ghost.tsx` · `canvas-layer-stack-leaves.tsx` (+viewport prop) · `CanvasLayerStack.tsx` (viewport→PreviewCanvasMounts) · `HomeRunWiresOverlay.tsx` · `canvas-layer-stack-clash-overlay.tsx` · `systems/mep-design/electrical/electrical-proposal-store.ts` (+sceneUnits) · `ui/ribbon/hooks/useRibbonElectricalAutoBridge.ts` (+sceneUnits) · `ui/ribbon/hooks/useRibbonElectricalWeakAutoBridge.ts` (+sceneUnits) · `hooks/data/useMepSegmentPersistence.ts` (race guards)
**DELETED:** 7× `hooks/tools/use{Water,Drainage,Heating,Electrical,Hvac,Fire,Gas}ProposalGhostPreview.ts`

---

## 🔴 ΕΚΚΡΕΜΗ (ακριβή βήματα)

### A. 3Δ proposal ghost wiring (εγκεκριμένο plan — builders ΕΤΟΙΜΟΙ)
`bim-3d/proposal/proposal-ghost-3d-builders.ts` έχει ΗΔΗ: `buildElectricalGhost3D(wirePaths, sceneUnits)` (reuse `wirePathToMesh` polyline· translucent material) + `buildSegmentGhost3D(tubes: ProposalGhostTube[], sceneUnits)` (tube/segment) + interface `ProposalGhostTube{start,end,diameterMm,elevationMm,colorHex?}`. **Single-floor convention: `floorElevationMm=0`, `baseElevationM=0`** (όπως `bim3d-preview-rebuild`).
**ΛΕΙΠΟΥΝ 3 πράγματα:**
1. NEW `bim-3d/proposal/ProposalGhost3DOverlay.tsx` — generic: props `{managerRef, objects: THREE.Object3D[]|null}`. Στο change: remove+dispose προηγούμενο transient group, add νέο στη σκηνή μέσω **`managerRef.current.scene`** (public· επιβεβαιωμένο). `raycast=()=>{}`. Lifecycle mirror `bim-3d/placement/MepSegmentPlacementGhost.ts` (add/removeMesh/dispose). Unmount→cleanup.
2. NEW `bim-3d/proposal/ProposalGhost3DMount.tsx` — καλεί τα 7 `use{X}Proposal()` (σταθερός αριθμός hooks), βρίσκει το ΕΝΑ active review, φτιάχνει objects: electrical→`buildElectricalGhost3D(review.wirePaths, review.sceneUnits)`· τα 6 pipe→flatten `review.proposal.networks[].segments[]` σε `ProposalGhostTube[]` (elevation=`network.sourceElevationMm`, colorHex=`resolveSegmentClassificationColor(seg/network.classification)`)→`buildSegmentGhost3D`. Renders `<ProposalGhost3DOverlay managerRef objects/>`.
3. MOD `bim-3d/viewport/BimViewport3D.tsx` — mount `<ProposalGhost3DMount managerRef={managerRef}/>` δίπλα στο `<ClashMarkers3DOverlay managerRef={managerRef}/>` (import ~γρ.35· managerRef ~γρ.70).

### B. Tests
- NEW `components/dxf-layout/__tests__/ProposalGhostOverlay.test.tsx` (inactive→null· active+valid viewport→paint κλήθηκε· 0×0 guard)
- NEW `bim-3d/proposal/__tests__/proposal-ghost-3d-builders.test.ts` (electrical→meshes>0· pipe→1 tube/segment σωστό χρώμα/radius· empty→[])
- NEW test για `immediate-transform-frame.ts` (mock scheduler: registers· isDirty true on sig change· initial onFrame)

### C. Docs (N.15)
- **ADR-040 changelog:** proposal ghosts → αποκλειστικό SSoT `ProposalGhostOverlay` + zero-lag `subscribeImmediateTransformFrame` + νέο 3Δ overlay. **STAGE ADR-040** (CHECK 6B/6D — canvas/leaves/3D αρχεία).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` update αν υπάρχει σχετικό item. **ΜΗΝ adr-index.**

### D. #4 — 3Δ committed καλώδια ΔΕΝ φτάνουν στις μπρίζες (ξεχωριστό προϋπάρχον bug)
Τα committed home-run wires σε 3Δ «απέχουν» από τις μπρίζες (routing/elevation· πιθανό connector-elevation mismatch στο `wirePathToMesh`/`mep-wire-resolver`). **ΟΧΙ από τις αλλαγές μου.** Σχετίζεται με το 3Δ ghost (ίδιο routing). Διερεύνηση από Giorgio order.

---

## 🚫 ΜΗΝ
- ΜΗΝ commit/push (Giorgio· N.(-1)). ΜΗΝ adr-index. `git add` ΜΟΝΟ δικά σου, ΠΟΤΕ -A.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε ότι δεν τρέχει άλλος πριν).
- ΜΗΝ ξαναγράψεις τα verified (#1/#2/#3).
- ΜΗΝ σπάσεις το SSoT: `subscribeImmediateTransformFrame` (1 σημείο για clash+ghost+wires), `paintGhostSegments`, `ProposalGhostOverlay`.

## 🧭 NOTES
- **404 `*.scene.json` στο console = benign** (3-tier fallback στο `dxf-firestore-storage.impl.ts` — «file linked, scene never saved yet»). Όχι bug, όχι από τις αλλαγές μου.
- Πιθανό μελλοντικό SSoT: ο race-guard pattern (delete-tombstone) μπορεί να κεντρικοποιηθεί σε shared persist-wrapper για τα 7+ persistence hooks (peers practically μη-αναπαραγώγιμοι· low priority).
- Step-by-step verification με Giorgio: σαφή βήματα, εκτελεί, λέει «ΟΚ». **Confirm exact repro ΠΡΙΝ ξαναγράψεις κώδικα** (μάθημα: η 1η delete διάγνωση χρειάστηκε console ground-truth).
