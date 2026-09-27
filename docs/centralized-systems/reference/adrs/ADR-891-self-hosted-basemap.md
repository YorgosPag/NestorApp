# ADR-891 — Αυτοφιλοξενούμενος χάρτης φόντου (PMTiles): μηδέν συνδρομές, μηδέν όρια τρίτων

| | |
|---|---|
| **Status** | **Φ1 IMPLEMENTED** — 2026-09-27 (§6) · **Φ2 IMPLEMENTED** — 2026-09-27 (§7) · **Φ3 IMPLEMENTED (κώδικας)** — 2026-09-27 (§9)· ✅ διακομιστής ζωντανός (§9.3) · ⏳ ζωντανός έλεγχος εφαρμογής · Φ4–Φ5 PROPOSED |
| **Date** | 2026-09-26 |
| **Προέλευση** | Μελέτη χάρτη ανταγωνιστή (ADR-890 §2) → ερώτηση Giorgio «υστερούμε στους χάρτες;» + ρητός περιορισμός: **«δεν θέλω να πληρώσω συνδρομές και δικαιώματα χρήσης»** |
| **Σχετικά** | ADR-782 *(υπόβαθρο DXF — διαβάζει το μητρώο)* · ADR-777 §2.2 *(ακροατήρια χάρτη)* · CHECK 3.95 · ADR-890 *(σελίδα περιοχής, χάρτης θερμότητας Φ3)* · ADR-889 *(στρώση ζωνών §2.3)* · ADR-883 *(όρια περιοχών — στρώση πάνω στο φόντο)* · ADR-805 / CHECK 3.69 *(άδειες γραμματοσειρών)* · ADR-863 / CHECK 3.84 *(απόδοση αδειών)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το εύρημα

Σε **λειτουργίες** δεν υστερούμε. Ο ανταγωνιστής χρησιμοποιεί δεδομένα OSM, basemap Mapbox και στρώση kepler.gl. Εμείς
έχουμε δεδομένα OSM, basemap Carto/VersaTiles και MapLibre GL 5.9, που είναι η ανοιχτή συνέχεια του Mapbox GL (BSD).
Υπάρχει όμως **κίνδυνος κόστους και διαθεσιμότητας** (επαληθευμένο 2026-09-26).

⚠️ **Ο πίνακας που ακολουθεί είναι η εικόνα της 2026-09-26, και η Φάση 1 N.0.1 (2026-09-27) τον βρήκε
λανθασμένο σε τέσσερα σημεία.** Η διορθωμένη απογραφή είναι στο §6.1· ο πίνακας μένει ως ιστορικό.

| Πού | Πηγή πλακιδίων | Κίνδυνος |
|---|---|---|
| `subapps/geo-canvas/services/map/MapStyleManager.ts` — `INITIAL_MAP_STYLE = 'greece'` → **CARTO Positron** (+ Voyager, Dark Matter). Το χρησιμοποιεί και το `ListingMapSnapshotStage.tsx` | `basemaps.cartocdn.com` | Εμπορική χρήση δωρεάν **έως 1 εκατ. αιτήματα πλακιδίων/μήνα**· πάνω από αυτό **500 $/μήνα** (CARTO Basemaps Commercial) |
| `components/projects/ika/map-shared/map-styles.ts` `OSM_MAP_STYLE` → `PlaceMap.tsx`, χάρτες ΙΚΑ | `tile.openstreetmap.org` (raster) | Η Tile Usage Policy του OSM **απαγορεύει** εφαρμογές υψηλής κίνησης· αποκλεισμός χωρίς προειδοποίηση, καμία εγγύηση |
| `MapStyleManager.ts` watercolor / toner | `tiles.stadiamaps.com` | Χρειάζεται λογαριασμό/κλειδί σε παραγωγή· δωρεάν όριο |
| `geo-canvas/config/index.ts` | `tiles.versatiles.org` | Δωρεάν, χωρίς κλειδί — αλλά **τρίτος** διακομιστής χωρίς SLA |
| `subapps/dxf-viewer/systems/basemap/basemap-source.ts` | *(να ελεγχθεί στη Φ1)* | — |

## 2. Η απόφαση

**Ένα αρχείο PMTiles της Ελλάδας, σερβιρισμένο από τη δική μας υποδομή.** Αυτό το αρχείο γίνεται η **προεπιλογή όλων**
των χαρτών. Οι εξωτερικές πηγές μένουν μόνο ως **εναλλακτικές** που επιλέγει ρητά ο χρήστης.

| Κομμάτι | Επιλογή | Άδεια |
|---|---|---|
| Δεδομένα | OpenStreetMap (απόσπασμα Ελλάδας) | ODbL — **μόνο** αναφορά «© OpenStreetMap contributors» (την έχουμε ήδη) |
| Κατασκευή πλακιδίων | Ημερήσιο build Protomaps + `pmtiles extract` με bbox Ελλάδας, **ή** Planetiler από το απόσπασμα Geofabrik | BSD-3 / Apache-2.0 |
| Ανάγνωση στον browser | Πακέτο `pmtiles` (πρωτόκολλο για MapLibre) | **BSD-3** — επιτρέπεται (N.5). Έλεγχος άδειας **πριν** την εγκατάσταση |
| Στυλ | Protomaps basemaps (light/dark = τα **δύο θέματα**, πύλες 3.38–3.42) | BSD-3 |
| Γραμματοσειρές (glyphs) + sprites | Αυτοφιλοξενούμενα | Γραμματοσειρές **OFL** → δήλωση στο μητρώο του **CHECK 3.69** |
| Σερβίρισμα | Στατικό αρχείο με **HTTP Range** (nginx στο Netcup) ή Firebase Storage | Κανένα κόστος ανά προβολή |

**Γιατί όχι δικός μας διακομιστής πλακιδίων** (tileserver-gl, martin): το PMTiles είναι **ένα** αρχείο που διαβάζεται με
αιτήματα Range. Δεν χρειάζεται υπηρεσία που τρέχει, ούτε μνήμη, ούτε παρακολούθηση.

**Γιατί όχι kepler.gl**: βαριά βιβλιοθήκη οπτικοποίησης για αναλυτές (redux, μεγάλο bundle). Ο χάρτης θερμότητας
(ADR-890 Φ3) είναι ένα `fill` layer του MapLibre με χρώμα από τα δεδομένα.

## 3. Φάσεις

| Φάση | Περιεχόμενο | Πύλη εξόδου |
|---|---|---|
| **Φ1** | Απογραφή **όλων** των πηγών πλακιδίων (§1) σε **ένα** SSoT στυλ/πηγών· σήμερα είναι σκορπισμένες σε 4+ αρχεία | Ένα σημείο δήλωσης· grep = 0 URL πλακιδίων εκτός SSoT |
| **Φ2** | Γεννήτορας `build:basemap` → `greece.pmtiles`. **Μέτρηση** μεγέθους (zoom 0–14) και χρόνου | Αριθμοί στο §4 |
| **Φ3** | Σερβίρισμα (Range) + στυλ light/dark + glyphs/sprites + πρωτόκολλο `pmtiles` στο MapLibre· **προεπιλογή** στην αναζήτηση/αγγελία | Ζωντανή επαλήθευση: κινητό, δύο θέματα, zoom Αθήνα → νησί |
| **Φ4** | `PlaceMap`/ΙΚΑ από `tile.openstreetmap.org` → ίδιο φόντο. CARTO/Stadia μόνο ως ρητή εναλλακτική | Καμία προεπιλογή σε εξωτερική πηγή |
| **Φ5** | Ανανέωση (π.χ. τριμηνιαία — οι δρόμοι αλλάζουν αργά) | — |

## 4. Μετρήσεις

Μετρημένο 2026-09-27, build Protomaps `20260926` (σχήμα 4.15.2), `npm run build:basemap`, σύνδεση ~8 MB/s. Λεπτομέρειες στο §7.

| Μέγεθος | Τιμή |
|---|---|
| **`greece.pmtiles`** (z0–15, κλιμακωτή κάλυψη §7.2) | **682,8 MB** |
| Ίδιο αρχείο με **ένα** ορθογώνιο Ελλάδας (19,2–29,75 E · 34,7–41,8 N) | 982 MB *(dry-run, απορρίφθηκε)* |
| Χρόνος build (λήψη ~711 MB με Range, merge, κέντρο, verify) | **203–227 s** (δύο εκτελέσεις) |
| Αιτήματα προς το Protomaps | ~200 (Range)· **κανένα** από επισκέπτη |
| Μέγεθος πηγής (ο πλανήτης) | 138,3 GB — **δεν** κατεβαίνει |
| Assets (γραμματοσειρές 4 stacks + sprites light/dark + άδειες) | **1.034 αρχεία · 17,8 MB** (από tarball 6,4 MB) |
| Πλακίδιο Αθήνα z14 / Καστελλόριζο z13 / Κωνσταντινούπολη z5 | 125,5 / 20,5 / 129,6 KB (μετρημένο με το `pmtiles` JS· Κωνσταντινούπολη z12 = **κενό**, όπως σχεδιάστηκε) |
| Πλακίδια ανά προβολή σελίδας | ⏳ μετριέται στον ζωντανό έλεγχο της Φ3 (Network) |

## 5. Ανοιχτά

- ✅ **Φιλοξενία — ΑΠΟΦΑΣΗ Giorgio 2026-09-27: Netcup** (VPS 1000 G12: 4 vCore, 8 GB, 256 GB NVMe, 2,5 Gbps, όριο
  ορθής χρήσης 2 TB/24ω ⇒ 200 Mbps). Σύγκριση που παρουσιάστηκε: Netcup **0 €** · Cloudflare R2 + Worker 0 € ως 10 εκ.
  αναγνώσεις/μήνα, **αλλά** μεταφορά όλου του DNS στο Cloudflare για να δουλέψει η cache · Bunny 0,01 $/GB (ελάχ. 1 $/μήνα).
  Το URL ζει σε **μία** γραμμή του μητρώου ⇒ η μετάβαση αργότερα είναι αλλαγή μίας γραμμής + ανέβασμα. Λεπτομέρειες §9.
- **Δορυφορικό υπόβαθρο**: δεν υπάρχει δωρεάν πηγή για εμπορική χρήση σε κλίμακα. Μένει εκτός.

## 6. Φ1 — υλοποίηση (2026-09-27)

### 6.1 Φάση 1 N.0.1: τι βρέθηκε στον κώδικα (διορθώνει το §1)

| # | Το §1 έλεγε | Ο κώδικας |
|---|---|---|
| 1 | Η προεπιλογή είναι CARTO Positron | `INITIAL_MAP_STYLE = 'greece'` = **OSM raster απευθείας**. **Κάθε** χάρτης ανοίγει στο `tile.openstreetmap.org`· η CARTO φορτώνεται μόνο αν πατηθεί διακόπτης |
| 2 | — | Δημόσιος διακόπτης: «Χάρτης» = CARTO **Positron** (όχι ο χάρτης του ανοίγματος ⇒ στο άνοιγμα **κανένα** κουμπί πατημένο) · «Δορυφόρος» = CARTO **Voyager**, δηλαδή **οδικός** χάρτης |
| 3 | Stadia: «χρειάζεται κλειδί» | Χειρότερο: τα στυλ Stamen είναι **CC BY-NC-SA** ⇒ εμπορική χρήση **μόνο** με πληρωμένο πακέτο. Και το **OpenTopoMap** (υπόβαθρο `terrain`, λείπει από το §1) είναι **μόνο μη εμπορικό** (400k/μήνα, 5000/ώρα/IP) |
| 4 | `geo-canvas/config/index.ts` → VersaTiles | **Νεκρό**: κανένας εισαγωγέας. Και **πέμπτο** σημείο, που δεν ήξερε κανείς: `geo-canvas/domains/configuration/GeoCanvasConfig.ts` με `mapbox://` (θέλει πληρωμένο κλειδί Mapbox) — **ολόκληρος** ο φάκελος `domains/` (4 αρχεία, 1.317 γρ.) χωρίς κανέναν εισαγωγέα |
| 5 | dxf-viewer: «να ελεγχθεί» | OSM raster, με τους όρους ήδη ως πεδία (`maxPrefetchRing: 0`, `hasServiceLevelAgreement`) — **το πρότυπο** του μητρώου |
| 6 | — | Το style.json της CARTO φορτώνει πλακίδια από **`tiles.basemaps.cartocdn.com`** (μετρημένο με `curl`) — διακομιστής που **δεν γράφεται πουθενά** στον κώδικα, άρα αόρατος σε κάθε grep |

### 6.2 Αποφάσεις Giorgio

- Stadia (watercolor, toner) και OpenTopoMap (terrain) **αφαιρούνται**.
- Το κουμπί «Δορυφόρος» **αφαιρείται** από τον δημόσιο χάρτη.
- Φύλαξη **όπως οι μεγάλοι**: στατικά στο presubmit **και** την ώρα της εκτέλεσης.

### 6.3 Τι χτίστηκε

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| **Μητρώο (SSoT)** | `src/lib/maps/basemap-catalog.ts` | Πάροχοι (`osmf`, `carto`) με `hosts` (μαζί με τους έμμεσους) · `terms` ως πεδία · `attribution` σε κομμάτια. Πηγές: `osm-raster`, `carto-positron`, `carto-voyager`, `carto-dark-matter`. Ο **ένας** χτίστης raster στυλ (`rasterStyleSpecification`) αντικαθιστά τους τρεις χειρόγραφους. 🔑 Το `commercialUse` **δεν έχει** τιμή «μη εμπορικό»: τέτοιος πάροχος δεν μεταγλωττίζεται |
| **Φύλακας εκτέλεσης** | `src/lib/maps/basemap-request-sentinel.ts` + `Map` του συνόρου `src/lib/maps/maplibre.ts` | `transformRequest` σε **κάθε** χάρτη. Αίτημα προς διακομιστή εκτός μητρώου και εκτός προέλευσης ⇒ `logger.warn` **μία φορά ανά διακομιστή**. Αναφέρει, δεν μπλοκάρει (CSP Report-Only). Το `Map` του συνόρου σκιάζει εκείνο του `export *` |
| **Πύλη presubmit** | CHECK 3.95 `scripts/check-basemap-sources.js` | Δομικά μοτίβα σε **κυριολεκτικές συμβολοσειρές** (AST): `{z}/{x}/{y}` · `style.json` · `.pmtiles` · `mapbox://` · `tile(s).`/`basemap(s).`. Κανένας κατάλογος διακομιστών μέσα στην πύλη (θα ήταν δεύτερο αντίγραφο) |
| Χάρτης γεωαναφοράς / αναζήτησης | `MapStyleManager.ts` (445 → ~130 γρ.) | 4 υπόβαθρα `osm`·`voyager`·`dark`·`greece`, όλα από το μητρώο. `satellite` → `voyager` (έντιμο όνομα «Αναλυτικός») |
| Ακροατήρια | `map-chrome.ts` | `showcase` = **ένα** υπόβαθρο (`INITIAL_MAP_STYLE`), `basemapSwitcher: 'none'`· το πάνελ δεν αποδίδεται (`showsBasemapPanel`) |
| ΙΚΑ / PlaceMap | `ika/map-shared/map-styles.ts` | `OSM_MAP_STYLE = rasterStyleSpecification('osm-raster')` |
| Καμβάς DXF | `dxf-viewer/systems/basemap/basemap-source.ts` | `fromCatalog(...)`· `maxPrefetchRing` παράγεται από `prefetchAllowed` (ADR-782) |
| Νεκρό | `geo-canvas/config/index.ts` | Αφαιρέθηκαν `MAP_STYLES` (VersaTiles) · `DEFAULT_MAP_STYLE` · `GEO_CANVAS_CONFIG.mapStyle` |

### 6.4 Επαλήθευση

- Jest: `npm run test:basemap-sources` = **67** (27 πύλη με 4 μεταλλάξεις που **εκτελούν** την πύλη σε προσωρινό δέντρο + 40 μητρώο/φύλακας).
  Συνολικά 716/717 στις σουίτες χαρτών, geo-canvas, DXF basemap, ΙΚΑ, i18n. Το 1 κόκκινο είναι το `DxfGeoTransform.test.ts`
  (αναμενόταν ελληνικό μήνυμα σφάλματος). Είναι **προϋπάρχον** και άσχετο με τη Φ1.
- Πύλες: 3.75 ✅ · 3.80 ✅ (0 θανάσιμες ακμές) · 3.66 ✅ (11 αδήλωτες = baseline) · 3.28 jscpd ✅ (0 νέοι κλώνοι σε 10 αρχεία).
- CHECK 3.95 στο δέντρο: 13.739 αρχεία, 4 πηγές στο μητρώο, **3 ευρήματα**. Όλα είναι στο **νεκρό**
  `geo-canvas/domains/configuration/GeoCanvasConfig.ts` (`mapbox://`). Η διαγραφή του φακέλου **δεν επετράπη** στον πράκτορα
  από το σύστημα αδειών, και περιμένει τον Giorgio. Μέχρι τότε η πύλη μπλοκάρει, **σωστά**.
- **Ζωντανά** (`/search/results`, dev):
  - Κανένας διακόπτης υποβάθρου.
  - 81 πλακίδια `tile.openstreetmap.org`, όλα `200`.
  - Απόδοση `© <a>OpenStreetMap</a> contributors`.
  - Ο φύλακας είναι **φορεμένος** στον πραγματικό χάρτη (βρέθηκε το `transformRequest` στα props του `Map`). Κλήση με αδήλωτο
    `tiles.stadiamaps.com` δύο φορές ⇒ **μία** προειδοποίηση `MAP_REQUEST_SENTINEL`. Ο δηλωμένος διακομιστής ⇒ σιωπή.
- ⚠️ **Δεν επαληθεύτηκαν ζωντανά**:
  - Ο χάρτης `embedded` (`AddressMap`, 4 κουμπιά): η σελίδα έργων δεν φόρτωσε στον dev μέσα στον χρόνο αναμονής.
  - Ο `workspace` (`GeoCanvasApp`): **κανένα** route δεν τον φορτώνει σήμερα.
  - Το κινητό 390px: ο browser δεν εφάρμοσε το μέγεθος.
  - Τα δύο θέματα: η Φ1 δεν αλλάζει χρώματα, αφού το υπόβαθρο δεν ακολουθεί ακόμη το θέμα (Φ3).

### 6.5 Δηλωμένα ανοιχτά

- ✅ **Διαγράφηκε ο νεκρός `src/subapps/geo-canvas/domains/`** (Giorgio, 2026-09-27) ⇒ CHECK 3.95 **πράσινη**: 0 ευρήματα, 1 ιδιοκτήτης, 13.734 καθαρά αρχεία.
- ✅ Το OSM έμενε προεπιλογή μέχρι τη Φ3 (PMTiles). Με το μητρώο, η αλλαγή ήταν **μία γραμμή** στο `MAP_STYLE_SOURCE` (§9).
- ✅ Υπόβαθρο ανά θέμα (φωτεινό/σκοτεινό) ⇒ Φ3 (§9).

## 7. Φ2 — γεννήτορας `build:basemap` (2026-09-27)

### 7.1 Έρευνα και απόφαση

| Ερώτηση | Απάντηση (πηγή) |
|---|---|
| Protomaps build ή Planetiler; | **Protomaps build + `pmtiles extract`**. Το build είναι ήδη Planetiler, χωρίς Java και χωρίς δικό μας pipeline OSM. Το Planetiler με σχήμα OpenMapTiles θα έφερνε **και** υποχρεωτική αναφορά «OpenMapTiles» (CC-BY 4.0 στο σχήμα) |
| Κατεβαίνει ο πλανήτης (138 GB); | **Όχι**. Το `extract` διαβάζει με HTTP Range μόνο τους καταλόγους και τα πλακίδια της περιοχής (docs.protomaps.com/pmtiles/cli) |
| Άδειες | `go-pmtiles` **BSD-3** · `pmtiles` npm 4.5.0 **BSD-3** · `@protomaps/basemaps` 5.7.2 **BSD-3 + CC0 + MIT** · γραμματοσειρές Noto **OFL** · εικονίδια **CC0** · δεδομένα **ODbL** (μόνο «© OpenStreetMap», την έχουμε). **Κανένα GPL/LGPL** (N.5 ✅) |
| Ελληνικά ονόματα; | ✅ **Μετρημένο**: οι στρώσεις του αρχείου έχουν πεδίο `name:el` (`pmtiles show --metadata`). Το `lang: 'el'` του στυλ επαληθεύεται οπτικά στη Φ3 |
| Διατήρηση builds | Το Protomaps κρατά ~1 εβδομάδα + το τελευταίο ανά έκδοση σχήματος (`build-metadata.protomaps.dev/builds.json`). Η αναπαραγωγιμότητα είναι **δική μας**: το αρχείο + η προέλευσή του |

### 7.2 Κλιμακωτή κάλυψη: βελτίωση πάνω στο «ένα ορθογώνιο»

Το ορθογώνιο της Ελλάδας περιέχει **Κωνσταντινούπολη, Σμύρνη, Προύσα και Τίρανα** σε zoom 15. Ένα αρχείο μόνο της
επικράτειας όμως **αδειάζει** όταν απομακρύνεσαι. Λύση: πυραμίδα «επισκόπηση + λεπτομέρεια», σε **έναν** πίνακα
(`scripts/lib/basemap/basemap-coverage.ts` → `BASEMAP_TIERS`):

| Ζώνη | Zoom | Περιοχή | Μετρημένο |
|---|---|---|---|
| `world` | 0–5 | όλη η Γη | 15,0 MB · 7 s |
| `region` | 6–7 | επικράτεια + 1.500 km | 32,1 MB · 7 s |
| `neighbourhood` | 8–9 | επικράτεια + 600 km | 80,1 MB · 19 s |
| `territory` | 10–15 | **κάθε** όριο + 15 km | 555,7 MB · 136 s |

- **Η επικράτεια δεν γράφεται με το χέρι**. Βγαίνει από τα όρια Καλλικράτη που ήδη δημοσιεύουμε (ADR-883): για κάθε κλάδο
  της ιεραρχίας, το λεπτομερέστερο διαθέσιμο όριο έως τον δήμο (`territoryLeaves`, 333 όρια· το Άγιο Όρος περιλαμβάνεται ως
  `municipality:9901`). Το υπάρχον `GREECE_GEOGRAPHIC_BBOX` του DXF (ADR-716) **δεν** επαναχρησιμοποιήθηκε: απαντά σε **άλλη**
  ερώτηση (παράθυρο αληθοφάνειας UTM) και κόβει επίτηδες στο 28,5° E, έξω από το Καστελλόριζο.
- **Τα 15 km είναι εγγύηση**, γιατί το ορθογώνιο κάθε ορίου περιέχει το όριο. Φαίνεται η τουρκική ακτή απέναντι από τη Σάμο (1,6 km).
- **Απορρίφθηκε**: κάλυψη στο πλέγμα πλακιδίων z12 με διαστολή. Έβγαινε 537 MB, δηλαδή ίδιο βάρος, με περισσότερο κώδικα και χωρίς εγγύηση σε km.
- Οι ζώνες είναι **ξένες** μεταξύ τους (απαίτηση του `pmtiles merge`) και καλύπτουν **ακριβώς** το 0–15 (`assertTierPartition`).

### 7.3 Τι χτίστηκε

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| Γεννήτορας | `scripts/build-basemap.ts` · `npm run build:basemap [--build=YYYYMMDD] [--dry-run]` | επικράτεια → build → extract ανά ζώνη → merge → κέντρο → verify → προέλευση |
| Κάλυψη | `scripts/lib/basemap/basemap-coverage.ts` | `BASEMAP_TIERS` · `territoryLeaves` · `expandBox` · `tierExtent` (καθαρό, χωρίς I/O) |
| Επιλογή build | `scripts/lib/basemap/protomaps-builds.ts` | 🔑 **το σχήμα καρφώνεται (4.x), όχι η ημερομηνία**: build άλλης κύριας έκδοσης θα έδινε **άδειο χάρτη χωρίς σφάλμα**, οπότε απορρίπτεται |
| Εργαλείο | `scripts/lib/basemap/pmtiles-cli.ts` | `go-pmtiles` 1.31.2, **sha256 καρφωμένο ανά πλατφόρμα**, γιατί εκτελείται κώδικας από το διαδίκτυο. Στα Windows ρητά `System32\tar.exe`, γιατί το GNU tar του Git Bash δεν ανοίγει zip |
| **Λήψη πηγής (SSoT, N.0.2)** | `scripts/lib/cached-download.ts` | Ήταν **δύο** αντίγραφα (ADR-883 `loadLayer` · ADR-889 `mama-download`) και θα γινόταν τρίτο. Ροή με sha256 εν κινήσει, ατομική εγγραφή `.part` → μετονομασία, `.meta.json` δίπλα, προαιρετικό κάρφωμα. Και οι δύο παλιοί καταναλωτές περνούν πλέον από εδώ |

**Προέλευση** (`greece.pmtiles.provenance.json`): build, σχήμα, BLAKE3 του πλανήτη, άδειες, επικράτεια, μέγεθος και χρόνος ανά ζώνη, sha256 και κεφαλίδα του αρχείου.

**Κεφαλίδα**: το `merge` αντέγραφε κέντρο `[0,0,0]` από το πρώτο αρχείο (τον κόσμο), και διορθώνεται σε κέντρο επικράτειας στο z6.
Τα `bounds` μένουν **όλη η Γη** επίτηδες: το πρωτόκολλο δεν ζητά πλακίδια έξω από αυτά, οπότε η ζώνη `world` θα χανόταν.

🔴 **Η έξοδος ΔΕΝ μπαίνει στο `public/`** (`node_modules/.cache/basemap/out/`). Το `Dockerfile` αντιγράφει όλο το `public/`
στην εικόνα, και τα 683 MB θα ταξίδευαν σε **κάθε** deploy και στο git. Το πού σερβίρεται αποφασίζεται στη Φ3 (§5).

### 7.4 Επαλήθευση

- Jest: **46/46**. Κάλυψη (ζώνες, φύλλα, km, περιοχές) · επιλογή build · CLI · λήψη πηγής απέναντι σε **πραγματικό** τοπικό διακομιστή
  HTTP (κάρφωμα, μισό αρχείο, cache χωρίς προέλευση, αλλαγή καρφώματος) · `settlement-points` αμετάβλητο.
- Μεταλλάξεις: αφαίρεση του ελέγχου sha256 και χαλάρωση της διαμέρισης zoom ⇒ **4** κόκκινα.
- Build από άκρη σε άκρη, **δύο φορές**: `verify` ✅ και κέντρο κεφαλίδας `[24,51, 38,28, z6]` (πριν τη διόρθωση ήταν `[0,0,0]`). Η sha256 εξόδου γράφεται στην προέλευση. Το αν δύο builds του ίδιου build Protomaps δίνουν ίδια bytes **δεν** μετρήθηκε: οι δύο εκτελέσεις διέφεραν ήδη στην κεφαλίδα.

### 7.5 Για τη Φ3

- **Φιλοξενία** (§5): ~683 MB, στατικό, με HTTP Range. Υποψήφιοι: τόμος του Coolify στο Netcup, ή αποθήκη αντικειμένων χωρίς κόστος εξόδου.
  ⚠️ **Το Firebase Storage έχει κόστος εξόδου** ανά GB, οπότε αντιφάσκει με το «κανένα κόστος ανά προβολή» του §2.
- Τα πλακίδια είναι ήδη `gzip`: ο διακομιστής **δεν** πρέπει να τα ξανασυμπιέζει, και πρέπει να εκθέτει `Range`/`ETag` στο CORS.
- Νέα πηγή στο `BASEMAP_SOURCE_TABLE` + πρωτόκολλο `pmtiles` + στυλ `@protomaps/basemaps` light/dark με `lang: 'el'` + glyphs/sprites αυτοφιλοξενούμενα (Noto, OFL ⇒ CHECK 3.69).
- Ανανέωση (Φ5): `npm run build:basemap` με νεότερο build του ίδιου σχήματος.

## 8. Η απόδοση του χάρτη στο σύνορο (2026-09-27)

### 8.1 Το εύρημα (ζωντανός έλεγχος κινητού της `/area`, στιγμιότυπα Giorgio)

Ο χάρτης της **δημόσιας** σελίδας περιοχής έδειχνε πλακίδια OpenStreetMap **χωρίς** «© OpenStreetMap contributors». Η απόδοση
αυτή είναι **όρος της άδειας ODbL** και της πολιτικής πλακιδίων του OSMF. Η ρίζα ήταν ένας κανόνας και όχι μια παράλειψη: ο `PlaceMap`
έκλεινε το `attributionControl` και «κάθε καταναλωτής τη γράφει μόνος του». Η μέτρηση:

| Χάρτης | Απόδοση πριν |
|---|---|
| `PlaceSummary` · `PlaceChooser` · `DemandAreaOutline` · `DemandFrontageField` · `CoverageOutlineMap` | ✅ αλλά από **μετάφραση** (`search-results:place.attribution`), όχι από την πηγή. Θα έμενε λάθος μετά την αλλαγή υποβάθρου της Φ3 |
| `AreaBoundaryMap` (**δημόσια** `/area`) · `CoverageOutlinePicker` · `CoverageRadiusPicker` · `GeofenceConfigMap` · `LiveWorkerMap` (ΙΚΑ) | ❌ **καμία** |

### 8.2 Η θεραπεία: στο σύνορο, από τις πηγές

- Το `Map` του `@/lib/maps/maplibre` (το σύνορο του CHECK 3.75, όπου ζει ήδη ο φύλακας της §6) **ζωγραφίζει πάντα** την απόδοση:
  - Διαβάζει από τις **πηγές του φορτωμένου στυλ** μέσω `mapAttribution` (`map-attribution.ts`). Είναι η **ίδια** ανάγνωση με το στιγμιότυπο αγγελίας, που πριν είχε δικό του αντίγραφο.
  - Ενημερώνεται σε `load` / `styledata` / `sourcedata`, και από το τελευταίο **μόνο** όταν έρθουν μεταδεδομένα. Η αναφορά μένει ίδια όσο το κείμενο δεν αλλάζει, άρα καμία επαναζωγράφιση ανά πλακίδιο.
  - Η εμφάνιση είναι **μία** (`map-attribution-view.tsx` → `MapAttributionText`), κοινή με το `ListingMapSnapshot`. Θεματικά χρώματα (`bg-card`), πάντα ορατή και **ποτέ** πίσω από «ⓘ»: το compact του MapLibre κρύβει το κείμενο σε στενούς χάρτες, δηλαδή σε κάρτες, φόρμες και κινητό.
- Το `attributionControl` του καταναλωτή **αγνοείται**. Αφαιρέθηκαν τα 4 `attributionControl={false}`, οι 5 χειρόγραφες γραμμές και το κλειδί `place.attribution` (el/en).
- 🔑 Για τη Φ3: το PMTiles φέρνει την απόδοσή του στο `source.attribution` και εμφανίζεται **χωρίς** καμία αλλαγή σε χάρτη.

### 8.3 Επαλήθευση

- Jest **681/681** (66 σουίτες: χάρτες, geo, εντολές, ζήτηση, στιγμιότυπο, ακίνητο, περιοχή, ΙΚΑ). Νέα άγκυρα `map-boundary-attribution.test.tsx`: η μετάλλαξη «χωρίς απόδοση / με `attributionControl` του καταναλωτή» δίνει **2** κόκκινα.
- Πύλες: 3.75 ✅ · 3.80 ✅ (0 θανάσιμες ακμές) · 3.95 ✅ · 3.8 ✅ · 3.28 jscpd ✅.
- ⏳ **CHECK 3.34 (shell slice)**: ο γεννήτορας **αρνείται να γράψει** λόγω **ξένης** διαδρομής. Το `(auth)/email/preferences/[token]` έχει 5850 > 5831 bytes και μεγάλωσε από τις αλλαγές ειδοποιήσεων άλλης εργασίας. Μέχρι να λυθεί εκεί, το `shell-slice.el.json` κρατά ακόμη το `place.attribution`.
- ⏳ Ζωντανός έλεγχος στην `/area` (δύο θέματα, κινητό).

## 9. Φ3 — σερβίρισμα, στυλ ανά θέμα, πρωτόκολλο (2026-09-27)

### 9.1 Έρευνα και αποφάσεις

| Ερώτηση | Απάντηση (πηγή) |
|---|---|
| Πού; | **Netcup** (απόφαση Giorgio, §5). Όχι Firebase Storage (κόστος εξόδου) · όχι `public/` (ταξιδεύει σε κάθε εικόνα Docker) |
| Διαδρομή `/basemap` ή υποτομέας; | **Υποτομέας `maps.nestorconstruct.gr`**. Τα domains-με-διαδρομή του Coolify v4 έχουν ανοιχτά σφάλματα δρομολόγησης (coollabsio/coolify #8775 · #5813 · #6545: άδειο `Host`, βρόχοι `StripPrefix`) |
| Διακομιστής; | **Caddy `file_server`** = Go `http.ServeContent`: Range/206, If-Range, ETag, 304 **χωρίς ρύθμιση** (docs.protomaps.com/deploy/server). Όχι `pmtiles_proxy`/tileserver: ένα στατικό αρχείο δεν θέλει υπηρεσία |
| CORS; | **Ναι, `*` για GET/HEAD**. Χρειάζεται ούτως ή άλλως: το στιγμιότυπο αγγελίας κάνει `toDataURL`, και ο καμβάς «μολύνεται» από sprite χωρίς CORS. Εκτίθενται `ETag`/`Content-Range`/`Accept-Ranges` |
| Συμπίεση; | **Καμία**. Τα πλακίδια είναι ήδη gzip (`tileCompression: 2`, μετρημένο)· ένα 206 που ξανασυμπιέζεται δίνει λάθος bytes |
| Cache; | Ονόματα με έκδοση (`greece-YYYYMMDD.pmtiles`, `assets/<rev>/…`) ⇒ `public, max-age=31536000, immutable`. Νέο build = νέο όνομα |
| Πρωτόκολλο; | `pmtiles` 4.5.0: `new Protocol({ metadata: false })` + `addProtocol` **μία φορά** (καθολικό μητρώο της MapLibre). `metadata: false` γιατί η απόδοση έρχεται από τον κατάλογο (ένα αίτημα λιγότερο) |
| Στυλ; | `@protomaps/basemaps` 5.7.2: `layers(src, namedFlavor('light'\|'dark'), { lang: 'el' })`. Ελληνικά: `name:el` με υποχώρηση στο `name`, και **ειδικός κλάδος** για ελληνική γραφή (`script == "Greek"`, μετρημένο στα layers) |
| Συμβατότητα σχήματος; | ✅ **Μετρημένο**: τα 9 source-layers που ζητά το στυλ υπάρχουν **όλα** στα `vector_layers` του αρχείου μας (build 20260926, σχήμα 4.15.2) |
| Αλλαγή θέματος; | Ίδιο αντικείμενο `sources` στα δύο στυλ ⇒ το `setStyle` της MapLibre κάνει diff: ξαναβάφει, **δεν** ξανακατεβάζει πλακίδια |
| Γραμματοσειρές; | `protomaps/basemaps-assets` @ `028c18f7` (tarball 6,4 MB, sha256 **ίδιο σε δύο λήψεις**). Noto Sans Regular/Medium/Italic (+ Devanagari, που το στυλ ζητά με έκφραση). Ελληνικά: `768-1023.pbf` = 77 KB, γεμάτο. ⚠️ Πολυτονικό (`7936-8191.pbf`) = **άδειο** στην πηγή: τα πολυτονικά ονόματα θα έχουν κενά (σπάνια σε OSM) |
| Άδειες; | `pmtiles` BSD-3 (+ `fflate` MIT, ήδη εγκατεστημένο) · `@protomaps/basemaps` BSD-3 · γραμματοσειρές **OFL-1.1** · εικονίδια **MIT** (tangrams/icons — το repo των assets **δεν** φέρει το κείμενο, κατεβαίνει καρφωμένο). Κανένα GPL (N.5 ✅) |

### 9.2 Τι χτίστηκε

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| **Μητρώο** | `src/lib/maps/basemap-catalog.ts` | Πάροχος `nestor` (όροι, hosts, απόδοση OSM, **`distributedAssets`**: ό,τι διανέμουμε εμείς + αρχείο άδειας). Πηγή `protomaps-greece` (`format: 'vector-archive'`). Σταθερές `BASEMAP_ARCHIVE_BUILD`, `BASEMAP_ASSETS_REVISION`, `BASEMAP_BUNDLE_PATHS` — τις διαβάζει **και** ο γεννήτορας. `NEXT_PUBLIC_BASEMAP_ORIGIN` μόνο για τοπικό έλεγχο |
| Χτίστης στυλ | `src/lib/maps/protomaps-style.ts` | `protomapsStyle(id, scheme)`: memoized, κοινό `sources`. Χωριστά από τον κατάλογο, που μένει φύλλο χωρίς εξαρτήσεις εκτέλεσης |
| Πρωτόκολλο | `src/lib/maps/pmtiles-protocol.ts` + σύνορο `maplibre.ts` | `ensurePmtilesProtocol(addProtocol)` με φρουρά. Το `addProtocol` έρχεται ως όρισμα: ωμή εισαγωγή `maplibre-gl` μόνο στο σύνορο (CHECK 3.75) |
| Θέμα | `src/lib/maps/use-basemap-scheme.ts` | Από το SSoT `useHydratedTheme`· πριν την ενυδάτωση `APP_DEFAULT_THEME` — **νέα** σταθερά στο `lib/appearance/theme-storage-key.ts`, που αντικατέστησε το ωμό `defaultTheme="dark"` του layout (N.0.2) |
| Φύλακας | `basemap-request-sentinel.ts` | Κρίνει το `pmtiles://https://…` με τον διακομιστή που **πράγματι** χτυπιέται (`unwrapArchiveUrl`) |
| Προεπιλογή | `MapStyleManager.ts` · `InteractiveMapContainer.tsx` | `greece` → `protomaps-greece`· στυλ ανά θέμα (`getStyleUrl(style, scheme)`). Ο καταρράκτης `greece → osm` (CARTO) μένει ως ασφαλής αποτυχία |
| Στιγμιότυπο αγγελίας | `ListingMapSnapshotStage.tsx` | **Πάντα φωτεινό**: αποθηκευμένη εικόνα για το κοινό δεν μπορεί να ακολουθεί θέμα θεατή |
| Bundle | `scripts/build-basemap.ts` · `lib/basemap/{basemap-assets,basemap-paths,byte-range}.ts` · `lib/tar-extract.ts` | Έξοδος `out/bundle/` = ό,τι ανεβαίνει. `--assets-only`. Προειδοποίηση όταν το build ≠ καρφωμένο στον κατάλογο. Αναγνώστης tar σε καθαρό Node: **252 symlinks** του tarball γίνονται αντίγραφα (στα Windows τα symlinks θέλουν δικαιώματα) |
| Τοπικός έλεγχος | `scripts/serve-basemap.ts` (`npm run basemap:serve`) | Ίδιες υποσχέσεις με τον Caddy (206, CORS, ETag, χωρίς συμπίεση), χωρίς `immutable`. Μπλοκάρει έξοδο από τον φάκελο |
| Υποδομή | `infra/basemap/{Caddyfile,docker-compose.yml}` | Πηγή = `Caddyfile`· το compose κρατά **προβολή** του (το Coolify δεν διαβάζει αρχεία δίπλα σε επικολλημένο compose), με άγκυρα που κοκκινίζει αν αποκλίνουν |

⚠️ **Δηλωμένο κενό (CHECK 3.69)**: τα `.pbf` ζουν **εκτός git**, άρα η πύλη γραμματοσειρών δομικά δεν τα βλέπει. Η δήλωσή
τους είναι το `distributedAssets` του καταλόγου· ο γεννήτορας **σταματά** αν λείπει από το bundle αρχείο άδειας που δηλώνεται.
Εκτός Φ3: `PlaceMap`/`/area`/ΙΚΑ (Φ4) · καμβάς DXF (raster, δεν διαβάζει vector).

### 9.3 Επαλήθευση

- Jest: 17 σουίτες χαρτών/bundle πράσινες (268 tests). Νέες άγκυρες: `protomaps-style.test.ts` (θέμα, κοινό `sources`, κάθε URL
  `declared`, μία καταχώριση) · `MapStyleManager.test.ts` · `basemap-bundle.test.ts` (επιλογή assets, Range, προβολή Caddyfile) ·
  `tar-extract.test.ts` (pax σε bytes, symlink → αντίγραφο).
- **Μεταλλάξεις 3/3 κόκκινες**: χωρίς φρουρά πρωτοκόλλου · `sources` όχι κοινά · glyphs σε αδήλωτο host.
- Πύλες: 3.95 ✅ (0 αδήλωτες σε 13.795) · 3.75 ✅ · 3.80 ✅ (0 θανάσιμες ακμές) · 3.65 ✅ · 3.84: σημειώσεις ξαναγεννήθηκαν
  (+2 πακέτα· η `surface-unknown` είναι προϋπάρχουσα κατάσταση όλου του δέντρου, 1.066 → 1.068).
- Από άκρη σε άκρη, τοπικά (`basemap:serve` + `pmtiles` JS): κεφαλίδα z0–15, κέντρο επικράτειας · Range → `206` με
  `Content-Range` · έξοδος από τον φάκελο → `404`.
- ✅ **Διακομιστής ζωντανός — 2026-09-27** (`maps.nestorconstruct.gr`, Coolify service `basemap`, Netcup):
  - ανέβασμα με `scp` (~2,5 MB/s) · `sha256` στον διακομιστή **ίδιο** με το τοπικό (`20211f24…0758`) · 1.034 assets.
  - Range → `206` · `Content-Range: bytes 0-16383/682840422` · CORS `*` · `immutable` · ETag · **κανένα `Content-Encoding`**
    ακόμη και με `Accept-Encoding: gzip` (το κουτάκι gzip του πόρου κλειστό, και **μετρήθηκε** — πρβλ. §9.4 #2105).
  - γραμματοσειρά ελληνικών `768-1023.pbf` → `200`, `application/x-protobuf`, 77.034 bytes · sprite → `200` · preflight → `204`.
  - ρίζα / `assets/` / `../etc/passwd` → `404` (καμία λίστα φακέλων, καμία έξοδος) · HTTPS με έγκυρο πιστοποιητικό.
  - bytes στην αρχή **και** στο τέλος του αρχείου (`0-126`, `682000000-682000999`) **ταυτόσημα** με το τοπικό, μαγικό `PMTiles`.
  - ⚠️ Μετρήθηκε: τα πρώτα ~60 s μετά το deploy απαντά `503` (ο proxy περιμένει τον πρώτο έλεγχο υγείας, `interval: 60s`).
- 🔴→✅ **Εύρημα ζωντανού ελέγχου (στιγμιότυπα Giorgio, παραγωγή + dev)**: κεφαλαία **με τόνους** — `ΑΛΒΑΝΊΑ`,
  `ΕΛΛΆΔΑ`, `ΜΥΡΤΏΟ ΠΈΛΑΓΟΣ`. Αιτία **μετρημένη**: η MapLibre 5.15 (`transform_text.ts`) κάνει `toLocaleUpperCase()`
  **χωρίς γλώσσα** ⇒ κατά το locale του browser (με `el` το ICU βγάζει σωστά `ΑΛΒΑΝΙΑ`/`ΑΪΔΙΝΙΟ`, με άλλο όχι).
  Καμία έκφραση δεν αφαιρεί τόνους ⇒ `withoutEngineUppercase` στο `protomaps-style.ts`: τα 4 στρώματα
  (`places_country`, `places_region`, `places_subplace`, `water_label_ocean`) γράφονται ως έχουν (`Αλβανία`), όπως
  ο ελληνικός χάρτης της Google. Άγκυρα στο `protomaps-style.test.ts` · μετάλλαξη 1/1 κόκκινη.
- ✅ Ελληνικά ονόματα με το τοπικό από κάτω (`Κωνσταντινούπολη / İstanbul`) · απόδοση OSM + geodata.gov.gr κάτω δεξιά ·
  φωτεινό και σκοτεινό θέμα · σμίκρυνση ως Βαλκάνια/Τουρκία χωρίς κενά.
- ⏳ **Ζωντανά** (Giorgio): αναζήτηση σε δύο θέματα, zoom Αθήνα → νησί → Καστελλόριζο, κινητό, στιγμιότυπο αγγελίας, πλακίδια/προβολή.

### 9.4 Εγκατάσταση στον διακομιστή (μία φορά) — ΠΡΙΝ το push του κώδικα

Σειρά: **πρώτα** ο διακομιστής και το curl ✅, **μετά** το push. Αλλιώς ο χάρτης πέφτει στον καταρράκτη CARTO (ασφαλές, αλλά όχι ο στόχος).

1. **DNS (papaki.gr)**: εγγραφή `A` · όνομα `maps` · τιμή `159.195.44.221`.
2. **Φάκελος** (PowerShell): `ssh root@159.195.44.221 "mkdir -p /srv/basemap && df -h /srv"`.
3. **Ανέβασμα** (~700 MB):
   `scp -r "C:\Nestor_Pagonis\node_modules\.cache\basemap\out\bundle\greece-20260926.pmtiles" "C:\Nestor_Pagonis\node_modules\.cache\basemap\out\bundle\assets" root@159.195.44.221:/srv/basemap/`
4. **Coolify**: New Resource → Docker Compose (Empty) → επικόλληση του `infra/basemap/docker-compose.yml` → domain της
   υπηρεσίας `basemap`: `https://maps.nestorconstruct.gr` · gzip **κλειστό** → Deploy.
   Το Caddyfile μπαίνει με την επέκταση `content:` του Coolify σε bind τόμο (τη **μόνη** τεκμηριωμένη· το top-level
   `configs.content` του Compose δεν αναφέρεται στα docs του Coolify — αλλαγή 2026-09-27).
   ⚠️ Το κουτάκι gzip σε πόρο Compose **δεν είναι εγγύηση** (coollabsio/coolify #2105: οι ετικέτες compress μένουν
   ενώ είναι ξετσεκαρισμένο) ⇒ κριτής είναι **μόνο** το curl του βήματος 5.
5. **Έλεγχος**:
   `curl -sI -H "Range: bytes=0-16383" -H "Accept-Encoding: gzip" https://maps.nestorconstruct.gr/greece-20260926.pmtiles`
   ⇒ `206` · `Content-Range: bytes 0-16383/682840422` · `Access-Control-Allow-Origin: *` · **χωρίς** `Content-Encoding`.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-27 | **Φ3 — κεφαλαία χωρίς τόνους** (§9.3). Η MapLibre κεφαλαιοποιεί με το locale του browser ⇒ `ΑΛΒΑΝΊΑ` εκτός `el`. `withoutEngineUppercase` στο `protomaps-style.ts` + άγκυρα |
| 2026-09-27 | **Φ3 — διακομιστής ζωντανός** (§9.3). `maps.nestorconstruct.gr` σε Coolify/Netcup: sha256 ίδιο με το τοπικό, 206/CORS/immutable, χωρίς `Content-Encoding`, 404 σε λίστα/έξοδο. Το compose περνά το Caddyfile με την επέκταση `content:` του Coolify αντί για `configs.content` (μη τεκμηριωμένο στο Coolify). ⏳ Ζωντανός έλεγχος της εφαρμογής μετά το push |
| 2026-09-27 | **Φ3 IMPLEMENTED (κώδικας)** (§9). Φιλοξενία Netcup (απόφαση Giorgio, σύγκριση Netcup/R2/Bunny στο §5) σε υποτομέα `maps.nestorconstruct.gr` (Caddy, `infra/basemap/`). Πάροχος `nestor` + πηγή `protomaps-greece` στο μητρώο · πρωτόκολλο `pmtiles` μία φορά στο σύνορο · στυλ Protomaps ανά θέμα με κοινό `sources` · `APP_DEFAULT_THEME` · bundle με assets καρφωμένα με sha256 και άδειες OFL/MIT. Νέα πακέτα `pmtiles` 4.5.0 · `@protomaps/basemaps` 5.7.2 (BSD-3). ⏳ Διακομιστής + ζωντανός έλεγχος |
| 2026-09-27 | **§8 — απόδοση στο σύνορο.** Πέντε χάρτες (ανάμεσά τους η δημόσια `/area`) χωρίς «© OpenStreetMap» και πέντε με απόδοση από μετάφραση. Πλέον το `Map` του `@/lib/maps/maplibre` τη ζωγραφίζει πάντα, από τις πηγές του στυλ. Νέα `map-attribution-view.tsx` · `mapAttribution`/`sameAttribution` στο `map-attribution.ts` · άγκυρα `map-boundary-attribution.test.tsx`. Αφαιρέθηκε το κλειδί `search-results:place.attribution` |
| 2026-09-27 | **Φ2 IMPLEMENTED** (§4, §7). Γεννήτορας `build:basemap` → `greece.pmtiles` **682,8 MB σε 203–227 s**. Κλιμακωτή κάλυψη 4 ζωνών (−30% έναντι ορθογωνίου, χωρίς κενό όταν απομακρύνεσαι). Επικράτεια από τα όρια ADR-883. Κάρφωμα σχήματος 4.x και sha256 εργαλείου. Νέο SSoT `scripts/lib/cached-download.ts`, με μετάβαση των ADR-883/889. Έρευνα: Protomaps · Planetiler · Geofabrik · άδειες · `name:el` μετρημένο |
| 2026-09-27 | **Φ1 IMPLEMENTED** (§6). Φάση 1 N.0.1: έξι αποκλίσεις από το §1 (§6.1), μεταξύ τους η προεπιλογή OSM (όχι CARTO), ο ψευδής «Δορυφόρος», δύο πάροχοι μόνο μη εμπορικής χρήσης, πέμπτο νεκρό σημείο με `mapbox://`, και έμμεσος διακομιστής CARTO. Νέα: μητρώο `basemap-catalog.ts` · φύλακας `basemap-request-sentinel.ts` στο σύνορο `maplibre.ts` · **CHECK 3.95**. Έρευνα όρων: OSMF · CARTO · Stadia · OpenTopoMap · OpenFreeMap. Πρότυπο μητρώου: kepler.gl `mapStyles` + όροι ως πεδία |
| 2026-09-26 | Δημιουργία (PROPOSED). Εύρημα: η προεπιλογή είναι CARTO (όριο 1 εκατ./μήνα, μετά 500 $/μήνα) και το `PlaceMap` χτυπά απευθείας το `tile.openstreetmap.org` |
