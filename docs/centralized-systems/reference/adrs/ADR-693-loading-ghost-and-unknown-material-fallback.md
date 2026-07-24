# ADR-693 — Το σιωπηλό «σκυρόδεμα» ως default υλικό + η κατάσταση φόρτωσης εισαγόμενου μοντέλου

**Status:** 🟡 **ΠΛΑΝΟ (Φ1 προτεινόμενο)** — 2026-07-24. Αναμονή «προχώρα» από Giorgio. Commit = Giorgio.
**Date:** 2026-07-24
**Owner:** Giorgio
**Execution mode:** Plan Mode (N.8: ~9 αρχεία / 3 domains — απόφαση Giorgio 2026-07-24)
**Σχετικά (parents):** **ADR-411** (`mesh-to-object3d`, bbox placeholder) · **ADR-683** Φ3 (imported-mesh) · **ADR-413** §2D (swatch → slug → albedo) · **ADR-687** Φ6/Φ7/Φ8 (offscreen sphere thumbnail, «Υλικά όψης») · **ADR-691** Φ3 (swatch precedence) · **ADR-366** §7.1 (`MATERIAL_DEFS`) · **ADR-410** (έπιπλα) · **ADR-406/408** (Η/Μ)

---

## 1. Πρόβλημα (Giorgio, browser 2026-07-24 22:45)

Μετά την εισαγωγή του `abricos_gerbera.dae` (24 αντικείμενα), δύο **οπτικά** προβλήματα — η
λειτουργικότητα του ADR-691 δουλεύει:

1. **Δύο swatches σπασμένα.** Στη μπάρα «Υλικά όψης» τα `Mat #4` και `Mat.3` εμφανίζονται ως
   **broken-image icon**· τα άλλα 4 (κόκκινο + 3 υφές) δείχνουν σωστά.
2. **Σκυρόδεμα κατά τη φόρτωση.** Πριν ολοκληρωθεί το rendering, **ΟΛΑ** τα εισαγόμενα κομμάτια
   εμφανίζονται ως γκρι **τσιμεντένιοι όγκοι** (screenshot `Στιγμιότυπο οθόνης 2026-07-24 224556.jpg`)
   και μετά «γίνονται» το κανονικό μοντέλο.

---

## 2. Ground truth — η ρίζα, μετρημένη στον κώδικα

```
src/subapps/dxf-viewer/bim/materials/material-catalog-defs.ts:164
export const DEFAULT_MATERIAL_KEY = 'mat-concrete';

:170  export function resolveMaterialKey(materialId: string): string {
:171    for (const prefix of Object.keys(MATERIAL_DEFS)) {
:172      if (materialId.startsWith(prefix)) return prefix;
:173    }
:174    return DEFAULT_MATERIAL_KEY;      // ← ΚΑΘΕ άγνωστο id → ΣΚΥΡΟΔΕΜΑ
:175  }
```

### 2.1 Πρόβλημα #2 — ΑΠΟΔΕΔΕΙΓΜΕΝΟ (screenshot = ground truth, δεν χρειάστηκε browser)

| # | Αρχείο:γραμμή | Τι συμβαίνει |
|---|---|---|
| 1 | `bim-3d/converters/imported-mesh-to-three.ts:52` | `matId: 'elem-imported-mesh'` |
| 2 | `bim-3d/converters/mesh-to-object3d.ts:141` | `new THREE.Mesh(geo, getMaterial3D(matId))` |
| 3 | `bim-3d/materials/MaterialCatalog3D.ts:221` | δεν είναι `bmat_` → `resolveMaterialKey('elem-imported-mesh')` |
| 4 | `material-catalog-defs.ts:174` | **κανένα** prefix δεν ταιριάζει → `'mat-concrete'` |
| 5 | `MaterialCatalog3D.ts:88-104` | realistic ON → `textureSlugForKey('mat-concrete')` |
| 6 | `bim-texture-registry.ts:185` | `'mat-concrete' → 'concrete'` → **η φωτογραφία `concrete_floor_02`** |
| 7 | `mesh-to-object3d.ts:142-143,158-161` | `castShadow = receiveShadow = true` → ο ghost **ρίχνει σκιά** σαν πραγματικός όγκος |

**Grep: το `elem-imported-mesh` δεν υπάρχει πουθενά στο `MATERIAL_DEFS`** — μόνο 2 hits σε ΟΛΟ το
`src/`: ο converter + ένα test. Άρα το κουτί φόρτωσης δεν είναι «ουδέτερο γκρι»· είναι **κυριολεκτικά
ντυμένο σκυρόδεμα, με σκιές**. Ακριβώς η εικόνα του Giorgio.

> **Γιατί το έπιπλο ΔΕΝ έχει το πρόβλημα:** το `elem-furniture` **υπάρχει** στο `MATERIAL_DEFS`
> (`furniture-to-three.ts:39`) και **δεν** έχει texture slug → flat καφέ κουτί. Το εισαγόμενο πλέγμα
> είναι ο **μόνος** mesh-based τύπος που πέφτει στο κενό. Τυχαία διαφορά, όχι σχεδιασμός.

### 2.2 SSoT audit — ΟΛΟΙ οι καλούντες του `resolveMaterialKey` (grep, 2026-07-24)

| # | Call site | Φρουρημένο; | Τι δίνει σε ξένο/`bmat_*` id |
|---|---|---|---|
| 1 | `MaterialCatalog3D.ts:221` `getMaterial3D` | ✅ `bmat_` early-return | concrete (by design, catalog path) |
| 2 | `MaterialCatalog3D.ts:244` `getRoofTileMaterial3D` | ✅ (μόνο `mat-roof-tile`) | — |
| 3 | `MaterialCatalog3D.ts:347` `hasFaceTexture` | ✅ `mat-`/`elem-` gate | `false` (σωστά) |
| 4 | `MaterialCatalog3D.ts:113` `getResolvedTextureKeyForMaterialId` | — passthrough | concrete |
| 5 | `bim-texture-registry.ts:240` `tileSizeMForMaterialId` | ❌ | concrete tileSize |
| 6 | `material-thumbnail-resolver.ts:45` **`slugForMaterialId`** | ❌ | **`'concrete'` → η υφή σκυροδέματος ως swatch** |
| 7 | `material-thumbnail-spec.ts:65` **`resolveThumbnailTextureSet`** | ✅ `bmat_` gate, ❌ ξένα ids | concrete texture set στη σφαίρα |
| 8 | `material-thumbnail-spec.ts:76` **`preloadThumbnailTextures`** | ✅ `bmat_` gate, ❌ ξένα ids | φορτώνει άσκοπα concrete |

**Συμπέρασμα:** το ίδιο bug, **τρεις φορές** (#6/#7/#8), στο μονοπάτι του swatch. Το `resolveThumbnailDef`
(`material-thumbnail-spec.ts:51`) **ήδη** εξαιρεί ρητά τα `bmat_*` — η ίδια εξαίρεση **λείπει** από τους
αδελφούς του. Κλασικό sibling gap.

### 2.3 Πρόβλημα #1 — δύο υποψήφιοι μηχανισμοί (🔴 εκκρεμεί ground truth)

Firestore (query handoff §2): `Mat #4` = `{#cccccc, rough 1, metal 0, op 1}`, `Mat.3` = `{#ffffff, …}`,
και οι δύο **`pbrTextures.albedoUrl: null`**. Τα δεδομένα είναι **σωστά** — το πρόβλημα είναι στο render.

Ροή στο `MaterialSwatch.tsx:95-124` για `bmat_*` με `appearance` και χωρίς υφή:

```
slug              = slugForMaterialId('bmat_…')        → 'concrete'   ← ΚΑΛΟΥΝ #6 παραπάνω
resolvedAlbedoUrl = <URL υφής σκυροδέματος>
sphereSet         = getUserMaterialTextureSet(id)      → null
sphereThumb       = <offscreen sphere PNG> ή null
url = thumbnailUrl || preferredSphere || albedoUrl || sphereThumb || resolvedAlbedoUrl
                                                                      └─ το τελευταίο δίχτυ = ΣΚΥΡΟΔΕΜΑ
```

| Υπόθεση | Μηχανισμός | Απόδειξη που τη διακρίνει |
|---|---|---|
| **(Α)** offscreen sphere | `WebGLRenderer.domElement.toDataURL()` σε **χαμένο GL context** επιστρέφει τη συμβολοσειρά **`"data:,"`** — που είναι **truthy** → μπαίνει στο `urls` cache του `material-appearance-thumbnail-store.ts:53` **μόνιμα** → `<img src="data:,">` = **broken-image icon**. Εξηγεί μερική αποτυχία (2 από 6): οι browsers κόβουν το ~16ο ταυτόχρονο WebGL context. | `img.src === 'data:,'` ή `naturalWidth === 0` σε data-URL |
| **(Β)** slug fallback | Ο sphere γύρισε `null` → `failed` → το url πέφτει στο `resolvedAlbedoUrl` = υφή σκυροδέματος, και **αυτό** το URL 404άρει στο τρέχον mode (`texture-source.ts` public ↔ storage). | `img.src` περιέχει `textures/concrete/albedo` |

**Ελεγκτής (DevTools → Console, στην καρτέλα με το μοντέλο):**

```js
[...document.querySelectorAll('img[aria-hidden="true"]')]
  .map(i => [i.closest('button')?.innerText.trim(), i.src.slice(0,60), i.naturalWidth])
```

⚠️ Και οι δύο υποθέσεις είναι **πραγματικά ελαττώματα** και κλείνουν **και οι δύο** στο Φ1 — το ground
truth καθορίζει ποιο ήταν η **ρίζα** και ποιο το **δίχτυ ασφαλείας**, όχι το αν διορθώνεται.

---

## 3. Big-player benchmark — τι δείχνουν οι μεγάλοι όσο φορτώνει γεωμετρία

| Εφαρμογή | Κατάσταση φόρτωσης |
|---|---|
| **Revit** (linked model / cloud) | Τίποτα, ή **wireframe bounding box**. Ποτέ ψεύτικο υλικό. |
| **ArchiCAD** (Hotlink) | Placeholder **περίγραμμα** με ρητή ένδειξη «loading». |
| **Cinema 4D** (proxy / Alembic) | **Bounding box** ή low-res proxy, οπτικά ουδέτερο. |
| **Autodesk Platform Services Viewer / Speckle** | Progressive streaming· ό,τι δεν φόρτωσε **δεν ζωγραφίζεται**, ή ημιδιάφανο ουδέτερο. |
| **Figma** (εικόνες) | **Skeleton / ουδέτερο shimmer**. Ποτέ «τυχαίο» περιεχόμενο. |
| **Sketchfab / three.js παραδείγματα** | Ουδέτερο `MeshBasicMaterial` wireframe ή τίποτα + progress bar. |

**Ο κανόνας που προκύπτει (και ο λόγος που ο Giorgio μπερδεύτηκε):** μια κατάσταση φόρτωσης πρέπει να
**φαίνεται σαν κατάσταση φόρτωσης**. Ένα αληθοφανές υλικό (σκυρόδεμα, με σκιές) είναι **χειρότερο από
το τίποτα**, γιατί ο χρήστης δεν μπορεί να ξεχωρίσει «φορτώνει» από «αυτό ΕΙΝΑΙ σκυρόδεμα».

### 3.1 Πού ξεπερνάμε τους μεγάλους

Το Revit δείχνει bounding box **χωρίς σωστές διαστάσεις** μέχρι να διαβάσει το linked αρχείο. Εμείς
έχουμε **ήδη** τα per-node `measuredWidthMm/DepthMm/HeightMm` **αποθηκευμένα στην οντότητα** (ADR-683)
— άρα το ghost έχει **σωστό μέγεθος και σωστή θέση από το πρώτο καρέ**, χωρίς καμία αναμονή δικτύου.
Αυτό ήδη ισχύει σήμερα· το μόνο που λείπει είναι να **φαίνεται** σαν ghost αντί για σκυρόδεμα.

---

## 4. Απόφαση

### Άξονας Α — «άγνωστο ≠ σκυρόδεμα», χωρίς άγγιγμα του global default

**Το `DEFAULT_MATERIAL_KEY` ΜΕΝΕΙ `'mat-concrete'`** (απόφαση Giorgio 2026-07-24). Τοίχοι, πλάκες,
θεμελιώσεις και DNA layers βασίζονται **σιωπηλά** πάνω του σε 8 call sites· αλλαγή του = οπτική
παλινδρόμηση σε όλο το BIM για μηδενικό κέρδος στα δύο συμπτώματα.

**Α1.** Νέα `resolveMaterialKeyOrNull(materialId): string | null` στο **ίδιο** SSoT αρχείο
(`material-catalog-defs.ts`) — **ΜΙΑ** υλοποίηση του prefix match. Το `resolveMaterialKey` γίνεται
λεπτό wrapper `?? DEFAULT_MATERIAL_KEY` → **μηδέν** αλλαγή συμπεριφοράς για τους 8 υπάρχοντες
καλούντες, **μηδέν** διπλότυπος βρόχος (N.18).

**Α2.** Τα 3 αφρούρητα σημεία του swatch μονοπατιού (#6/#7/#8 του §2.2) περνούν στο `…OrNull`:
- `slugForMaterialId('bmat_…')` → **`null`** (ένα user υλικό **δεν έχει ποτέ** DNA prefix — το να του
  δίνουμε την υφή σκυροδέματος είναι λάθος **εξ ορισμού**· το `resolveThumbnailDef` ήδη το εξαιρεί).
- `resolveThumbnailTextureSet` / `preloadThumbnailTextures` → **`null`** / no-op για ξένα ids.

**Α3.** Ρητό def `'elem-imported-mesh'` στο `MATERIAL_DEFS`: ουδέτερο ανοιχτό γκρι, matte, **χωρίς
καταχώριση στο `MATERIAL_TEXTURE_MAP`** → ποτέ υφή. Δίχτυ ασφαλείας για **κάθε άλλο** μονοπάτι που
ρωτά το υλικό ενός εισαγόμενου (π.χ. `section-cut-cap-groups.ts:62` → `resolveHatchKey(userData.matId)`,
2D χρώμα). Ασφαλές ως προς τη σειρά: κανένα υπάρχον κλειδί δεν είναι prefix του, ούτε αυτό των άλλων.

### Άξονας Β — ένα SSoT «φορτώνει» ghost για ΟΛΕΣ τις mesh-based οντότητες

**Νέο** `bim-3d/materials/loading-placeholder-material.ts` — ένα cached singleton:
ουδέτερο γκρι, `transparent: true, opacity ≈ 0.28`, `depthWrite: false`, `side: DoubleSide`,
`roughness 1 / metalness 0`, **καμία υφή**, `toneMapped` όπως τα υπόλοιπα. Δεν μπαίνει στο
`MATERIAL_DEFS` — **δεν είναι υλικό, είναι κατάσταση UI**· αν έμπαινε, θα γινόταν επιλέξιμο/βαφόμενο.

**Καταναλωτής: `mesh-to-object3d.ts::buildPlaceholder`** — το **ΕΝΑ** σημείο απ' όπου περνούν **όλες**
οι mesh-based οντότητες (εισαγόμενα ADR-683, έπιπλα ADR-410, εξαρτήματα Η/Μ ADR-406/408). Ίδιο
σκεπτικό με το `attachMeshWireframe` στο `finalize` (ADR-689 Φ3): **ένα call site → καμία οντότητα δεν
μπορεί να ξεχαστεί**. (Απόφαση Giorgio 2026-07-24: εύρος = ΟΛΕΣ, όχι μόνο τα εισαγόμενα — δύο
διαφορετικές «γλώσσες φόρτωσης» στην ίδια σκηνή είναι ακριβώς η σκόρπια συμπεριφορά που απαγορεύει
ο N.0.2.)

**Β1.** Το `buildPlaceholder` **παύει** να καλεί `getMaterial3D(matId)`. Το `matId` συνεχίζει να
σφραγίζεται στο `userData` (το διαβάζουν τα section cuts) — αλλάζει **μόνο** τι ζωγραφίζεται.

**Β2.** **Καμία σκιά.** Ένα ghost δεν ρίχνει και δεν δέχεται σκιά. Σήμερα το `buildPlaceholder`
(:142-143) **και** το `tagObject` (:158-161) βάζουν `castShadow/receiveShadow = true` — το `tagObject`
θα σέβεται τη σημαία `userData.bimLoadingGhost` αντί να την ξαναγράφει.

**Β3.** **Περίγραμμα** (`EdgesGeometry` + `LineSegments`) ώστε ο ημιδιάφανος όγκος να διαβάζεται ως
«κουτί που φορτώνει» και όχι ως αχνό αντικείμενο — η πρακτική ArchiCAD Hotlink / C4D proxy. Το
περίγραμμα παίρνει `raycast = () => {}` (three.js idiom) ώστε **να μην συμμετέχει σε picking ή στο 3D
marquee** (ADR-692, υπό εξέλιξη από άλλον agent — μηδέν επιφάνεια σύγκρουσης).

### Άξονας Γ — κανένα σπασμένο swatch, ποτέ (belt-and-suspenders, N.7.2 #4)

**Γ1 (ρίζα, υπόθεση Α).** `material-thumbnail-sphere.ts`: πριν επιστρέψει, ελέγχει
`gl.isContextLost()` **και** απορρίπτει εκφυλισμένα data URLs (`'data:,'` / χωρίς `base64,` payload)
→ `null`. Επιπλέον, σε χαμένο context **ανακτά** (dispose + rebuild του singleton) αντί να
δηλώνει μόνιμη αποτυχία — σήμερα το `unavailable` είναι one-way.

**Γ2 (ρίζα, υπόθεση Β).** Καλύπτεται ήδη από το **Α2**: χωρίς το `slugForMaterialId → 'concrete'`,
το τελευταίο σκαλί του `url` precedence γίνεται `null` → **flat colour chip**, όχι σπασμένη εικόνα.

**Γ3 (δίχτυ).** `MaterialSwatch.tsx`: `onError` στο `<img>` → local state → πέφτει στο flat colour
chip. Ό,τι κι αν σπάσει στο μέλλον (404 Storage URL, expired signed URL, χαμένο context), ο χρήστης
βλέπει **χρώμα**, ποτέ broken-image icon. Αυτό είναι το Revit/Figma συμβόλαιο.

---

## 5. Τι ΔΕΝ κάνουμε (και γιατί)

| Απόρριψη | Λόγος |
|---|---|
| Αλλαγή του `DEFAULT_MATERIAL_KEY` σε ουδέτερο | 8 call sites, cross-cutting· τοίχοι/πλάκες/θεμελιώσεις ζωγραφίζονται concrete μέσω σιωπηλού fallback. Απόφαση Giorgio. |
| «Μην ζωγραφίζεις τίποτα μέχρι να φορτώσει» (Revit/Speckle) | Ο Giorgio εισάγει 24 αντικείμενα ταυτόχρονα — ολική απουσία διαβάζεται ως **αποτυχία εισαγωγής**. Το ghost με σωστές διαστάσεις είναι η σωστή ισορροπία. |
| Wireframe-only ghost | Έχουμε ήδη άξονα «Συρμάτινο/Κρυφή Γραμμή» (ADR-689 Φ3). Ένα wireframe placeholder θα ήταν **οπτικά αδιάκριτο** από ένα ενεργό Visual Style. |
| Progressive fade-in ανά κόμβο | Χρειάζεται RAF hook στο 3D → ADR-040-ευαίσθητο. **Φ2**, ξεχωριστά. |
| Να ξαναβαφτεί η γεωμετρία με `faceAppearance` | Ρητά απορριφθέν στο ADR-691 §3.α — **ΜΗΝ το αναιρέσεις.** |

---

## 6. Αρχεία

**NEW**
- `bim-3d/materials/loading-placeholder-material.ts` — το ghost SSoT (Β)
- `bim-3d/materials/__tests__/loading-placeholder-material.test.ts`

**EDIT**
- `bim/materials/material-catalog-defs.ts` — `resolveMaterialKeyOrNull` (Α1) + `elem-imported-mesh` def (Α3)
- `bim/materials/material-thumbnail-resolver.ts` — `slugForMaterialId` → null (Α2)
- `bim-3d/preview/material-thumbnail-spec.ts` — 2 call sites → null/no-op (Α2)
- `bim-3d/converters/mesh-to-object3d.ts` — ghost + shadows + outline (Β1/Β2/Β3)
- `bim-3d/preview/material-thumbnail-sphere.ts` — context-loss recovery + degenerate data URL (Γ1)
- `ui/components/shared/MaterialSwatch.tsx` — `onError` → flat chip (Γ3)

**TESTS**
- `bim/materials/__tests__/material-catalog-defs.test.ts` (+ `…OrNull`, `elem-imported-mesh`)
- `bim-3d/preview/__tests__/material-thumbnail-spec.test.ts` (ξένα ids → null)
- `bim-3d/converters/__tests__/mesh-to-object3d.test.ts` (ghost, όχι concrete, όχι σκιές)
- `ui/components/shared/__tests__/MaterialSwatch.test.tsx` (onError → flat· `bmat_*` → όχι concrete)

**Μηδέν επικάλυψη** με τα αρχεία του ADR-692 (3D marquee, άλλος agent στο ίδιο working tree).
**Μηδέν** νέο i18n κλειδί (Φ1 = καθαρά οπτικό· ο τρέχων toast «Εισήχθησαν N αντικείμενα» αρκεί).

---

## 7. N.7.2 — Google-level checklist

| # | Ερώτηση | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive; | **Proactive** — το ghost χτίζεται στο ίδιο καρέ με το cache miss, από ήδη αποθηκευμένες διαστάσεις. Καμία αναμονή δικτύου. |
| 2 | Race condition; | **Όχι** — καθαρά συναρτησιακό· ο υπάρχων `preload → store bump → resync` κύκλος μένει ανέγγιχτος. |
| 3 | Idempotent; | **Ναι** — cached singletons (υλικό + geometry), κάθε rebuild δίνει το ίδιο αποτέλεσμα. |
| 4 | Belt-and-suspenders; | **Ναι** — Α3 (ρητό def) + Β (ghost) + Γ1 (recovery) + Γ3 (`onError`): τέσσερα ανεξάρτητα στρώματα, κανένα δεν εξαρτάται από τα άλλα. |
| 5 | SSoT; | **Ναι** — ΜΙΑ υλοποίηση prefix match (Α1), ΕΝΑ ghost υλικό, ΕΝΑ call site placeholder. |
| 6 | Await ή fire-and-forget; | Αμετάβλητο — η φόρτωση mesh/υφών μένει fire-and-forget με resync (σωστό: μη-μπλοκάρον side effect). |
| 7 | Ποιος κατέχει τον κύκλο ζωής; | **Ρητά:** `mesh-to-object3d` κατέχει το placeholder, `loading-placeholder-material` κατέχει το ghost υλικό, `material-catalog-defs` κατέχει την επίλυση κλειδιού. |

---

## 8. Επαλήθευση

- **jest:** τα 4 test αρχεία παραπάνω + πλήρη regression στα `bim/materials`, `bim-3d/converters`,
  `bim-3d/preview`, `ui/components/shared`.
- **N.18:** `npm run jscpd:diff <staged src>` πριν δηλωθεί «done».
- **N.17:** κανένα `tsc` από τον πράκτορα.
- **🔴 Browser (Giorgio):** (α) ο ελεγκτής του §2.3 **πριν** τη διόρθωση → καταγράφεται ποια υπόθεση
  ίσχυε· (β) μετά: εισαγωγή `.dae` → τα κομμάτια εμφανίζονται ως **ημιδιάφανα ghost με περίγραμμα**,
  ποτέ σκυρόδεμα· (γ) και τα 6 swatches δείχνουν εικόνα ή χρώμα, **κανένα** broken icon.

---

## 9. Changelog

| Ημ/νία | Φάση | Τι |
|---|---|---|
| 2026-07-24 | — | ADR δημιουργήθηκε (Plan Mode). SSoT audit των 8 καλούντων του `resolveMaterialKey`· πρόβλημα #2 αποδείχθηκε πλήρως στον κώδικα· πρόβλημα #1 περιορίστηκε σε 2 υποψήφιους μηχανισμούς + ελεγκτής DevTools. Αναμονή «προχώρα». |
