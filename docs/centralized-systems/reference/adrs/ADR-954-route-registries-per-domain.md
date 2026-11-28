# ADR-954 — Μητρώα διαδρομών ανά τομέα και όρια φόρτωσης στη χρήση: η μεταγλώττιση μιας σελίδας φτάνει μόνο τον τομέα της

| | |
|---|---|
| **Status** | IN PROGRESS — 2026-11-28 · ✅ πιλότος (6 τομείς) · ✅ όριο θεατή κατόψεων (§2) · ✅ §4 Ε3/Ε4 · ✅ ξαναμέτρηση στο codespace (§5) · ⏳ 13 τομείς · ⏸ Ε5 (σφράγιση 3.34, §5.3) |
| **Date** | 2026-11-25 |
| **Προέλευση** | Ο dev server (Turbopack) έπεφτε από μνήμη στο `/dashboard` (14,3 GB) — `HANDOFFS/2026-11-24_ROUTE-REGISTRY_dev-compile-OOM_handoff.md` |
| **Σχετικά** | ADR-294 *(dynamic imports)* · ADR-858 §6α *(αρχή αξιολόγησης modules — `lazyRouteFactory`)* · ADR-280 §11.8 *(κώδικας + κείμενα ως ένα αίτημα)* · ADR-744 §27 *(τεμπέλικες επιφάνειες)* · ADR-796 *(δημόσια επιφάνεια `dxf-viewer`, CHECK 3.62)* · ADR-912 §12.17 *(`flow` · `fill`)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Μητρώα διαδρομών ανά τομέα (πιλότος — commit `77521ff6`)

**Το πρόβλημα.** Το κοινό `LazyRoutes` (`src/utils/lazyRoutes.tsx` + `lazyRoutesAdr294.tsx`) ήταν **ένα** αντικείμενο με
όλες τις σελίδες. Ο bundler δεν κόβει ιδιότητες αντικειμένου, και το `preloadRoutes.ts` καλούσε `import()` για όλες ⇒
**κάθε** μεταγλώττιση σελίδας στο dev έφερνε ~12.300 αρχεία, μαζί με όλο τον DXF viewer.

**Η απόφαση** (feature modules — `loadChildren` του Angular, module bundles του Odoo):
- Κάθε τομέας **κατέχει** το μητρώο του (`building-routes` · `contact-routes` · `property-routes` · `crm-routes` ·
  `obligation-routes` · `src/utils/routes/dxf-viewer-routes.tsx`), με το ίδιο `defineLazyRoutes` και τα ίδια κλειδιά.
  Η σελίδα εισάγει **μόνο** το μητρώο του τομέα της.
- `preloadRoutes.ts`: χάρτης `PreloadableRoute → preload()` του μητρώου τομέα, **μόνο** όταν
  `process.env.NODE_ENV === 'production'` (η πολιτική του `<Link prefetch>` της Next). Η συνθήκη γράφεται
  **κυριολεκτικά**: ο bundler κόβει τον νεκρό κλάδο, άρα στο dev το κέλυφος δεν έχει ακμή `import()` προς σελίδες.
- Κάθε μητρώο δηλώνεται στο `lazyRouteRegistries` (`scripts/lib/i18n-shell-slice/config.js`).

⚠️ **ΜΗΝ** ενώσεις ξανά μητρώα σε ένα αντικείμενο ή barrel — αυτή ήταν η αιτία.
⚠️ **ΜΗΝ** βγάλεις τη συνθήκη `NODE_ENV` σε μεταβλητή/helper — χάνεται η αποκοπή.

**Μέτρηση** (codespace 4 πυρήνες / 16 GB, Turbopack):

| σελίδα | πριν | πιλότος |
|---|---|---|
| `/dashboard` | έπεφτε (14,3 GB) | ✅ 91,7s · RSS 4,2 GB |
| `/properties` | — | 128,9s · RSS **9,4 GB** |

⇒ ο Turbopack κόβει την ακμή `NODE_ENV`· το `/dashboard` φορτώνει. Το `/properties` όμως έμενε βαρύ — §2.

## 2. Το όριο του θεατή κατόψεων (`floorplan-gallery-surfaces`)

**Μέτρηση της αιτίας** (στατικός γράφος εισαγωγών από τη ρίζα της σελίδας, χωρίς `import type`, 2026-11-27):
`PropertiesPageContent` = **5.457** αρχεία, από τα οποία **2.540** του `dxf-viewer`. Η τομή «κοινός κώδικας → `dxf-viewer`»
(BFS που δεν μπαίνει στο `dxf-viewer`) έδωσε 50 ακμές· η μάζα ήταν μία: η **καρτέλα κάτοψης** →
`EntityFilesManager` → `EntityFilesContent` → `FloorplanGallery`, που εισάγει στατικά το 3Δ (`BimViewport3D`, ~2.500
αρχεία), το `DxfRenderer`, το snap. Δηλαδή όλος ο θεατής, για ένα πάνελ που ανοίγει **μόνο με κλικ**.

**Η απόφαση** — ο βαρύς θεατής είναι module που φορτώνει **στη χρήση**, και τα κείμενά του ταξιδεύουν **μαζί** με τον
κώδικα (Closure `ModuleManager` / Figma / VS Code). Με τον **υπάρχοντα** μηχανισμό, όχι δεύτερο:
- `src/components/shared/files/media/floorplan-gallery-surfaces.tsx` — `defineLazySurfaces` (ADR-280 §11.8 Β4.1),
  εκθέτει το `LazyFloorplanGallery` με το **ίδιο API** με το `FloorplanGallery`.
- **Δύο κλειδιά, ένα chunk** (`FloorplanGallery` · `FloorplanGalleryFill`): το `fallback` δεν βλέπει props, και η όψη
  αναμονής (`FloorplanGalleryPending.tsx`) κρατά τη θέση της κάτοψης στη **δική της** διάταξη — `flow` ⇒ δάπεδο 500px·
  `fill` ⇒ ό,τι δίνει ο γονιός (δάπεδο 500px σε χώρο 280px θα ξανάφερνε το κομμένο κέντρο του ADR-912).
- `floorplan-gallery-props.ts` — **μόνο τύποι**: ο γράφος της 3.34 μετρά και το `import type` ως ακμή. Το
  `FloorplanGalleryProps` μετακινήθηκε εδώ από το `floorplan-gallery-config.ts` (μία δήλωση).
- Καταναλωτές: `EntityFilesContent` · `ReadOnlyMediaViewer` · `ReadOnlyMediaSubTabs`. Το `EntityFilesContent` εισάγει
  πλέον το `MediaGallery` **απευθείας**: το barrel `./media` επανεξάγει και το `FloorplanGallery`, άρα αλλιώς η τομή
  δεν θα έπιανε.
- `BuildingFloorplanService`: το `DxfFirestoreService` φορτώνεται με `await import()` μέσα στις async μεθόδους
  (ίδιο ιδίωμα με το `CADProcessor`)· στατικά έφερνε **360** αρχεία (κύκλος του πυρήνα γεωμετρίας, §4).
- **CHECK 3.62 (ADR-796) βλέπει πλέον τα `import()`.** Μετά την αλλαγή του `BuildingFloorplanService` η πύλη
  μπλόκαρε με «κανείς δεν ζητά πια `DxfFirestoreService` — σβήσε τη γραμμή»: **ψευδές**, γιατί η υπηρεσία
  χρησιμοποιούνταν ακόμη, με `await import()`. Η πύλη μετρούσε μόνο στατικές εισαγωγές· μετρημένα, **15** `import()` και
  **3** αναφορές τύπου `import('x').T` από έξω ήταν αόρατες. Η δημόσια επιφάνεια ρωτά **ποιος** ζητά, όχι **πότε**
  φορτώνεται. Νέο `scripts/lib/public-surface/dynamic-claims.js`, με την ίδια σημασία που δίνουν webpack 5 / Rollup στο
  tree-shaking του `import()`: `{ A } = await import()` · `.then((m) => m.A)` · `(await import()).A` ⇒ `A`·
  module που διαφεύγει ολόκληρο (lazy loader) ⇒ `*`· άγνωστο σχήμα ⇒ `*` (fail-closed). **Μία** κρίση
  `classifyClaim` για στατικές και δυναμικές αξιώσεις. Αποτέλεσμα: 636 → **645** δηλωμένες χρήσεις, **0** ορφανές. Οι
  **7** αξιώσεις που ήταν σε χρήση αλλά αόρατες δηλώθηκαν **με λόγο** στο `.dxf-viewer-public-api.json` (μεταξύ τους
  `DxfViewerApp#default` και `dxf-import#dxfImportService`). Άγκυρες `Δ1–Δ6` στο `public-surface-gate.test.js`
  (μαζί με το περιστατικό και τον παρονομαστή του).

**Αποτέλεσμα** (ίδιος γράφος, πάνω στον αλλαγμένο κώδικα):

| ρίζα | πριν | μετά |
|---|---|---|
| `PropertiesPageContent` | 5.457 / 2.540 dxf | **3.087 / 365 dxf** |
| `BuildingsPageContent` | 5.433 / 2.540 dxf | **3.051 / 365 dxf** |
| `/dashboard` σελίδα | 385 / 0 dxf | 385 / 0 dxf |

**Δεύτερο κέρδος (από τον γεννήτορα, `lazy-route-namespaces.json`):** οι διαδρομές `Properties` · `PropertyDetail` ·
`PropertyDossierTab` · `SalesReserveDialog` · `Spaces*` κ.ά. **δεν περιμένουν πλέον** στο πρώτο καρέ τα 12 namespaces
`dxf-viewer*` · `bim*` · `uom` — τα περιμένει μόνο το chunk της κάτοψης.

⚠️ **ΜΗΝ** εισαγάγεις στατικά το `FloorplanGallery` από κοινό κώδικα (ούτε μέσω του barrel `media/index.ts`).

## 3. Πώς μετρήθηκε

Στατικός γράφος με τον parser του TypeScript: `@/` → `src/` (και τα aliases του `tsconfig.base.json`), αγνοούνται
`import type`, εισαγωγές όπου **όλα** τα ονόματα είναι `type`, και `import('x').Τύπος` σε θέση τύπου· τα `import()` σε
χρόνο εκτέλεσης είναι όρια. Δύο ερωτήσεις: (α) κλειστότητα από τη ρίζα· (β) **τομή** — BFS που δεν μπαίνει στο
`dxf-viewer`, ώστε να μετρούν μόνο οι ακμές του **κοινού** κώδικα (όχι κοινά αρχεία που φτάνονται μέσα από τον viewer).
Τα νούμερα είναι γράφος, **όχι** μνήμη· η πραγματική εξοικονόμηση θέλει ξαναμέτρηση στο codespace (⏳).

## 4. Τι μένει

- ✅ **Ε3 / Ε4 — ο «κύκλος των 346» ήταν μία λάθος εισαγωγή, όχι κύκλος του πυρήνα** (2026-11-28). Τα καθαρά μαθηματικά
  είχαν ήδη αποσπαστεί στο `geometry-vector-utils.ts` (ADR-065), αλλά τα φύλλα `geometry-angle-utils` ·
  `geometry-circle-utils` · `geometry-arc-utils` · `geometry-polyline-utils` και το barrel `geometry-utils` τα εισήγαγαν
  ακόμη από το `geometry-rendering-utils` — μέσω της **επανεξαγωγής συμβατότητας**. Εκείνο εισάγει `types/entities` ·
  `useTextPreviewStyle` · `text-rendering-config`, άρα κάθε `clamp` / `degToRad` κουβαλούσε τον renderer.
  **Διόρθωση = κάθε εισαγωγέας ζητά από τον ιδιοκτήτη**: τα φύλλα από το `geometry-vector-utils`· το
  `geometry-rendering-utils` το `degToRad` από το `@/lib/geometry/angle` και το `clamp` από το `utils/scalar-math` (έπαψε
  να εισάγει το barrel που το επανεξάγει — κύκλος)· οι δύο γέφυρες (`formatter-unit-formats` ·
  `DxfViewerComponents.styles`) επίσης από τους καθαρούς ιδιοκτήτες. Καμία συνάρτηση δεν άλλαξε — ίδια αναφορά.
  Η δημόσια επιφάνεια (CHECK 3.62) δεν αλλάζει: οι εξωτερικές αξιώσεις μένουν ίδιες.

  | στατικός γράφος | πριν | μετά |
  |---|---|---|
  | `geometry-utils` | 437 | **15** |
  | `display-length-format` (Ε4) | 437 | **40** |
  | `DxfViewerComponents.styles` (Ε3) | 480 | **52** |
  | `PropertiesPageContent` | 3.076 / 365 dxf | **2.739 / 37 dxf** |

  ⚠️ **ΜΗΝ** εισαγάγεις από το `geometry-rendering-utils` ή το barrel `geometry-utils` μέσα σε **φύλλο** μαθηματικών:
  ξαναδένει τα καθαρά μαθηματικά με τον renderer (437 αρχεία για ένα `clamp`).
- Οι υπόλοιποι 13 τομείς του κοινού `LazyRoutes` · διαγραφή `lazyRoutes.tsx` / `lazyRoutesAdr294.tsx` και των αναφορών τους.
  **Είναι το μόνο βήμα αυτού του ADR που μειώνει τη μνήμη του dev** (§5.2).
- ⏸ **Ε5 — φύλλα γρήγορης δημιουργίας** (`BuildingQuickCreateSheet` · `ProjectQuickCreateSheet`): βλ. §5.3.
- Η όψη αναμονής `flow` δεν κρατά το ύψος της γραμμής εργαλείων ⇒ μικρό πήδημα όταν φτάσει το chunk.

## 5. Ξαναμέτρηση στο codespace (2026-11-28) — ο γράφος ΔΕΝ είναι η μνήμη

Codespace 4 πυρήνες / 16 GB, Next **15.5.22** + Turbopack, φρέσκος `.next` ανά εκτέλεση, αίτημα με `curl` (user-agent
φυλλομετρητή). Οι σελίδες απαντούν 500 (το ssh δεν έχει τα secrets του codespace)· η **μεταγλώττιση** ολοκληρώνεται
πριν από την απόδοση (`✓ Compiled /o/[workspace]/properties`), άρα η μνήμη της μετριέται κανονικά.

### 5.1 Μετρήσεις

| εκτέλεση | commit | μέγιστο RSS | μεταγλώττιση |
|---|---|---|---|
| `/dashboard` → `/properties` → `/buildings` (ένας server) | `3a2b5098` | 4,75 → 9,60 → 9,76 GB | 71,5s · 80,1s · — |
| `/properties` **μόνο του** | `77521ff6` (πιλότος, **χωρίς** §2) | **9,56 GB** | 135,5s |
| `/properties` **μόνο του** | `3a2b5098` (**με** §2) | **9,40 GB** | 131,7s |

⇒ το §2 μείωσε τον στατικό γράφο κατά 43% (5.457 → 3.087) και τη μνήμη του dev κατά **~2%**.

### 5.2 Γιατί — ο Turbopack της 15.5 μεταγλωττίζει και τους στόχους των `import()`

Στη Next 15.5 ο Turbopack στο `next dev` μεταγλωττίζει τους στόχους των `import()` / `next/dynamic` **μαζί με τη σελίδα**.
Η αναβολή τους υπάρχει μόνο από την **16.4** (`experimental.turbopackLazyDynamicImports` / `…SSR`, πειραματικά,
προεπιλογή `false`)· η αποβολή μνήμης (`turbopackMemoryEviction`, έως −90% μετά από 50 διαδρομές) από την **16.3**.
Η 15.5.22 δεν έχει κανένα από τα δύο (`config-schema.js`). Ο γράφος **με** τα `import()` (εργαλείο §3, `--dyn`) για το
`PropertiesPageContent` είναι **5.986 αρχεία / 2.575 `dxf-viewer`** — αυτό μεταγλωττίζει ο dev, και αυτό εξηγεί τα 9,4 GB.

**Συνέπειες:**
- Ένα όριο `import()` (§2, Ε5) μικραίνει το **bundle του φυλλομετρητή στην παραγωγή** (πρώτο φόρτωμα), **όχι** τη μνήμη
  του dev. Η αξία του §2 μένει — είναι αξία παραγωγής.
- Ό,τι μειώνει τη μνήμη του dev είναι η **αφαίρεση** ακμής, όχι η μετατροπή της σε `import()`. Γι' αυτό ο πιλότος έσωσε
  το `/dashboard`: η συνθήκη `NODE_ENV` **σβήνει** τις ακμές `import()` του `preloadRoutes` στο dev. Το ίδιο θα κάνουν οι
  13 τομείς: κάθε σελίδα που εισάγει το κοινό `LazyRoutes` κουβαλά `import()` προς **όλες** τις σελίδες.
- Το Ε3/Ε4 είναι στατική αφαίρεση, αλλά στο `/properties` τα ίδια αρχεία φτάνουν και μέσα από το chunk της κάτοψης ⇒
  κέρδος παραγωγής εκεί· κέρδος dev μόνο σε σελίδες χωρίς κάτοψη.

### 5.3 Ε5 — παρκαρισμένο: η σφράγιση του CHECK 3.34 το αρνείται

Υλοποιήθηκε (κέλυφος φύλλου στατικό + επεξεργαστής ως επιφάνεια `defineLazySurfaces`, `/properties` 2.739 → 1.731 στον
στατικό γράφο) και ο γεννήτορας **αρνήθηκε**: οι δύο επεξεργαστές γίνονται νέες ρίζες αναμονής κειμένων ⇒ ζεύγη
(διαδρομή, namespace εκτός εκκίνησης) 126 → 133 και τριάδες εισδοχής 330 → 345 — σφράγιση **μόνο συρρικνώνεται**.
Τα namespaces δεν εξαφανίζονται· **μετακομίζουν** από τη διαδρομή στο φύλλο (το `Properties`/`PropertyDetail` έπαψαν να
περιμένουν `org-structure` · `surveyRecord`). Η θεραπεία που ζητά η πύλη είναι τεμπέλικες **καρτέλες** μέσα στο
`BuildingDetails` / `ProjectDetails`, ώστε το φύλλο να περιμένει μόνο τα κείμενα της πρώτης καρτέλας. Και επειδή είναι
όριο `import()`, στη 15.5 δεν δίνει τίποτα στη μνήμη του dev (§5.2). Απόφαση Giorgio: (α) τεμπέλικες καρτέλες πρώτα ·
(β) σφράγιση με γραμμένο `why` · (γ) να μείνει.

### 5.4 Πώς μετρήθηκε

`measure-dev.sh` στο codespace (μέσω `gh codespace ssh`): `rm -rf .next` → `pnpm dev` στο παρασκήνιο → δειγματολήπτης
1s με άθροισμα RSS των διεργασιών `node`/`next` (κρατά το μέγιστο ανά σελίδα) + `memory.current` / `oom_kill` του
cgroup → `curl` ανά σελίδα. Η μνήμη του Turbopack δεν επιστρέφει μεταξύ σελίδων, γι' αυτό η σύγκριση γίνεται σε
**κρύο** server με μία σελίδα.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-25 | Πιλότος §1: 6 μητρώα τομέα, `preloadRoutes` μόνο σε παραγωγή (`77521ff6`). Μέτρηση codespace: `/dashboard` φορτώνει. |
| 2026-11-27 | §2: όριο θεατή κατόψεων (`floorplan-gallery-surfaces`) + `BuildingFloorplanService` με `await import()`. `/properties` 2.540 → 365 αρχεία `dxf-viewer` (γράφος). ADR γράφτηκε. CHECK 3.62 μετρά πλέον `import()` / `import('x').T` (7 αόρατες αξιώσεις δηλώθηκαν με λόγο). |
| 2026-11-28 | **Επαναρίθμηση 953 → 954** πριν την ένταξη: ο αριθμός 953 δόθηκε στο `main` στο `ADR-953-owner-listing-concurrent-save.md` (`bc94c819`). Άλλαξε αριθμό αυτό το ADR, επειδή δεν είχε ενταχθεί ακόμη στο `main`. Τα μηνύματα των commits `77521ff6` και `bd53926e` γράφουν ακόμη «ADR-953» — το ιστορικό δεν ξαναγράφεται. |
| 2026-11-28 | **§4 Ε3/Ε4**: ο «κύκλος των 346» ήταν εισαγωγή από την επανεξαγωγή συμβατότητας του `geometry-rendering-utils` — κάθε εισαγωγέας ζητά πλέον από τον ιδιοκτήτη (`geometry-vector-utils` · `@/lib/geometry/angle` · `utils/scalar-math`). `/properties` 365 → **37** αρχεία `dxf-viewer` (γράφος). **§5 ξαναμέτρηση στο codespace**: το §2 έδωσε ~2% μνήμη dev (9,56 → 9,40 GB κρύο `/properties`) — η 15.5 μεταγλωττίζει τους στόχους των `import()`· μόνο η **αφαίρεση** ακμής (13 τομείς) μειώνει τη μνήμη του dev. **Ε5** υλοποιήθηκε και παρκαρίστηκε: η σφράγιση του CHECK 3.34 το αρνείται (§5.3). |
