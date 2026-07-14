# ADR-654 — Βιβλιοθήκη 2D Επίπλων σε Κάτοψη (Entourage)

**Status**: Accepted (M1–M3 υλοποιημένα, pilot)
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

## 9. Γνωστό κενό — grips

`ImageRenderer.getGrips()` **ζωγραφίζει** 8 handles, αλλά το `GRIP_PRODUCERS`
(`hooks/grip-computation-producers.ts`) **δεν έχει `image` entry** ⇒ δεν μπαίνουν στο
`AllGripsStore` ⇒ το `findNearestGrip` δεν τα βρίσκει. **Τα handles φαίνονται αλλά δεν πιάνονται.**

Αυτό είναι **προϋπάρχον** (αφορά ήδη το title-block stamp) και **δεν είναι blocker**: το μέγεθος
έρχεται σωστό από το catalog, ενώ move / rotate / scale δουλεύουν μέσω των generic commands. Το
interactive resize-με-λαβές απαιτεί δικό του `gripKind` + drag handler + patch applier (όπως το
text path) — **ξεχωριστό υπο-έργο**, όχι μία γραμμή στο registry.

## 10. Εκκρεμεί

- **Άδεια χρήσης**: το pack το **παρήγαγε ο ίδιος** ο φίλος του Giorgio (τα δημιούργησε και τα
  εμπορευόταν· δεν ασχολείται πλέον) και του έδωσε άδεια χρήσης το 2007. Δηλαδή η άδεια προέρχεται
  από τον **δημιουργό**, όχι από ενδιάμεσο μεταπωλητή. Ο Giorgio μπορεί να την προσκομίσει γραπτώς.
- **Πλήρες pack** (~450 κομμάτια από 258 αρχεία): χρειάζεται κατηγοριοποίηση. Χειροκίνητα ή με
  vision AI (υπάρχει ήδη gpt-4o-mini vision pipeline). Το pilot ταξινομήθηκε με το χέρι (19).
- **Grips** (§9).

---

## Changelog

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
