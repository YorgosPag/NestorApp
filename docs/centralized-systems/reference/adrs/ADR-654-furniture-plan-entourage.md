# ADR-654 — Βιβλιοθήκη 2D Επίπλων σε Κάτοψη (Entourage)

**Status**: Accepted (M1–M5 υλοποιημένα· M6 άνθρωποι+οχήματα — Φάσεις 1–4 υλοποιημένες: builder+assets+vision+data+generic engine+UI/wiring· εκκρεμεί μόνο το upload στο Storage)
**Date**: 2026-07-14
**Σχετικά**: ADR-651 (ImageEntity), ADR-652 (Block Library), ADR-413 (PBR textures / asset source), ADR-600 (placement tool SSoT), ADR-643 (hatch image fill), ADR-040 (micro-leaf), ADR-584 / N.18 (jscpd)

---

## 1. Πρόβλημα

Οι κατόψεις του DXF viewer διαβάζονται ως σκέτες γραμμές. Για παρουσίαση σε πελάτη θέλουμε
**φωτορεαλιστικά έπιπλα σε κάτοψη** (top-view cut-outs με alpha) πάνω στο σχέδιο — το κλασικό
«presentation plan» της αρχιτεκτονικής πρακτικής.

Ο Giorgio διαθέτει pack 236 TIF + 22 χαλιά (2007). **Δεν είναι υλικά/hatch**: τα hatch textures
είναι tileable patterns που γεμίζουν περιοχή· αυτά είναι μεμονωμένα αντικείμενα που μπαίνουν μία
φορά, με πραγματικό μέγεθος και περιστροφή.

## 2. Ground truth (τι βρέθηκε στα ίδια τα αρχεία, όχι υποθέσεις)

| Εύρημα | Συνέπεια |
|---|---|
| `SamplesPerPixel=4`, alpha min 0 / max 255 | Πραγματικά cut-outs — **καμία** αφαίρεση φόντου |
| Ένα TIF = **πολλά** έπιπλα (`001.tif` = καναπές + 2 πολυθρόνες) | Χρειάζεται **connected-components split** στο alpha |
| Η κλίμακα **δεν** είναι ενιαία (τα μονά αρχεία γυρίστηκαν αλλιώς από τα σετ) | Το μέγεθος **δεν** συνάγεται από pixels — το ορίζει η κατηγορία |
| Τα sprites **δεν** έχουν κοινό προσανατολισμό (διθέσιοι κάθετοι, aspect 0.57) | Η κατηγορία ορίζει **μεγάλη πλευρά**, όχι «πλάτος» |

Το τελευταίο είναι το λεπτό: αν η κατηγορία όριζε «πλάτος 1500mm» και το εφαρμόζαμε στον άξονα x,
ένας κάθετα γυρισμένος διθέσιος θα έβγαινε **2632mm βαθύς**. Με το μοντέλο «μεγάλη πλευρά» βγαίνει
857 × 1500 — σωστό. Επαλήθευση: το διπλό κρεβάτι βγαίνει 1567 × 2000mm.

## 3. Απόφαση

**Το έπιπλο κάτοψης είναι `ImageEntity`** (ADR-651 Φάση Ε), όχι νέος entity type και όχι
`BlockLibraryItem`.

Γιατί όχι reuse του Block Library: το `BlockLibraryItem.geometryUrl` είναι **πάντα** serialized
vector `Entity[]` blob και το thumbnail είναι **ρητά** vector-only (`block-thumbnail.ts`). Raster
μέσα εκεί θα έσπαγε δύο contracts. Το `ImageEntity` είναι ήδη πλήρως καλωδιωμένο σε selection /
hit-test / move / rotate / scale / bounds / z-order / persistence / DXF export (IMAGE + IMAGEDEF).

Δύο υπάρχοντα SSoT patterns γίνονται mirror — **κανένας νέος μηχανισμός**:

- **Asset serving** → `createAssetSourceResolver` (βλ. §4)
- **Placement** → `createSingleClickPlacementTool` (ADR-600), με το «ποιο έπιπλο» σε selection
  store που διαβάζεται σε **event-time** (ADR-040 — μηδέν high-freq React state)

## 4. Νέο SSoT: `createAssetSourceResolver`

Το ADR-413 (`texture-source.ts`) είχε ήδη τον ακριβή μηχανισμό που χρειαζόμασταν: builtin assets
που σε dev σερβίρονται από `public/` και σε production από Firebase Storage, με mode switch και
in-flight de-dup. Δεύτερο αντίγραφο θα ήταν **ακριβώς** το token-based sibling clone που απαγορεύει
ο N.18 (ADR-584).

Άρα ο μηχανισμός **εξήχθη** σε `systems/assets/create-asset-source-resolver.ts` και τον κάνουν
configure **και οι δύο** βιβλιοθήκες:

| Βιβλιοθήκη | publicRoot | storageRoot | env flag |
|---|---|---|---|
| PBR textures (413) | `/textures` | `bim-texture-library` | `NEXT_PUBLIC_BIM_TEXTURE_SOURCE` |
| Έπιπλα κάτοψης (654) | `/furniture-2d` | `furniture-2d-library` | `NEXT_PUBLIC_FURNITURE_PLAN_SOURCE` |

Το δημόσιο API του `texture-source.ts` έμεινε **byte-identical** — κανένας consumer δεν άλλαξε.
`npm run jscpd:diff` στα 7 αρχεία: καθαρό.

## 5. Κλίμακα — ο SSoT του μεγέθους

`FURNITURE_PLAN_LONG_SIDE_MM` (`data/furniture-plan-catalog.ts`) — **μήκος** (μεγάλη πλευρά) ανά
κατηγορία, τυπικές διαστάσεις επίπλου:

```
sofa3 2100 · sofa2 1500 · armchair 900 · recliner 1600 · chair 500
officeChair 650 · bedDouble 2000 · bedSingle 2000 · rug 2400
```

`getFurniturePlanSizeMm(id)` εφαρμόζει το μήκος στη **μεγάλη** διάσταση του sprite· η μικρή
προκύπτει από το `aspect` ⇒ **μηδέν παραμόρφωση, ποτέ**.

Δύο μετατροπές στο `place-furniture-plan.ts`, μία φορά:

1. **mm → scene units** μέσω του SSoT `mmToSceneUnits` (η σκηνή μπορεί να είναι mm/cm/m) — ποτέ
   inline `/1000`.
2. **κλικ = ΚΕΝΤΡΟ → `position` = κάτω-αριστερή γωνία** (σύμβαση DXF INSERT, y-up).

## 6. URL prefetch — γιατί το selection store κρατά `{id, url}`

`resolveFurniturePlanUrl` είναι **async** (storage mode → `getDownloadURL`), αλλά το placement
διαβάζει σε **event-time** μέσα στον click handler, όπου δεν χωράει `await`. Άρα η παλέτα κάνει
resolve **μία φορά τη στιγμή της επιλογής** (proactive) και το store κρατά έτοιμο url. Όσο δεν
έχει γίνει resolve, η επιλογή είναι `null` ⇒ το tool δεν τοποθετεί. **Μηδέν race, ποτέ entity με
κενό src.**

## 7. Layer

Όλο το entourage προσγειώνεται στο `FURNITURE-2D` layer ⇒ ανοιγοκλείνει με ένα κλικ (τεχνική
εκτύπωση vs παρουσίαση πελάτη). Το z-order δουλεύει ήδη: το υπάρχον `ReorderEntityCommand` είναι
type-agnostic, άρα send-to-back βάζει τα έπιπλα κάτω από τις γραμμές των τοίχων.

## 8. Asset pipeline

`scripts/build-furniture-plan-assets.js` (+ `scripts/lib/alpha-connected-components.js`, pure &
unit-tested). TIF → split → crop → WebP (alpha, max 1024px) + thumb 256px + manifest.
Τα `.webp` **δεν** μπαίνουν στο git (ίδια σύμβαση με `public/textures/*.jpg` του ADR-413).

Νέο devDependency: `sharp` (Apache-2.0 ✅ N.5).

## 9. Ιθαγένεια καμβά — redraw · hover · grips (ΕΚΛΕΙΣΕ, 2026-07-14)

Το sprite (`ImageEntity`) **δημιουργούνταν** και **ζωγραφιζόταν** σωστά, αλλά δεν ήταν πολίτης
πρώτης κατηγορίας: δεν φαινόταν αμέσως, δεν έκανε hover, δεν έπιαναν οι λαβές. Τρεις ξεχωριστές
ρίζες — ΟΛΕΣ «ο τύπος `image` ξεχάστηκε σε ένα registry», σιωπηλά (`default → null`):

| # | Σύμπτωμα | Ρίζα | Λύση |
|---|---|---|---|
| 1 | «θέλει ανανέωση για να φανεί» | Το async `img.decode()` καλούσε ΜΟΝΟ `markAllCanvasDirty()`. Ο `DxfBitmapCache` (ADR-040 Φάση D) ήταν **HIT** (scene/transform/viewport/DPR αμετάβλητα) → ξανα-blit του **παλιού** bitmap με το placeholder. | `subscribeImageAssetReady` σήμα στο `HatchImageCache` + `bitmapCache.invalidate()` στο `useDxfCanvasCacheInvalidation` — **ίδιο συμβόλαιο με το `subscribeFontReady`** (ADR-530): one-time event, εκτός cache key. Διορθώνει ΚΑΙ το image-fill hatch (ίδια λανθάνουσα ρίζα). |
| 2 | δεν κάνει hover / δεν επιλέγεται με κλικ | `BoundsCalculator` (`Bounds.ts`) **και** `convertDxfEntityToEntityModel` δεν είχαν `case 'image'` → χωρίς bbox το entity **ποτέ δεν έμπαινε στο spatial index**. (Το marquee δούλευε γιατί περνά από ΑΛΛΟ bounds SSoT — η ασυμμετρία που έκρυβε το bug.) | `case 'image'` και στα δύο. Το `ENTITY_BOUNDS_PROVIDERS.image` δρομολογείται πλέον στον **ίδιο** `BoundsCalculator` → marquee ≡ hover ≡ κλικ, μία υλοποίηση. |
| 3 | οι λαβές δεν μετακινούν την εικόνα | `GRIP_PRODUCERS` δεν είχε `image` → `[]`. Ο `ImageRenderer.getGrips()` ζωγράφιζε 8 άτυπες λαβές που **κανείς δεν έπιανε** (render ≠ interaction). | Νέο `bim/image/image-grips.ts` (SSoT): MOVE (κέντρο) + ROTATION (μέσο πάνω ακμής) + 4 γωνιακές SIZE. Ο renderer **καλεί το ίδιο** `getImageGrips` → render ≡ interaction. |

**Λαβές (Revit «Image» / Figma frame parity)** — μηδέν νέα γεωμετρία:
- θέσεις από το κοινό `RectFrame` (`bim/grips/rect-frame.ts`), rotation-aware·
- γωνιακό resize από τον κοινό `rect-grip-engine` (**αντίθετη γωνία σταθερή**, ίδια σημασιολογία με
  τοίχο/κολόνα/block) → patch `{position, width, height}`·
- περιστροφή από τον κοινό swept-angle SSoT (`rotateEntityGripDragDeg` — thin adapter πάνω στο
  `rotateEntityGripDrag`, γιατί η εικόνα κρατά **μοίρες** `rotation`, όχι `angleRad`)·
- commit + live ghost τρέχουν το **ίδιο** `applyImageGripDrag` (preview ≡ commit εξ ορισμού), μέσω
  `commitParametricAnnotationGripDrag` → `UpdateEntityCommand` (flat params, χωρίς geometry cache).

**Λόγος πλευρών (απόφαση Giorgio, 2026-07-14)**: η γωνιακή λαβή **κλειδώνει** τον λόγο πλευρών
(uniform scale — καμία παραμόρφωση)· το **Shift τον ελευθερώνει** για ελεύθερο stretch
(Figma/Illustrator/PowerPoint parity — μια εικόνα σπάνια θέλει παραμόρφωση, άρα το ασφαλές είναι το
default). Η αναλογική συστολή ζει στο **κοινό** `rect-grip-engine` (`lockAspect`, κυρίαρχος άξονας),
όχι ιδιωτικά στην εικόνα· ο ζωντανός Shift διαβάζεται από το `ShiftKeyTracker` **και** στο commit
**και** στο ghost → preview ≡ commit.

Ισχύει **ταυτόχρονα** για entourage, furniture-plan sprites και τη σφραγίδα πινακίδας (ADR-651) —
μοιράζονται 100% τον ίδιο renderer/hit-test/grip κώδικα.

> **Επακόλουθο — ADR-587 Φ10 (2026-07-14).** Η ρίζα #2 δεν ήταν ατύχημα της εικόνας: τα τρία seams
> που την έκρυψαν (`Bounds` / `hit-test-entity-model` / `performDetailedHitTest`) **δεν είχαν
> coverage test**, σε αντίθεση με 16 άλλα seams του repo. Η Φ10 τα έκανε introspectable registries
> δεμένα στο `RENDERABLE_ENTITY_TYPES` → πλέον **σπάνε στο build**. Στην πορεία αποκάλυψε **δύο
> ακόμη ζωντανά θύματα του ίδιου μοτίβου**: `wall-covering` και `railing` ζωγραφίζονταν αλλά **δεν
> επιλέγονταν με κλικ**. Βλ. ADR-587 §5 Φ10.

## 10. Εκκρεμεί

- **Άδεια χρήσης**: το pack το **παρήγαγε ο ίδιος** ο φίλος του Giorgio (τα δημιούργησε και τα
  εμπορευόταν· δεν ασχολείται πλέον) και του έδωσε άδεια χρήσης το 2007. Δηλαδή η άδεια προέρχεται
  από τον **δημιουργό**, όχι από ενδιάμεσο μεταπωλητή. Ο Giorgio μπορεί να την προσκομίσει γραπτώς.
- **Πλήρες pack** (~450 κομμάτια από 258 αρχεία): χρειάζεται κατηγοριοποίηση. Χειροκίνητα ή με
  vision AI (υπάρχει ήδη gpt-4o-mini vision pipeline). Το pilot ταξινομήθηκε με το χέρι (19).

---

## Changelog

### 2026-07-14 — Grip-drag feedback εικόνας = wall parity (5 ενδείξεις, opt-in σε shared SSoT)

Ο Giorgio ζήτησε κατά το grip-drag (περιστροφή / resize / μετακίνηση) της εικόνας να ενεργοποιούνται ΟΛΕΣ
οι ενδείξεις που δείχνει ο τοίχος. Κάθε ένα είναι shared SSoT όπου η εικόνα απλώς **δεν είχε δηλωθεί** —
**μηδέν νέος μηχανισμός**, κάθε αλλαγή καθρεφτίζει υπάρχον entity (text / opening-info-tag). SSoT audit
(grep) πρώτα (3 παράλληλα investigations). Plan Mode, incremental, όλα δικά μου αρχεία.

1. **Διακεκομμένη γραμμή περιστροφής ταυτισμένη με τις πλευρές** — `move-glyph-frame.ts` (η εικόνα μπαίνει
   στον text-branch: top-level `rotation` deg → frame· extend condition = μηδέν clone) + `rotate-reference-axis.ts`
   `entityCentre` (+κλάδος image → `imageRectFrame().center` για το toward-body flip). Επίσης ενεργοποιεί
   directional move glyph. Tests: `move-glyph-frame` +2, `rotate-reference-axis` +2.
2. **Λευκές μετρήσεις πλευρών + γωνίας** — `grip-ghost-preview-hud-helpers.ts` `drawMemberGripHud` (+κλάδος
   `type==='image'`: 4 ακμές μέσω `imageEntityRectVertices`, `specLabel=''` — καθρέφτης opening-info-tag).
   Gate: resize grips μόνο (`!movesEntity && !rotatePivot`).
3. **Σιελ-κυανές clearance προς γείτονες** — `entity-footprint-for-dims.ts` (+κλάδος image → rotation-aware
   4-γωνο footprint). Η κινούμενη εικόνα δείχνει cyan προς **όλους** τους structural + DXF γείτονες. Tests +2.
   ⚠️ **Deferred**: εικόνα-ΩΣ-γείτονας (image↔image) — θα απαιτούσε προσθήκη στο `scene-snap-targets`, που έχει
   blast radius στο placement-snap (κολόνες θα κολλούσαν σε εικόνες). Χρειάζεται clearance-only target channel.
4. **Λευκά ίχνη ευθυγράμμισης** — move grip ήδη δούλευε (entity-agnostic base-point). +images-ΩΣ-source
   (`ambient-alignment-source.ts`: 4 rotated corners + centroid) + resize-anchor (`grip-drag-alignment-role.ts`:
   dragged handle → smart-guide, gated 'image'). Tests +4.
5. **Κίτρινα/πορτοκαλί πολαρ** — η περιστροφή ενεργοποιεί το rotation polar ray αυτόματα (η εικόνα είναι πλέον
   hot-grip rotate → `rotatePivot` set → `paintRotationTracking`, ίδιο path με scale-bar/opening-info-tag).
   ⚠️ **Deferred**: πολαρ-σε-resize — απαιτεί classification των image resize kinds ως footprint-reshape (τα sprite
   δεν είναι footprint entities). Big-player: Figma/Illustrator δεν βάζουν polar σε image resize handle → OK να λείπει.

**Σύνολο**: 6 src αρχεία (4 domains) + 4 test αρχεία, **102+44 tests πράσινα**, jscpd καθαρό. Ζωγραφική-μόνο /
pure opt-ins· καμία αλλαγή σε commit/geometry.

### 2026-07-14 — Λαβές entourage = wall parity: +3 μεσοπλευρικές (E/S/W)

Ο Giorgio ζήτησε οι λαβές των entourage (έπιπλα-κάτοψης / άνθρωποι / δέντρα / οχήματα — **όλα
`ImageEntity`**) να γίνουν parity με τον τοίχο (γωνίες + μέσα-πλευρών + move + rotation). Επειδή ΟΛΑ
είναι `ImageEntity`, η αλλαγή έγινε **ΜΙΑ φορά** στο `getImageGrips` → κάλυψε ταυτόχρονα κάθε οικογένεια.

- **SSoT audit (grep) — απόφαση**: το handoff πρότεινε `centred-box-grips`, αλλά το audit έδειξε ότι
  **ΔΕΝ βγάζει mid-edges** (μόνο rotation+4γωνίες), έχει αφαιρέσει το MOVE, είναι mm-scaled + centre-anchored
  και θα χαλούσε το aspect-lock (ADR-654). Το σωστό SSoT υπάρχει ήδη: η εικόνα κάθεται **στον ίδιο**
  βαθύτερο πυρήνα `rect-frame` + `rect-grip-engine` με τοίχο/block. Precedent: **BLOCK (ADR-641)** πρόσθεσε
  `block-edge-{n,e,s,w}` ακριβώς έτσι. → reuse του **ίδιου** `applyRectEdgeDrag` + `rectEdgeWorld`,
  **μηδέν νέα γεωμετρία, μηδέν διπλότυπο** (jscpd:diff καθαρό).
- **Θέση rotation (Giorgio 2026-07-14)**: το `image-rotation` grip **μένει στο μέσο της πάνω ακμής** —
  άρα το `image-edge-n` **δεν** προστίθεται (θα συνέπιπτε). Μεσοπλευρικές = **3** (E/S/W), όχι 4.
- **Αλλαγές (μόνο image path)**: `ImageGripKind` += `image-edge-{e,s,w}` (`grip-kinds-primitives.ts`)·
  `getImageGrips` εκπέμπει 3 midpoint grips (index 6-8, `type:'midpoint'` → gated «Midpoints», wall parity)·
  `applyImageGripDrag` δρομολογεί edge kinds → `applyRectEdgeDrag` (1-άξονα stretch, αντίθετη ακμή σταθερή,
  μη-ομοιόμορφο — καμία aspect-lock). Το commit (`grip-image-commit.ts`) + preview + glyph registry **αμετάβλητα**
  (kind-agnostic dispatch· edges → default 'square' glyph, όπως block/corners).
- **Bugfix render (Giorgio 2026-07-14: «δεν εμφανίζονται τα σημάδια περιστροφής & μετακίνησης»)**: ο
  `ImageRenderer.getGrips` γύρναγε σκέτο `getImageGrips` **χωρίς `shape`** → το `GripPhaseRenderer`
  (`grip.shape ?? 'square'`) ζωγράφιζε ΟΛΕΣ τις λαβές ως τετράγωνα, οπότε τα `image-move`/`image-rotation`
  δεν έδειχναν σταυρό/καμπύλο σήμα. Fix: ανάθεση `shape` μέσω του κοινού `gripGlyphShape(gripKindOf(g,'image'))`
  — **ίδιο pattern με ScaleBar/OpeningInfoTag/Line/Text renderers** (spread → διατηρεί `gripKind`/`movesEntity`).
- **Tests**: `image-grips.test.ts` (6→9 λαβές + 4 edge-drag: opposite-edge-fixed / non-uniform / rotated) +
  `ImageRenderer.test.ts` (render ≡ interaction: 9 λαβές + **glyph shapes** move/rotation/7×square). **28/28** πράσινα.
- **Hot-grip περιστροφή (Giorgio 2026-07-14: «να μένει κόκκινο, να ορίζω κέντρο, τόξα πράσινο/κόκκινο όπως ο τοίχος»)**:
  το `image-rotation` έλειπε από το `HOT_GRIP_OP_REGISTRY` (`wall-hot-grip-fsm.ts`) → έμενε press-drag.
  Μία γραμμή `'image-rotation': 'rotate'` (ίδιο opt-in με scale-bar/opening-info-tag) → click → armed/κόκκινο →
  όρισε κέντρο → free spin + τόξα αναφοράς. Το commit (`commitParametricAnnotationGripDrag`) + το ghost
  (`apply-parametric-annotation-preview`) **ήδη** διάβαζαν το `BimRotateHotGripStore` pivot και το περνούσαν
  στο pivot-aware `applyImageGripDrag` — **καμία άλλη σύνδεση**. FSM test +1 describe (56 πράσινα).
- **Boy-Scout**: διόρθωση stale `@see` (`ADR-654-entourage-library.md` → `-furniture-plan-entourage.md`).

### 2026-07-14 — M7 Φάση Γ2: συνθέσεις & νέα έπιπλα (images_4)

Το `images_4` (μεικτή συλλογή entourage, ~580 TIF) αξιοποιήθηκε ΜΕΣΑ στο **ίδιο** pack
`furniture-plan-2d` (group `set` ⇒ ids `furn-set-<stem>-N`, μηδέν σύγκρουση με τα 379 `furn-obj/rug-*`).

- **Assets**: manifest **904** = 379 original + **525 furn-set** (516 συνθέσεις/έπιπλα + 9 centerpieces).
  Από τις 525, **230 συνθέσεις** (`…-0`, kind⇒composition) + 295 μεμονωμένα (kind⇒individual).
- **Vision (2 passes)**: A = `furniture-set.modes.json` (577 stems: composition/variant-sheet/single —
  ορίζει αν ένα TIF εκπέμπει ολόκληρο σετ + μέρη)· B = `furniture-set.visionB.json` (516 entries
  `{id,category,style,kind}` — human-verified). Και τα δύο persisted ως SSoT στο `entourage-classification/`.
- **Εξαιρέσεις από το furniture build** (`furniture-set.exclude.json`, 83 stems):
  **77 broken** = degenerate source alpha (κενό περίγραμμα λευκό-σε-λευκό + ασπρόμαυρες μάσκες
  δέντρων/θάμνων 260-265 που το alpha-split έσπασε σε σκουπίδια-θραύσματα + λάθος σκαναρίσματα
  224 πάγκος/457 σιφώνι) — **μη ανακτήσιμα, follow-up re-export από την πηγή**. **6 vehicles** (254-259).
- **17 νέες κατηγορίες** (0 νέα styles): diningSet, diningTable, desk, tvUnit, loungeSet, sideTable,
  umbrella, bathtub, sunLounger, cooktop, tray, piano, toilet, kitchenSink, shower, stove, **centerpiece**.
  Κάθε μία → 4 SSoT σημεία (union `FurniturePlanCategory` + `FURNITURE_PLAN_LONG_SIDE_MM` +
  generator allowlist + i18n `furniturePlan.categories.*` el/en).
- **Routing μη-επίπλων**: τα 9 floral-tray sprites (405-407/458-460/512-513/565) ήταν **διακοσμητικά
  τραπεζιού** (ξύλινος δίσκος + floral σύνθεση), όχι φυτά κηποτεχνίας → μπήκαν στο furniture ως
  `centerpiece` (`style:floral`). Τα 6 αυτοκίνητα (254-259, top-view) → pack **`vehicles-2d`** (87→**93**,
  category `car` + color facet). Το `plants-2d` έμεινε **αμετάβλητο** (τα 17 αρχικά «plants» δεν ήταν φυτά).
- **Guard**: `git diff furniture-plan-catalog.data.ts` — τα 379 obj/rug rows **IDENTICAL** (μηδέν διαγραφή,
  μόνο 525 προσθήκες furn-set)· ομοίως vehicles (87 IDENTICAL + 6). Regen ντετερμινιστικό.
- **Tests**: furniture suite 14→**17** (+≥1 composition, +17 νέες cats έχουν μήκος+sprite, +379 obj/rug
  μηδέν regression)· entourage-catalog vehicles count 87→93. **102/102** πράσινα. **jscpd:diff** καθαρό (N.18).
- **Εκκρεμεί (μετά «ναι» Giorgio)**: upload furniture (`--only furn-set-`) + vehicles asset packs.


### 2026-07-14 — Ιθαγένεια καμβά: redraw · hover · grips (§9)

Το entourage/furniture-plan sprite έγινε **πολίτης πρώτης κατηγορίας**: φαίνεται αμέσως μετά την
τοποθέτηση, φωτίζεται στο hover, επιλέγεται με σκέτο κλικ, και σέρνεται/περιστρέφεται/κλιμακώνεται
από λαβές — όπως κάθε άλλη οντότητα.

- **Bug 1 (redraw)**: `HatchImageCache` → `subscribeImageAssetReady` (module-level external store)·
  ο `useDxfCanvasCacheInvalidation` κάνει `bitmapCache.invalidate()` στο σήμα. Το σκέτο
  `markAllCanvasDirty()` ΔΕΝ αρκούσε: το bitmap key δεν άλλαζε → cache HIT → stale blit.
- **Bug 2 (hover/κλικ)**: `case 'image'` σε `Bounds.ts` (→ νέο `calculateImageBounds` στο
  `bounds-annotation.ts`, πάνω στο υπάρχον `imageEntityRectVertices` SSoT) **και** σε
  `hit-test-entity-model.ts` (flat passthrough — το `default` πετούσε position/width/height/rotation).
  Το `ENTITY_BOUNDS_PROVIDERS.image` ενοποιήθηκε στον `BoundsCalculator` (ήταν 2 υλοποιήσεις).
- **Bug 3 (grips)**: νέο `bim/image/image-grips.ts` + `ImageGripKind` + `GRIP_PRODUCERS.image` +
  `PARAMETRIC_COMMIT_HANDLERS.image` (`grip-image-commit.ts`) + ghost branch + glyph registry.
  Ο `ImageRenderer.getGrips()` **delegate-άρει** στο ίδιο SSoT (render ≡ interaction).
- **Tests**: `bim/image/__tests__/image-grips.test.ts` (θέσεις + move/rotate/corner drag, rotation-aware),
  `canvas-v2/dxf-canvas/__tests__/dxf-bitmap-cache-image-ready-invalidation.test.ts` (πινάρει ότι
  «dirty χωρίς invalidate» = ο bug). Ενημερώθηκαν τα coverage seams (grip-kinds 34→35, parametric
  dispatch 26→27, ghost routing, ImageRenderer 8→6 tagged λαβές).
- **Boy-scout**: 3 golden λίστες ήταν ήδη κόκκινες επειδή το `floorplan-symbol` έγινε renderable
  (ADR-415/635) χωρίς ενημέρωσή τους — διορθώθηκαν (code = truth).


### 2026-07-14 — M7 Φάση Γ1: migration **furniture → generic core** + facet **`kind`** (μηδέν regression)

Τα έπιπλα (379 sprites) ήταν το ΜΟΝΟ entourage family εκτός του κοινού core (δικό τους catalog/source/
selection-store/placer/tool/panel/generator — αντέγραφε τον αλγόριθμο). Μετανάστευσαν στη ΜΙΑ μηχανή,
με νέο facet `kind` («Μεμονωμένα ⇄ Συνθέσεις» — Revit «Furniture» vs «Furniture Systems»), κρατώντας
**ίδια `furn-*` ids, ίδια URLs, layer `FURNITURE-2D`, πράσινα τα tests**.

- **kind των υπαρχόντων 379**: 194 sprites (65 multi-piece objects `-1/-2/-3…`) → ντετερμινιστικά
  `individual` (ήδη alpha-split, M5). 185 single-piece → **re-vision** (10 Haiku subagents, batches ~20,
  οπτική ανάγνωση webp). **Human check** στα flagged compositions (γωνιακοί καναπέδες/πολυθρόνες με
  ραφές, χαλιά με μοτίβο): **όλα false positives** → **0 πραγματικές συνθέσεις** στα υπάρχοντα (καμία
  υπάρχουσα κατηγορία δεν είναι σετ). Άρα και τα 379 = `individual`· οι πραγματικές συνθέσεις έρχονται
  στη Φάση Γ2 (`images_4`). → `scripts/entourage-classification/furniture-plan.classification.json`
  (reconstruct category/style από το `.data.ts` — δεν υπήρχε furniture classification.json).
- **Generator**: `furniture` entry στο ενοποιημένο `generate-entourage-catalog.js` (`facets:[{kind:
  individual|composition},{style:…10}]`, kind ΠΡΩΤΟ)· regen `.data.ts` → shape `facets:{kind,style}`.
  **Guard**: ids/category/style/series/aspect ΑΜΕΤΑΒΛΗΤΑ (diff-verified), μόνο +kind + style→facets.
  **Καταργήθηκε** ο παράλληλος `generate-furniture-plan-catalog.js`.
- **Catalog**: `furniture-plan-catalog.ts` → thin wrapper στον core (`createEntourageCatalog`), ίδια
  ονόματα εξαγωγής (`listFurniturePlanDefs`/`getFurniturePlanSizeMm`/…) ⇒ callers (asset-pack-registry)
  + tests αμετάβλητοι. +`FurniturePlanKind` type.
- **Wiring (rewire owner, ίδια σημεία)**: `FURNITURE_PLAN_PACK_ID`+`resolveFurniturePlanUrl` → κοινό
  `entourage-plan-sources.ts` (ταυτόσημο URL — `resolveEntourageUrl`)· `furniturePlanSelection`·
  `furniturePlanPlacer` (layer `FURNITURE-2D`)· `useFurniturePlanTool` (entourage-tools)·
  `FURNITURE_PALETTE_DESCRIPTOR` (icon `Armchair`, `facetKeys:['kind','style']`)· FloatingPanelsSection
  `<EntouragePalette>`· useSpecialTools(+placement, `addEntourageToScene(...,'furniture-plan')`)·
  canvas-click-types τύπος → `EntouragePlacementToolLike` (διαγράφηκε το διπλό `FurniturePlanToolLike`,
  N.18). Tool id `furniture-plan` + panel flag + insert-tab κουμπί ΑΜΕΤΑΒΛΗΤΑ.
- **i18n** (el+en): +`furniturePlan.kind.{individual,composition}`+`kindFilterLabel/All`· `styles`(plural)
  → `style`(singular) + `styleFilterAll` (η generic palette ζητά `${prefix}.${facet}.…`).
- **Διαγραφή** standalone: `bim/furniture-plan/*`, `ui/panels/furniture-plan/*`, `hooks/drawing/
  useFurniturePlanTool.ts`, `data/furniture-plan-source.ts`, `generate-furniture-plan-catalog.js`.
- **Tests**: catalog test (shape `style`→`facets.style`, +kind, series key +kind)· furniture placement
  checks μεταφέρθηκαν στα κοινά `place-entourage`/`entourage-sources` (SSoT, όχι sibling file). **63
  πράσινα**. jscpd καθαρό.
- **ΕΚΤΟΣ scope (Γ2)**: composition-aware build των 580 νέων TIF (`images_4`) — νέο group `furn-set-*`.

### 2026-07-14 — M7 Φάση Β: νέο pack **`plants-plan-2d`** (φυτά/δέντρα, 103 sprites)

Τρίτη οικογένεια entourage πάνω στον N-facet core (0 facets, mirror people). ΜΟΝΟ `category` = τύπος
φυτού (size-driver)· η top-view δεν δίνει αξιόπιστο δεύτερο facet.

- **Assets** (`images_5` → `public/plants-2d/`, prefix `pl`): 99 TIF → **103 sprites** (`index.tif`
  contact sheet χωρίς alpha → αγνοήθηκε αυτόματα). `.gitignore` +`public/plants-2d/`.
- **Vision** (6 Sonnet subagents, batches ~18, οπτική ανάγνωση webp): 7 κατηγορίες size-distinct —
  `tree`(26)/`shrub`(39)/`palm`(14)/`flower`(16)/`largeTree`(4)/`grass`(2)/`hedge`(2). →
  `scripts/entourage-classification/plants-plan.classification.json` (validated: 0 missing/extra).
- **Κλίμακα** (`PLANTS_PLAN_LONG_SIDE_MM`): tree 6000· largeTree 9000· shrub 2000· hedge 2500· palm
  5000· flower 450· grass 1000 (mm, μεγάλη πλευρά).
- **Data/catalog**: `plants-plan-catalog.ts` (+`.data.ts`, generator `plants` entry) — thin wrapper στον
  κοινό core (N.18: μηδέν clone με people/vehicles, jscpd καθαρό).
- **Wiring («+1 pack» checklist)**: `PLANTS_PLAN_PACK_ID`+`resolvePlantsPlanUrl`· `plantsPlanSelection`·
  `plantsPlanPlacer` (layer `PLANTS-2D`)· `usePlantsPlanTool`· `PLANTS_PALETTE_DESCRIPTOR` (icon
  `Trees`, `facetKeys:[]`)· `AssetPackId`+`ASSET_PACKS['plants-plan-2d']`· ToolType `plants-plan`
  (+tool-def, +canvas-click type/dispatch branch)· useSpecialTools(+placement)· CanvasSection·
  insert-tab κουμπί· RibbonButtonIcon `Trees`· FloatingPanelsSection `<EntouragePalette>`·
  useToolbarState (state+toggle)· useDxfViewerState action· DxfViewerContent prop· `upload-asset-pack`
  `PACK_SOURCE_DIRS`.
- **i18n** (el+en): `tools.plantsPlan.*`, `ribbon.panels/commands.plantsPlan`, `assetPacks.plantsPlan2d`,
  top-level `plantsPlan` (title/hint/7 categories/…).
- **Tests**: plants προστέθηκε στα κοινά `entourage-catalog`(count 103)/`entourage-sources`/
  `place-entourage` (SSoT — όχι sibling test file). **58 πράσινα** (+asset-pack-registry). jscpd καθαρό.
- **ΕΚΚΡΕΜΕΙ**: upload `public/plants-2d/` → Storage (`node scripts/upload-asset-pack.js plants-plan-2d`).

### 2026-07-14 — M7 Φάση Α: γενίκευση core «1 secondary» → **N facets**

Θεμέλιο για φυτά (0 facets) + έπιπλα (category + `style` + `kind`). Ο core γενικεύτηκε από ενικό
`secondary: string|null` σε **`facets: Readonly<Record<string,string>>`** (0..N)· `category` παραμένει
ο **μόνος** size-driver. Καμία αλλαγή στη λογική μεγέθους (`getSizeMm` άθικτο). Μηδέν regression:
τα people/vehicles data ξανα-παρήχθησαν ντετερμινιστικά — **ίδια ids/series/aspect**, μόνο το πεδίο
`secondary:` → `facets:` (verified με diff column-by-column).

- **Core** (`data/entourage-catalog-core.ts`): `EntourageDef.facets` (record)· `EntourageLabelParts.
  facetKeys` (χάρτης `facetName → i18n key`)· νέα εξαγόμενη pure `entourageLabelParts(def, prefix)` =
  ο **μοναδικός** κανόνας ονοματοδοσίας κλειδιών (category + `<prefix>.<facet>.<value>`), κοινός σε
  catalog + palette.
- **Νέο** `data/entourage-display-name.ts`: `composeEntourageDisplayName(t, labelParts, facetOrder)` —
  ένα σημείο σύνθεσης «Κατηγορία · f1 · f2 NN» (η παλέτα ΠΡΙΝ αντέγραφε τη λογική με hardcoded
  `.secondary.` → **αφαιρέθηκε το clone**, N.18).
- **Descriptor** (`entourage-pack-descriptor.ts`): +`facetKeys: readonly string[]` (διατεταγμένα —
  ορίζει σειρά chip-rows + σύνθεση ονόματος). People `[]`, Vehicles `['color']`.
- **Generic palette** (`EntouragePalette.tsx`): 2 σταθερά facet rows → **N δυναμικά** (`facetKeys.map`)·
  state `Record<facetKey, filter>`· filter `facetKeys.every(...)`. i18n keys ανά facet:
  `<prefix>.<facet>.<value>`, `<prefix>.<facet>FilterAll`, `<prefix>.<facet>FilterLabel`.
- **Generator** (`scripts/generate-entourage-catalog.js`): config `secondaryField/secondaryValues` →
  `facets: [{ key, values }]` (N)· γράφει `facets: {…}`· series counter συμβατός (0 facets → ίδιο key).
- **i18n** (`dxf-viewer-shell.json` el+en): vehicles `secondary`→`color` namespace· `allSecondary/
  secondaryFilterLabel` → `colorFilterAll/colorFilterLabel`.
- **Tests**: `entourage-catalog.test.ts` ξαναγράφτηκε σε facets + κάλυψη `composeEntourageDisplayName`.
  **36 πράσινα** (catalog+sources+place-entourage). `jscpd:diff` καθαρό (7 files).

### 2026-07-14 — M6 Φάση 1: γενίκευση builder + build packs «άνθρωποι» + «οχήματα»

Δύο νέες οικογένειες entourage (πρότυπο Revit RPC People / RPC Cars — ξεχωριστές οικογένειες,
κοινή μηχανή). Απόφαση αρχιτεκτονικής (Giorgio): **γενίκευση σε έναν παραμετρικό core**, όχι
mirror ανά pack· το υπάρχον `furniture-plan` **μένει άθικτο στο runtime** και μετακομίζει στον
core σε δεύτερο βήμα (phased, χαμηλό ρίσκο σε shared working tree).

- **Κοινή μηχανή builder** (`scripts/lib/entourage-asset-builder.js`): εξήχθη ΟΛΗ η λογική
  TIF → alpha-split → WebP + thumbnail + manifest από τον furniture builder σε παραμετρικό
  `buildEntouragePack({ sources, outRoot, idPrefix, filterStems })`. N.18: μηδέν sibling clone.
  - `scripts/build-entourage-assets.js` — γενικό CLI (`<srcDir> <outSubdir> <prefix> [group]`).
  - `scripts/build-furniture-plan-assets.js` — έγινε thin wrapper πάνω στη μηχανή· τα ids
    `furn-*` **αμετάβλητα** (κανένα ανεβασμένο asset δεν αλλάζει ταυτότητα). Καθαρό internal
    refactor του offline builder — μηδέν αλλαγή runtime.
- **Assets χτίστηκαν** (gitignored, `public/{people,vehicles}-2d/`):
  - **Άνθρωποι** (`images_2`, prefix `ppl`): 126 TIF → **129 sprites** (3 αρχεία με 2 φιγούρες).
  - **Οχήματα** (`images_3`, prefix `veh`): 88 TIF → **87 sprites** (`catalog1.tif` = contact
    sheet χωρίς alpha → αγνοήθηκε αυτόματα).
- **`.gitignore`**: `+images_2/ +images_3/ +public/people-2d/ +public/vehicles-2d/`.
**Φάση 2 — vision ταξινόμηση + human review (build-time, εφάπαξ):** 12 Claude vision subagents
(Sonnet, παρτίδες ~18) διάβασαν οπτικά τα thumbnails. Αποτελέσματα + αποφάσεις Giorgio (size-critical):
- **Οχήματα (87, 10 κατηγορίες):** το pack είχε 22% «other» με υψηλή βεβαιότητα → προστέθηκαν
  κατηγορίες `airplane`(7), `construction`(7), `boat`(5), `tractor`(1) πέρα από
  `car`(44)/`van`(8)/`motorcycle`(7)/`truck`(5)/`scooter`(2)/`pickup`(1). Δευτερεύον facet =
  χρώμα. Vision confidence υψηλό (avg 0.86· 10/87 <0.7).
- **Άνθρωποι (124, 6 κατηγορίες):** top-view πόζα = αναξιόπιστη (85% conf <0.7 — αναμενόμενο).
  Απόφαση: **collapse όλων των όρθιων πόζων σε ένα `person`**(82), κρατώντας ΜΟΝΟ τις κατηγορίες
  που αλλάζουν ΜΕΓΕΘΟΣ και βρέθηκαν σίγουρα: `lying`(21), `group`(13), `stroller`(6),
  `wheelchair`(1), `child`(1). Πετάχτηκαν 5 junk (cropped fragments/indistinct).
- **SSoT των αποφάσεων:** `scripts/entourage-classification/{people,vehicles}-plan.classification.json`
  (committed → reproducible· re-run του generator = ίδιο data). Βελτίωση έναντι M5 (που έχασε το
  transient classification).
**Φάση 3 — γενικός catalog core + per-pack δεδομένα (data layer):**
- **`data/entourage-catalog-core.ts`** — `createEntourageCatalog<C>({data, longSideMm, i18nPrefix})`
  → `{list, getById, getLabelParts, getSizeMm}`. Το invariant «μεγάλη πλευρά» ζει ΕΔΩ, μία φορά.
  **Προαιρετικό δευτερεύον facet** (`secondary: string|null`): άνθρωποι = null, οχήματα = χρώμα.
- **`data/people-plan-catalog.ts`** (6 κατηγορίες, `PEOPLE_PLAN_LONG_SIDE_MM`: person 650, lying
  1800, group 1400, stroller 1600, wheelchair 1200, child 450) + **`vehicles-plan-catalog.ts`**
  (10 τύποι, `VEHICLE_PLAN_LONG_SIDE_MM`: car 4500 … truck 8500, boat 15000, construction 8000,
  tractor 4500, airplane 40000). Καθένα = thin delegation στον core (λεξιλόγιο+μεγέθη μόνο).
- **`scripts/generate-entourage-catalog.js`** — γενικός (`node … people|vehicles`), config-driven·
  παρήγαγε `{people,vehicles}-plan-catalog.data.ts` (124 + 87). fail-fast validation.
- **Tests** (`data/__tests__/entourage-catalog.test.ts`, 15 πράσινα): long-side invariant στον core
  + ακεραιότητα/κλίμακα/series/facets και στα δύο packs. jscpd:diff καθαρό (κοινός core, μηδέν clone).
- Επόμενο (Φάση 4): `*-plan-source.ts` (URL resolver), registry `ASSET_PACKS` +2, generic palette
  (`EntouragePalette`) + selection store/placement/tool factory, ToolType+ribbon wiring, i18n, upload.

**Φάση 4 — generic entourage engine + UI/wiring (people + vehicles ΜΠΗΚΑΝ στην εφαρμογή):**
Το furniture-specific pipeline **γενικεύτηκε** σε κοινή μηχανή `entourage` (N.18: μηδέν sibling
clone ανά pack)· το furniture RUNTIME έμεινε ΑΘΙΚΤΟ (migrate σε δεύτερο βήμα — phased).
- **Source**: `data/entourage-source.ts` (`resolveEntourageUrl(packId,id,variant)` — sync, ADR-655) +
  `data/entourage-plan-sources.ts` (τα δύο `*_PACK_ID` + thin resolvers, ΕΝΑ αρχείο).
- **bim/entourage**: `entourage-selection-store.ts` (`createEntourageSelectionStore()` factory) +
  `entourage-selection-stores.ts` (2 instances)· `place-entourage.ts` (`createEntouragePlacer({getSizeMm,
  layerId})` → resolveSceneSize/buildEntity/buildGhost· mm→scene + κέντρο→γωνία) + `entourage-placers.ts`
  (2 instances, layers `PEOPLE-2D`/`VEHICLES-2D`)· `add-entourage-to-scene.ts` (tag-παραμετρικό, thin
  πάνω στο `appendEntityToScene`).
- **Tool**: `hooks/drawing/create-entourage-tool.ts` (`createEntourageTool(descriptor)` wrapping
  `createSingleClickPlacementTool`, ADR-600) + `entourage-tools.ts` (`usePeoplePlanTool`/`useVehiclesPlanTool`).
- **Palette (generic)**: `ui/panels/entourage/` — `EntouragePalette` (category chip row πάντα +
  secondary row ΜΟΝΟ όταν υπάρχει), `EntourageCard`, `use-entourage-palette.ts`,
  `entourage-pack-descriptor.ts` (τύπος) + `entourage-descriptors.tsx` (People icon `Users` 1 facet,
  Vehicles icon `Car` 2 facets=χρώμα).
- **Registry/scripts**: `AssetPackId` += `people-plan-2d`/`vehicles-plan-2d`, `ASSET_PACKS` +2
  (defaultStatus `entitled`, allowlist = catalog)· `upload-asset-pack.js` `PACK_SOURCE_DIRS` +2.
- **Wiring (2 νέα ToolTypes `people-plan`/`vehicles-plan` → shared factories, ~14 αρχεία)**:
  tool-definitions, toolbar/types, canvas-click (types/dispatch, ένα `EntouragePlacementToolLike`),
  useSpecialTools(-placement-tools), insert-tab (+2 κουμπιά), RibbonButtonIcon, FloatingPanelsSection
  (2× `<EntouragePalette>`), useToolbarState, useDxfViewerState, DxfViewerContent, CanvasSection.
- **i18n** el+en: `peoplePlan`/`vehiclePlan` blocks (categories· vehicles +secondary=χρώματα),
  `tools.*`, `assetPacks.*.title` +2, `ribbon.panels/commands` +2.
- **Tests** (jest, όλα πράσινα): `place-entourage.test.ts` (mm→scene + κέντρο→γωνία + ghost==commit,
  και τα δύο placers), `entourage-sources.test.ts` (proxy URL shape + hard-error guard),
  `asset-pack-registry.test.ts` (+2 packs, allowlist isolation). jscpd:diff καθαρό.
- **Εκκρεμεί**: upload στο Storage (`node scripts/upload-asset-pack.js people-plan-2d` + `vehicles-plan-2d`
  — Giorgio-authorized· χωρίς αυτό σπασμένες μικρογραφίες σε dev)· phased migrate του furniture runtime στον core.

### 2026-07-14 — M5: πλήρες pack (379 sprites) + faceted taxonomy

Το pack μεγάλωσε από 19 σε **379 sprites** (250 TIF → connected-components split) και το μοντέλο
ονοματοδοσίας έγινε **faceted** (πρότυπο Revit / ArchiCAD): αντί για ~380 χειρόγραφα per-item
strings, κάθε sprite περιγράφεται από **facets** που συντίθενται στο runtime.

- **Faceted catalog** (`data/furniture-plan-catalog.ts`): `FurniturePlanDef = { id, category, style,
  series, aspect }` — έφυγε το `labelKeySuffix`. Το εμφανιζόμενο όνομα ΣΥΝΤΙΘΕΤΑΙ από τα i18n
  κλειδιά των facets: `getFurniturePlanLabelParts()` → «Πολυθρόνα · Δέρμα · 03».
  - **category** (15): SSoT μεγέθους (`FURNITURE_PLAN_LONG_SIDE_MM`) + κύριο φίλτρο. Νέες:
    `sofaCorner (2600), stool (400), bench (1200), pouf (600), washbasin (600), coffeeTable (1100)`.
  - **style** (10): δευτερεύον facet (φίλτρο/όνομα), δεν επηρεάζει μέγεθος. Στα ελληνικά ως
    **facet tags** (ουσιαστικά/άκλιτα με `·`) ώστε να μη σκάει η γραμματική συμφωνία γένους.
- **Vision ταξινόμηση** (εφάπαξ, build-time): 379 thumbnails → category+style μέσω Claude vision
  subagents (18 παρτίδες, Sonnet) + human review στα size-critical αμφίβολα. Πιάστηκε συστηματικό
  λάθος armchair→sofa2 (001-3…007-3, conf 0.72) μέσω aspect-outlier ελέγχου (sofa2 με τετράγωνο
  aspect = ύποπτο). **Καμία AI κλήση στο runtime** — το αποτέλεσμα ζει στα δεδομένα.
- **Generator SSoT** (`scripts/generate-furniture-plan-catalog.js`): manifest + classification →
  `data/furniture-plan-catalog.data.ts` (AUTO-GENERATED, ντετερμινιστικό, fail-fast validation).
  Μηδέν χειρόγραφη συντήρηση 379 εγγραφών.
- **Παλέτα** (`FurniturePlanPanel.tsx`): δύο φίλτρα (κατηγορία + στυλ) με επαναχρησιμοποιήσιμο
  `ChipFilterRow` (μηδέν jscpd clone).
- **Allowlist**: το `listAssetIds()` του ADR-655 registry **παράγεται από τον catalog** ⇒ τα 379
  νέα ids εγκρίθηκαν στον proxy αυτόματα, μηδέν αλλαγή σε registry/rules/routes.
- **i18n**: το `furniturePlan` block ξαναγράφτηκε (el+en) — `categories` (15) + `styles` (10),
  έφυγε το `items`. Tests: **13 πράσινα** (facets + «μεγάλη πλευρά»). `jscpd:diff`: καθαρό.
- **Deploy**: `node scripts/upload-asset-pack.js furniture-plan-2d` → 758 αρχεία (full+thumb) στο
  Storage `v1`.

### 2026-07-14 — M4: μετάβαση σε asset pack (ADR-655) ⚠️ ΥΠΕΡΙΣΧΥΕΙ ΤΩΝ §4 ΚΑΙ §6

Η βιβλιοθήκη έγινε **gated asset pack** (`furniture-plan-2d`). Ό,τι λένε τα §4 και §6 παραπάνω
για `createAssetSourceResolver` / async URL prefetch **δεν ισχύει πλέον** — βλ.
[ADR-655](./ADR-655-asset-packs.md).

- **Ασφάλεια**: τα sprites μετακόμισαν σε `asset-packs/furniture-plan-2d/v1/` με
  `allow read: if false` — κανείς client δεν τα διαβάζει απευθείας. Σερβίρονται μόνο μέσω του
  authenticated proxy `/api/asset-packs/...` (kill switch → company entitlement → RBAC).
- **🐛 Latent bug που διορθώθηκε**: το `storage.rules` **ποτέ δεν είχε κανόνα για
  `furniture-2d-library/`** ⇒ default-deny ⇒ το production `storage` mode ήταν **ήδη σπασμένο**
  (η παλέτα θα έβγαινε άδεια). Δεν είχε εντοπιστεί επειδή το feature έτρεχε μόνο σε dev.
- **Απλοποίηση**: το URL είναι πλέον **σύγχρονο** (παράγεται από το registry) ⇒ εξαφανίστηκαν το
  per-card fire-and-forget resolve, το `busyId`, και το proactive prefetch του §6. **Δεν υπάρχει
  race χωρίς αναμονή.**
- **Φορητότητα**: μία διαδρομή σε dev ΚΑΙ prod. Πριν, σχέδιο αποθηκευμένο σε dev
  (`/furniture-2d/...`) θα έσπαγε σε prod.
- **Προϋπόθεση dev**: `node scripts/upload-asset-pack.js furniture-plan-2d` (μία φορά).

### 2026-07-14 — M1–M3 (pilot, 19 sprites)
- **M1** asset pipeline: `scripts/build-furniture-plan-assets.js` + `scripts/lib/alpha-connected-components.js` (8 unit tests). 11 TIF → 19 sprites, οπτικά επαληθευμένα.
- **M2** data SSoT: `data/furniture-plan-catalog.ts` (μοντέλο «μεγάλης πλευράς», 9 tests) + `data/furniture-plan-source.ts`.
- **Νέο SSoT**: `systems/assets/create-asset-source-resolver.ts` — εξήχθη από το `texture-source.ts` (ADR-413) ώστε να μην υπάρξει sibling clone (N.18). Το ADR-413 API αμετάβλητο.
- **M3** placement: `bim/furniture-plan/{furniture-plan-selection-store,place-furniture-plan}.ts` (11 tests) + `hooks/drawing/useFurniturePlanTool.ts` + tool registry wiring (`furniture-plan` ToolType) + UI παλέτα `ui/panels/furniture-plan/`.
- Tests: 28 πράσινα. `jscpd:diff`: καθαρό.
- **Δεν** έγινε: grips (§9), πλήρες pack (§10).

### 2026-07-14 — Render fit mode: contain → **FILL** (λαβές «έμεναν μακριά» μετά μη-ομοιόμορφο resize)
- **Bug (Giorgio)**: μεσοπλευρική λαβή E/W ενός entourage `ImageEntity` (έπιπλο/άνθρωπος/δέντρο/όχημα)
  → μετά το resize οι λαβές δεν ακολουθούσαν το ορατό sprite, «έμεναν μακριά».
- **Root cause (grounded)**: `rendering/entities/ImageRenderer.ts` `drawImage` ζωγράφιζε **contain-fit**
  (`Math.min(w/iw, h/ih)` + centering/letterbox), ενώ λαβές/bounds/hit-test διαβάζουν το ΠΛΑΙΣΙΟ μέσω
  `imageEntityRectVertices` (`shared/image-rect-vertices.ts`, αμετάβλητο). Μη-ομοιόμορφη λαβή αλλάζει
  μόνο `width` → το κεντραρισμένο sprite αποκλίνει από το πλαίσιο. Το frame math (`applyRectEdgeDrag`)
  ήταν **σωστό** — καθαρά render fit mode.
- **Απόφαση (big-player parity — Figma/Illustrator/PowerPoint/C4D)**: **fill**. Το sprite γεμίζει
  ολόκληρο το `width × height` πλαίσιο (`drawImage(img, 0, 0, e.width, e.height)`, χωρίς fitScale/dx/dy)
  ⇒ ορατό sprite ≡ πλαίσιο ≡ λαβές ≡ bounds ≡ hit-test **ΠΑΝΤΑ**. Μη-ομοιόμορφη λαβή τεντώνει την
  εικόνα και ΑΚΟΛΟΥΘΕΙ τις λαβές (εσκεμμένο).
- **Γιατί μηδέν παραμόρφωση στην τοποθέτηση** (κρίσιμο σημείο απόφασης): το `getSizeMm`
  (`data/entourage-catalog-core.ts`) παράγει `widthMm/heightMm` από `def.aspect = wPx/hPx` του sprite,
  άρα `e.width/e.height === iw/ih` κατά την τοποθέτηση → fill ≡ contain εκεί, καμία ανάγκη για
  aspect-στην-τοποθέτηση ή async intrinsic size (core-only fix). `imageIntrinsicSize` παραμένει ΜΟΝΟ ως
  validity guard.
- **DXF export**: αμετάβλητο & τώρα **σύμφωνο** — `export/core/image-entity-export.ts` σειριοποιεί ήδη το
  ΠΛΑΙΣΙΟ (`tileWorldWidth/Height = entity.width/height`, native IMAGE fill semantics)· ο render έγινε
  fill ⇒ έκλεισε η προϋπάρχουσα ασυμφωνία render(contain) vs export(fill).
- **Αρχεία**: `rendering/entities/ImageRenderer.ts` (drawImage + doc), `__tests__/ImageRenderer.test.ts`
  (2 tests contain→fill, 10 πράσινα), `shared/image-intrinsic-size.ts` (doc). `jscpd:diff`: καθαρό.

### 2026-07-14 — Selection surfaces: contextual tab «Εικόνα» + αριστερό «Ιδιότητες» panel (double-no → double-yes)
- **Αίτημα (Giorgio)**: επιλογή entourage (έπιπλο/άνθρωπος/όχημα/φυτό — όλα `ImageEntity`) να ανοίγει
  **ταυτόχρονα** contextual ribbon tab (πάνω) **και** αριστερό Properties palette, όπως το hatch. Πριν:
  double-no (κανένα από τα δύο· το tab «Ιδιότητες» έδειχνε άδειο).
- **Root cause (grounded, 3 Explore agents)**: δύο ασύνδετα συστήματα — (1) `ENTITY_CONTEXTUAL_TRIGGER`
  map (`app/resolve-contextual-trigger.ts`, coverage-tested) και (2) η auto-switch πύλη
  (`app/SelectionSideEffectsHost.tsx`) + ο `if/else` router (`ui/wall-advanced-panel/BimPropertiesRouter.tsx`).
  Το `image` (non-BIM, `types/image.ts`) έλειπε **και από τα δύο**.
- **Απόφαση (big-player split, mirror ADR-641 Block)**: contextual tab = ΜΟΝΟ ενέργειες· αριστερό panel =
  ΟΛΕΣ οι ιδιότητες (object inspector). Ένα tab + ένα panel keyed σε `isImageEntity` καλύπτει και τις 4
  οικογένειες (ένας τύπος `image`).
- **Νέα (mirror `ui/block-advanced-panel/`, imports όχι copy — jscpd:diff καθαρό)**:
  `ui/ribbon/hooks/bridge/image-command-keys.ts` (`IMAGE_PROPERTY_KEYS`)·
  `ui/image-advanced-panel/{image-property-fields.ts (IMAGE_PROPERTY_GROUPS: Γενικά[πηγή,επίπεδο] +
  Γεωμετρία[θέση X/Y, πλάτος, ύψος, γωνία]), useImagePropertyBridge.ts (read/write via SSoT
  useEntityPatchCommand→UpdateEntityCommand + useEntityLayerField· imageSourceLabel helper),
  ImageAdvancedPanel.tsx, ImagePropertiesTab.tsx}`· `ui/ribbon/data/contextual-image-tab.ts`
  (`CONTEXTUAL_IMAGE_TAB`: buildSelectPanel + generic Modify actions move/rotate/mirror/copy/delete —
  μηδέν νέο command wiring).
- **Wiring (5 SSoT σημεία)**: `resolve-contextual-trigger.ts` (`image` στο map) + `contextual-triggers.ts`
  (barrel) + `ribbon-contextual-config.ts` (register) + `SelectionSideEffectsHost.tsx` (`|| isImageEntity`
  στην πύλη — auto-open) + `BimPropertiesRouter.tsx` (branch → `ImagePropertiesTab`).
- **i18n (el+en)**: `imageAdvancedPanel.*` + `ribbon.tabs.imageTools` + `ribbon.panels.imageActions`
  (τα command labels move/rotate/mirror/copy/delete/select προϋπήρχαν).
- **Boy-scout (ADR-415)**: το coverage test `resolve-contextual-trigger-coverage.test.ts` ήταν **ήδη
  κόκκινο στο HEAD** (έλειπαν `image` ΚΑΙ `floorplan-symbol` από το partition). Καλύφθηκαν και τα δύο:
  `image`→SIMPLE (map)· `floorplan-symbol`→NO_SELECTION_TAB (resolver επιστρέφει ήδη null, behavior-neutral).
- **Tests**: νέο `ui/image-advanced-panel/__tests__/image-property-fields.test.ts` (descriptor + imageSourceLabel,
  πράσινο) + `resolve-contextual-trigger-coverage.test.ts` 12/12 πράσινο. `jscpd:diff`: καθαρό. **ΟΧΙ tsc.**

### 2026-07-15 — Big-player display precision στα editable Properties fields (LUPREC/AUPREC-style, κεντρικό SSoT)
- **Πρόβλημα (Giorgio)**: το image panel έδειχνε float noise — `Πλάτος 637.08313078260…`, `Γωνία -0.7050491969792`.
  Οι μεγάλοι (Revit/ArchiCAD/C4D/Figma) στρογγυλοποιούν στο display precision (AutoCAD LUPREC/AUPREC).
- **Root cause (SSoT audit)**: το `toDisp` (`ui/ribbon/hooks/useRibbonLineToolBridge.helpers.ts`) έκανε raw
  `String(toDisplay().value)` — **παρέκαμπτε** το υπάρχον editable-input formatting SSoT
  (`config/units.ts formatDisplayValue` → `DEFAULT_DISPLAY_PRECISION`, το οποίο ρητά ορίζεται ως ο σωστός δρόμος
  για editable fields στο `display-length-format.ts` §17-19). Η γωνία δεν είχε καθόλου editable formatter.
- **Fix (κεντρικό, FULL SSoT)**:
  - `config/units.ts`: **νέος** `formatAngleValue(deg, precision?)` + `DEFAULT_ANGLE_PRECISION=2` (AUPREC-style,
    dot-separated/parseable, snap sub-precision→0· mirror του `formatDisplayValue`).
  - `toDisp` → πλέον επιστρέφει `formatDisplayValue(mm, unit)` ⇒ **ΟΛΑ** τα editable bridges (line/block/image)
    στρογγυλοποιούν coords/lengths μαζί (μηδέν νέος μηχανισμός· round-trip ασφαλές: rounded===rounded ⇒ no
    phantom write).
  - image bridge rotation → `formatAngleValue`. **Boy-scout**: block bridge rotation → `formatAngleValue` (συνέπεια
    εντός panel, αφού το `toDisp` fix στρογγυλοποιεί ήδη τα block coords).
- **Tests**: νέο `config/__tests__/units-format.test.ts` (10· formatDisplayValue + formatAngleValue, incl. IEEE
  edge cases) + ενημ. `useRibbonLineToolBridge.test.tsx` `disp` helper (raw→`formatDisplayValue`). Regression sweep
  156/156 πράσινα. `jscpd:diff` καθαρό. **ΟΧΙ tsc.**

### 2026-07-15 — Real-time panel κατά το drag (move/resize/rotate) — reuse του grip-drag live SSoT (ADR-557 mirror)
- **Αίτημα (Giorgio)**: τα πεδία του image panel να αλλάζουν σε πραγματικό χρόνο καθώς σέρνω/αλλάζω
  διαστάσεις ενός entourage (καναπές κ.λπ.), reuse-άροντας τον κεντρικό real-time κώδικα (μηδέν διπλότυπο).
- **SSoT audit**: ο κεντρικός μηχανισμός live-during-drag είναι το `dragPreview` (`DxfGripDragPreview`, per-frame
  React state στο `canvas-layer-stack-preview-mounts.tsx`) + per-type sync leaves (π.χ. `TextGripRibbonSyncMount`
  ADR-557 που «παλμώνει» το text-toolbar preview channel). Το `applyEntityPreview` (ghost SSoT) **δεν** έχει image
  branch· η live/commit γεωμετρία της εικόνας ζει στο `applyImageGripDrag` (`bim/image/image-grips.ts` — «το SSoT
  που τρέχουν ΚΑΙ commit ΚΑΙ ghost»).
- **Υλοποίηση (mirror ADR-557, zero νέα math)**:
  - **NEW** `systems/grip/EntityPropsLivePreviewStore.ts` — zero-React panel-side preview channel
    (`{entityId, patch}`· pattern ≡ `GripDragStore`) + `withEntityPropsLivePreview` merge helper (generic: block/line
    μπορούν να το adopt-άρουν).
  - **NEW** `hooks/grips/useImagePropsGripSync.ts` (`ImagePropsGripSyncMount`) — διαβάζει το live `dragPreview`, τρέχει
    το **υπάρχον** `applyImageGripDrag` (+ `ShiftKeyTracker` για aspect-lock parity), δημοσιεύει το live patch·
    redundant-write guard + clear on release. Mounted δίπλα στο `TextGripRibbonSyncMount`.
  - `ImageAdvancedPanel.tsx` — `useSyncExternalStore` στο channel → `withEntityPropsLivePreview(image, live)` → περνά
    το live image στο `useImagePropertyBridge`. Leaf-only re-render (ADR-040· κανένα canvas), settle σε committed on release.
- **Tests**: νέο `hooks/grips/__tests__/useImagePropsGripSync.test.ts` (5· store round-trip/merge + MOVE path e2e +
  release clear + zero-delta guard). `jscpd:diff` καθαρό. **ΟΧΙ tsc.**

### 2026-07-15 — FIX: το real-time δεν έτρεχε (writer = RAF draw loop, ΟΧΙ το laggy React dragPreview)
- **Σφάλμα (Giorgio)**: «δεν τρέχουν ζωντανά τα νούμερα». Root cause (grounded): το πρώτο cut διάβαζε το React
  `dragPreview` state στο `useImagePropsGripSync`. Ο on-canvas ghost ΔΕΝ βασίζεται σε αυτό — ο
  `useGripGhostPreview.draw` τρέχει **per-frame στο RAF loop** και ανα-υπολογίζει τη γεωμετρία από τον high-freq
  `effectiveCursor` (`resolveLiveGripDragPreview`, ADR-040 Φ12) ώστε να έχει «zero React-state lag». Το React
  `dragPreview` lag-άρει/δεν φτάνει live στο mount → το panel έμενε στατικό.
- **Fix (writer = ο ΙΔΙΟΣ per-frame βρόχος του ghost)**: στο `hooks/tools/useGripGhostPreview.ts`, αμέσως μετά το
  `const transformed = applyEntityPreview(...)` (το live entity ανά frame, ήδη περασμένο από το `applyImageGripDrag`
  SSoT), αν `transformed.type === 'image'` → `setEntityPropsLivePreview({entityId, patch:{position,width,height,rotation}})`.
  Guaranteed 60fps parity με τον ghost (ίδιο effectiveCursor).
- **Store**: προστέθηκε `equals` (`sameLivePreview`, JSON value-compare) ώστε ο per-frame writer να ΜΗΝ κάνει
  60fps no-change re-render του panel.
- **`useImagePropsGripSync`**: απλοποιήθηκε σε **clear-only guard** — καθαρίζει το κανάλι σε release
  (`dragPreview=null`) ή non-image drag· ενώ σέρνεται image ΔΕΝ αγγίζει το κανάλι (ο draw loop το owns → μηδέν race).
- **Tests**: ενημ. `useImagePropsGripSync.test.ts` (store equals guard + merge + clear σε release/non-image, 5 πράσινα).
  CHECK 6D: staged ADR-654 (άγγιξα ghost draw file). `jscpd:diff` καθαρό. **ΟΧΙ tsc.**

### 2026-07-15 — FIX #2: real-time ΚΑΙ στο body-drag (κλικ στο σώμα + drag), όχι μόνο λαβές
- **Σφάλμα (Giorgio)**: real-time δούλευε ΜΟΝΟ από τις λαβές· «κλικ στο σώμα + drag» = στατικό. Root cause: το
  body-drag είναι **δεύτερο** per-frame RAF loop (`hooks/tools/useEntityBodyDragPreview.ts`, driven από
  `EntityBodyDragStore` + `effectiveCursor`) — άλλο μονοπάτι από το grip `useGripGhostPreview`. Το `calculateMovedGeometry`
  μεταφράζει κανονικά το image (`move-entity-geometry.ts` §image), αλλά ο body loop δεν δημοσίευε στο κανάλι.
- **Fix (SSoT writer, N.18)**: **NEW** `hooks/tools/publish-image-live-preview.ts` — ΕΝΑΣ writer
  (`publishImageLivePreview(transformed)`, no-op για non-image), που καλούν **ΚΑΙ ΟΙ ΔΥΟ** RAF loops
  (`useGripGhostPreview` + `useEntityBodyDragPreview`) αμέσως μετά το `transformed = applyEntityPreview(...)`. Μηδέν
  διπλότυπο block (το inline του grip loop αντικαταστάθηκε με το helper).
- **Clear (unified)**: `useImagePropsGripSync` πλέον subscribe-άρει ΚΑΙ στο `EntityBodyDragStore` — καθαρίζει το κανάλι
  όταν ΚΑΝΕΝΑ drag (grip **ή** body) δεν αφορά image (release/non-image)· ενώ σέρνεται image (οποιοδήποτε μονοπάτι)
  δεν αγγίζει το κανάλι → οι writers δεν συγκρούονται.
- **Tests**: ενημ. `useImagePropsGripSync.test.ts` (8 πράσινα· + body-drag arm/release clear + `publishImageLivePreview`
  helper image/non-image). `jscpd:diff` καθαρό. CHECK 6D: staged ADR-654. **ΟΧΙ tsc.**
