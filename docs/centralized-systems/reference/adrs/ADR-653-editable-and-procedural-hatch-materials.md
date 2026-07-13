# ADR-653 — Επεξεργάσιμα & Διαδικαστικά Υλικά Γραμμοσκίασης (Editable / Procedural Hatch Materials)

**Status:** Φ8 ✅ + Φ9 ✅ IMPLEMENTED · Φ7 🟡 ΚΩΔΙΚΑΣ ✅ (+10 φωτογραφικά builtins — registry/catalog/i18n/tests) · αναμονή CC0 `albedo.jpg` από Giorgio (ο agent δεν κατεβάζει)
**Ημερομηνία:** 2026-07-13
**Επεκτείνει:** ADR-643 (Hatch Image Fill), ADR-413 (PBR Textures), ADR-507 (Hatch entity)
**Σχετικά:** ADR-040 (canvas performance), ADR-652 (Block Library — scoped library idiom)

---

## 1. Πλαίσιο / Problem Statement

Το ADR-643 (Φ1–Φ6, ολοκληρωμένο) έδωσε γέμισμα γραμμοσκίασης με **εικόνα υλικού**: 8 CC0 φωτογραφικές
υφές (Poly Haven), tiled σε πραγματική διάσταση, + upload δικών φωτογραφιών, + αρμοί, + DXF export.

**Το κενό (Giorgio 2026-07-13):**

> «Το πλακάκι είναι σκακιέρα καφέ/μπεζ. Θέλω να το κάνω άσπρο/μαύρο. Υπάρχει τρόπος;»

**Σήμερα: ΟΧΙ.** Το `matimg-ceramic-tile` είναι μια **φωτογραφία** (`public/textures/tile/albedo.jpg`).
Δεν υπάρχει πουθενά «χρώμα Α» και «χρώμα Β» — υπάρχουν pixels. Ο χρήστης ρυθμίζει μόνο
`tileWidth`/`tileHeight`/`angle`/`origin`/`grout`. Το χρώμα του υλικού είναι **ψημένο στο raster**.

Δεύτερο κενό: η βιβλιοθήκη έχει **8** υλικά. Ένα αρχιτεκτονικό γραφείο χρειάζεται 25–40 (γρανίτης,
μωσαϊκό, laminate, ψηφίδα, χαλίκι, γρασίδι, άσφαλτος, γυψοσανίδα, …).

### 1.1 Το ζητούμενο με ένα παράδειγμα

```
ΣΗΜΕΡΑ                                  ΜΕ ΤΟ ADR-653
┌───────────────────────┐               ┌───────────────────────┐
│ [Κεραμικό πλακ.] ← καφέ/μπεζ φωτο     │ [Κεραμικό πλακ.]      │
│  Πλάτος:  600 mm      │               │  Πλάτος:  600 mm      │
│  Ύψος:    600 mm      │               │  Ύψος:    600 mm      │
│  Γωνία:     0°        │               │  Γωνία:     0°        │
│  ☐ Αρμοί              │               │  ☐ Αρμοί              │
│                       │               │  ☑ Χρωματισμός  ← ΝΕΟ │
│  (τέλος)              │               │    Χρώμα Α: ⬜ #FFFFFF │
└───────────────────────┘               │    Χρώμα Β: ⬛ #000000 │
                                        │    Ένταση:  100 %     │
   → καφέ σκακιέρα, τελεία              └───────────────────────┘
                                           → ΑΣΠΡΗ/ΜΑΥΡΗ σκακιέρα,
                                             με την υφή να επιβιώνει
```

### 1.2 Κρίσιμο εύρημα στον υπάρχοντα κώδικα (code = SoT)

Και τα **τρία** caches του `HatchRenderer` είναι keyed **αποκλειστικά στο `assetId`**:

| Cache | Γραμμή | Κλειδί σήμερα |
|---|---|---|
| `imageCache` (`HatchImageCache`) | `hatch-image-cache.ts:39` | `assetId` |
| `imagePatternCache` | `HatchRenderer.ts:110` | `assetId` |
| `averageColorCache` | `HatchRenderer.ts:112` | `assetId` |

Τη στιγμή που το ΙΔΙΟ υλικό μπορεί να έχει **δύο οπτικές εκδοχές** (καφέ σκακιέρα σε έναν χώρο,
άσπρη/μαύρη στον διπλανό), το `assetId` **παύει να είναι επαρκές κλειδί** → οι δύο γραμμοσκιάσεις θα
μοιράζονταν το ίδιο cache entry και θα ζωγραφίζονταν και οι δύο με το χρώμα όποιας φορτώθηκε πρώτη.

**Αυτό είναι το ΕΝΑ αρχιτεκτονικό σημείο που πρέπει να λυθεί σωστά πριν από οτιδήποτε άλλο.**
Λύση: **variant key** — ένα καθαρό, ντετερμινιστικό κλειδί που περιγράφει *τι ακριβώς ζωγραφίζεται*
(υλικό + χρωματισμός + διαδικαστικές παράμετροι), όχι απλώς *ποιο αρχείο*.

---

## 2. Έρευνα: πώς το κάνουν οι μεγάλοι

| Εργαλείο | Μηχανισμός |
|---|---|
| **ArchiCAD** | *Image Fill* (φωτογραφία) **και** *Vectorial/Symbol Fill* (διαδικαστικό, πλήρως επεξεργάσιμο χρώμα). Δύο διακριτοί τύποι, ίδιο UI. |
| **Revit** | *Fill Pattern* (vector, χρώμα ελεύθερο) + *Appearance Asset* (raster με **tint** στον Appearance editor). Το tint είναι πρώτης τάξης ιδιότητα. |
| **AutoCAD** | *Hatch* με `.pat` (vector, χρώμα ελεύθερο)· raster μόνο ως εξωτερικό reference. |
| **Cinema 4D / Blender** | Procedural shaders (Checkerboard, Bricks, Wood, Tiles nodes) — παράμετροι χρώματος, ποτέ raster. |
| **Figma** | Image fill + blend modes (χρωματισμός εικόνας). |

**Σύγκλιση:** όλοι έχουν **δύο δρόμους** — raster (φωτορεαλισμός, με tint) **και** procedural (πλήρης
έλεγχος, άπειρη ευκρίνεια). Δεν διαλέγουν· έχουν και τα δύο, με ενιαίο UI.

---

## 3. Αρχιτεκτονική Απόφαση

### 3.1 Κεντρική απόφαση: ΕΝΑ pipeline, ΤΡΕΙΣ πηγές tile

Το `fillType: 'image'` **δεν αλλάζει**. Αλλάζει μόνο **από πού έρχεται το tile image**:

```
                       ┌─────────────────────────────────────────┐
                       │  HatchImageFill  (assetId + tint? + proc?) │
                       └───────────────────┬─────────────────────┘
                                           │  variantKey()  ← SSoT (ΝΕΟ)
                       ┌───────────────────▼─────────────────────┐
                       │       HatchImageCache.resolve(key)      │
                       └───────────────────┬─────────────────────┘
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
   ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
   │ 1. RASTER        │         │ 2. RASTER+TINT   │         │ 3. PROCEDURAL    │
   │ builtin/upload   │         │ duotone pass     │         │ canvas generator │
   │ (ADR-643, ΩΣ ΕΧΕΙ)│        │ (ΝΕΟ, Φ8)        │         │ (ΝΕΟ, Φ9)        │
   │ → HTMLImageElement│        │ → HTMLCanvasElement│       │ → HTMLCanvasElement│
   └────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
            └────────────────────────────┼────────────────────────────┘
                                         ▼
                          CanvasImageSource (intrinsic w×h px)
                                         │
                    ΑΜΕΤΑΒΛΗΤΟ ADR-643 render path (μηδέν νέα math):
             computeImageTileMatrix → fillHatchPattern → drawImageGrout
```

**Γιατί δουλεύει χωρίς αλλαγή του render path:** το `computeImageTileMatrix` δέχεται
`CanvasImageSource` και διαβάζει μόνο το intrinsic `w×h` (`imageIntrinsicSize`, γραμμή 29). Ένα
`HTMLCanvasElement` 512×512 είναι **ισοδύναμο** με ένα `<img>` 512×512. Το `drawImageGrout` το ίδιο.
Άρα: **μηδέν αλλαγή** σε `hatch-image-paint.ts`, μηδέν δεύτερη υλοποίηση tiling (N.18).

### 3.2 Data model — επέκταση `HatchImageFill` (MOD `types/entities.ts`)

```ts
export interface HatchImageFill {
  assetId: string;          // ΑΜΕΤΑΒΛΗΤΟ (builtin matimg-* | upload bmat_* | proc:* )
  tileWidth: number;
  tileHeight: number;
  angle?: number;
  origin?: Point2D;
  grout?: { color: string; widthMm: number };

  /** ΝΕΟ (Φ8) — χρωματικός επαναχρωματισμός raster υλικού (Revit «tint»). */
  tint?: HatchImageTint;

  /** ΝΕΟ (Φ9) — παράμετροι διαδικαστικού υλικού (μόνο όταν assetId ξεκινά με `proc:`). */
  procedural?: HatchProceduralParams;
}

/** Duotone: φωτεινότητα εικόνας → ράμπα colorA→colorB, ανακατεμένο κατά `strength`. */
export interface HatchImageTint {
  colorA: string;    // σκούρο άκρο (π.χ. #000000)
  colorB: string;    // φωτεινό άκρο (π.χ. #FFFFFF)
  strength: number;  // 0..1 — 0 = ανέγγιχτη φωτο, 1 = πλήρες duotone
}

/** Διαδικαστικό υλικό: γεννήτρια + χρώματα + παράμετροι σχεδίου. */
export interface HatchProceduralParams {
  generator: ProceduralGeneratorId;   // 'checker' | 'running-bond' | 'planks' | ...
  colors: readonly string[];          // 1–3 χρώματα ανά γεννήτρια (contract στον κατάλογο)
  jointMm?: number;                   // πάχος αρμού ΜΕΣΑ στο tile (π.χ. τούβλα)
  jointColor?: string;
  seed?: number;                      // ντετερμινιστική «τυχαιότητα» (ξύλο/πέτρα)
}
```

**Backward compatible:** και τα δύο πεδία optional· υπάρχοντα hatches δεν αλλάζουν byte.

### 3.3 Variant key — το SSoT κλειδί (ΝΕΟ `shared/hatch-image-variant-key.ts`)

```ts
/** Ντετερμινιστικό κλειδί: ΤΙ ζωγραφίζεται (όχι απλώς ποιο αρχείο). ΕΝΑ σημείο. */
export function imageFillVariantKey(f: HatchImageFill): string {
  if (f.procedural) return `proc:${f.procedural.generator}|${f.procedural.colors.join(',')}|…`;
  if (f.tint) return `${f.assetId}|tint:${f.tint.colorA},${f.tint.colorB},${f.tint.strength}`;
  return f.assetId;                                   // ← ΑΚΡΙΒΩΣ το σημερινό κλειδί
}
```

Χωρίς tint/procedural το κλειδί **είναι** το `assetId` → μηδενικό ρίσκο παλινδρόμησης,
μηδέν cache-busting σε υπάρχοντα σχέδια.

Και τα **τρία** caches (`imageCache`, `imagePatternCache`, `averageColorCache`) περνούν σε αυτό το
κλειδί. **ΟΧΙ τρία διαφορετικά κλειδιά** — ένα, από ένα σημείο (N.12).

### 3.4 ADR-040 compliance

- Ο `HatchRenderer` **παραμένει** χωρίς subscriptions. Το procedural tile παράγεται **σύγχρονα**
  (offscreen canvas, μία φορά ανά variant key) — δεν χρειάζεται καν το async decode path.
- Το tint pass είναι **μία φορά ανά variant** (decode → duotone → cache), όχι per-frame.
- Το LOD tint fallback (zoom-out) δουλεύει ως έχει — το `averageImageColor` τρέχει στο **τελικό**
  (tinted/procedural) canvas → το zoom-out χρώμα ταιριάζει με το zoom-in, αυτόματα.

---

## 4. Φάσεις υλοποίησης

| Φ | Περιεχόμενο | Αρχεία (κύρια) | Εκτίμηση |
|---|---|---|---|
| **Φ7** 🟡 | **Εμπλουτισμός καταλόγου** — **+10 φωτογραφικά CC0 builtins ΓΡΑΦΤΗΚΑΝ** (κώδικας πλήρης): νέα slugs + πραγματικό tile size + κατάλογος + i18n (el/en) + tests. Παίρνει **αυτόματα** και το 3D (ίδιο registry). **Απομένουν ΜΟΝΟ τα αρχεία:** κάθε υλικό χρειάζεται `public/textures/<slug>/albedo.jpg` (dev) + Firebase Storage `bim-texture-library/<slug>/albedo.jpg` (prod — τα `.jpg` είναι `.gitignored`)· ο agent δεν κατεβάζει φωτο → ο Giorgio ρίχνει τα 10 albedo (λίστα assets στο changelog). Μέχρι τότε οι 10 swatches εμφανίζονται κενές. | `bim-texture-registry.ts`, `data/material-image-catalog.ts`, `locales/{el,en}/dxf-viewer-shell.json`, `public/textures/<slug>/albedo.jpg` | ✅ κώδικας |
| **Φ8** ✅ | **Χρωματισμός (duotone tint)** — variant key SSoT (§3.3, **προαπαιτούμενο**) + duotone pass + 4 πεδία UI (toggle / Χρώμα Α / Χρώμα Β / Ένταση %). Δουλεύει σε **όλα** τα raster υλικά, builtin ΚΑΙ uploads + πιστό DXF export (tinted raster/average). | ΝΕΑ `shared/hatch-image-variant-key.ts` + `shared/hatch-image-tint.ts`· MOD `hatch-image-cache.ts`, `HatchRenderer.ts`, `hatch-image-build.ts`, `hatch-property-fields.ts`, `hatch-command-keys.ts`, `useRibbonHatchBridge.ts`, `hatch-bridge-read.ts`, `hatch-draw-defaults-store.ts`, `types/entities.ts`, `image-fill-export.ts`, `image-export-shared.ts`, locales | μεσαίο |
| **Φ9** ✅ | **Διαδικαστικά υλικά** — κατάλογος γεννητριών (checker/grid-tile/running-bond/stripes) + offscreen tile renderer (seamless canvas) + picker section «Διαδικαστικά» (swatches ζωγραφισμένα, μηδέν asset) + πεδία χρωμάτων/αρμού. | ΝΕΑ `data/procedural-material-catalog.ts` + `rendering/entities/shared/procedural-tile-render.ts` + `bridge/hatch-bridge-default-patch.ts`· MOD `hatch-image-cache.ts`, `hatch-image-variant-key.ts`, `HatchRenderer.ts`, `MaterialImagePicker.tsx`, `hatch-image-build.ts`, `image-fill-export.ts`, property-fields/command-keys/bridge/read/draw-defaults, `types/entities.ts`, locales | μεγάλο |

### 4.1 Φ9 — γεννήτριες (κύμα 1 + κύμα 2)

| Γεννήτρια | Χρώματα | Καλύπτει | Κατάσταση |
|---|---|---|---|
| `checker` | 2 | σκακιέρα πλακάκι (**το αίτημα του Giorgio**) | ✅ κύμα 1 |
| `grid-tile` | 1 + αρμός | ενιαίο πλακάκι με αρμό | ✅ κύμα 1 |
| `running-bond` | 1 + αρμός | τούβλο, τσιμεντόλιθος (ιμάντας ½) | ✅ κύμα 1 |
| `stripes` | 2 | ρίγες, μεμβράνες, μόνωση | ✅ κύμα 1 |
| `herringbone` | 2 + αρμός | ψαροκόκαλο / παρκέ (σανίδες 2:1 σε staircase) | ✅ κύμα 2 |
| `basketweave` | 2 + αρμός | πλέξη / ψάθα (τετράδες σανίδων εναλλάξ) | ✅ κύμα 2 |
| `hexagon` | 1 + αρμός | εξάγωνο πλακάκι / μωσαϊκό (pointy-top, repeat √3R×3R) | ✅ κύμα 2 |
| `planks` | 1–2 | ξύλινο δάπεδο / deck (μακριές σανίδες) | ⏳ μελλοντικό |
| `scales` | 1 + αρμός | ψαρολέπι / κεραμίδι (καμπύλες — χωριστή γεννήτρια) | ⏳ μελλοντικό |

> **Market check (κύμα 2, 2026-07-13):** herringbone/basketweave/hexagon επιλέχθηκαν γιατί τα προσφέρουν **και οι τέσσερις** μεγάλοι — Revit (parquet fill patterns), ArchiCAD (herringbone/basketweave vectorial fills), AutoCAD (`acad.pat` parquet/masonry), MAXON C4D Tile Shader (presets *Parquet*, *Weave*, *Hexagons*). `scales` (C4D *Scales 1/2*) & `planks` μένουν για επόμενο κύμα (καμπύλο/μακρύ seamless = χωριστή γεννήτρια).

---

## 5. Performance (100% ειλικρίνεια)

- **Procedural:** το tile παράγεται **μία φορά** ανά variant key σε offscreen canvas (π.χ. 512×512).
  Κόστος: ~1–3 ms. Μετά είναι σκέτο `CanvasPattern` — **ταχύτερο** από raster (μηδέν decode, μηδέν δίκτυο).
- **Tint:** ένα `getImageData`/`putImageData` pass πάνω στο decoded raster (2048×2048 → ~15–30 ms),
  **μία φορά** ανά variant key. Δεν είναι στο frame path.
- **Cache blowup — ο πραγματικός κίνδυνος:** αν ο χρήστης σέρνει color picker, κάθε ενδιάμεσο χρώμα
  παράγει νέο variant key → νέο entry. **Μετριασμός:** LRU cap (π.χ. 32 variants) στο `HatchImageCache`
  + debounce στο color picker (commit on release). **ΔΕΝ** το αγνοούμε.
- **Μνήμη:** 32 variants × 512² canvas ≈ 32 MB worst case. Αποδεκτό· το LRU cap το φράζει.

---

## 6. Persistence & DXF Export

- **Firestore:** `tint` + `procedural` μπαίνουν στο ήδη υπάρχον flat `data.imageFill` map
  (`hatch-firestore-service.ts` — το `imageFill` ήδη persist-άρεται ολόκληρο από τη Φ6). Χρειάζεται
  μόνο επέκταση του doc type. Το procedural είναι **παράμετροι, όχι pixels** → ελάχιστο doc size.
- **DXF export:** το υπάρχον pre-pass (`image-fill-export.ts`) κάνει decode → tile grid → raster σε zip.
  Το tinted/procedural canvas είναι επίσης `CanvasImageSource` → **ο ίδιος κώδικας** παράγει το raster
  (μέσω `canvas.toBlob()`) → πιστό export **δωρεάν**. Το solid-downgrade fallback χρησιμοποιεί το
  `averageImageColor` του τελικού canvas → σωστό χρώμα, αυτόματα.

---

## 7. Q&A

| # | Ερώτηση | Απόφαση |
|---|---|---|
| **Q1** | Πόσα νέα builtin υλικά στη Φ7 και ποια; | **ΑΝΟΙΧΤΟ** (Φ7) — προτεινόμενα ~12: γρανίτης, μωσαϊκό, laminate/parquet, ψηφίδα, χαλίκι, γρασίδι, χώμα, άσφαλτος, γυψοσανίδα, OSB/κόντρα-πλακέ, πέτρα (ακανόνιστη), σκυρόδεμα λείο. |
| **Q2** | Το tint να είναι **duotone** ή **hue-shift**; | **duotone + ένταση %** (Revit-grade decision, N.feedback) — το μόνο που κάνει «καφέ σκακιέρα → άσπρη/μαύρη» πραγματικά. Υλοποιήθηκε στη Φ8. |
| **Q3** | Στη Φ9, τα διαδικαστικά ως **δεύτερη ενότητα στο ίδιο picker** ή ξεχωριστό fillType; | **ίδιο picker** (ArchiCAD idiom· ο χρήστης δεν νοιάζεται πώς παράγεται το tile). |
| **Q4** | Σειρά υλοποίησης; | **Φ8 → Φ7 → Φ9** (Giorgio 2026-07-13). |

---

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-14 | **Φ7 ΚΩΔΙΚΑΣ ✅ — +10 φωτογραφικά CC0 builtins (καθαρή επέκταση, μηδέν νέος μηχανισμός).** **Market check (SoT, όχι μνήμη):** Revit fill patterns (gravel/asphalt/plywood/stone/sand) + Poly Haven CC0 API επιβεβαίωσαν τα υλικά· **terrazzo/μωσαϊκό** & **γρασίδι** εξαιρέθηκαν (κανένα αξιόλογο CC0· το μωσαϊκό καλύπτεται ήδη από procedural `hexagon`/`checker` της Φ9). **SSoT audit (grep, ΠΡΙΝ κώδικα):** ο pipeline (resolver→cache→picker→3D→DXF export) είναι ήδη 100% generic — νέο builtin = 4 σημεία μόνο (union slug + `TEXTURE_SET_DEFS` + `material-image-catalog` row + i18n)· μηδέν αλλαγή σε consumers, μηδέν διπλότυπο, `MATERIAL_TEXTURE_MAP` αμετάβλητο (τα νέα δεν είναι DNA materials → κανένα 3D 404). **Τα 10 (δικό μας slug → Poly Haven asset → tileSizeM):** `granite`→granite_tile→0.6· `asphalt`→clean_asphalt→2.0· `gravel`→gravel_floor→1.0· `plywood`→plywood→1.2· `osb`→oriented_strand_board→1.2· `laminate`→laminate_floor→1.2· `wood-floor`→wood_floor→1.5· `smooth-concrete`→smooth_concrete_floor→2.0· `cobblestone`→cobblestone_floor_04→2.0· `parquet`→diagonal_parquet→1.0. **Albedo-only** (hasNormal/Roughness/Ao=false → μηδέν 404 σε public mode· η 2D γραμμοσκίαση χρησιμοποιεί μόνο albedo). **MOD:** `bim-texture-registry.ts` (union +10, `TEXTURE_SET_DEFS` +10), `data/material-image-catalog.ts` (+10 `matimg-*` rows), locales el/en (`hatchImageFill.materials.{granite,asphalt,gravel,plywood,osb,laminate,woodFloor,smoothConcrete,cobblestone,parquet}`), `material-image-catalog.test.ts` (8→18 + granite assertion). Tests **23/23 pass** (catalog/registry/resolver)· `jscpd:diff` **καθαρό** (3 files)· data files size-exempt. **ΑΠΟΜΕΝΕΙ (Giorgio):** κατέβασμα των 10 albedo 2K JPG → `public/textures/<slug>/albedo.jpg` (dev) + Storage `bim-texture-library/<slug>/albedo.jpg` (prod). Μέχρι τότε οι swatches κενές. |
| 2026-07-13 | **Φ9 κύμα 2 — +3 γεννήτριες (herringbone / basketweave / hexagon).** Καθαρή **επέκταση** (η αρχιτεκτονική Φ9 ήταν έτοιμη· μηδέν νέος μηχανισμός cache/variant-key/tiling). **Market check (SoT, όχι μνήμη):** επιλέχθηκαν όσα προσφέρουν **και οι 4** μεγάλοι — Revit parquet fill patterns, ArchiCAD herringbone/basketweave vectorial fills, AutoCAD `acad.pat` parquet/masonry, MAXON C4D Tile Shader presets (*Parquet* / *Weave* / *Hexagons*). **Γεωμετρία (seamless):** `herringbone` = 8 σανίδες 2:1 σε staircase, repeat-unit 4W×4W (torus πλήρως καλυμμένο, τα wrapping rects σχεδιάζονται με ±1-tile shift)· H=colors[0] / V=colors[1] + αρμός → 2τονο παρκέ. `basketweave` = σκακιέρα από μπλοκ 2W, κάθε μπλοκ 2 σανίδες οριζόντιες(c0)/κάθετες(c1) εναλλάξ + αρμός. `hexagon` = κανονικά pointy-top (2 ανά repeat-unit **√3R×3R** → μη-τετράγωνο tile ώστε να βγαίνουν κανονικά· κορυφές σε normalized coords, per-axis inset για ομοιόμορφο grout, 9-copy wrap). **SSoT audit (grep, ΠΡΙΝ κώδικα):** επιβεβαιώθηκε ότι `hatch-pattern-catalog.ts` (PAT line-hatch, ADR-507) & Tekton catalog είναι **line-based** → κανένα υπάρχον raster-tile generator· μηδέν διπλότυπο. **Consumers αμετάβλητοι** (`hatch-image-build.ts`/picker/export πλήρως generic μέσω `getProceduralMaterialByAssetId`+`defaultProceduralParams`). **N.18:** `jscpd:diff` έπιασε clone στο grout-backdrop boilerplate → εξαγωγή `fillJointBackground()` (κοινό σε grid-tile/running-bond/herringbone/basketweave/hexagon)· επανέλεγχος **καθαρό**. **MOD:** `types/entities.ts` (union +3), `data/procedural-material-catalog.ts` (+3 defaults), `procedural-tile-render.ts` (+3 γεννήτριες, 259 γρ.), locales el/en (`proceduralMaterials.{herringbone,basketweave,hexagon}`). Tests: procedural-catalog **+3** → **41/41 pass** (catalog/variant-key/build)· όλα <500· `jscpd:diff` καθαρό. `scales` (ψαρολέπι) & `planks` → επόμενο κύμα. |
| 2026-07-13 | **v1 DRAFT** — δημιουργία μετά από αίτημα Giorgio («σκακιέρα καφέ/μπεζ → άσπρο/μαύρο») + code recon στο ADR-643 pipeline. **Κρίσιμο εύρημα:** και τα 3 caches του `HatchRenderer` είναι keyed μόνο στο `assetId` → ασυμβίβαστα με «ίδιο υλικό, δύο χρωματικές εκδοχές» → variant key SSoT = προαπαιτούμενο κάθε άλλης δουλειάς. Αρχιτεκτονική: ΕΝΑ pipeline, τρεις πηγές tile (raster / raster+tint / procedural canvas) — μηδέν αλλαγή στο render math (`computeImageTileMatrix` δέχεται ήδη `CanvasImageSource`). Q&A ανοιχτό. |
| 2026-07-13 | **Φ9 IMPLEMENTED** — διαδικαστικά (procedural) υλικά. **Τρίτη πηγή tile (§3.1):** `assetId` `proc:<generator>` → το tile ΖΩΓΡΑΦΙΖΕΤΑΙ από παραμέτρους αντί να φορτωθεί raster (μηδέν αρχείο, πλήρως επεξεργάσιμα χρώματα, τέλεια ευκρίνεια). **Γεννήτριες (πρώτο κύμα):** checker (σκακιέρα — το αίτημα Giorgio), grid-tile (πλακίδιο+αρμός), running-bond (τούβλο), stripes (ρίγες). **Data:** `HatchProceduralParams` (generator + colors[] + jointMm/jointColor) στο `HatchImageFill` (optional → persistence δωρεάν). Νέα: `data/procedural-material-catalog.ts` (defaults/tile-size/i18n ανά γεννήτρια· `proc:` prefix, ΠΟΤΕ σύγκρουση με `matimg-*`/`bmat_*`)· `procedural-tile-render.ts` (seamless canvas 512px· αρμός mm→px ως κλάσμα tile → φυσικό πάχος). **Cache:** procedural branch στο `HatchImageCache.resolve` — **σύγχρονη** γέννηση (μηδέν δίκτυο/decode, χωρίς loading flash)· variant key = generator+colors+joint+tile-dims (αρμός εξαρτάται από tile). **Render math ΑΜΕΤΑΒΛΗΤΟ** — το canvas είναι `CanvasImageSource` → `computeImageTileMatrix`/`fillHatchPattern` το tile-άρουν αυτούσιο. **UI:** το image panel σπάει σε 3 groups με visibility — `image` (μέγεθος/αρμοί), `imageTint` (duotone· raster only), `procedural` (χρώματα/αρμός· proc only) ώστε να μη δείχνονται άχρηστα πεδία. Picker: νέα ενότητα «Διαδικαστικά» με swatches ζωγραφισμένα από τις γεννήτριες (toDataURL). Επιλογή procedural → build υιοθετεί default params+tile, καθαρίζει tint· επιλογή raster καθαρίζει procedural. **DXF export πιστό:** `image-fill-export.ts` unified `prepareExportSource` (procedural canvas / tinted / σκέτο raster) → σωστό average + raster. **File-size (N.7.1):** το `useRibbonHatchBridge` ξεπέρασε τις 500 (554) → εξαγωγή pure mappers + image string-field map σε νέο `hatch-bridge-default-patch.ts` (mirror του read-side split· 495 γρ. πλέον). Tests: procedural-catalog (+6)· variant-key procedural (+4)· build procedural (+5)· HatchRenderer/bridge/export/resolver **93/93**· `jscpd:diff` καθαρό (9 files)· όλα <500. **Σειρά:** Φ9 πριν τη Φ7 (Giorgio 2026-07-13) γιατί η Φ7 μπλοκάρεται από έλλειψη CC0 αρχείων. |
| 2026-07-13 | **Φ8 IMPLEMENTED** — duotone tint. **Variant key SSoT (§3.3, το προαπαιτούμενο):** νέο `hatch-image-variant-key.ts` — χωρίς tint επιστρέφει *ακριβώς* το `assetId` (ADR-643 backward compat, μηδέν cache-busting)· με tint → `assetId\|tint:…`. Και τα 3 caches του `HatchRenderer` (decoded image / `CanvasPattern` / μέσο χρώμα) περνούν στο variant key — άρα καφέ vs άσπρη/μαύρη σκακιέρα πλέον δεν συγκρούονται. **Duotone pass:** νέο `hatch-image-tint.ts` (`applyDuotoneTint`) — φωτεινότητα pixel (`luminance601` SSoT) → ράμπα `colorA→colorB`, mix με πρωτότυπο κατά `strength`· offscreen canvas στο intrinsic μέγεθος → ισοδύναμο `CanvasImageSource` → **μηδέν αλλαγή** στο ADR-643 render math. Εφαρμόζεται **μία φορά μετά το decode** μέσα στο `HatchImageCache` (ADR-040, ΠΟΤΕ per-frame)· `ImageRenderer` (ADR-651) περνά σκέτο string → αμετάβλητος. **Data model:** `HatchImageFill.tint?: HatchImageTint` (optional → persistence δωρεάν, το `imageFill` persist-άρεται ήδη ολόκληρο, Φ6). **UI (mirror grout):** image group +4 πεδία (toggle `Χρωματισμός` / Χρώμα Α σκούρο / Χρώμα Β φωτεινό / Ένταση %) — command keys + guards + bridge get/set/toggle + read-side + draw-defaults (default off, μαύρο→λευκό, 100%)· ένταση UI σε % (0..100) ⇄ domain 0..1. i18n `tint*` (el/en). **DXF export (fidelity, όχι απλή έλλειψη):** το solid-mode default θα έβγαζε το **αρχικό** χρώμα → correctness bug· ο pre-pass (`image-fill-export.ts`) εφαρμόζει τώρα τον ΙΔΙΟ duotone (average + raster) μέσω κοινού `canvasToRasterArtifact` (νέο στο `image-export-shared.ts`, δίδυμο του `fetchRasterWithTimeout`)· variant-keyed filename ώστε tinted εκδοχές να μη συγκρούονται στο dedup. **SSoT reuse (N.12):** `parseHex`/`luminance601`/`clamp01` (color-math), μηδέν νέο χρωματικό math. Tests: hatch-image-build tint (+7) / variant-key (+6) / export (αμετάβλητα) **36/36**· bridge+renderer+resolver **42/42**· `jscpd:diff` καθαρό (9 files). |

---

## Πηγές έρευνας

- ArchiCAD — [Vectorial vs Image Fills (Graphisoft)](https://support.graphisoft.com/hc/en-us/articles/30314265324049-How-to-create-and-use-image-fills)
- Revit — [Appearance Asset Editor / tint](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-EBD9E8E6-AF83-4579-8D9A-9B9E23DCAA52)
- Blender/C4D — procedural checker/brick/tile nodes (γεννήτριες παραμετρικών tiles)
