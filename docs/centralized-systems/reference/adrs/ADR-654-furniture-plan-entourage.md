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
