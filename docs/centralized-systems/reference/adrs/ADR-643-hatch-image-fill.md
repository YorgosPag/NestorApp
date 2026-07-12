# ADR-643 — Hatch Image Fill (Γέμισμα Γραμμοσκίασης με Εικόνα / «ζωντανά» υλικά)

> **Status:** 🟢 SPECIFICATION COMPLETE v1 · Q&A ΚΛΕΙΣΤΟ (Giorgio 2026-07-12) · έτοιμο για υλοποίηση (Φ1)
> **Date:** 2026-07-12
> **Subapp:** `src/subapps/dxf-viewer`
> **Author:** Giorgio + agent
> **Related:** ADR-507 (Hatch Creation System — ο πυρήνας), ADR-531 (screen-space raster hatch / `CanvasPattern`), ADR-627 (hatch grip parity), ADR-419 (Floor Finish hatch), ADR-363 §5.5 (BIM material hatch), ADR-040 (canvas performance / micro-leaf), ADR-017/210/294 (Enterprise IDs), ADR-635/636 (DXF import/export coverage)

---

## 1. Πλαίσιο / Problem Statement

Σήμερα (ADR-507) ο χρήστης γεμίζει μια κλειστή περιοχή στην κάτοψη με **procedural γεωμετρία**:
solid χρώμα, `user-defined` γραμμές, `predefined` PAT μοτίβο (ANSI31, AR-CONC, BRICK…), ή `gradient`.
Όλα είναι **vector** — γραμμές & flat χρώματα που ζωγραφίζει ο υπολογιστής.

**Ο Giorgio θέλει** να μπορεί να βάλει σε μια περιοχή μια **πραγματική εικόνα υλικού** — π.χ. φωτογραφία
πλακιδίου δαπέδου (γρανίτης 60×60, ξύλο, μάρμαρο) — ώστε η κάτοψη να δείχνει **ζωντανή, ρεαλιστική**,
σαν να έχει «στρωθεί» το πλακίδιο στο πάτωμα, αντί για αφηρημένες γραμμούλες.

### 1.1 Το ζητούμενο, με ένα παράδειγμα

```
ΣΗΜΕΡΑ (μοτίβο)                         ΜΕΤΑ ΤΟ ADR-643 (εικόνα)
┌───────────────────────┐               ┌───────────────────────┐
│ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ │               │ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ │  ← φωτο πλακιδίου
│ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ │   →           │ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ │    60×60, επαναλαμβανόμενη
│ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ │               │ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ ▦ │    & κομμένη στο όριο
└───────────────────────┘               └───────────────────────┘
   (διαγώνιες γραμμές)                       (μοιάζει με αληθινό δάπεδο)
```

### 1.2 Κρίσιμο εύρημα στον υπάρχοντα κώδικα (τι ΥΠΑΡΧΕΙ ήδη)

**Δεν ξεκινάμε από το μηδέν.** Ο μηχανισμός γραμμοσκίασης (ADR-507) έχει ήδη ΟΛΑ τα «κουμπώματα»:

| Κομμάτι | Κατάσταση σήμερα | Αρχείο |
|---|---|---|
| `HatchEntity.fillType` (union) | ✅ `'solid'\|'user-defined'\|'predefined'\|'gradient'` — προσθέτουμε `'image'` | `types/entities.ts:685` |
| `HatchRenderer.render()` branch-ανά-fillType | ✅ καθαρή δομή `if/else` ανά fillType — νέο branch κουμπώνει | `rendering/entities/HatchRenderer.ts:203-230` |
| Boundary path SSoT (`traceHatchBoundary`) | ✅ χτίζει ΕΝΑ multi-subpath με even-odd (νησίδες = τρύπες) | `rendering/entities/shared/hatch-gradient-paint.ts:46` (`drawBoundaryPath()` :353) |
| `ctx.clip('evenodd')` idiom | ✅ ήδη σε χρήση αλλού: `FloorFinishRenderer:144`, `SlabRenderer:253`, `WallCoveringRenderer:162`, `detail-canvas-renderer:108` | — |
| `ctx.drawImage` σε clipped region | ✅ ήδη σε χρήση: `bim/structural/detail-sheet/render/detail-canvas-renderer.ts:175` | — |
| `CanvasPattern` (repeat tile) + `setTransform(DOMMatrix)` | ✅ ήδη σε χρήση για screen-raster hatch (ADR-531) | `HatchRenderer.ts:112-156` |
| Φόρτωση/cache εικόνας (raster provider) | ✅ ήδη σε χρήση: `floorplan-background/providers/ImageProvider.ts` (image loading + draw) | — |
| Density-LOD (collapse σε tint σε zoom-out) | ✅ ήδη σε χρήση για πυκνά patterns | `HatchRenderer.ts:215-223` |
| **Image-fill για HATCH entity** | ❌ **ΔΕΝ ΥΠΑΡΧΕΙ** — αυτό χτίζει το ADR-643 | — |

Δηλαδή: όλα τα εργαλεία (clip, drawImage, tiling pattern, image loading, LOD) **υπάρχουν και δοκιμασμένα** —
απλώς δεν έχουν συνδεθεί ποτέ σε ένα `fillType: 'image'`.

---

## 2. Έρευνα: Πώς το κάνουν οι μεγάλοι (AutoCAD / Revit / ArchiCAD)

*(Πηγές στο τέλος. Επιβεβαιωμένο 2026-07-12.)*

| Λογισμικό | Μηχανισμός | Ενσωματωμένο στο hatch; | Κλίμακα δεμένη με πραγμ. διάσταση; |
|---|---|---|---|
| **AutoCAD** | «Super Hatch» — η εικόνα μπαίνει ως block/image reference, tiled & clipped στο σχήμα. **ΟΧΙ πραγματικό hatch**: μη-associative, δεν επεξεργάζεται ως hatch. Autodesk: «τα hatch είναι για linework· για εικόνες → materials/mapping». | ❌ Χωριστός μηχανισμός (workaround) | ⚠️ Χειροκίνητα |
| **Revit** | **Διαχωρισμός σε 2**: (α) *model fill pattern* στην κάτοψη = vector γραμμές **δεμένες με πραγματική διάσταση** (πλακίδιο 600×600 → φαίνεται ακριβώς 600×600)· (β) *render appearance* = η φωτογραφία, ορατή **μόνο σε 3D/φωτορεαλισμό**. Στην 2D κάτοψη βλέπεις γραμμές, όχι φωτο. | ⚠️ Δεμένα στο «υλικό» αλλά χωριστή εμφάνιση 2D/3D | ✅ Ναι (model pattern) |
| **ArchiCAD** | **«Image Fill»** — native τύπος γεμίσματος: βάζεις φωτογραφία υλικού ως fill attribute, ορίζεις πραγματικό μέγεθος, φαίνεται **στην ίδια την 2D κάτοψη**. Μπορεί να συνδυάζει και γραμμές αρμών από πάνω. **Ακριβώς το ζητούμενο του Giorgio.** | ✅ **ΝΑΙ — ενσωματωμένο ως είδος fill** | ✅ Ναι (texture size = tile size) |

**Συμπέρασμα έρευνας:** Το μοντέλο **ArchiCAD** είναι το πλησιέστερο στο ζητούμενο και το πιο καθαρό
αρχιτεκτονικά: η εικόνα είναι **απλώς ένας ακόμη τύπος γεμίσματος** δίπλα στα υπόλοιπα — όχι ξεχωριστό
υποσύστημα (AutoCAD workaround) ούτε μόνο-3D (Revit). Ταιριάζει 1:1 με το `HatchEntity.fillType` μας.

---

## 3. Αρχιτεκτονική Απόφαση (προτεινόμενη)

### 3.1 Κεντρική απόφαση: `fillType: 'image'` (μοντέλο ArchiCAD)

Προσθέτουμε **έναν νέο τύπο γεμίσματος** `'image'` στο υπάρχον `HatchEntity` — δεν φτιάχνουμε νέο entity,
δεν φτιάχνουμε νέο tool. Επαναχρησιμοποιούμε **ολόκληρο** το lifecycle του ADR-507 (tool, boundary
detection Α/Β, grips, contextual panel, associative recompute, move/rotate, DXF import boundary).

**Αρχή SSoT:** «μία γραμμοσκίαση, πολλοί τρόποι γεμίσματος». Το image fill = ένα ακόμη branch, όχι fork.

### 3.2 Data model — επέκταση `HatchEntity` (MOD `types/entities.ts`)

```typescript
// NEW — προτεινόμενο· αναφορά σε asset (ΟΧΙ inline base64 στο entity)
export interface HatchImageFill {
  /** Enterprise asset id της εικόνας υλικού (SSoT· βλ. §6). */
  assetId: string;
  /** Ρυθμιζόμενο URL/src resolve-άρεται από τον asset resolver (runtime, όχι persisted). */
  // (το src ΔΕΝ αποθηκεύεται στο entity — resolve μέσω assetId)
  /** Πραγματικό πλάτος του πλακιδίου/tile σε ΜΟΝΑΔΕΣ ΣΧΕΔΙΟΥ (mm) — Revit/ArchiCAD style. */
  tileWidth: number;
  /** Πραγματικό ύψος tile σε mm (default = tileWidth → τετράγωνο). */
  tileHeight: number;
  /** Γωνία περιστροφής του μοτίβου (μοίρες, default 0). */
  angle?: number;
  /** Σημείο αγκύρωσης (phase) του tiling — default = `patternOrigin`/lower-left bbox. */
  origin?: Point2D;
  /** Προαιρετικές γραμμές αρμών (grout) πάνω από την εικόνα (ArchiCAD symbol-fill combo). */
  grout?: { color: string; widthMm: number };
}

export interface HatchEntity extends BaseEntity {
  // …υπάρχοντα πεδία ADR-507…
  fillType?: 'solid' | 'user-defined' | 'predefined' | 'gradient' | 'image'; // ← +'image'
  /** ADR-643 — image fill (μόνο όταν fillType==='image'). */
  imageFill?: HatchImageFill;
}
```

> **Γιατί `assetId` και ΟΧΙ inline base64:** μια φωτο πλακιδίου = 100KB–2MB. Αν μπει inline στο entity,
> κάθε σκηνή/undo-snapshot/persist φουσκώνει ανεξέλεγκτα (ADR-040 = θάνατος). Το entity κρατά **μόνο
> ένα id**· η εικόνα ζει μία φορά στο asset store και resolve-άρεται runtime (πρότυπο floorplan-background).

### 3.3 Rendering — νέο branch στο `HatchRenderer.render()` (MOD)

Ακολουθεί **ακριβώς** το ήδη υπάρχον idiom (SlabRenderer/detail-sheet): `clip('evenodd')` + tiled `drawImage`.

```
} else if (hatch.fillType === 'image' && hatch.imageFill) {
  const img = this.imageCache.resolve(hatch.imageFill.assetId);   // ImageBitmap/HTMLImageElement
  if (img && this.imageDensityOk(hatch)) {                        // LOD gate (βλ. §5)
    this.ctx.save();
    this.drawBoundaryPath(paths);        // SSoT multi-subpath (traceHatchBoundary)
    this.ctx.clip('evenodd');            // νησίδες = τρύπες (ίδιο rule με fill)
    this.fillTiledImage(paths, img, hatch.imageFill);  // CanvasPattern repeat + DOMMatrix (world size+angle)
    this.ctx.restore();
    if (hatch.imageFill.grout) this.drawGroutLines(paths, hatch.imageFill);
  } else {
    // LOD fallback: μέσο χρώμα εικόνας ως solid tint (zoom-out ή μη-φορτωμένη) — δεν βαραίνει.
    this.fillAverageColorTint(paths, hatch.imageFill.assetId);
  }
}
```

- **Tiling με πραγματική κλίμακα:** `CanvasPattern` (`createPattern(img,'repeat')`) + `setTransform(DOMMatrix)`
  που κλιμακώνει το tile ώστε `tileWidth`(mm) → σωστά pixels στο τρέχον zoom, + rotation `angle`, + anchor
  στο `origin` (ίδια τεχνική με `fillScreenSpacePattern` :141, αλλά **world-space** scale αντί screen-px).
- **Async load:** αν η εικόνα δεν είναι έτοιμη → tint fallback + ένα `onload` → invalidate/redraw (fire-and-forget,
  ΟΧΙ blocking· ADR-040 micro-leaf: ο renderer δεν subscribe-άρει, το asset store σκανδαλίζει redraw).

### 3.4 ADR-040 compliance

- Το image + το derived `CanvasPattern` κρατιούνται σε **cache ανά (assetId, tileW, tileH, angle, scale-bucket)** —
  ο `render()` **δεν** ξαναφτιάχνει pattern ανά frame (mirror του `screenPatternCache`/`segCache`).
- Ο resolver εικόνων = **leaf-level** (ίδιο πρότυπο με το υπάρχον image cache) — καμία high-freq subscription
  σε `CanvasSection`/`CanvasLayerStack`.
- Zoom/pan = μόνο `DOMMatrix` update στο υπάρχον pattern (μηδέν re-tiling).

---

## 4. Πηγή & αποθήκευση εικόνων (asset library)

Προτεινόμενο (προς επιβεβαίωση — βλ. §9 Q1/Q2):

1. **Ενσωματωμένη βιβλιοθήκη υλικών** (starter set): πλακίδια/ξύλο/μάρμαρο/χαλί — curated, MIT/royalty-free
   textures, με προκαθορισμένο `tileWidth×tileHeight` (π.χ. «Γρανίτης 60×60»). SSoT: `data/material-image-catalog.ts`.
2. **Upload δικών του φωτο** από τον χρήστη → αποθήκευση σε **Firebase Storage** (company-scoped, `storage.rules`),
   με **Enterprise ID** (`enterprise-id.service.ts` — νέο prefix `mat_img_*`· ADR-017/210/294). Το entity κρατά `assetId`.
3. **Resolver SSoT** `material-image-resolver.ts`: `assetId → src (URL/data)`, με in-memory `ImageBitmap` cache
   (επαναχρήση του image-loading προτύπου από `floorplan-background/providers/ImageProvider.ts`).

---

## 5. Performance (κρίσιμο — 100% ειλικρίνεια)

Οι εικόνες είναι **βαρύτερες** από vector. Χωρίς μέτρα, πολλά image-hatch = πτώση FPS. Μέτρα (όλα με
υπάρχον πρότυπο στον κώδικα):

| Κίνδυνος | Μέτρο | Πρότυπο |
|---|---|---|
| Χιλιάδες tiny tiles σε zoom-out | **Density-LOD**: κάτω από N px/tile → μέσο χρώμα ως solid tint | `HatchRenderer.ts:215-223` (ήδη για patterns) |
| Re-tiling ανά frame | `CanvasPattern` cache ανά (asset+size+angle) | `screenPatternCache` :92 |
| Off-screen hatches | Ήδη: μόνο ορατά entities render-άρονται (culling) | ADR-040 |
| Μεγάλα uploads | Server-side/on-load downscale σε max edge (π.χ. 1024px) + `ImageBitmap` | `ImageProvider` |
| Undo/persist bloat | `assetId` reference, ΟΧΙ inline pixels | §3.2 |

---

## 6. DXF Interoperability (import/export)

- **Export → DXF:** το native DXF `HATCH` **δεν έχει image fill**. **Απόφαση Giorgio (Q3): ΚΑΙ ΤΑ ΔΥΟ —
  επιλογή του χρήστη τη στιγμή του export** (dropdown στο export dialog):
  (α) **Ελαφρύ** — υποβάθμιση σε `SOLID` με το μέσο χρώμα της εικόνας (ασφαλές, πάντα ανοίγει, ελαφρύ αρχείο)·
  (β) **Πιστό** — export ως ξεχωριστό `IMAGE` entity + clip boundary (κοντά στο AutoCAD «Super Hatch», βαρύτερο
  & λιγότερο διαλειτουργικό). Default επιλογή = (α). Το πλήρες native image-fill (assetId + tile params) επιβιώνει
  ούτως ή άλλως στο **native project format** (Firestore persistence) ανεξάρτητα από την DXF επιλογή.
- **Import ← DXF:** εκτός scope (το DXF δεν φέρνει image-hatch· τυχόν raster έρχεται ως ξεχωριστό IMAGE entity, άλλο θέμα).

---

## 7. UX Flow (μοντέλο ArchiCAD, πάνω στο υπάρχον hatch tool)

```
1. Χρήστης κλικ «Γραμμοσκίαση» → επιλέγει περιοχή (Τρόπος Α/Β, ADR-507 — ΙΔΙΟ)
2. Στο contextual panel: [Τύπος: Εικόνα ▼]  ← νέα επιλογή δίπλα σε Solid/Μοτίβο/Gradient
3. Ανοίγει picker: [Βιβλιοθήκη υλικών] | [Ανέβασμα φωτο]
4. Επιλογή υλικού → ορίζει διάσταση tile (π.χ. 60×60 εκ.) → live preview στο canvas
5. Ρυθμίσεις: [Διάσταση] [Γωνία] [Αρμοί ✓ χρώμα/πάχος] [Διαφάνεια (BaseEntity)]
6. Move/rotate/vertex grips = ΙΔΙΑ με ADR-507/627 (καμία νέα grip υποδομή)
```

---

## 8. Φάσεις υλοποίησης (προτεινόμενες)

| Φ | Περιεχόμενο | Αρχεία (κύρια) |
|---|---|---|
| **Φ1** | Data model (`HatchImageFill`, `fillType:'image'`) + renderer branch (clip+tiled drawImage) + LOD tint fallback | `types/entities.ts`, `HatchRenderer.ts`, νέο `hatch-image-paint.ts` |
| **Φ2** | Asset resolver + image cache (`ImageBitmap`) + starter βιβλιοθήκη υλικών | `material-image-resolver.ts`, `data/material-image-catalog.ts` |
| **Φ3** | Contextual panel UI: επιλογή «Εικόνα», picker, διάσταση/γωνία/αρμοί | `ui/contextual/contextual-hatch-tab.ts`, νέο picker component |
| **Φ4** | Upload δικών φωτο → Firebase Storage + Enterprise ID (`mat_img_*`) | `enterprise-id.service.ts`, storage integration |
| **Φ5** | Αρμοί (grout lines) + DXF export **και τα δύο** (dropdown: solid-downgrade / IMAGE entity, Q3) | `hatch-image-paint.ts`, `dxf-ascii-hatch-writer.ts`, export dialog |
| **Φ6** | i18n (el/en), persistence round-trip, tests | locales, `__tests__` |

---

## 9. Q&A — ΚΛΕΙΣΤΟ (Giorgio 2026-07-12)

| # | Ερώτηση | Απόφαση Giorgio | Επίπτωση |
|---|---|---|---|
| **Q1** | Πόσο μεγάλο; MVP ή πλήρες σύστημα; | **Πλήρες, σταδιακά** (Φ1→Φ6) | Χτίζουμε ολόκληρο το ArchiCAD-style σύστημα σε φάσεις· αποτέλεσμα ορατό από Φ1. |
| **Q2** | Πηγή εικόνων; | **Και τα δύο** (βιβλιοθήκη + upload) | Βιβλιοθήκη=Φ2, upload=Φ4. |
| **Q3** | DXF export συμπεριφορά; | **Και τα δύο — επιλογή χρήστη στο export** | Dropdown στο export dialog: solid-downgrade (default) / IMAGE entity (πιστό). Φ5. |
| **Q4** | Αρμοί (grout) πότε; | **Αργότερα (Φ5)** | Η βασική εικόνα-γέμισμα δουλεύει από Φ1· αρμοί προστίθενται στη Φ5. |
| **Q5** | Κλίμακα; | **Πάντα πραγματική διάσταση tile** (Revit/ArchiCAD) | `tileWidth×tileHeight` σε mm· το μοτίβο δείχνει το αληθινό μέγεθος πλακιδίου σε κάθε zoom. |

---

## 10. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-12 | **v1 DRAFT** — δημιουργία ADR μετά από έρευνα αγοράς (AutoCAD/Revit/ArchiCAD) + code recon. Προτεινόμενη αρχιτεκτονική: `fillType:'image'` (μοντέλο ArchiCAD) πάνω στο ADR-507. Q&A ανοιχτό. |
| 2026-07-12 | **v1 SPEC COMPLETE** — Q&A κλειστό (Giorgio): Q1=πλήρες/σταδιακά, Q2=βιβλιοθήκη+upload, Q3=DXF export και τα δύο (επιλογή χρήστη), Q4=αρμοί στη Φ5, Q5=πάντα πραγματική διάσταση. Έτοιμο για υλοποίηση Φ1. |

---

## Πηγές έρευνας

- AutoCAD — [Using an Image as a Hatch (Autodesk Blog)](https://www.autodesk.com/blogs/autocad/quick-tip-using-an-image-as-a-hatch-in-autocad/) · [To Work With Hatching or Filling Objects](https://help.autodesk.com/view/ACD/2017/ENU/?guid=GUID-EFAAB5F6-FE3C-4052-9E04-560AE6A8B814)
- Revit — [About Fill Patterns for Material Graphics](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-EBD9E8E6-AF83-4579-8D9A-9B9E23DCAA52) · [Aligning Revit Textures with Model Hatch (Arkance)](https://ukcommunity.arkance.world/hc/en-us/articles/21565599511826-Aligning-Revit-Textures-with-Model-Hatch-pattern-fill-styles)
- ArchiCAD — [Creating Image Fills (ContraBIM)](https://www.contrabim.com/blog/creating-image-fills-in-archicad) · [How to create and use image fills (Graphisoft)](https://support.graphisoft.com/hc/en-us/articles/30314265324049-How-to-create-and-use-image-fills)
