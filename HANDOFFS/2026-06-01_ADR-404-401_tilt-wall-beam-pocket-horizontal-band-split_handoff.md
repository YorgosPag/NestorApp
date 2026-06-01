# HANDOFF — ADR-404 ↔ ADR-401 · Οριζόντιος διαχωρισμός pocket γερμένου τοίχου στην κάτω παρειά δοκαριού

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: ΝΕΑ συνεδρία (καθαρό context) — **3D geometry refactor** του attach clip σε **κεκλιμένο** τοίχο.
- **🎯 Μοντέλο (N.14)**: **Opus** — cross-cutting geometry (ADR-401 clip ↔ ADR-404 tilt), ~2-3 αρχεία, 2 domains.
- **⚠️ COMMIT/PUSH**: **ΤΑ ΚΑΝΕΙ Ο GIORGIO**, ΟΧΙ ο agent.
- **🚨 Multi-agent**: το working tree **μοιράζεται με άλλον agent** (ADR-363 from-perimeter). Stage **ΜΟΝΟ** τα δικά σου hunks (`git add -p`)· **ΠΟΤΕ** `git checkout/restore` σε ξένα αρχεία.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
`"C:\Program Files\Git\cmd\git.exe" log --oneline -5` + `git status`. **ΠΡΟΣΟΧΗ:** πολλά αρχεία είναι **uncommitted/pending** (ADR-401/402/404 + ADR-363 από προηγούμενες συνεδρίες· ο Giorgio θα κάνει commit). Συγκεκριμένα τα `wall-top-clip.ts`, `BimToThreeConverter.ts`, `mesh-slope-shear.ts`, `column-piece-geometry.ts`, `wall-opening-pieces.ts`, `ADR-404-*.md`, `ADR-401-*.md` είναι **δουλειά ADR-404 tilt (Phase 1→4.1)** — **εξαρτάσαι** από αυτήν. ΜΗΝ υποθέσεις τι έγινε commit.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (Giorgio live, 2026-06-01)

**Σενάριο:** δοκάρι, από κάτω τοίχος. Περιστρέφεις/γέρνεις τον τοίχο (tilt X/Z ring, ADR-404) ώστε να σχηματιστεί φωλιά για να καθίσει το δοκάρι μέσα στον τοίχο. Ο τοίχος σπάει σε **7 κομμάτια**:
- 2 ακριανά **παραλληλόγραμμα** (αριστερά/δεξιά), ύψος 3m (nominal).
- 2 **μεταβατικά τρίγωνα** ύψος 3m (nominal) — δίπλα στα ακριανά.
- κάτω από το δοκάρι: 2 **τρίγωνα** + 1 **ορθογώνιο**, ύψος 2.5m (= κάτω παρειά δοκαριού· δοκάρι 0.5m, τοίχος 3m → underside 2.5m).

**Σύμπτωμα:** τα **2 μεταβατικά τρίγωνα των 3m** δεν συμπεριφέρονται σωστά. Κάθε τέτοιο τρίγωνο είναι ένα prism από τη **βάση (0) έως 3m**, αλλά **λόγω της λοξάδας** η **κάτοψη της κάτω πλευράς (βάση) διαφέρει από την κάτοψη της πάνω πλευράς (κορυφή)** — το prism γέρνει και τα δύο τρίγωνα (nominal@3 και underside@2.5) δεν «δένουν» καθαρά.

---

## 2. ROOT CAUSE (code = source of truth)

`clipWallBandTopRegions` (`bim-3d/converters/wall-top-clip.ts`) σπάει το plan-quad κάθε **profile-following** κομματιού (jamb/μεταβατικό) σε **κατακόρυφα prisms από τη βάση**:
- **inside** = `quad ∩ ⋃ hosts` → `top = host underside` (π.χ. 2.5), `base = baseLocalM` (0).
- **outside** = `quad − ⋃ hosts` → `top = nominal` (3.0), `base = baseLocalM` (0).

Σε διαγώνια διασταύρωση δοκαριού, μια μεταβατική ζώνη βγάζει **2 τρίγωνα**: ένα outside@3.0 (0→3.0) + ένα inside@2.5 (0→2.5), που μοιράζονται τη διαγώνια ακμή του host.

**Ο περιορισμός:** ο `buildColumnPrismGeometry` (`column-piece-geometry.ts`) χτίζει prism με **ΕΝΑ footprint** (ίδια κάτοψη πάνω & κάτω) + per-corner ύψη· ο τελικός tilt shear (ADR-404 Phase 4, στο `emit()`) γέρνει το prism **ομοιόμορφα**. Άρα ένα prism **δεν μπορεί** να έχει διαφορετικό σχήμα κάτοψης στη βάση από την κορυφή. Όταν ο τοίχος γέρνει, τα δύο μεταβατικά τρίγωνα (που ξεκινούν από τη βάση) εμφανίζουν την περιττή διαγώνια **κάτω από το δοκάρι** + ασυνέπεια κάτοψης βάσης/κορυφής.

**Σημ.:** το ADR-404 Phase 4.1 (`tiltCompensateWallTopClip`) ήδη μετατοπίζει τα host footprints κατά `−shear(Hu)` ώστε το pocket να προσγειώνεται κάτω από το δοκάρι μετά τον shear — αυτό **μένει** και είναι σωστό. Το παρόν είναι **ορθογώνιο** πρόβλημα: η **κατακόρυφη δομή** των κομματιών.

---

## 3. Η ΛΥΣΗ (πρόταση Giorgio — Revit-correct) — **7 → 9 κομμάτια**

**Οριζόντιος διαχωρισμός των μεταβατικών κομματιών στην κάτω παρειά του δοκαριού (`Hu`).**
Κάθε ένα από τα **2 εξωτερικά (nominal) τρίγωνα** που σήμερα πάνε `0→nominal` σπάει στα `Hu`
σε **κάτω** (`base→Hu`) + **πάνω** (`Hu→nominal`) → **+2 κομμάτια = 9** συνολικά. Τα inside
τρίγωνα + το inside ορθογώνιο (`base→Hu`, κάτω από το δοκάρι) **μένουν ως έχουν**.

### 🔴 ΚΡΙΣΙΜΟ — γιατί το πάνω band ΔΕΝ είναι απλό sheared prism
Το **δοκάρι είναι κατακόρυφο** (οι παρειές του δεν γέρνουν) → η εγκοπή όπου ακουμπά πρέπει να
έχει **κατακόρυφη κοπή**. Ο **τοίχος γέρνει**. Άρα στη ζώνη `Hu→nominal`:
- οι **παρειές του τοίχου** (outer/inner) μετατοπίζονται με το ύψος (lean),
- η **κοπή του δοκαριού μένει κατακόρυφη** (η διαγώνια ακμή του host = κατακόρυφο επίπεδο),
- επειδή η ακμή του host είναι **διαγώνια** στην κάτοψη, η lean-μετατόπιση τέμνει τη διαγώνια σε
  **διαφορετικό σημείο σε κάθε ύψος** → το **αποτύπωμα ΑΛΛΑΖΕΙ ΣΧΗΜΑ** όσο ανεβαίνεις από `Hu`
  στο `nominal` (όχι απλώς μετατοπίζεται). **base-footprint (@Hu) ≠ top-footprint (@nominal).**

➡️ Άρα ένα `buildColumnPrismGeometry` (ΕΝΑ footprint + ομοιόμορφος shear στο `emit()`) **ΔΕΝ
αρκεί** για το πάνω band — θα έγερνε ΚΑΙ την κοπή του δοκαριού → mismatch με το κατακόρυφο
δοκάρι (gap/overlap). Χρειάζεται **στερεό με γερμένες παρειές + κατακόρυφη κοπή** (διαφορετικά
top/bottom footprints).

### Δομή 9 κομματιών (ανά μεταβατική ζώνη)
| Κομμάτι | Ζώνη ύψους | Κάτοψη | Κατασκευή |
|---|---|---|---|
| inside τρίγωνο (μένει) | `base→Hu` | `quad ∩ host` | σταθερό footprint prism (γέρνει ομοιόμορφα) |
| **κάτω** outside (ΝΕΟ split) | `base→Hu` | `quad − host` | σταθερό footprint prism (γέρνει ομοιόμορφα) |
| **πάνω** outside (ΝΕΟ, special) | `Hu→nominal` | μεταβάλλεται! | **loft/wedge**: γερμένες παρειές + **κατακόρυφη** κοπή host |

(Τα 2 ακριανά παραλληλόγραμμα + το inside ορθογώνιο: αμετάβλητα.)

### Πώς χτίζεται το «πάνω» band (κατακόρυφη κοπή)
Σκέψου το στον **un-sheared** χώρο: η κατακόρυφη κοπή του δοκαριού, υπό inverse-shear, γίνεται
**γραμμικά κινούμενη** κοπή με το ύψος → το un-sheared στερεό έχει **bottom-footprint @Hu** =
`quad − (host − shear(Hu))` και **top-footprint @nominal** = `quad − (host − shear(nominal))`,
με **γραμμική** μετάβαση ενδιάμεσα. Μετά εφαρμόζεται ο ομοιόμορφος shear (`emit`) → στον world
χώρο η κοπή ξαναγίνεται κατακόρυφη. Υποψήφιες υλοποιήσεις (αποφασίζει η νέα συνεδρία, Plan Mode):
- **(προτιμώμενο) loft builder** που γενικεύει το `buildSlopedWallPieceGeometry` (8-vertex wedge):
  εδώ το **footprint** μεταβάλλεται γραμμικά (όχι μόνο το top height) — bottom triangle (@Hu) →
  top triangle (@nominal), connect corresponding vertices. Προσοχή σε διαφορετικό vertex count
  bottom vs top (ο host μπορεί να μπει/βγει από το quad μέσα στο band).
- **εναλλακτικά** 3D boolean (sheared wall slab band − vertical beam box) — exact αλλά βαρύ.

### Πού να γίνει
- `clipWallBandTopRegions` (ή νέα tilt-aware έκδοση): για **κεκλιμένο** τοίχο, σπάσε τα outside
  regions στα `Hu` → κάτω (σταθερό) + πάνω (μεταβλητό). Επέστρεψε ξεχωριστά τα δύο, με ένδειξη
  ότι το «πάνω» χρειάζεται τον loft builder (διαφορετικά footprints `@Hu`/`@nominal`).
- `BimToThreeConverter.buildStraightWallWithOpenings`: το `emit()` (Phase 4 shear) μένει· το «πάνω»
  band κατασκευάζεται με τον νέο loft builder και μετά περνά κι αυτό από τον ίδιο `emit()` shear.
- `tiltCompensateWallTopClip` (Phase 4.1): **ΜΕΝΕΙ** — δίνει το σωστό `shear(Hu)` offset· το
  «πάνω» band χρειάζεται επιπλέον το `shear(nominal)` offset για το top-footprint.

### Προσοχές / scope
- **Single flat host** = ο καθαρός στόχος (reported σενάριο). **Multiple hosts διαφορετικού ύψους /
  sloped underside** → πολλαπλά bands — **follow-up**, μην το λύσεις τώρα (fallback/τεκμηρίωση).
- **Gate σε `isWallTilted`**: για **κατακόρυφο** τοίχο shear(h)=0 → το «πάνω» band footprint είναι
  σταθερό (top==bottom) → ίδιο 3D solid με σήμερα. Πιο ασφαλές να ενεργοποιείται μόνο σε tilted
  (μηδέν blast radius στο vertical clip + tests).
- **Watertight:** lower-outside-top (@Hu) ≡ upper-band-bottom (@Hu) (ίδιο footprint `quad − (host
  − shear(Hu))`)· η κατακόρυφη κοπή του «πάνω» band ≡ η κατακόρυφη παρειά του δοκαριού.
- **Base-attach / κεκλιμένη βάση:** ο gate `flatBase` (BimToThreeConverter) ισχύει — μην το πειράξεις.
- **Edges:** `attachEdgesProjection` τρέχει per-prism → οι ακμές ακολουθούν αυτόματα.

---

## 4. RECOGNITION (Phase 1 — διάβασε ΠΡΩΤΑ)
1. `bim-3d/converters/wall-top-clip.ts` — `clipWallBandTopRegions` (γρ.~203-251· inside/outside regions, base=baseLocalM) + `tiltCompensateWallTopClip` (ADR-404 Phase 4.1 — host un-shear, ΜΕΝΕΙ).
2. `bim-3d/converters/BimToThreeConverter.ts` — `buildStraightWallWithOpenings` (το `if (effTopClip && pc.topFollowsProfile && flatBase)` block που καλεί `clipWallBandTopRegions` + `emit(prism, floorY)`· ο `emit` εφαρμόζει `applyWallTilt`).
3. `bim-3d/converters/column-piece-geometry.ts` — `buildColumnPrismGeometry` (per-corner base/top· ΕΝΑ footprint — γι' αυτό χρειάζονται 2 prisms).
4. `bim-3d/converters/mesh-slope-shear.ts` — `applyWallTilt(geo, params, baseHeightM)` (Phase 4· ο shear που γέρνει τα prisms).
5. `bim/geometry/host-footprint-eval.ts` — `hostUndersideAt`/`hostUndersidePlaneMm` (το `Hu` ανά σημείο).
6. ADR-404 §Phase 4 + 4.1 + ADR-401 §2.4 (γωνιακή διασταύρωση clip).
7. Tests: `bim-3d/converters/__tests__/wall-top-angled-crossing.test.ts` (assert-άρει το **τρέχον** «2 τρίγωνα» — θα αλλάξει αν δεν κάνεις gate· βλ. §5), `wall-tilt-attach-clip-3d.test.ts`, `wall-tilt-pieces-3d.test.ts`.

---

## 5. Tests (στόχος)
- **ΝΕΟ** test (κεκλιμένος attached τοίχος + flat diagonal host @Hu):
  - Το outside (nominal) region σπάει στα `Hu` → κάτω (`base→Hu`, σταθερό footprint) + πάνω
    (`Hu→nominal`). Επαλήθευση **7→9** κομμάτια στη μεταβατική περίπτωση.
  - **Κατακόρυφη κοπή:** η παρειά κοπής του «πάνω» band είναι **κατακόρυφη στον world** (ίδιο
    plan-x/-y σε `Hu` και `nominal` στην ακμή του host), ενώ οι παρειές τοίχου **γέρνουν** →
    `base-footprint(@Hu) ≠ top-footprint(@nominal)` (το ζητούμενο).
  - Watertight: lower-outside-top(@Hu) ≡ upper-band-bottom(@Hu).
  - flat τοίχος → αμετάβλητο (gate σε tilted).
- **Gate σε tilted** → τα υπάρχοντα `wall-top-angled-crossing.test.ts` (που περιμένουν «2 τρίγωνα»
  στο vertical) μένουν πράσινα. Αν εφαρμοστεί παντού → ενημέρωσέ τα.
- Regression: `npx jest wall-top-angled-crossing wall-tilt-attach-clip-3d wall-tilt-pieces-3d wall-opening-pieces column-piece-geometry`.
- `npx tsc --noEmit` (touched) → 0.
- 🔴 **Browser (Giorgio):** γερμένος τοίχος + δοκάρι → κάτω από το δοκάρι κανονικά· πάνω από το
  δοκάρι (Hu→nominal) ο τοίχος **αγκαλιάζει πλήρως** το κατακόρυφο δοκάρι (καμία τρύπα/υπέρβαση,
  κατακόρυφη κοπή)· ίσιος τοίχος αμετάβλητος.

---

## 6. ADR + trackers (Phase 3, ίδιο commit — N.15)
- `ADR-404-*.md` (Phase 4.2; changelog) + `ADR-401-*.md` §2.4 (clip band model).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr404_3d_bim_tilt.md`.
- ⚠️ `adr-index.md` ΟΧΙ (το πειράζει ο from-perimeter agent — multi-agent guard).

## 7. Multi-agent — ΜΗΝ αγγίξεις (uncommitted, άλλου agent)
ADR-363 from-perimeter: `ribbon-contextual-config.ts`, `bim/walls/wall-from-entity.ts`, `perimeter-from-faces.ts`, `column-from-faces.ts`, `dxf-canvas-renderer.ts`, `useCanvasClickHandler.ts`, `use-wall-commit.ts`, `useWallTool.ts`, `wall-tool-types.ts`, `useSpecialTools.ts`, `EventBus.ts`, `tool-definitions.ts`, `home-tab-draw.ts`, `adr-index.md`, `ADR-363*.md`, i18n `dxf-viewer-shell.json`, `column-types.ts`/`column.schemas.ts`/`column-validator.ts`, `column-geometry.ts`/`safe-polygon-boolean.ts` (Φ2 U-shape/composite).
**ΣΥΝ-ΕΠΕΞΕΡΓΑΣΙΑ (pending ADR-401/404):** `wall-top-clip.ts`, `BimToThreeConverter.ts`, `column-piece-geometry.ts` — surgical, `git add -p`.

## 8. Refs
- Code: `wall-top-clip.ts` (`clipWallBandTopRegions`, `tiltCompensateWallTopClip`), `BimToThreeConverter.ts` (`buildStraightWallWithOpenings.emit`), `column-piece-geometry.ts`, `mesh-slope-shear.ts` (`applyWallTilt`).
- ADR: `ADR-404-3d-bim-element-tilt.md` (Phase 4/4.1), `ADR-401-*.md` §2.4.
- Memory: `project_adr404_3d_bim_tilt.md`, `project_adr401_wall_top_constraints.md`.
