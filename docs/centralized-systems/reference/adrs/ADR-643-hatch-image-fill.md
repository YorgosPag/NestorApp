# ADR-643 — Hatch Image Fill (Γέμισμα Γραμμοσκίασης με Εικόνα / «ζωντανά» υλικά)

> **Status:** 🟢 **Φ1→Φ6 IMPLEMENTED — ΟΛΟΚΛΗΡΩΜΕΝΟ** (render path + asset resolver + starter βιβλιοθήκη + panel UI/visual picker + user upload reuse `bmat` + αρμοί/grout + **DXF export solid-downgrade/IMAGE + persistence round-trip + tests**) · Q&A ΚΛΕΙΣΤΟ (Giorgio 2026-07-12). **Pending (τεκμηριωμένο):** real-AutoCAD οπτική επικύρωση του image-mode export (κανένας IMAGE import reader για round-trip — τα tests είναι structural).
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

> **⚠️ Διόρθωση υλοποίησης Φ1 (code = source of truth):** το ψευδο-code πάνω δείχνει `clip('evenodd')`
> + `drawImage`. Ο πραγματικός κώδικας χρησιμοποιεί `CanvasPattern` (`createPattern(img,'repeat')`) +
> `fill('evenodd')` πάνω στο boundary path — το `fill('evenodd')` **ΕΙΝΑΙ** το clip (νησίδες = τρύπες),
> οπότε δεν χρειάζεται ξεχωριστό `ctx.clip()`. Αυτό ταυτίζεται 1:1 με το υπάρχον screen-raster μονοπάτι
> (`fillScreenSpacePattern`, ADR-531): εξήχθη **ΓΕΝΙΚΟ** SSoT `fillHatchPattern()` που μοιράζονται ΚΑΙ οι
> δύο (μηδέν sibling clone — N.18). Το average-color tint fallback φτιάχτηκε ως `fillBoundary()` helper,
> στο οποίο δρομολογήθηκαν (Boy-Scout, N.0.2) και τα υπάρχοντα solid / background / density-LOD blocks.

### 3.3.1 Πλήρες passthrough μονοπάτι (κρίσιμο — ΔΕΝ ήταν στο v1 spec)

Ένα committed hatch φτάνει στον `HatchRenderer` περνώντας από **ΤΡΙΑ** layers που αντιγράφουν πεδία
ρητά (allowlist, όχι spread) — το `imageFill` έπρεπε να προστεθεί σε **ΚΑΙ ΤΑ ΤΡΙΑ**, αλλιώς **σιωπηλό
drop** (η εικόνα δεν φτάνει ποτέ στον καμβά· ίδιο trap που είχε κρύψει gradient/backgroundColor/lineweight):

```
scene HatchEntity
   → dxf-scene-entity-handlers.ts   (h.imageFill        → DxfEntityUnion)
   → dxf-types.ts  DxfHatch          (imageFill?: HatchEntity['imageFill'])
   → dxf-renderer-entity-model.ts    (entity.imageFill  → Entity για HatchRenderer)
   → HatchRenderer.render()          (hatch.fillType==='image' branch)
```

### 3.4 ADR-040 compliance

- Το image + το derived `CanvasPattern` κρατιούνται σε **cache ανά (assetId, tileW, tileH, angle, scale-bucket)** —
  ο `render()` **δεν** ξαναφτιάχνει pattern ανά frame (mirror του `screenPatternCache`/`segCache`).
- Ο resolver εικόνων = **leaf-level** (ίδιο πρότυπο με το υπάρχον image cache) — καμία high-freq subscription
  σε `CanvasSection`/`CanvasLayerStack`.
- Zoom/pan = μόνο `DOMMatrix` update στο υπάρχον pattern (μηδέν re-tiling).

---

## 4. Πηγή & αποθήκευση εικόνων (asset library)

> **⚠️ Φ2 IMPLEMENTED — SSoT audit άλλαξε τον σχεδιασμό (code = source of truth):** Το starter
> library **ΔΕΝ** έφτιαξε νέο asset store. Υπάρχει ήδη ολόκληρο CC0 texture library (**ADR-413**):
> 8 slugs (`tile/wood/stone/concrete/brick/plaster/metal/roof-tiles`) με φυσικές `albedo.jpg`
> (`public/textures/<slug>/`, public mode· Firebase Storage `bim-texture-library`, storage mode) +
> per-slug πραγματικό μέγεθος tile (m) + licence **CC0 (Poly Haven)**. Ο **`resolveTextureUrl`**
> (SSoT, public↔storage switchable, in-flight de-dup) είναι ήδη ο asset resolver. Big-player SSoT
> (Revit/ArchiCAD/C4D): **μία** texture library, αναφορά ΚΑΙ από 2D image-fill ΚΑΙ από 3D render
> appearance — ακριβώς το idiom του υπάρχοντος 2D swatch `material-thumbnail-resolver.ts`.

**Υλοποιημένο (Φ2):**

1. **Starter βιβλιοθήκη = façade πάνω στο ADR-413** — `data/material-image-catalog.ts`: 8 curated υλικά,
   καθένα `{ id, textureSlug, category, labelKeySuffix }`. Το `assetId` του entity = ένα `matimg-*` id
   αυτού του καταλόγου (σταθερά curated ids — διακριτά από τα generated `bmat_*` και τα Φ4 `mat_img_*`).
   Το **πραγματικό μέγεθος tile (mm) παράγεται** από το `TEXTURE_SET_DEFS[slug].tileSizeM × 1000`
   (`getMaterialImageDefaultTileMm`) — **μηδέν διπλότυπο δεδομένο διάστασης**.
2. **Resolver SSoT** `rendering/entities/shared/material-image-resolver.ts`: `resolveMaterialImageSrc(assetId)`
   → catalog → slug → **`resolveTextureUrl(slug,'albedo')`** (ADR-413). Άγνωστο id → `null`.
3. **Σύνδεση** στο `HatchImageCache`: ο resolver injected στον constructor (default = `resolveMaterialImageSrc`,
   testable)· `img.src = (await resolveSrc(assetId)) ?? assetId` — fallback στο raw assetId διατηρεί
   backward-compat με Φ1 dev-mode ΚΑΙ τα μελλοντικά Φ4 user uploads (που θα φέρνουν δικό τους resolvable src).
   Το ADR-040 fire-and-forget + `markAllCanvasDirty` idiom **αμετάβλητο** (ο resolver τρέχει μέσα στο ήδη-async `load`).
4. **i18n** `hatchImageFill.materials.<suffix>` (el + en, `dxf-viewer-shell.json`).

**Αναβλήθηκε (χωρίς μετρημένη ανάγκη):** `ImageBitmap` upgrade στο decode — το `HTMLImageElement` + `createPattern`
είναι ήδη ADR-040-clean & cached ανά assetId. Θα μπει αν φανεί perf ανάγκη.

> **⚠️ Φ4 IMPLEMENTED — SSoT audit άλλαξε τον σχεδιασμό (code = source of truth):** Το αρχικό note
> προδιέγραφε νέο prefix `mat_img_*`. Το πραγματικό audit έδειξε ότι **όλη η upload υποδομή είναι ήδη
> keyed σε `materialId` (`bmat` doc)** — service (`uploadMaterialThumbnail`), storage path
> (`buildBimMaterialThumbnailPath`), `storage.rules` (company-scoped `bim-material-thumbnails`), και ο
> `setDoc`+enterprise-id writer (`MaterialLibraryService.saveMaterial`). Νέο `mat_img` prefix/collection θα
> **διπλασίαζε** όλη αυτή την υποδομή (ενάντια σε N.0/N.12/SSoT). Η **πρακτική των μεγάλων** το επιβεβαιώνει:
> Revit/Cinema 4D/Figma χρησιμοποιούν **μία κοινή material library**, upload once → id → reference, ίδιο asset
> για 2D + 3D (ArchiCAD: χωριστός *τύπος* fill αλλά ίδια βιβλιοθήκη). Ταυτίζεται 1:1 με το §4 Φ2 note
> («μία texture library, αναφορά από 2D + 3D»). **Απόφαση: reuse `bmat` / `bim_materials`**, μηδέν `mat_img`.

**Υλοποιημένο (Φ4):**

1. **Upload = first-class library entry** — δικές φωτο χρήστη → **Firebase Storage** (company-scoped, reuse
   `uploadMaterialThumbnail`, ADR-413 §2D) + **Enterprise ID `bmat_*`** (reuse `generateBimMaterialId` μέσω
   `saveMaterial`, N.6 `setDoc`). Το `HatchImageFill.assetId` = ένα `bmat_*` id. Thin orchestrator
   `bim/services/hatch-image-upload.service.ts` (`uploadHatchImageMaterial`): validate → `saveMaterial`
   (minimal doc: auto-name από filename, `category:'other'`, `atoeCategory:''`) → upload → patch `thumbnailUrl`
   → register· orphan-doc cleanup on failure (belt-and-suspenders). **Μηδέν** νέο service/collection/prefix/rule.
2. **Resolver extension (ένα σημείο)** — ο `material-image-resolver` ελέγχει **user upload → builtin catalog →
   null**. Το user src έρχεται από τον νέο ελαφρύ (THREE-free) `user-material-image-store` (assetId →
   `thumbnailUrl`), fed **always-on** από τον υπάρχοντα `UserMaterialRegistryHost` (η ΙΔΙΑ Firestore
   subscription που τρέφει το 3D `user-material-registry`) + direct register on upload.
3. **Reload self-heal (leak-free)** — ο `HatchImageCache` κάνει lazy `error`-retry gated σε ένα monotonic
   `version` του store (ένας ακέραιος έλεγχος/frame· μηδέν per-cache subscription). Ο host κάνει
   `markAllCanvasDirty` στην ενυδάτωση της βιβλιοθήκης ώστε reopened doc να ξαναζωγραφίζει.
4. **Picker upload UI** — `MaterialImagePicker` απέκτησε «Ανέβασμα φωτο» + grid «Δικές μου εικόνες» (reuse
   `useMaterialLibrary` μέσω `useHatchImageUploads`). Κοινό `SwatchButton` (builtin + upload, μηδέν clone).
   `aria-label`/`aria-pressed` (CHECK 3.23, ΟΧΙ `title=`). i18n `hatchImageFill.upload.*` (el+en).
5. **Delete (Φ4 delete)** — hover «κάδος» affordance **μόνο** στα user uploads (όχι builtin) → `ConfirmDialog`
   (destructive, warning ότι οι γραμμοσκιάσεις θα πέσουν σε απλό χρώμα) → thin `hatch-image-delete.service.ts`
   που σβήνει **ΚΑΙ** το `bim_materials` doc (`deleteMaterial`, builtin guard) **ΚΑΙ** το Storage thumbnail
   (`deleteMaterialThumbnailByUrl`, best-effort — έκλεισε το orphan-blob κενό). Το picker αδειάζει αυτόματα
   από το live library snapshot (μηδέν χειροκίνητο unregister).

**Σημείωση κλίμακας:** ένα user upload δεν φέρει πραγματικό μέγεθος tile → default (fallback
`getMaterialImageDefaultTileMm` = 1000×1000 mm)· ο χρήστης το ρυθμίζει με τα πεδία διάστασης (Φ3). Το ίδιο
`bmat` doc εμφανίζεται και στη Βιβλιοθήκη Υλικών (2D swatch + 3D appearance) — big-player «μία library, 2D+3D».

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

- **Export → DXF (Φ5b IMPLEMENTED):** το native DXF `HATCH` **δεν έχει image fill**. **Απόφαση Giorgio (Q3):
  ΚΑΙ ΤΑ ΔΥΟ — επιλογή του χρήστη τη στιγμή του export** (dropdown `export.dxfImageFillMode` στο export dialog,
  ορατό μόνο για DXF):
  (α) **Ελαφρύ / `'solid'` (DEFAULT)** — υποβάθμιση σε `SOLID` με το **μέσο χρώμα** της εικόνας (reuse
  `averageImageColor`, client pre-pass). Ασφαλές, πάντα ανοίγει, ελαφρύ single-file `.dxf`.
  (β) **Πιστό / `'image'`** — tiled `IMAGE`+`IMAGEDEF` σε **πραγματική διάσταση tile** (Revit/ArchiCAD), με το
  raster **bundled σε `.zip`** (relative path `images/*`, **AutoCAD eTransmit standard** — απόφαση Giorgio στο fork).
  Κοντά στο AutoCAD «Super Hatch».

  **Ροή (marker-driven, ο writer μένει pure):** ο client pre-pass `resolveImageFillsForDxf` (`export/core/image-fill-export.ts`)
  τρέχει ΠΡΙΝ τον sync writer — solid mode → μετατρέπει το hatch σε κανονικό `SOLID`· image mode → stamp
  `dxfImageExport` marker (inserts even-odd-PIP-culled + πραγματική διάσταση tile) + fetch raster. Ο `dxf-ascii-image-writer`
  σειριοποιεί το marker σε `IMAGE`/`IMAGEDEF` (ΜΙΑ κοινή OBJECTS section με τα MLINESTYLE). Το `packageDxfArtifacts`
  βάζει τα rasters + το `.dxf` σε ΕΝΑ `.zip` (dedup ανά filename).

  **Fidelity boundaries (100% ειλικρίνεια):**
  - `solid` = ACI χρώμα (όχι true-color, όπως ΚΑΘΕ solid hatch)· `image` = **εξωτερικό raster reference** (το DXF
    δεν ενσωματώνει pixels — ταξιδεύει bundled στο zip).
  - Image mode: **δεν** εκπέμπονται `RASTERVARIABLES`/`IMAGEDEF_REACTOR` (AutoCAD defaults/regen)· περικοπή στο
    boundary = **tile-granularity even-odd PIP culling** (όχι per-image clip polygon)· overflow πάνω από
    `IMAGE_TILE_CAP` (400) ή αποτυχία decode/fetch → **ασφαλές solid fallback** (πάντα ανοίγει).
  - **Real-AutoCAD οπτική επικύρωση = PENDING** (κανένας IMAGE import reader για round-trip· τα tests είναι structural).
- **Native project format:** το πλήρες image-fill (assetId + tile params + grout) επιβιώνει στο **Firestore persistence**
  (Φ6, flat map `data.imageFill`) ανεξάρτητα από την DXF επιλογή. Το export-only `dxfImageExport` marker ΔΕΝ persist-άρεται.
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
| **Φ1** ✅ | Data model (`HatchImageFill`, `fillType:'image'`) + renderer branch (tiled `CanvasPattern`) + LOD tint fallback + live image cache + 3-layer passthrough | `types/entities.ts`, `HatchRenderer.ts`, νέα `shared/hatch-image-paint.ts` + `shared/hatch-image-cache.ts`, `dxf-types.ts`, `dxf-renderer-entity-model.ts`, `dxf-scene-entity-handlers.ts` |
| **Φ2** ✅ | Asset resolver (façade πάνω σε ADR-413 `resolveTextureUrl`) + starter βιβλιοθήκη 8 CC0 υλικών (tile size **derived**) + inject στο live cache | `data/material-image-catalog.ts`, `rendering/entities/shared/material-image-resolver.ts`, `hatch-image-cache.ts` |
| **Φ3** ✅ | Panel UI: fillType «Εικόνα» + **visual swatch grid** (Revit/ArchiCAD, reuse ADR-413 thumbnails) + διάσταση/γωνία + draw-defaults + bridge. **File-location διόρθωση (code=SoT):** το UI ζει στο descriptor-driven `hatch-advanced-panel` (μετά το ribbon-slim), ΟΧΙ στο `contextual-hatch-tab`. Αρμοί=Φ5. | `hatch-property-fields.ts`, `bridge/hatch-command-keys.ts`, `useRibbonHatchBridge.ts`, `hatch-draw-defaults-store.ts`, `hatch-completion.ts`, νέα `hatch-image-build.ts` + `bridge/hatch-bridge-read.ts` + `MaterialImagePicker.tsx`, `HatchPropertiesTab.tsx` |
| **Φ4** ✅ | Upload δικών φωτο → **reuse `bmat`/`bim_materials`** (Storage + Enterprise ID `bmat_*`, μηδέν νέα υποδομή) + resolver user-branch + always-on 2D store + picker upload UI | νέα `bim/services/hatch-image-upload.service.ts` + `rendering/entities/shared/user-material-image-store.ts` + `ui/hatch-advanced-panel/hooks/useHatchImageUploads.ts`· MOD `material-image-resolver.ts`, `hatch-image-cache.ts`, `UserMaterialRegistryHost.tsx`, `MaterialImagePicker.tsx`, `HatchPropertiesTab.tsx` |
| **Φ5a** ✅ | Αρμοί (grout lines) — render στα όρια tiles (ίδια DOMMatrix) + πλήρες UI wiring (toggle/χρώμα/πλάτος) | `hatch-image-paint.ts` (`drawImageGrout`), `HatchRenderer.ts`, `hatch-image-build.ts`, `hatch-draw-defaults-store.ts`, `hatch-command-keys.ts`, `hatch-property-fields.ts`, `useRibbonHatchBridge.ts`, `hatch-bridge-read.ts` |
| **Φ5b** ✅ | DXF export **και τα δύο** (dropdown: solid-downgrade default / πιστό tiled IMAGE + raster σε zip, Q3). Client pre-pass (marker-driven) + pure IMAGE/IMAGEDEF writer (κοινή OBJECTS με MLINE) + zip bundling + dialog dropdown | νέα `export/core/image-fill-export.ts` + `export/core/dxf-ascii-image-writer.ts`· MOD `dxf-ascii-writer.ts`, `dxf-ascii-mline-writer.ts` (extract `emitMlineStyleBlocks`), `export-service.ts`, `export/types.ts`, `types/entities.ts` (`DxfImageExportMarker`), `ui/components/export/{useExportDialogState,ExportDialog}.tsx` |
| **Φ6** ✅ | Persistence round-trip (`data.imageFill` flat map· `dxfImageExport` ΠΟΤΕ persisted) + i18n (el/en) + tests (pure tile-grid + IMAGE writer structural + solid/overflow/dedup control-flow + persistence) | MOD `bim/hatch/hatch-firestore-service.ts`· νέα `export/core/__tests__/{image-fill-export,dxf-ascii-image-writer}.test.ts` + επέκταση `hatch-firestore-service.test.ts`· locales `{el,en}/dxf-viewer-shell.json` |

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
| 2026-07-12 | **Φ4 delete IMPLEMENTED** — αφαίρεση user-uploaded εικόνας (το κενό: Φ4 έφτιαξε upload, όχι delete). **SSoT audit εύρημα:** ο `MaterialLibraryService.deleteMaterial` σβήνει **ΜΟΝΟ** το Firestore doc (το Storage thumbnail έμενε orphan). Νέα: thin `hatch-image-delete.service.ts` (`deleteHatchImageMaterial`: doc delete → **best-effort** storage delete· doc-fail διαδίδεται ΠΡΙΝ οποιοδήποτε storage op· builtin guard από τον `deleteMaterial`) + `deleteMaterialThumbnailByUrl` στο `bim-material-thumbnail-upload.service.ts` (reuse `deleteObject`, `ref(storage, downloadUrl)` — χωρίς ext-guessing). MOD: `useHatchImageUploads` (+`remove(assetId)`/`removingId`)· `MaterialImagePicker` (hover «κάδος» **μόνο** σε δικά μου uploads, όχι builtin· reuse `ConfirmDialog` SSoT destructive + `Trash2`· `aria-label` CHECK 3.23). Η αφαίρεση από το picker γίνεται αυτόματα (live `bim_materials` snapshot + always-on `UserMaterialRegistryHost` → replace 2D store· μηδέν χειροκίνητο unregister). i18n `hatchImageFill.upload.{delete,deleteTitle,deleteDescription,deleteConfirm,errors.deleteFailed}` (el+en, ICU `{name}`). **Bugfix (layout):** το `ConfirmDialog` (`AlertDialogContent` = CSS `grid`) «φούσκωνε» πέρα από το `max-w-md` όταν το όνομα υλικού ήταν μακρύ hash (uploads keyed by hash → 80-char name) → grid min-content blowout → footer κουμπιά εκτός πλαισίου· fix: description ως node με `[overflow-wrap:anywhere]` (μηδενίζει το min-content· χωρίς άγγιγμα του shared component). Tests: delete orchestrator **4/4** (doc→storage order, storage-fail swallow, doc-fail propagate, no-URL skip). jscpd:diff καθαρό. |
| 2026-07-12 | **Φ6 IMPLEMENTED** — persistence round-trip + i18n audit + tests (ΟΛΟΚΛΗΡΩΣΗ ADR-643). **Persistence (κρίσιμο εύρημα SSoT audit):** το `hatch-firestore-service.ts` **ΔΕΝ** persist-άρε καθόλου το `imageFill` (έλειπε από `HATCH_SCALAR_KEYS` + το doc `fillType` union δεν είχε `'image'`) → τα image-fill hatches **δεν επιβίωναν reload** (fillType='image' αποθηκευόταν ως string αλλά χωρίς imageFill → tint/τίποτα). Fix: +`'image'` στο doc union, +`imageFill?: HatchImageFill` πεδίο (flat map, ίδιο idiom με gradient — assetId reference, μηδέν inline pixels), +`'imageFill'` στα scalar keys. Το export-only `dxfImageExport` marker μένει **structurally excluded** (allowlist pickHatchData → ΠΟΤΕ persisted· απόδειξη με test). **Reopened-doc render:** δουλεύει πλέον αυτόματα — το persisted `imageFill` ρέει από τον Φ1 3-layer passthrough (μηδέν νέος κώδικας render). **i18n:** `export.dxfImageFillMode` + `export.imageFillModes.{solid,image}` (el+en). **Tests (+39, όλα PASS):** pure `buildImageTilePlacements` (tile-grid, even-odd PIP, overflow caps)· IMAGE writer structural round-trip (πλήθος IMAGE=inserts, dedup IMAGEDEF ανά filename, 340→5 handle wiring, ΜΙΑ κοινή OBJECTS με MLINE)· `resolveImageFillsForDxf` control-flow (solid downgrade/image marker/overflow fallback/dedup/decode-fail, mocked Image+fetch+resolver)· persistence imageFill round-trip + dxfImageExport-never-persisted. `jscpd:diff` καθαρό. |
| 2026-07-12 | **Φ5b IMPLEMENTED** — DXF export image-fill, ΚΑΙ ΤΑ ΔΥΟ (Q3). **SSoT audit πρώτα:** ο DXF writer είναι client-side αλλά pure/sync → derived data προ-υπολογίζονται σε pre-pass & stamp-άρονται ως `dxf*` markers (idiom `dxfFaces`/`dxfMlineSource`)· reuse `averageImageColor`+`resolveImageFillOrigin`+`resolveMaterialImageSrc`+`pointInPolygon`+`zip-pack` (μηδέν διπλότυπο). Νέα: `image-fill-export.ts` (async client pre-pass: solid-downgrade default με μέσο χρώμα / image-mode `dxfImageExport` marker με even-odd-PIP tile-grid σε πραγματική διάσταση + fetch raster· ασφαλές solid fallback σε decode/fetch/overflow)· `dxf-ascii-image-writer.ts` (pure `IMAGE`/`IMAGEDEF` σειριοποίηση, dedup ανά filename, mirror mline writer). MOD: `dxf-ascii-writer.ts` (image-mode hatch → `emitImageTiles` skip HATCH· `buildImageDefRegistry` ίδιο `$HANDSEED` pool· **ΜΙΑ** κοινή OBJECTS MLINESTYLE+IMAGEDEF)· `dxf-ascii-mline-writer.ts` (extract `emitMlineStyleBlocks` body, backward-compat)· `export-service.ts` (`renderDxfWithImages` async pre-pass + `packageDxfArtifacts` rasters σε ΕΝΑ zip· inline orphaned `exportFloorToDxf` — Boy-Scout, ήταν latent bug που δεν έτρεχε το image pre-pass)· `export/types.ts` (`DxfImageFillMode`)· `types/entities.ts` (`DxfImageExportMarker` + `HatchEntity.dxfImageExport`). UI: `ExportDialog` dropdown `dxfImageFillMode` (solid default / image, ορατό μόνο DXF) + `useExportDialogState`. **Fidelity boundaries (§6):** raster = εξωτερικό reference (zip bundle, AutoCAD eTransmit)· χωρίς RASTERVARIABLES/IMAGEDEF_REACTOR· clip = tile-granularity PIP· real-AutoCAD οπτική επικύρωση PENDING (tests structural). |
| 2026-07-12 | **Φ5a IMPLEMENTED** — αρμοί (grout lines). Render: νέο pure `drawImageGrout` (`hatch-image-paint.ts`) που χρησιμοποιεί την **ΙΔΙΑ `DOMMatrix`** με το tiled pattern (image-px→screen) → οι αρμοί πέφτουν ακριβώς στα όρια των πλακιδίων σε κάθε zoom/rotation/origin· clipped even-odd· πάχος `widthMm×scale` (≥1px)· safety cap 2000 γρ./άξονα (LOD gate ήδη περιορίζει)· κλήση στο `HatchRenderer.fillImage` μόνο στο pattern branch (όχι στο LOD tint). UI wiring (mirror gradient singleColor+colors): draw-defaults `groutEnabled/groutColor/groutWidthMm` (default off, λευκό 5mm)· `ImageFieldPatch` +grout cases (χρώμα/πλάτος ενεργοποιούν τους αρμούς· disable αφαιρεί το object)· command keys `toggles.grout`/`stringParams.groutColor`/`params.groutWidth` (+unions+guards)· property-fields image group (+toggle/color/numeric)· bridge onToggle/getToggleState/onComboboxChange + `imageDefaultPatch` + read-side. i18n `grout`/`groutColor`/`groutWidth` (el+en). Verified: hatch-image-build+property-fields+bridge+completion+HatchRenderer jest **71/71**, `jscpd:diff` καθαρό (8 files). **Εκκρεμεί Φ5b** (DXF export). |
| 2026-07-12 | **Φ4 IMPLEMENTED** — user image upload. **SSoT audit εύρημα (άλλαξε τον σχεδιασμό §4, code=SoT):** αντί για νέο `mat_img` prefix/collection/rule/writer, **reuse `bmat`/`bim_materials`** — όλη η upload υποδομή (service/path/rules/`setDoc`-writer) ήταν ήδη keyed σε `materialId`. Επιβεβαίωση από πρακτική μεγάλων (Revit/C4D/Figma: μία shared library, upload once → id → reference, 2D+3D)· ταυτίζεται με το §4 Φ2 note. Νέα: `hatch-image-upload.service.ts` (thin: validate→`saveMaterial`→`uploadMaterialThumbnail`→patch→register· orphan cleanup)· `user-material-image-store.ts` (2D, THREE-free, assetId→`thumbnailUrl`, monotonic version)· `useHatchImageUploads.ts` (reuse `useMaterialLibrary`). MOD: `material-image-resolver` (user→catalog→null)· `hatch-image-cache` (lazy `error`-retry gated σε store version, leak-free)· `UserMaterialRegistryHost` (ίδια subscription τρέφει ΚΑΙ το 2D store + `markAllCanvasDirty`)· `MaterialImagePicker` (Ανέβασμα φωτο + «Δικές μου εικόνες» grid· κοινό `SwatchButton`, μηδέν clone· `aria-label` CHECK 3.23)· `HatchPropertiesTab` (projectId). i18n `hatchImageFill.upload.*` (el+en). **Enterprise IDs:** `bmat_*` (N.6 `setDoc`, μηδέν νέο prefix). Verified: resolver+upload jest **10/10** (27/27 στα γειτονικά suites), `jscpd:diff` καθαρό (8 files). |
| 2026-07-12 | **Φ3 IMPLEMENTED** — panel UI + visual material picker. fillType απέκτησε «Εικόνα»· νέο contextual group «Εικόνα» (ορατό μόνο fillType='image', mirror του gradient group). **Big-player picker (επιλογή Giorgio):** visual swatch grid (Revit/ArchiCAD/Figma material browser) που κάνει **reuse τα ADR-413 thumbnails** (`useMaterialThumbnailUrl(slug)` — μηδέν νέο asset). Wiring: νέα command keys (`imageAsset`/`imageTileWidth`/`imageTileHeight`/`imageAngle` + `visibility.image`)· bridge get/set/visibility (dual-mode selected↔draw-defaults)· image draw-defaults (tile size derived)· `hatch-completion` περνά `imageFill` στη νέα γραμμοσκίαση· νέο SSoT `hatch-image-build.ts` (`buildImageFillFromDefaults`/`withImageFillPatch` — mirror gradient-build, μοιρασμένο completion+bridge, μηδέν clone· επιλογή υλικού υιοθετεί το πραγματικό tile size). i18n `fillTypeImage`/`imageTile*`/`imageAngle`/`sections.image`/`pickerTitle` (el+en). **File-location διόρθωση:** UI = descriptor `hatch-advanced-panel`, ΟΧΙ `contextual-hatch-tab`. **File-size (N.7.1):** το `useRibbonHatchBridge` ξεπέρασε τις 500 γρ. → εξαγωγή του pure read-side σε `bridge/hatch-bridge-read.ts` (`readHatchComboboxState` — 478 γρ. bridge πλέον). Verified: hatch-image-build+completion+property-fields+bridge jest **62/62** ✅ (bridge 33/33 μετά την εξαγωγή), jscpd:diff ✅. |
| 2026-07-12 | **Φ2 IMPLEMENTED** — asset resolver + starter βιβλιοθήκη υλικών. **SSoT audit εύρημα (άλλαξε τον σχεδιασμό §4):** αντί για νέο asset store, το starter library = **façade πάνω στο υπάρχον ADR-413 CC0 texture library** (8 slugs, `resolveTextureUrl` public↔storage, licence CC0 Poly Haven) — big-player SSoT (μία library, 2D+3D), ίδιο idiom με `material-thumbnail-resolver`. Νέα: `data/material-image-catalog.ts` (8 curated `matimg-*` υλικά· tile size **derived** από `TEXTURE_SET_DEFS`, μηδέν διπλότυπη διάσταση)· `material-image-resolver.ts` (`assetId → resolveTextureUrl(slug,'albedo')`, null→raw fallback)· resolver injected στο `HatchImageCache` (ADR-040 idiom αμετάβλητο). i18n `hatchImageFill.materials.*` (el+en). `ImageBitmap` upgrade αναβλήθηκε (καμία μετρημένη ανάγκη). Verified: catalog+resolver jest 13/13 ✅, jscpd:diff ✅. |
| 2026-07-12 | **Φ1 IMPLEMENTED** — canvas render path. Data model (`HatchImageFill` + `fillType:'image'` + `imageFill?`)· νέα pure SSoT `hatch-image-paint.ts` (`resolveImageFillOrigin` / `computeImageTileMatrix` world-space tile scale / **γενικό** `fillHatchPattern` / `averageImageColor`)· live `hatch-image-cache.ts` (fire-and-forget decode → `markAllCanvasDirty`, ADR-040)· `HatchRenderer` image branch + `fillImage` + density-LOD tint + pattern/avg-color caches ανά assetId· 3-layer `imageFill` passthrough. **Boy-Scout:** εξαγωγή `fillBoundary()` (solid/bg/LOD) + κοινό `fillHatchPattern()` με το ADR-531 raster path (μηδέν clone, jscpd καθαρό). **Ghost:** image-fill drag δείχνει outline μόνο (πλήρες fill = μαζί με το panel, Φ3). **Φ1 src:** το `imageFill.assetId` χρησιμοποιείται απευθείας ως src· ο `assetId→src` resolver = Φ2. Verified: HatchRenderer + entity-model-hatch jest ✅, jscpd:diff ✅. |

---

## Πηγές έρευνας

- AutoCAD — [Using an Image as a Hatch (Autodesk Blog)](https://www.autodesk.com/blogs/autocad/quick-tip-using-an-image-as-a-hatch-in-autocad/) · [To Work With Hatching or Filling Objects](https://help.autodesk.com/view/ACD/2017/ENU/?guid=GUID-EFAAB5F6-FE3C-4052-9E04-560AE6A8B814)
- Revit — [About Fill Patterns for Material Graphics](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-EBD9E8E6-AF83-4579-8D9A-9B9E23DCAA52) · [Aligning Revit Textures with Model Hatch (Arkance)](https://ukcommunity.arkance.world/hc/en-us/articles/21565599511826-Aligning-Revit-Textures-with-Model-Hatch-pattern-fill-styles)
- ArchiCAD — [Creating Image Fills (ContraBIM)](https://www.contrabim.com/blog/creating-image-fills-in-archicad) · [How to create and use image fills (Graphisoft)](https://support.graphisoft.com/hc/en-us/articles/30314265324049-How-to-create-and-use-image-fills)
