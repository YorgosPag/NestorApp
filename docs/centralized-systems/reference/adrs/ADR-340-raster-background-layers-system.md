# ADR-340 — Floorplan Background System (PDF + Image, single-per-floor, Procore-grade separation)

**Status:** 📋 PROPOSED
**Date:** 2026-05-07
**Author:** Claude (Opus 4.7) + Γιώργος
**Mandate:** GOL + SSOT — full enterprise scope, zero MVP variants, completeness over phased-light, industry-standard convergence (Procore / SAP / Bluebeam)
**Supersedes (parzialmente):** PDF Background subsystem (`src/subapps/dxf-viewer/pdf-background/*`) → ridotto a **provider** PDF dietro un'astrazione comune
**Related ADRs:**
ADR-002 (z-index hierarchy),
ADR-003 (FloatingPanel compound),
ADR-029 (panel dimensions),
ADR-031 (Canonical File Storage System — `buildStoragePath`),
ADR-054 (FileUploadButton),
ADR-067/068/071 (geometry-utils, clamp, angle conversion),
ADR-134/170 (Telegram + attendance, side-context only),
ADR-292 (FILES collection unification),
ADR-294 (SSoT ratchet),
ADR-298 (Firestore rules tests),
ADR-301 (Storage rules tests),
ADR-310/311/312 (showcase + photo capture, side-context),
SPEC-237D (overlay support on PDF backgrounds)

---

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-07 | 📋 PROPOSED **revisione 2** dopo clarification round (6 Q&A, ελληνικά). Decisioni vincolanti: **(Q1)** scope = per-κάτοψη-ορόφου, niente altrove, multi-level units (μεζονέτες/καταστήματα) = N κατόψεις indipendenti (codice esistente), **(Q2)** single file per κάτοψη — abbandonato multi-layer stack/z-order/reorder, **(Q3)** replace = confirm dialog + cascade delete polygons, **(Q4)** calibration sempre disponibile (PDF + Image), **(Q5)** strong-separation Procore/SAP-grade — `files` SSoT (binary + generic metadata) + nuova `floorplan_backgrounds` (domain entity con calibration/transform/FK→files) + nuova `floorplan_overlays` (polygons con FK→floorplan_backgrounds), nuovo prefix `rbg_<ulid>`, **(Q6)** image formats = PNG + JPEG + WEBP + TIFF (via `utif.js` MIT). Tile provider rimosso dallo scope (non necessario per single-file-per-floor). ADR riscritto end-to-end. |
| 2026-05-07 | 📋 PROPOSED **revisione 1** — bozza iniziale post bug-fix PDF overlay alignment (`pdfTransform=identity` permanente). Architettura provider-based + multi-layer stack (poi rivista in revisione 2 dopo Q1-Q2 di Giorgio). |

---

## 1. Context

### 1.1 Stato corrente (2026-05-07)

Il DXF Viewer ha un **subsystem PDF-only** (`src/subapps/dxf-viewer/pdf-background/`) che renderizza la pagina 1 di un documento PDF dietro al canvas DXF, con transform indipendente, opacity, page navigation e fit-to-view.

**FloorplanGallery (read-only consumer)** usa lo stesso `PdfRenderer` via:
- `floorplan-pdf-renderer.ts` → `loadPdfPage1(url)` rende a scala 2x → `imageWidth × imageHeight` in pixel-space
- `floorplan-pdf-overlay-renderer.ts` → renderizza poligoni sopra l'immagine usando `calcFit + toScreen` (Y-UP CAD), fit semplice senza margini

**Bug recente (RISOLTO, dirty in working tree):**
`PdfControlsPanel.calculateFitScale()` raddoppiava `pageDimensions` (già a `scale=2`) per `DEFAULT_RENDER_SCALE=2` → `fitScale ≈ 0.22` → vertici salvati nello world ridotto (524×370 invece di ~1190×840) → gallery rendeva nell'angolo. **Fix:** `pdfTransform = identity` permanente + camera fit gestito esclusivamente da `useFitToPdf` su `canvasTransform`.

### 1.2 Limiti dell'architettura attuale

| Aspetto | Stato attuale | Limite |
|---------|---------------|--------|
| **Sources** | Solo PDF | No PNG/JPG/WEBP/TIFF → impossibile usare scansioni di kατόψεις vecchie da fotocopiatore/scanner |
| **Calibration** | Inesistente | L'utente non può dire "questo segmento = 2.5m" per scalare il raster a misure reali |
| **Persistence** | Inesistente — solo in-memory store | Reload pagina = riselezione file da disco |
| **Domain modeling** | `pdfBackgroundStore` accoppia file binary + render state + transform | Niente entità `FloorplanBackground` di prima classe; impossibile versionare, calibrare e salvare in modo coerente |
| **Polygon-file twin** | Polygons salvati in spazio mondiale del DXF; nessun twin per PDF/Image | Cancellando la κάτοψη restano polygons orfani |
| **Test coverage** | Smoke-only | Niente provider contract test, niente visual regression |

### 1.3 Pattern industry — convergenza

| Vendor | Pattern background floorplan |
|--------|------------------------------|
| **Procore (Drawings)** | `drawings/{id}` first-class entity (versions, calibration, sheet-area), markup tables FK to drawing+page |
| **Bluebeam Revu** | PDF document = doc; markups in tabelle dedicate per-page; calibration tool 2-click |
| **AutoCAD Construction Cloud** | Drawing = entity, markups separate, cross-version diff |
| **PlanGrid (ACC)** | Sheet-based PDF, photo overlays as separate domain, geo-pin calibration |
| **SAP DMS / EAM** | Strong typing — generic file blob + domain entity (cv_* + business object) |

**Pattern enterprise convergente:**
1. Drawing/floorplan = **first-class domain entity** con propria collection (NOT "just another file")
2. File binary = stored in object storage, **referenced via FK** dalla domain entity
3. Calibration / scale / transform = **on the domain entity** (mai dentro generic FileRecord)
4. Markups / polygons = **separate collection** con FK alla domain entity
5. Cascade delete = entity → markups → file (se non riferito altrove)

Memory rule "industry standard = default answer" (ADR-330 D8) ⟹ **applichiamo strong separation Procore/SAP-grade**.

### 1.4 Scope drivers (post-Giorgio Q1-Q2)

1. **FloorplanGallery** ha bisogno di renderizzare immagini scannerizzate (vecchie kátopseis su carta, foto smartphone, TIFF da scanner) come background.
2. **DXF Viewer editor** ha bisogno di **un solo** background per κάτοψη (nessuno stack multi-layer — semplificato dopo Q2).
3. **Per-floor binding**: ogni κάτοψη ha 0-1 background. Gli edifici μεζονέτα/κατάστημα che hanno N livelli avranno N κατόψεις indipendenti — **codice esistente nell'app**.
4. **Calibration** è essenziale e sempre disponibile (Q4): il workflow scan-old-floorplan → calibrate-by-known-distance → place-polygons è dominante.
5. **Persistence** è essenziale: reload-after-page-refresh deve mostrare lo stesso background con la stessa calibration.

---

## 2. Decision

Costruiamo un **Floorplan Background System** end-to-end enterprise che:

1. **Astrae** il source dietro un **provider pattern** (PDF + Image, due implementazioni).
2. **Modella** una nuova first-class entity `FloorplanBackground` (domain entity) separata dal generic `FileRecord` SSoT.
3. **Aggancia 0-1 background** per ogni κάτοψη ορόφου (single, no stack — Q2 vincolante).
4. **Introduce** calibration tool (2-point reference distance), sempre disponibile per entrambi i provider (Q4).
5. **Persiste** in 3 layer separati Procore-grade (Q5):
   - `files` collection — binary metadata SSoT (esistente, nessuna modifica)
   - `floorplan_backgrounds` — domain entity (NUOVA), FK→files, FK→floor
   - `floorplan_overlays` — polygons (NUOVA), FK→floorplan_backgrounds
6. **Replace flow** (Q3): nuovo upload con κάτοψη già occupata = confirm dialog + cascade delete (background + polygons), poi load del nuovo.
7. **Image formats** Procore-grade (Q6): PNG + JPEG + WEBP + TIFF (`utif.js` MIT).
8. **Sostituisce** `PdfControlsPanel` con `FloorplanBackgroundPanel` (single-target, no list/reorder).
9. **Wrap** del vecchio `pdfBackgroundStore` come adapter zero-data-loss durante migrazione.
10. **Copre** con test contract (provider) + integration (store + persistence) + visual regression (canvas) + Firestore/Storage rules tests.

Il PDF resta **fully functional** durante la migrazione: il vecchio store viene wrappato come **adapter** sopra il nuovo store, e tutti i consumer esistenti (`useFitToPdf`, `FloorplanGallery`, `DxfCanvas`) continuano a funzionare senza modifiche fino al boy-scout.

---

## 3. Architecture

### 3.1 Layered structure

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 8 — Migration sites (boy-scout)                       │
│  FloorplanGallery, DXF editor canvas, future consumers       │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 7 — UI Panel                                          │
│  FloorplanBackgroundPanel (single-target controls)           │
│  CalibrationDialog (2-point picker)                          │
│  ReplaceConfirmDialog (cascade delete confirmation)          │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 6 — Canvas                                            │
│  FloorplanBackgroundCanvas (RAF, paints active background)   │
│  Replaces PdfBackgroundCanvas                                │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 5 — Hooks                                             │
│  useFloorplanBackground(floorId), useFitToBackground         │
│  (replaces useFitToPdf), useCalibration                      │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 4 — Store                                             │
│  floorplanBackgroundStore (Zustand + immer + devtools)       │
│  Per-floor singleton state via Map<floorId, BackgroundState> │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 3 — Persistence                                       │
│  floorplan-background-persistence.service                    │
│  Writes: files + floorplan_backgrounds + floorplan_overlays  │
│  Tenant isolation: companyId on all 3 collections            │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2 — Provider Registry                                 │
│  registerProvider(providerId, factory) → ProviderRegistry    │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 — Provider Strategies                               │
│  PdfPageProvider, ImageProvider                              │
│  Both implement IFloorplanBackgroundProvider                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Provider interface (Layer 1)

**Single contract** che PDF e Image implementano:

```ts
export interface IFloorplanBackgroundProvider {
  readonly id: 'pdf-page' | 'image';
  readonly capabilities: ProviderCapabilities;
  readonly supportedMimeTypes: ReadonlyArray<string>;

  /** Loads raw source from File or storage URL. Returns natural pixel-space bounds. */
  loadAsync(source: ProviderSource): Promise<ProviderLoadResult>;

  /** Renders one frame onto the target canvas. */
  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void;

  /** Reports the un-transformed natural pixel dimensions. */
  getNaturalBounds(): NaturalBounds;

  /** Optional: page navigation (PDF-only). Gated by capabilities.multiPage. */
  setActivePage?(page: number): Promise<void>;

  /** Cleanup. */
  dispose(): void | Promise<void>;
}

export interface ProviderCapabilities {
  multiPage: boolean;             // PDF: true, Image: false
  exifAware: boolean;             // Image: true (rotation), PDF: false
  vectorEquivalent: boolean;      // PDF: true, Image: false
  calibratable: boolean;          // ENTRAMBI true (Q4 vincolante)
}

export type NaturalBounds = { width: number; height: number };

export type ProviderSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }
  | { kind: 'storage-path'; path: string };

export interface ProviderLoadResult {
  success: boolean;
  bounds?: NaturalBounds;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ProviderRenderParams {
  transform: BackgroundTransform;
  worldToCanvas: ViewTransform;
  viewport: { width: number; height: number };
  opacity: number;
}
```

### 3.3 Provider implementations

**PdfPageProvider** (Layer 1):
- Wraps existing `PdfRenderer` (pdfjs-dist 4.5.136). Zero re-implementation.
- `supportedMimeTypes`: `['application/pdf']`
- `capabilities`: `{ multiPage: true, exifAware: false, vectorEquivalent: true, calibratable: true }`
- `setActivePage(n)` chiama `PdfRenderer.renderPage(n)` e aggiorna l'asset rendered.
- Render: `ctx.drawImage(this.renderedImageCanvas, 0, 0)` con transform applicato dal compositor.

**ImageProvider** (Layer 1):
- Carica binary via `fetch(url).blob()`, decodifica a `HTMLImageElement` o `ImageBitmap`.
- `supportedMimeTypes`: `['image/png', 'image/jpeg', 'image/webp', 'image/tiff']` (Q6).
- `capabilities`: `{ multiPage: false, exifAware: true, vectorEquivalent: false, calibratable: true }`.
- **TIFF handling**: rileva mime `image/tiff` o `image/tif` o estensione `.tif/.tiff` → usa `utif.js` (MIT) per decode. Output: `ImageData` → `OffscreenCanvas` → blob URL → `HTMLImageElement`.
- **EXIF orientation**: legge tag `Orientation` via `exifr` (MIT, ~10KB gzip). Applica rotazione hardware (CSS-style transform pre-render, salvata nel transform metadata) — l'utente non vede mai una foto "ruotata di lato".
- Render: `ctx.drawImage(this.image, 0, 0)`.

### 3.4 Domain entity (Layer 4 store + Layer 3 persistence)

```ts
export interface FloorplanBackground {
  id: string;                              // rbg_<ulid> via enterprise-id.service
  companyId: string;                       // tenant isolation (immutable)
  floorId: string;                         // FK → floor entity (immutable)
  fileId: string;                          // FK → files collection (immutable)
  providerId: 'pdf-page' | 'image';
  providerMetadata: ProviderMetadata;      // page number, exif orientation, etc.
  naturalBounds: NaturalBounds;            // provider-reported, pixel-space, immutable
  transform: BackgroundTransform;          // user-controlled transform
  calibration: CalibrationData | null;     // Q4: optional, available for both
  opacity: number;                         // 0..1
  visible: boolean;
  locked: boolean;                         // UI: cannot move/calibrate when locked
  createdAt: number;
  updatedAt: number;
  createdBy: string;                       // userId
  updatedBy: string;                       // userId
}

export interface BackgroundTransform {
  translateX: number;       // world units (== natural pixels at scale=1)
  translateY: number;
  scaleX: number;
  scaleY: number;           // separate axes for non-uniform calibration
  rotation: number;         // degrees, CCW positive (CAD convention)
}

export interface CalibrationData {
  method: 'two-point';      // future-extension: 'three-point-affine'
  pointA: Point2D;          // pixel-space of natural raster
  pointB: Point2D;
  realDistance: number;     // user-supplied
  unit: 'm' | 'cm' | 'mm' | 'ft' | 'in';
  rotationDerived: boolean; // whether 2-point also derived rotation correction
  calibratedAt: number;
  calibratedBy: string;     // userId
}

export interface ProviderMetadata {
  pdfPageNumber?: number;   // pdf-only
  imageOrientation?: number; // exif-only
  imageMimeType?: string;
  imageDecoderUsed?: 'native' | 'utif';
}
```

### 3.5 Polygon overlays (separated entity, FK→background)

```ts
export interface FloorplanOverlay {
  id: string;                              // ovrl_<ulid> via existing OVERLAY prefix
  companyId: string;                       // tenant isolation (immutable)
  backgroundId: string;                    // FK → floorplan_backgrounds (immutable)
  floorId: string;                         // FK → floor (denormalized for query speed)
  polygon: ReadonlyArray<Point2D>;         // pixel-space del background (Y-UP CAD)
  linkedPropertyId?: string;               // FK → property entity (optional)
  resolvedStatus?: PropertyStatus;         // denormalized for render
  label?: string;
  zIndex: number;                          // ordering when overlapping
  createdAt: number;
  updatedAt: number;
}
```

**Cascade rule (Q3 vincolante):**
- Delete `FloorplanBackground` → cascade delete tutti gli `FloorplanOverlay` con matching `backgroundId`.
- Delete `Floor` → cascade delete tutti i `FloorplanBackground` con matching `floorId` → cascade delete relativi overlays.
- Cancellazione del file in `files`: solo se nessun altro background lo riferisce (reference counting).

### 3.6 Replace flow (Q3 vincolante)

User uploads new file su κάτοψη già occupata:

1. Detect: `existing = await getBackgroundByFloorId(floorId)`
2. Se esiste:
   - `polygonCount = countOverlaysByBackgroundId(existing.id)`
   - Mostra `ReplaceConfirmDialog`:
     ```
     ⚠️ Υπάρχει ήδη background αρχείο "{existing.fileName}".
     Αν συνεχίσεις, θα διαγραφούν:
     • Το παλιό αρχείο
     • {polygonCount} polygons
     Σίγουρα θες να συνεχίσεις;

     [ Ακύρωση ]    [ Διαγραφή και αντικατάσταση ]
     ```
   - Conferma → `cascadeDeleteBackground(existing.id)` → `addBackground(newFile)` (atomic via Firestore batch)
   - Cancel → no-op
3. Se non esiste: `addBackground(newFile)` direttamente.

### 3.7 Calibration system (Layer 5 hook + Layer 7 dialog)

**Two-point calibration** (Q4: sempre disponibile):
1. User clicca "Calibration" sul pannello → entra modalità `calibrate`.
2. Click 1: pixel-space point A.
3. Click 2: pixel-space point B.
4. Dialog `CalibrationDialog`:
   ```
   📏 Calibration

   Distance pixel-space: 487.3 px (calculated)

   Real distance: [____] [m ▾]

   ☐ Set this line as horizontal (derive rotation)

   [ Cancel ]    [ Apply ]
   ```
5. Apply → hook calcola:
   - `pixelDist = ‖B − A‖`
   - `realDist = userInput * unitToMeters[unit]`
   - `scale = realDist / pixelDist` (uniform — `scaleX === scaleY`)
   - **Optional rotation correction:** se utente checkba "horizontal/vertical", deriva `rotation` da `atan2(B−A)` e roto-trasla.
6. Aggiorna `background.transform` e `background.calibration`.
7. **Polygon impact:** se ci sono polygons esistenti, applica `inverse(oldTransform) ∘ newTransform` ai vertices così rimangono nello stesso real-world spot. Confirm dialog opzionale "Anche i polygons saranno scalati di X%, continui?" se delta > 5%.

### 3.8 Persistence (Layer 3) — strong separation Procore-grade

**Storage path** (esistente, ADR-031, zero modifica):

```
companies/{companyId}/projects/{projectId}/entities/floor/{floorId}/
  domains/construction/categories/floorplans/files/{fileId}.{ext}
```

via `buildStoragePath({ companyId, projectId, entityType: 'floor', entityId: floorId, domain: 'construction', category: 'floorplans', fileId, ext })`.

**Firestore collection 1 — `files` (esistente, SSoT post ADR-292):**
- Documento `FileRecord` con `file_*` ID via `generateFileId()`.
- Generic metadata: `fileName`, `fileSize`, `mimeType`, `storagePath`, `uploaderId`, `uploadedAt`, `entityType`, `entityId`.
- **Zero modifiche** al schema esistente. Nessun campo "rasterBackground" iniettato.

**Firestore collection 2 — `floorplan_backgrounds` (NUOVA):**
- Path: `floorplan_backgrounds/{rbgId}` (top-level, tenant isolation via `companyId` field + Firestore rules).
- ID: `rbg_<ulid>` via NUOVO `generateFloorplanBackgroundId()`.
- Domain entity: transform + calibration + naturalBounds + provider info.
- FK: `fileId` → files, `floorId` → (concettuale, no Firestore-level FK).
- Indexed by `(companyId, floorId)` per look-up O(1) per κάτοψη.

**Firestore collection 3 — `floorplan_overlays` (NUOVA):**
- Path: `floorplan_overlays/{ovrlId}` (top-level, tenant isolation via `companyId`).
- ID: `ovrl_<ulid>` via existing `generateOverlayId()` (REUSE).
- Polygons + linked property.
- FK: `backgroundId` → floorplan_backgrounds.
- Indexed by `(companyId, backgroundId)`.

**Cascade delete** (server-side, atomic):
- `deleteFloorplanBackground(rbgId)`: Firestore batch
  1. Query overlays where `backgroundId == rbgId` → delete tutti
  2. Delete `floorplan_backgrounds/{rbgId}`
  3. Check reference count for `fileId` → se 1 (solo questo background), mark file for deletion
  4. Cloud Function trigger pulisce Storage path + delete `files/{fileId}` se reference count == 0

**Tenant isolation:** ogni doc ha `companyId` immutable. Firestore rules CHECK 3.10 enforced (queries devono includere `where('companyId', '==', auth.token.companyId)`).

### 3.9 ID prefixes & naming (SSoT compliant)

**NUOVO prefix** in `src/services/enterprise-id-prefixes.ts`:
```ts
RASTER_BACKGROUND: 'rbg',  // Floorplan background (PDF or Image) — twin of file
```

**NUOVO generator** in `src/services/enterprise-id.service.ts`:
```ts
export function generateFloorplanBackgroundId(): string {
  return `${ENTERPRISE_ID_PREFIXES.RASTER_BACKGROUND}_${ulid()}`;
}
```

**NUOVE collections** in `src/config/firestore-collections.ts`:
```ts
FLOORPLAN_BACKGROUNDS: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION || 'floorplan_backgrounds',
FLOORPLAN_OVERLAYS: process.env.NEXT_PUBLIC_FLOORPLAN_OVERLAYS_COLLECTION || 'floorplan_overlays',
```

**REUSE esistenti:**
- `OVERLAY: 'ovrl'` per polygon IDs
- `FILE: 'file'` per uploaded asset IDs
- `entityType: 'floor'` (già esistente in `ENTITY_TYPES`)
- `domain: 'construction'`, `category: 'floorplans'` (già esistenti in `FILE_DOMAINS` / `FILE_CATEGORIES`)

### 3.10 UI Panel (Layer 7) — single-target

`FloorplanBackgroundPanel` sostituisce `PdfControlsPanel`:

```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│  📄 Floor-A.pdf  (page 2/12)         [ ⋮ ]   │  ← active background
├──────────────────────────────────────────────┤
│  ▸ Page: [ < 2 / 12 > ]                     │  (pdf-only, hidden for image)
│  ▸ Scale: [████░░░░] 1.20×    [ Calibrate ] │
│  ▸ Rotation: [────●───] 15°                 │
│  ▸ Position: X: 0  Y: 0       [ Reset ]     │
│  ▸ Opacity: [██████░░] 0.8                  │
│  ▸ Visible: [▣]  Locked: [□]                │
│  ────────────────────────────────────────── │
│  [ Replace background... ]                  │
│  [ Remove background ]                      │
└──────────────────────────────────────────────┘
```

Pannello vuoto-state (κάτοψη senza background):
```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│                                              │
│  Δεν υπάρχει background.                    │
│                                              │
│  [ 📄 Φόρτωση PDF ]   [ 🖼 Φόρτωση Εικόνας ]│
│                                              │
│  Υποστήριξη: PDF, PNG, JPG, WEBP, TIFF      │
└──────────────────────────────────────────────┘
```

UI features:
- ⋮ menu: Rename, Replace, Calibrate, Export transform, Delete
- Page navigation visible **only if** `provider.capabilities.multiPage`
- Calibrate button **always visible** (Q4)
- Replace = trigger `ReplaceConfirmDialog` (Q3)

### 3.11 Capabilities matrix

| Provider     | multiPage | exifAware | vectorEquiv | calibratable | mimeTypes                                                       |
|--------------|-----------|-----------|-------------|--------------|------------------------------------------------------------------|
| `pdf-page`   | ✅        | ❌        | ✅          | ✅           | `application/pdf`                                                |
| `image`      | ❌        | ✅        | ❌          | ✅           | `image/png`, `image/jpeg`, `image/webp`, `image/tiff`           |

UI panel reagisce alla matrix: nasconde controlli irrilevanti per provider.

---

## 4. Migration plan (PDF → wrapped provider)

### 4.1 Wrapped store

`pdfBackgroundStore` rimane API-compatibile ma diventa **selector wrapper** sopra `floorplanBackgroundStore`:

```ts
// External selectors unchanged — internally derive from new store
export const usePdfBackgroundStore = () => {
  const bg = useFloorplanBackgroundStore(s => s.activeBackground);
  return useMemo(() => ({
    enabled: bg?.visible ?? true,
    opacity: bg?.opacity ?? 0.5,
    documentInfo: bg?.providerId === 'pdf-page' ? legacyDocInfo(bg) : null,
    currentPage: bg?.providerMetadata.pdfPageNumber ?? 1,
    transform: legacyPdfTransform(bg?.transform),
    renderedImageUrl: bg?.providerId === 'pdf-page' ? rendererCache.get(bg.id) : null,
    // ... etc
  }), [bg]);
};
```

I metodi mutativi (`loadPdf`, `setCurrentPage`, `setOpacity`, `setTransform`) traducono in azioni del nuovo store.

### 4.2 Old → new mapping

| Old (`pdfBackgroundStore`)             | New (`floorplanBackgroundStore`)                                  |
|----------------------------------------|----------------------------------------------------------------|
| `state.enabled`                        | `activeBackground.visible`                                     |
| `state.opacity`                        | `activeBackground.opacity`                                     |
| `state.documentInfo.fileName`          | `getFileRecord(activeBackground.fileId).fileName`              |
| `state.currentPage`                    | `activeBackground.providerMetadata.pdfPageNumber`              |
| `state.pageDimensions`                 | `activeBackground.naturalBounds`                               |
| `state.transform`                      | `activeBackground.transform` (mapped)                          |
| `state.renderedImageUrl`               | provider-internal (cached by provider, not store-exposed)      |
| `loadPdf(file)`                        | `addBackground({ providerId: 'pdf-page', source: { kind: 'file' } })` |
| `setCurrentPage(n)`                    | `setActivePage(backgroundId, n)`                               |
| `unloadPdf()`                          | `removeBackground(backgroundId)`                               |

### 4.3 Boy-scout migration sites

| File | Migration action | Phase |
|------|------------------|-------|
| `src/subapps/dxf-viewer/hooks/canvas/useFitToPdf.ts` | Rinomina → `useFitToBackground`, leggi `activeBackground` | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-renderer.ts` | Sostituisci con `floorplan-background-renderer.ts` (delegate al provider registry) | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` | Rinomina → `floorplan-overlay-renderer.ts`, accetta `bounds` da any provider | Phase 4 |
| `src/subapps/dxf-viewer/.../DxfCanvas.tsx` (consumer di PdfBackgroundCanvas) | Sostituisci con `FloorplanBackgroundCanvas` | Phase 5 |
| `src/components/shared/files/media/FloorplanGallery.tsx` | Aggiorna prop API (rinomina `pdfBounds` → `backgroundBounds`) | Phase 4 |
| `src/components/shared/files/media/useFloorplanCanvasRender.ts` | Adatta a provider-agnostic | Phase 4 |
| `src/components/shared/files/media/useFloorplanPdfLoader.ts` | Generalizza → `useFloorplanBackgroundLoader` | Phase 4 |

**Strategia:** Phase 1-3 lavorano in parallelo accanto al PDF subsystem (zero modifiche ai consumer). Phase 4 introduce il wrapper. Phase 5 sostituisce i canvas. Phase 6+ elimina il vecchio store.

### 4.4 Data migration

**Test data only** (memory: "All Firestore/Storage data is test. No backward compat needed"):
- Nessun migration script necessario.
- File PDF caricati nelle session precedenti: utente ricarica file da disco — workflow attuale (no persistence ancora).

---

## 5. Test strategy (ADR-298 / ADR-301 / ADR-294 compliant)

### 5.1 Provider contract tests

`src/subapps/dxf-viewer/floorplan-background/providers/__tests__/<provider>.contract.test.ts`

Ogni provider passa la stessa test-suite generica:
1. `loadAsync({ kind: 'file' })` con asset di test → `success: true`, `bounds` valido
2. `getNaturalBounds()` post-load → identico al risultato di `loadAsync`
3. `render()` con identity transform → primo pixel non-blank al centro del canvas
4. `dispose()` → no-op chiamato due volte
5. Capabilities boolean-coerenti con feature implementate
6. **ImageProvider TIFF-specific:** decode multi-strip TIFF con baseline pattern → bounds correct, render non-blank

### 5.2 Store integration tests

`src/subapps/dxf-viewer/floorplan-background/stores/__tests__/floorplanBackgroundStore.test.ts`

- Add background → state.activeBackground populated
- Add second on same floor → trigger replace flow event (no auto-overwrite)
- Calibrate → polygon vertices remap (via subscription mock)
- Cascade delete simulation: background deleted → overlays subscriber notified

### 5.3 Persistence integration tests

`src/services/floorplan-background/__tests__/persistence.integration.test.ts`

- Create background → write to `floorplan_backgrounds` + reference to existing `file_*` doc
- Cascade delete: background → all overlays gone, file ref-count decrement
- Replace flow atomicity: batch write — failure mid-way leaves no orphans
- Tenant isolation: companyId mismatch → query returns empty

### 5.4 Compositor visual regression

`src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.visual.test.ts` (Playwright + screenshot diff)

- PDF + identity transform → screenshot match baseline
- Image PNG + scale ×2 → match
- Image TIFF (utif decode) → bounds correct, render valid
- Calibration scale ×2 + polygons → polygons remap visually correct

### 5.5 Firestore rules tests (CHECK 3.16)

`tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts`
`tests/firestore-rules/suites/floorplan-overlays.rules.test.ts`

- Read same-company → ALLOW
- Read other-company → DENY
- Write same-company + edit-role → ALLOW
- Write same-company + viewer-role → DENY
- Write missing `companyId` → DENY (immutability check via `request.resource.data.companyId == request.auth.token.companyId`)

### 5.6 Storage rules tests (CHECK 3.15)

`tests/storage-rules/suites/floorplan-backgrounds.test.ts`

- Upload pdf same-company → ALLOW
- Upload tiff same-company → ALLOW
- Upload exe → DENY (mime allowlist)
- Upload >50MB → DENY (size cap)
- Read other-company → DENY

### 5.7 SSoT registry update (ADR-294)

Nuovo modulo `floorplan-background-system` in `.ssot-registry.json` Tier 2:
- `forbiddenPatterns`: `useState.*pdfBackground` fuori dal subsystem, `addDoc.*floorplan_backgrounds`, `addDoc.*floorplan_overlays`
- `canonicalImports`: `@/subapps/dxf-viewer/floorplan-background`, `@/services/floorplan-background`
- Baseline aggiornato: `npm run ssot:baseline`

---

## 6. Phases

| Phase | Scope | Files (~) | Ship gate |
|-------|-------|-----------|-----------|
| **1** | ADR + provider interface + contract test scaffold + provider registry + ID prefix + collections constants | ~10 NEW | ADR-340 PROPOSED merged, prefix/collections registered, zero consumer impact |
| **2** | `ImageProvider` (PNG/JPG/WEBP/TIFF via utif.js) + EXIF orientation + standalone demo | ~6 NEW + 2 deps install (`utif`, `exifr`) | Demo `/demo/floorplan-background-image` mostra TIFF + EXIF |
| **3** | `floorplanBackgroundStore` + `useFloorplanBackground` + `FloorplanBackgroundCanvas` + provider switching (PDF + Image), no persist | ~7 NEW | Demo multi-provider funzionante in-memory |
| **4** | PDF wrapper adapter + `useFitToBackground` + FloorplanGallery boy-scout migration | ~4 MODIFY + 2 NEW | DXF editor + FloorplanGallery operano sul nuovo store, vecchio API API-compat |
| **5** | `FloorplanBackgroundPanel` UI + `ReplaceConfirmDialog` + DxfCanvas integration | ~4 NEW + 2 MODIFY | Panel sostituisce `PdfControlsPanel`, replace flow funzionante |
| **6** | Calibration system (2-point) + `CalibrationDialog` + `useCalibration` + polygon remap on calibrate | ~5 NEW | Calibration funzionante su image + pdf con polygon-aware remap |
| **7** | Firestore + Storage persistence + rules + tests + cascade delete CF | ~10 NEW + rules.json + index.json + 1 Cloud Function | Persistence reload across sessions; tenant isolation provata; cascade delete atomic |
| **8** | Visual regression suite + a11y audit + SSoT registry + ADR finalize → ✅ IMPLEMENTED | ~6 NEW tests | Status `✅ IMPLEMENTED`; baseline locked; all tests green |

**Atomicità:** ogni phase è ship-able da sola. Phase 1-3 zero impact sui consumer. Phase 4 critical-path migration. Phase 5+ può scivolare nel tempo senza bloccare.

---

## 7. Architecture invariants (N.7.2 checklist)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — provider load = data fetched + validated prima di render; replace = explicit confirm not silent overwrite |
| 2 | Race condition possible? | **No** — store mutations sequenziali in immer; canvas RAF debounced; provider.loadAsync await prima di addBackground; cascade delete via Firestore batch (atomic) |
| 3 | Idempotent? | **Yes** — `addBackground` con stesso `(floorId, fileId)` deduplica; `setTransform` overwrite-safe; cascade delete idempotente |
| 4 | Belt-and-suspenders? | **Yes** — `floorplan_backgrounds.fileId` validato a runtime contro `files`; orphan-detection task (Phase 9 follow-up); persistence reload validates `naturalBounds` |
| 5 | Single Source of Truth? | **Yes** — `floorplanBackgroundStore` SSoT in-memory; `floorplan_backgrounds` SSoT in Firestore; `files` SSoT per binary metadata; `pdfBackgroundStore` solo lettura derivata |
| 6 | Fire-and-forget or await? | **Await** per loadAsync, persistence write, cascade delete (correctness); fire-and-forget per render-ready telemetry (Phase 9) |
| 7 | Who owns the lifecycle? | **`floorplanBackgroundStore`** in-memory; **`floorplan-background-persistence.service`** server-side; provider registry singleton stateless |

✅ **Google-level: YES** — provider abstraction industria-standard, single-target per κάτοψη (Q2 vincolante), strong-separation Procore-grade (Q5), calibration first-class (Q4), persistence tenant-scoped, replace explicit (Q3), test multi-livello, image format coverage Procore-level (Q6).

---

## 8. File size compliance (N.7.1)

| Module | Estimated LOC | Notes |
|--------|---------------|-------|
| `IFloorplanBackgroundProvider.ts` (types) | ~100 | types/config — no limit |
| `provider-registry.ts` | ~60 | OK |
| `PdfPageProvider.ts` | ~280 | wraps existing PdfRenderer, OK |
| `ImageProvider.ts` | ~340 | OK (decoder dispatch + EXIF + TIFF) |
| `floorplanBackgroundStore.ts` | ~380 | OK (single-target, no stack) |
| `FloorplanBackgroundCanvas.tsx` | ~280 | OK (single-target rendering) |
| `FloorplanBackgroundPanel.tsx` | ~360 | OK |
| `CalibrationDialog.tsx` | ~280 | OK |
| `ReplaceConfirmDialog.tsx` | ~140 | OK |
| `useCalibration.ts` | ~180 | OK |
| `useFloorplanBackground.ts` | ~150 | OK |
| `useFitToBackground.ts` | ~80 | OK |
| `floorplan-background-persistence.service.ts` | ~420 | OK |

Tutti ≤500 LOC, target funzioni ≤40 LOC. Helpers estratti se necessario.

---

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration breaks existing PDF flows | **HIGH** | Phase 4 wrapper preserves API exactly; contract tests over wrapper boundary; FloorplanGallery pixel-diff baseline |
| Calibration math wrong → polygons drift | **HIGH** | Pure helpers + property-based tests (fast-check), visual regression with known-good fixtures, polygon remap confirm dialog if delta >5% |
| TIFF decoder crash on malformed input | **MED** | `utif.js` wrapped in try/catch, fallback error UI "TIFF non leggibile, prova PNG/JPG"; size cap 50MB |
| EXIF orientation rotates pin polygons unexpectedly | **MED** | Provider applies orientation pre-render, store baseline = post-orientation natural bounds; documented invariant |
| Storage cost spike (large TIFF files) | **MED** | 50 MB cap + per-company quota counter (Phase 9 follow-up) |
| Firestore index over-cost | **LOW** | Singolo composite `(companyId ASC, floorId ASC)` su backgrounds, `(companyId ASC, backgroundId ASC)` su overlays — sotto quota |
| Replace flow race (double-click) | **MED** | Confirm dialog button disabled during async cascade; idempotent `cascadeDeleteBackground(rbgId)` returns success if not found |
| FloorplanGallery breaks during Phase 4 | **HIGH** | Boy-scout same commit del wrapper; smoke-tests pre/post; PDF baseline pixel-diff |
| Cascade delete leaves orphan storage file | **MED** | Cloud Function trigger su delete `files/{fileId}` quando reference count == 0; nightly orphan-detection job (Phase 9) |
| pdf.js worker hot-reload regression | **LOW** | Già self-hosted (`/pdf.worker.min.mjs`); ImageProvider has no worker dep |

---

## 10. Open questions — RESOLVED (clarification round 2026-05-07)

> Tutte le domande aperte sono state risolte con Giorgio. Riepilogo vincolante.

| # | Domanda | Decisione | Memo |
|---|---------|-----------|------|
| **Q1** | Persistence scope | **Per κάτοψη ορόφου.** Niente altrove nell'app. | Multi-level units (μεζονέτα, κατάστημα) hanno N κατόψεις indipendenti — codice già esistente. |
| **Q2** | Quanti file per κάτοψη | **1 (singolo).** PDF *o* Image *o* DXF (il DXF rimane nel suo subsystem). | Niente stack multi-layer. Niente z-order. Niente reorder. |
| **Q3** | Replace flow su κάτοψη già occupata | **Confirm dialog + cascade delete.** | "Θα χαθούν τα N polygons. Συνεχίζεις;" — yes → atomic batch delete + new upload. No → cancel. |
| **Q4** | Calibration scope | **Sempre disponibile** per entrambi PDF e Image. | Bottone Calibrate sempre visibile. Default scale identity se utente non calibra. |
| **Q5** | Storage / collection / ID | **Strong-separation Procore/SAP-grade.** `files` (esistente, generic) + `floorplan_backgrounds` (NUOVA, domain entity, ID `rbg_<ulid>`) + `floorplan_overlays` (NUOVA, polygons, ID `ovrl_<ulid>` reuse). FK relationships. | Storage path via `buildStoragePath()` esistente, zero modifica. |
| **Q6** | Image formats | **PNG + JPEG + WEBP + TIFF.** | TIFF via `utif.js` (MIT). Procore-level coverage. AVIF/GIF/BMP esclusi. |

---

## 11. Library license check (N.5)

| Library | Use | License | Verdict |
|---------|-----|---------|---------|
| `pdfjs-dist@4.5.136` | PDF rendering | Apache-2.0 | ✅ already in tree |
| `utif@3.x` | TIFF decode | MIT | ✅ to install Phase 2 (~30KB gzip) |
| `exifr@7.x` | EXIF orientation read | MIT | ✅ to install Phase 2 (~10KB gzip) |

---

## 12. References

- **ADR-002** — Z-index hierarchy
- **ADR-031** — Canonical File Storage System (`buildStoragePath`)
- **ADR-292** — FILES collection unification
- **ADR-294** — SSoT ratchet enforcement
- **ADR-298** — Firestore rules test coverage SSoT
- **ADR-301** — Storage rules test coverage SSoT
- **SPEC-237D** — Overlay support on PDF backgrounds (carries over)
- **SOS. SOS. N.0.1** — ADR-driven workflow 4-phase
- **SOS. SOS. N.6** — Enterprise IDs (new generator `generateFloorplanBackgroundId`)
- **SOS. SOS. N.7.1 / N.7.2** — File size + architecture checklist
- **SOS. SOS. N.11** — i18n SSoT (all panel strings via `t()`)
- **SOS. SOS. N.12** — SSoT ratchet (new module in registry)

---

**Next step:** Phase 1 implementation (provider interface + registry + ID prefix + collections constants + ADR commit). Wait for Giorgio's "go" before starting.
