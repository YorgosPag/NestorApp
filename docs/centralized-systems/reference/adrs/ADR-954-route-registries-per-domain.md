# ADR-954 — Μητρώα διαδρομών ανά τομέα και όρια φόρτωσης στη χρήση: η μεταγλώττιση μιας σελίδας φτάνει μόνο τον τομέα της

| | |
|---|---|
| **Status** | IN PROGRESS — 2026-11-27 · ✅ πιλότος (6 τομείς) · ✅ όριο θεατή κατόψεων (§2) · ⏳ 13 τομείς · ⏳ §4 Ε3/Ε4 · ⏳ ξαναμέτρηση στο codespace |
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

- **Ε3** — `EnterprisePhotoUpload` → `DxfViewerComponents.styles` → (`clamp` από `geometry-utils`) → κύκλος ~346.
- **Ε4** — `audit-quantity-format` → `formatLengthForDisplay` → `FormatterRegistry` → `geometry-utils` → κύκλος ~346.
  Ο κύκλος (`geometry-utils ↔ types/entities ↔ entity-bounds ↔ block-expander …`) είναι **εσωτερικός** του
  `dxf-viewer`· όποιος τον αγγίζει παίρνει και τα 346. Θέλει έρευνα πριν από κώδικα (CHECK 3.62).
- Οι υπόλοιποι 13 τομείς του κοινού `LazyRoutes` · διαγραφή `lazyRoutes.tsx` / `lazyRoutesAdr294.tsx` και των αναφορών τους.
- Τα φύλλα γρήγορης δημιουργίας (`BuildingQuickCreateSheet` · `ProjectQuickCreateSheet`) εισάγουν στατικά ολόκληρο το
  `BuildingDetails` / `project-details` ⇒ μετρημένο: με όριο εκεί, `/properties` 2.724 → **1.709** αρχεία.
- Η όψη αναμονής `flow` δεν κρατά το ύψος της γραμμής εργαλείων ⇒ μικρό πήδημα όταν φτάσει το chunk.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-25 | Πιλότος §1: 6 μητρώα τομέα, `preloadRoutes` μόνο σε παραγωγή (`77521ff6`). Μέτρηση codespace: `/dashboard` φορτώνει. |
| 2026-11-27 | §2: όριο θεατή κατόψεων (`floorplan-gallery-surfaces`) + `BuildingFloorplanService` με `await import()`. `/properties` 2.540 → 365 αρχεία `dxf-viewer` (γράφος). ADR γράφτηκε. CHECK 3.62 μετρά πλέον `import()` / `import('x').T` (7 αόρατες αξιώσεις δηλώθηκαν με λόγο). |
| 2026-11-28 | **Επαναρίθμηση 953 → 954** πριν την ένταξη: ο αριθμός 953 δόθηκε στο `main` στο `ADR-953-owner-listing-concurrent-save.md` (`bc94c819`). Άλλαξε αριθμό αυτό το ADR, επειδή δεν είχε ενταχθεί ακόμη στο `main`. Τα μηνύματα των commits `77521ff6` και `bd53926e` γράφουν ακόμη «ADR-953» — το ιστορικό δεν ξαναγράφεται. |
