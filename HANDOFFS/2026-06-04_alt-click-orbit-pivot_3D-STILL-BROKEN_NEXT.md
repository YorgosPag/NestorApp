# HANDOFF — Alt+click orbit-pivot (no-jump) + preview υφές/highlight/flicker

**Ημερομηνία:** 2026-06-04 · **Μοντέλο:** Opus 4.8 · **Κατάσταση:** 🔴 1 ανοιχτό bug (κύριο 3D)
**⚠️ Working tree ΚΟΙΝΟ με άλλον agent** → stage ΜΟΝΟ τα αρχεία της λίστας, ΠΟΤΕ `git add -A`. **Commit τον κάνει ο Giorgio, ΟΧΙ ο agent.**

---

## 🎯 Τι ζήτησε ο Giorgio
Alt+σύρσιμο (περιστροφή 3D) → **το σημείο του κλικ να γίνεται κέντρο περιστροφής**, με **το σχέδιο να μένει στη θέση του** (ΧΩΡΙΣ άλμα/κεντράρισμα). **SSOT** — ίδια συμπεριφορά στο κύριο 3D **και** στο «Edit Type» preview (τοίχου/πλάκας).

## ✅ Τι ΔΟΥΛΕΥΕΙ (browser-verified από Giorgio)
Στο **preview panel** όλα σωστά:
- Alt+σύρσιμο → rigid orbit γύρω από το σημείο, **χωρίς άλμα**.
- Υφές preview πλέον ταιριάζουν με 3D (τέλος «λωρίδες»).
- Highlight περιγράμματος στρώσης εφάπτεται ακριβώς, **χωρίς flicker** στο hover.

## 🔴 Τι ΔΕΝ δουλεύει — ΤΟ ΑΝΟΙΧΤΟ BUG
Στο **κύριο 3D viewport** (`/dxf/viewer`, ThreeJsSceneManager): το Alt+σύρσιμο **εξακολουθεί να περιστρέφεται γύρω από το ΚΕΝΤΡΟ ΤΗΣ ΟΘΟΝΗΣ**, το σημείο του κλικ ΔΕΝ γίνεται pivot. Παρέμεινε ίδιο **και μετά από full page reload (Ctrl+Shift+R)**.

**ΣΗΜΑΝΤΙΚΟ:** Η λογική είναι αποδεδειγμένα σωστή σε isolation — το integration test `tumble-rotation.test.ts` «FULL FLOW: Alt-press sets pivot → drag orbits around the CLICK point» **ΠΕΡΝΑΕΙ** (το σημείο μένει καρφωμένο σε NDC, το target μετακινείται). Άρα το bug είναι στο **runtime/wiring του ζωντανού viewport**, ΟΧΙ στα μαθηματικά.

### Ροή που υλοποιήθηκε (πρέπει να δουλεύει, αλλά δεν δουλεύει live)
`tumble.onPointerDown(Alt+left)` → `onAltPress(x,y)` → `ThreeJsSceneManager.setOrbitPivotAt` → `setBimOrbitPivot` (`raycastWorldPointOrPlane`: geometry hit ή camera-facing plane fallback μέσα από `currentTarget`) → `viewport.setOrbitPivot(point)` → `tumble.setPivot(point)` (θέτει `customPivot`, ΧΩΡΙΣ recenter) → `tumble.applyRotation` καλεί `orbitCameraAroundPivot(camera, customPivot ?? target, target, dx, dy, speed)`.

### Πρώτες υποψίες για debug (κατά σειρά)
1. **OrbitControls.update() κάθε frame** (`viewport-camera.ts` `update()` → `controls.update()`, `enableDamping=true`) πιθανόν να ΑΚΥΡΩΝΕΙ το rigid orbit στο live — κάτι που το isolated test ΔΕΝ καλύπτει (δεν έχει OrbitControls). **#1 ύποπτος.** Δοκίμασε: μετά το rigid orbit, μήπως το `controls.update()` κάνει `lookAt(target)` που επαναφέρει; (θεωρητικά no-op αν `camera.up=(0,1,0)` & κοιτά target, αλλά επιβεβαίωσέ το live με log του `camera.position`/`controls.target` πριν & μετά το `controls.update()`).
2. **Μήπως `onAltPress` ΔΕΝ πυροδοτείται live** — βάλε `console.log` στο `tumble.onPointerDown` (altKey? enabled?) και στο `setOrbitPivotAt` (ποιο σημείο επιστρέφει; off-center;).
3. **Stale module στον Next.js dev server** (όχι μόνο browser): δοκίμασε **πλήρες restart `npm run dev`** (νέο module `orbit-around-pivot.ts` + αλλαγές σε class-based imperative κώδικα μπορεί να μην hot-swap-άρονται στο ζωντανό instance).
4. **Μήπως η περιστροφή στο 3D δεν περνά από tumble** αλλά από OrbitControls/άλλο path (επιβεβαίωσε ποιο handler τρέχει στο Alt+drag).
5. `customPivot` persists για πάντα μέχρι νέο Alt-press — επιβεβαίωσε ότι δεν μηδενίζεται ενδιάμεσα.

### Debug-first σύσταση
Πρόσθεσε προσωρινά logs (ή τρέξε με Giorgio σε browser) στα 4 σημεία της ροής για να δεις ΠΟΥ σπάει: (α) πυροδοτείται onPointerDown με altKey; (β) τι point δίνει το raycast; (γ) τι είναι το customPivot στο applyRotation; (δ) τι κάνει το controls.update() μετά. **Μην ξαναγράψεις κώδικα στα τυφλά** (μάθημα συνεδρίας: 2 γύροι χάθηκαν από λάθος υποθέσεις — βλ. memory `feedback_confirm_repro_before_reimplementing`).

---

## 📂 Αρχεία (ΟΛΑ uncommitted, κοινό tree — stage ΜΟΝΟ αυτά)
**ΝΕΑ:**
- `src/subapps/dxf-viewer/bim-3d/viewport/orbit-around-pivot.ts` — SSoT rigid turntable orbit (pure)
- `src/subapps/dxf-viewer/bim-3d/preview/preview-pivot.ts` — preview pivot pick (plane fallback) + crosshair marker
- `src/subapps/dxf-viewer/bim-3d/__tests__/orbit-around-pivot.test.ts` (5)
- `src/subapps/dxf-viewer/bim-3d/__tests__/preview-pivot.test.ts` (6)
- `src/subapps/dxf-viewer/bim-3d/converters/__tests__/bim-uv-helpers.test.ts` (4)

**MODIFIED:**
- `.../bim-3d/viewport/tumble-rotation.ts` — `customPivot`/`setPivot`/`onAltPress`, `applyRotation`→SSoT orbit (αφαιρέθηκε pole-flip)
- `.../bim-3d/viewport/viewport-camera.ts` — option `onAltPress`· `setOrbitPivot`→`tumble.setPivot` (ΧΩΡΙΣ recenter)
- `.../bim-3d/scene/scene-setup.ts` — dep `onAltPress`
- `.../bim-3d/scene/ThreeJsSceneManager.ts` — wiring `onAltPress`→`setOrbitPivotAt` + `currentTarget: viewport.target`
- `.../bim-3d/scene/scene-manager-actions.ts` — `setBimOrbitPivot` plane fallback (`raycastWorldPointOrPlane` + `OrbitPivotDeps.currentTarget`)
- `.../bim-3d/systems/raycaster/BimEntityRaycaster.ts` — νέα `raycastWorldPointOrPlane` (geometry → plane fallback)
- `.../bim-3d/systems/raycaster/__tests__/BimEntityRaycaster.test.ts` — +4 tests fallback
- `.../bim-3d/preview/preview-orbit-controls.ts` — Alt+left rigid orbit (custom), `enablePan=false` όσο Alt· `setPivot` αποθηκεύει customPivot χωρίς recenter· OrbitControls rotate OFF
- `.../bim-3d/preview/WallTypePreviewRenderer.ts` — `setBoxWorldUvs`· pivot marker· highlight exact (scale 1.0, depthTest:false, στο bandGroup)· idempotent `setHighlight`· pick ΜΟΝΟ band meshes
- `.../bim-3d/preview/SlabTypePreviewRenderer.ts` — ίδιες αλλαγές με Wall
- `.../bim-3d/converters/bim-uv-helpers.ts` — νέα `setBoxWorldUvs` (per-face world-meter UV)
- `.../bim-3d/__tests__/tumble-rotation.test.ts` — +onAltPress +FULL FLOW tests· ενημ. pole test

**DOCS (ΜΗΝ αγγίξεις adr-index — κοινό tree):**
- `docs/.../adrs/ADR-366-...md` — Changelog §A.6.Q5 **v3** (plane fallback) + **v4** (rigid no-jump)
- `docs/.../adrs/ADR-414-...md` — entries (d)–(i)
- `docs/.../adrs/ADR-413-...md` — v1.1 (`setBoxWorldUvs`)

## ✅ Έλεγχοι
`tsc --noEmit`: **0 σφάλματα στα δικά μας αρχεία** (project exit=2 = γνωστά pre-existing αλλού). Tests: orbit-around-pivot 5/5, tumble 9/9 (incl. FULL FLOW), preview-pivot 6/6, bim-uv 4/4, BimEntityRaycaster 10/10.

## 🧠 SSOT σημείωση
Ο πυρήνας περιστροφής = ΕΝΑ αρχείο `orbit-around-pivot.ts`, κοινός main+preview. Διαφέρει μόνο η ανίχνευση gesture (tumble vs PreviewOrbitControls) + το pivot-pick (BIM meshes vs band meshes· και τα δύο με plane fallback). Πιθανή μελλοντική ενοποίηση του pivot-pick (Giorgio το ρώτησε, δεν επείγει).

## ⚠️ Εκκρεμότητες πέρα από το bug
- `viewport-camera.ts` έχει παλιό doc-comment στο `setOrbitPivot` («no visual jump because OrbitControls preserves offset») που πλέον ΔΕΝ ισχύει — διόρθωσέ το.
- POI cross flashάρει στο `viewport.target` (κέντρο), όχι στο `customPivot` — μικρό· σκέψου ένδειξη στο pivot όπως ο preview crosshair.
- N.15: αν κάτι από αυτά σχετίζεται με `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, ενημέρωσέ το στο commit.
