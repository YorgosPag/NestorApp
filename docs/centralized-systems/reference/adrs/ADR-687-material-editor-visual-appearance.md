# ADR-687 — Material Editor «Εμφάνιση»: C4D-parity visual appearance (χρώμα + γυαλάδα + μέταλλο + υφή, ανά υλικό)

**Status:** 🟢 Φ1 + HDR-studio-preview + Φ4 IMPLEMENTED (2026-07-23, Opus 4.8· **UNCOMMITTED** — εκκρεμεί browser verify + commit Giorgio). Φ2/Φ3 = PROPOSED· Φ5 (clearcoat/transmission) = out-of-scope μέχρι έγκριση.
**Μοντέλο:** Opus 4.8 · **Γλώσσα:** Ελληνικά
**Σχετικά:** ADR-363 (Material Library), ADR-413 (PBR textures), ADR-539 (per-face paint), ADR-686 (imported appearance override), ADR-683 §10.10 (imported DoubleSide)

---

## 1. Το αίτημα (Giorgio, 2026-07-23, με 2 screenshots C4D vs Νέστωρ)

Στο **Cinema 4D**, διπλό κλικ σε ένα υλικό ανοίγει το **Material Editor** panel — ο χρήστης φτιάχνει υλικά
**ένα-ένα** με πλήρη έλεγχο: χρώμα (εκατομμύρια, όχι preset swatches), γυαλάδα/ματ, μεταλλικότητα,
φωτογραφία υφής, όνομα, σφαίρα-preview. Ο Giorgio θέλει το ίδιο: **«να καταχωρούμε τα υλικά ένα-ένα»**,
όχι 4-5 fixed swatches «Μπογιά». Ρητή απόφαση (ερωτήσεις 2026-07-23):
- **Μοντέλο: PBR** (σύγχρονο big-player — Blender Principled / Sketchfab / Revit / C4D R20+), **όχι** τα 13
  legacy channels του C4D R15 (Specular/Glow/Fog — ο three.js engine μας δεν τα υποστηρίζει).
- **Καταχώρηση ολόκληρων υλικών** (όχι σκέτα χρώματα): χρώμα + γυαλάδα + μέταλλο + υφή + όνομα + preview.
- **Σταδιακά**, με ADR πρώτα.

## 2. Τι ΥΠΑΡΧΕΙ ΗΔΗ (audit grep-anchored — το 80% υπάρχει, ΜΗΝ ξαναχτίσεις)

| Κομμάτι | Αρχείο | Κατάσταση |
|---|---|---|
| **Full color picker** (HSV/RGB/HEX, eyedropper, recent, palettes, contrast) | `ui/color/EnterpriseColorPicker.tsx` + `EnterpriseColorDialog.tsx` | ✅ Enterprise-grade, ήδη σε χρήση (text-toolbar + PolygonMaterialPanel custom-color) |
| **Material Library panel** (5η tab «Υλικά»: list/filter/search/CRUD) | `ui/panels/materials/MaterialsLibraryPanel.tsx` (mount: `usePanelContentRenderer.tsx:133`) | ✅ Υπάρχει |
| **Material Editor dialog** (create/edit, scope, validate) | `ui/panels/materials/MaterialEditorDialog.tsx` + `MaterialEditorSections.tsx` | ✅ Υπάρχει |
| **PBR textures upload** (albedo/normal/roughness/ao + tileSize) | `MaterialPbrTexturesSection.tsx` + `hooks/useMaterialPbrTextureUpload.ts` + `bim-material-texture-upload.service.ts` | ✅ Υπάρχει |
| **Thumbnail upload** (appearance εικονίτσα) | `bim-material-thumbnail-upload.service.ts` | ✅ Υπάρχει |
| **Persistence** (`saveMaterial`/`updateMaterial`, enterprise-id, scope project/company) | `bim/services/MaterialLibraryService.ts` | ✅ Υπάρχει |
| **Render feed** (bim_materials → 3D catalog, texture load/resync) | `bim-3d/materials/user-material-registry.ts` | ✅ Υπάρχει |
| **Per-face apply** (βάψε όψη/σώμα με materialId/colorHex, undo) | `bim-3d/ui/apply-face-appearance.ts` + `SetFaceAppearanceCommand` | ✅ Υπάρχει |
| **Swatch μπάρα** «Υλικά όψης» (catalog + user library + paints) | `bim-3d/ui/PolygonMaterialPanel.tsx` + `polygon-material-swatches.ts` | ✅ Υπάρχει |

## 3. Το ΚΕΝΟ (τι πραγματικά λείπει — 4 σημεία)

1. **Per-material appearance ΔΕΝ υπάρχει.** Το `BimMaterial` schema (`bim/types/bim-material-types.ts`)
   κρατά `category` + `pbrTextures`, **όχι** δικό του χρώμα/γυαλάδα/μέταλλο. Το appearance παράγεται από
   την **κατηγορία** (`getCategoryMaterialDef` → `material-catalog-defs.ts`: `mat-concrete` = γκρι/rough
   0.80, `mat-metal` = 0.90 metalness κ.λπ.). Άρα ο χρήστης **δεν** μπορεί να πει «αυτό το συγκεκριμένο
   χρώμα + αυτή τη γυαλάδα» — μόνο να διαλέξει κατηγορία + να ανεβάσει textures. **Αυτό είναι ο πυρήνας.**
2. **Καμία σφαίρα-preview** στο editor (το C4D την έχει· εμείς δείχνουμε μόνο flat swatch/thumbnail).
3. **Καμία σύνδεση μπάρας → editor.** Το «Υλικά όψης» panel (κάτω από τον 3D) και το «Υλικά» library
   panel (αριστερό sidebar) ζουν χωριστά. Δεν υπάρχει «＋ Νέο Υλικό» από τη μπάρα ούτε prominence — γι'
   αυτό ο Giorgio βλέπει μόνο τα fixed swatches και όχι τη δυνατότητα δημιουργίας.
4. **Το editor είναι κοστολογικό, όχι visual.** Κυριαρχούν ΑΤΟΕ/density/fireRating/cost — τα appearance
   πεδία (χρώμα/γυαλάδα) απουσιάζουν ή είναι θαμμένα.

## 4. Αποφάσεις σχεδίασης (SSoT-first, μηδέν διπλότυπα)

- **PBR appearance model:** `baseColorHex` + `metalness` (0-1) + `roughness` (0-1) + optional `pbrTextures`
  (ήδη υπάρχει) + (μελλοντικά) `emissive`/`opacity`. Χαρτογραφείται 1-1 στο three.js `MeshStandardMaterial`.
- **Reuse `EnterpriseColorPicker`** για το χρώμα — **κανένα νέο picker** (N.18).
- **Reuse `MaterialLibraryService.saveMaterial`/`updateMaterial`** — **καμία νέα persistence** (N.6 enterprise-id ήδη).
- **Reuse `user-material-registry` render feed** — επεκτείνεται να διαβάζει το per-material appearance override
  αντί μόνο `getCategoryMaterialDef` (η κατηγορία μένει **fallback** όταν δεν υπάρχει override).
- **Reuse `PolygonMaterialPanel` apply** — το νέο υλικό εφαρμόζεται στις όψεις μέσω του **ίδιου** μηχανισμού
  (`materialId` → `resolveFaceMaterial`), μηδέν δεύτερο paint path.
- **Scope:** project/company (single-user pre-production — ADR-363 permissions ήδη ισχύουν).

## 5. Schema αλλαγή (ελάχιστη, Firestore-safe)

Προσθήκη **optional** appearance block στο `BimMaterial` + `SaveBimMaterialInput`/`UpdateBimMaterialPatch`
(Firestore rejects `undefined` → `null`/conditional-spread όπως το `pbrTextures`):

```ts
export interface BimMaterialAppearance {
  readonly baseColorHex: string;      // '#rrggbb' — user color (εκατομμύρια)
  readonly metalness: number;         // 0..1
  readonly roughness: number;         // 0..1
}
// BimMaterial += readonly appearance: BimMaterialAppearance | null;  // null → category fallback (back-compat)
```

**Back-compat:** τα ~25 system-seeded + όλα τα υπάρχοντα υλικά έχουν `appearance: null` → συμπεριφορά
**αμετάβλητη** (category-driven). Μηδέν migration υποχρεωτικό.

## 6. UX (big-player, από τη μπάρα)

- **«＋ Νέο Υλικό»** ως **πρώτο, φανερό** στοιχείο στη μπάρα «Υλικά όψης» (αντί για κρυμμένο δεξί κουμπάκι
  «Προσαρμοσμένο χρώμα»). Ανοίγει το editor σε `mode='create'` με ενεργή τη νέα **«Εμφάνιση»** section.
- **«Εμφάνιση» section** στο `MaterialEditorDialog`: color picker + metalness slider + roughness slider +
  **σφαίρα preview** (three.js offscreen ή CSS-approx στη Φ1).
- Μετά την αποθήκευση → το υλικό εμφανίζεται **αμέσως** ως swatch στη μπάρα (ο `user-material-registry`
  feed είναι ήδη always-on) → ένα κλικ = apply. **Ακριβώς το C4D Material Manager.**

## 7. Φάσεις (σταδιακά — value σε κάθε βήμα)

| Φ | Παραδοτέο | Αρχεία (εκτίμηση) |
|---|---|---|
| **Φ1 ✅** | «Εμφάνιση» section (χρώμα+metalness+roughness) + schema `appearance` + render read + «＋ Νέο Υλικό» prominent + **αληθινή 3D σφαίρα-preview** | **DONE** — 11 src + 4 i18n + tests (βλ. changelog 2026-07-23) |
| **Φ2** | Ενοποίηση textures (ήδη υπάρχουν) στο appearance context — «διάλεξε φωτογραφία υφής» δίπλα στο χρώμα | ~2-3 |
| **Φ3** | Material Manager grid (thumbnails, διπλό-κλικ→edit, delete/organize) — πλήρες C4D-style | ~4-5 |
| **Φ4 ✅** | Advanced: emissive (αυτοφωτισμός) + opacity (διαφάνεια) — schema→def→factory→registry→UI→i18n→tests | **DONE** (βλ. changelog 2026-07-23 Φ4) |

**⚠️ N.8:** Φ1 = 6-8 αρχεία / 2 domains (types+UI+render) → **Plan Mode ή Orchestrator** την ώρα της
υλοποίησης, με έγκριση Giorgio. Το παρόν ADR είναι μόνο το blueprint.

## 8. Google-level checklist (N.7.2)

- Proactive: το υλικό δημιουργείται στο lifecycle moment («＋ Νέο»), όχι side-effect. ✅
- SSoT: ένα appearance schema, ένας picker, ένας persistence, ένας render feed, ένα apply path. ✅
- Idempotent: save → ένα doc (enterprise-id)· render read = pure. ✅
- Back-compat: `appearance: null` → category fallback (μηδέν regression). ✅
- Belt-and-suspenders: override → category → concrete fallback (υπάρχουσα αλυσίδα). ✅

## 9. Αποφάσεις (Giorgio 2026-07-23 — «κάν' το όπως οι μεγάλοι, full enterprise + full SSOT»)

1. **Preview sphere:** ✅ **Αληθινή 3D σφαίρα (three.js) από τη Φ1.** Reuse του υπάρχοντος bim-3d render
   engine (offscreen/inline `MeshStandardMaterial` + φωτισμός) — μηδέν δεύτερος renderer. Δείχνει το
   πραγματικό αποτέλεσμα (χρώμα+γυαλάδα+μέταλλο+υφή) όπως το C4D Material Editor.
2. **«＋ Νέο Υλικό» ΑΝΤΙΚΑΘΙΣΤΑ το «Προσαρμοσμένο χρώμα» — ΕΝΟΠΟΙΗΣΗ σε υλικά (big-player 3D/BIM).**
   Τεκμηρίωση: Revit (Materials/Appearance assets), ArchiCAD (Surfaces), Cinema 4D (Materials) **δεν έχουν
   «σκέτο χρώμα» ως ξεχωριστή έννοια** — το χρώμα είναι η απλούστερη μορφή υλικού (base color μόνο, χωρίς
   υφή). Μόνο η Figma (2D UI, όχι 3D/BIM) έχει quick solid fill. Άρα:
   - **Ένα concept: υλικό** (FULL SSOT — όχι δύο παράλληλα paths).
   - Ένα «γρήγορο χρώμα» = υλικό με μόνο `baseColorHex` (κενά metalness/roughness=defaults, καμία υφή).
   - Το low-level `colorHex` per-face override **μένει** ως εσωτερικός μηχανισμός (το χρησιμοποιεί ήδη
     ADR-539 paint + ADR-686 imported override) — απλά **δεν εκτίθεται** πια ως ξεχωριστό UI κουμπί.
   - Ταχύτητα (Figma-like recents): τα πρόσφατα υλικά εμφανίζονται στη μπάρα (feed ήδη always-on).
3. **Emissive/opacity:** Φ4 (ο Aeron pellicle ημιδιαφανές → opacity χρήσιμο, αλλά όχι blocker για Φ1).

## 9.5 Νέο audit εύρημα (Φ1 υλοποίηση) — υπάρχον preview harness

Κατά τη Φ1 βρέθηκε ότι **ΥΠΑΡΧΕΙ ήδη self-contained mini-THREE preview harness**:
`bim-3d/preview/band-stack-preview-renderer.ts` + `ui/ribbon/components/BandStackPreviewPanel.tsx`
(ADR-412/414, Wall/Slab «Edit Type» live preview). Είναι **band-stack-specific** (layers/pick/
highlight/8-corner fit) — όχι έτοιμη σφαίρα. Η σφαίρα-preview της Φ1 **επαναχρησιμοποιεί τα κοινά
primitives** του (`createBimLights` lighting SSoT, `buildMat` material SSoT, render-on-demand +
dispose pattern) σε νέο μικρό `MaterialPreviewSphereRenderer`, χωρίς δεύτερο renderer/lighting rig.
`jscpd:diff` **καθαρό** (μηδέν clone vs band-stack). Το save+upload orchestration εξήχθη από το
`MaterialsLibraryPanel` σε `persist-material-from-editor.ts` (SSoT) ώστε library panel + μπάρα να το
μοιράζονται — μηδέν sibling clone.

## 10. Changelog

- **2026-07-23 (Opus 4.8) — PROPOSED.** Design blueprint μετά από Phase-1 audit. Ευρήματα: το 80% του
  Material Editor/Library/persistence/render/apply **υπάρχει ήδη** (ADR-363/413)· το πραγματικό κενό =
  (α) per-material appearance (χρώμα/metalness/roughness — σήμερα category-driven), (β) preview sphere,
  (γ) σύνδεση μπάρας→editor + prominence. Απόφαση: PBR model, schema `appearance` optional (back-compat),
  reuse EnterpriseColorPicker + MaterialLibraryService + user-material-registry.
- **2026-07-23 (Opus 4.8) — §9 αποφάσεις (Giorgio «όπως οι μεγάλοι»).** (1) Real 3D three.js preview
  sphere από Φ1. (2) **Ενοποίηση σε υλικά** — «＋ Νέο Υλικό» αντικαθιστά το «Προσαρμοσμένο χρώμα» (Revit/
  ArchiCAD/C4D pattern: όλα materials· «σκέτο χρώμα» = υλικό με μόνο base color)· `colorHex` μένει internal.
  (3) Emissive/opacity = Φ4. **Εκκρεμεί:** έγκριση blueprint + Plan Mode για Φ1 υλοποίηση.
- **2026-07-23 (Opus 4.8) — Φ1 IMPLEMENTED (UNCOMMITTED).** Giorgio «ΠΡΟΧΩΡΑ» μετά το Plan Mode.
  **Αρχεία (11 src + 4 i18n + 1 test):**
  1. `bim/types/bim-material-types.ts` — `BimMaterialAppearance {baseColorHex, metalness, roughness}` +
     `BimMaterial.appearance: …|null` + `SaveInput.appearance?` + `UpdatePatch.appearance?: …|null`.
  2. `bim/materials/material-catalog-defs.ts` — `appearanceToDef()` (hex→int + clamp01, pure SSoT mapping).
  3. `bim-3d/materials/user-material-registry.ts` — **ΕΝΑ resolution point**: `resolveMaterialDef` = appearance
     override ? `appearanceToDef` : `getCategoryMaterialDef`· signature += appearance (re-bump). Ο 3D catalog,
     ο 2D color provider (γρ.155-158) + το swatch διαβάζουν ΤΟ ΙΔΙΟ `def` — μηδέν δεύτερο read-site.
  4. `bim/services/MaterialLibraryService.ts` — writer create `appearance: input.appearance ?? null`.
  5. **NEW** `bim-3d/preview/material-preview-sphere-renderer.ts` — mini-THREE σφαίρα (reuse `buildMat` +
     `createBimLights`, render-on-demand, dispose).
  6. **NEW** `ui/panels/materials/MaterialPreviewSphere.tsx` — React shell (mount/dispose/resize + `def`→renderer).
  7. `ui/panels/materials/MaterialEditorSections.tsx` — `AppearanceSection` (inline `EnterpriseColorPicker` +
     2 sliders + live σφαίρα) + `FormState` += baseColorHex/metalness/roughness.
  8. `ui/panels/materials/MaterialEditorDialog.tsx` — `appearanceSeed`/`buildAppearance` + wire section + build
     σε initial/save/update. **Κάθε νέο/edited υλικό αποθηκεύει appearance** (seed από `appearance ?? category def`
     → μηδέν visual regression σε legacy).
  9. **NEW** `ui/panels/materials/persist-material-from-editor.ts` — SSoT save+upload orchestration (extract).
  10. `ui/panels/materials/MaterialsLibraryPanel.tsx` — delegate `handleSave` → shared fn.
  11. `bim-3d/ui/PolygonMaterialPanel.tsx` — «Προσαρμοσμένο χρώμα» → **«＋ Νέο Υλικό»** (create-mode editor,
      shared persist)· `EnterpriseColorDialog` αφαιρέθηκε (colorHex μένει internal για drag-drop/ADR-539/686).
  - **i18n:** `el/en bim-materials.json` (`appearance.*`) + `el/en bim3d.json` (`polygonMode.newMaterial(Tooltip)`).
  - **Tests:** `user-material-registry.test.ts` +4 (override/fallback/re-bump/clamp) → **12/12 πράσινα**·
    `MaterialCatalog3D-user-material.test.ts` **4/4** (καμία regression). `jscpd:diff` **καθαρό** (11 αρχεία).
    **ΟΧΙ tsc (N.17).** Back-compat: system seeds + legacy `appearance: null` → category fallback αμετάβλητο.
  - 🔴 **Εκκρεμεί (Giorgio):** browser verify (φτιάξε «Ξύλο» χρώμα+γυαλάδα → σώσε → βάψε όψη → 3D preview ζωντανή)
    + commit. Δες §9.5 για το preview-harness εύρημα.
- **2026-07-23 (Opus 4.8) — Φ1 UI refinements (browser feedback Giorgio, 2 screenshots).** (1) Σφαίρα-preview
  **κοβόταν** (radius-1 sphere > frame): camera z 3.2→**5** (`material-preview-sphere-renderer.ts`) → πλήρως εντός
  frame με margin. (2) «＋ Νέο Υλικό» **μετακινήθηκε στην ΑΡΧΗ** της μπάρας (αμέσως μετά το mode toggle «Πολύγωνα»,
  όχι στο δεξί άκρο· `PolygonMaterialPanel.tsx`). (3) Ο editor **έκανε vertical scroll**: `DialogContent` `lg`→**`xl`**
  (max-w-4xl) + **2-column layout** (Εμφάνιση full-width πάνω· Required/Dimensions/Metadata/PBR/Thumbnail σε
  `grid md:grid-cols-2`) → μηδέν/ελάχιστο scroll. jscpd καθαρό.
- **2026-07-23 (Opus 4.8) — Φ1 layout v2: ρητό 4-column grid (Giorgio screenshot 1→2→3→4).** Το CSS
  `columns` masonry **έσπαγε τον picker** (section πιο ψηλό από τη στήλη → fragment παρά το
  `break-inside-avoid`). Αντικαταστάθηκε με **CSS grid** (`lg:grid-cols-4`, ΠΟΤΕ δεν σπάει child):
  στ.1-2 = «Εμφάνιση» (σφαίρα + **οριζόντιος** `EnterpriseColorPicker` = area/sliders | παλέτες,
  `orientation="horizontal"`) + οι 2 PBR sliders σε 2 στήλες· στ.3 = Required/Dimensions/Metadata·
  στ.4 = Υφές 3D + Μικρογραφία. `DialogContent` `xl`→**`2xl`** (max-w-7xl). jscpd καθαρό.
- **2026-07-23 (Opus 4.8) — Φ1 layout v3 (browser fixes).** (1) Οι **παλέτες χρωμάτων κόβονταν**: ο
  οριζόντιος picker έχει `flex-shrink-0` στήλες (~480px) και η σφαίρα δίπλα του έτρωγε πλάτος →
  σφαίρα **πάνω** (centered), picker από κάτω σε πλήρες col-span-2 → χωράνε ολόκληρες. (2) Τα
  **dropdown έκοβαν κείμενα** (το `SelectContent` κλειδώνει στο ακριβές trigger-width, `select.tsx:124`):
  localized override `w-auto min-w-[var(--radix-select-trigger-width)]` (const `DROPDOWN_CONTENT`) στα 4
  selects (Κατηγορία/Μονάδα/Εύρος/Πυράντοχη) → μεγαλώνουν ως το περιεχόμενο. jscpd καθαρό.
- **2026-07-23 (Opus 4.8) — Φ1 layout v4: 4 ΙΣΟΜΕΓΕΘΕΙΣ στήλες (Giorgio σειρά).** Το appearance
  έπιανε 2 στήλες (φαινόταν σαν ένα φαρδύ μπλοκ, όχι 4 στήλες). Σπάστηκε το `AppearanceSection` σε δύο:
  `AppearancePreviewSection` (σφαίρα `aspect-square` + PBR sliders) + `AppearanceColorSection` (**κάθετος**
  picker, ~260px → χωράει σε 1 στήλη). Νέα σειρά 4 στηλών: **(1)** πεδία υλικού (Required/Dimensions/
  Metadata) · **(2)** σφαίρα + sliders · **(3)** χρώμα · **(4)** υφές 3D + μικρογραφία. jscpd καθαρό.
- **2026-07-23 (Opus 4.8) — Big-player ρεαλισμός στη σφαίρα-preview: HDR studio IBL + ACES (UNCOMMITTED).**
  Ο Giorgio «ό,τι πιο αληθοφανές/μαγικό, οι πιο σύγχρονες τεχνικές, όπως οι μεγάλοι». **1η προσπάθεια
  (απορρίφθηκε από browser-verify):** reuse `applyGradientFallback(noon)` → gradient IBL + studio-gradient
  backdrop. Ο Giorgio (2 screenshots): στο metalness=1 η σφαίρα έδειχνε «σκούρα μπάλα με μία άσπρη κουκκίδα»,
  όχι γυαλισμένο μέταλλο. **Root cause:** (α) το 2-χρωμο gradient env δεν έχει φωτεινά χαρακτηριστικά να
  αντανακλαστούν· (β) τα δυνατά fill-lights (ambient 0.5 + sun 3 + hemi) έπνιγαν το IBL. **Big-player λύση
  (Cinema 4D / Substance / Marmoset / Blender look-dev):** HDR studio environment με softbox panels + filmic
  tone mapping + IBL-dominant φωτισμός. **Υλοποίηση (3 αρχεία + 1 test):**
  1. **NEW** `bim-3d/lighting/studio-preview-environment.ts` — `buildStudioPreviewEnvTexture()`: procedural
     **float** equirect (512×256, `FloatType`) — neutral grey surround + 3 softbox panels με ΓΡΑΜΜΙΚΕΣ τιμές
     **>1** (γνήσιο HDR → φωτεινές αντανακλάσεις). Deterministic, offline, instant (χωρίς network HDRI). Pure
     data (mirror `studio-background-texture.ts`).
  2. `bim-3d/lighting/envmap-generator.ts` — **NEW public** `applyEquirectEnvironment(equirect)`: PMREM
     αυθαίρετου equirect → `scene.environment` (env-only, χωρίς background/hdri state)· disposes το transient
     source + το προηγούμενο env. PMREM SSoT.
  3. `bim-3d/preview/material-preview-sphere-renderer.ts` — renderer += `ACESFilmicToneMapping` + explicit
     sRGB· lighting IBL-dominant (ambient 0.5→**0.18**, sun 3→**1.4**, **hemi dropped**)· env =
     `applyEquirectEnvironment(buildStudioPreviewEnvTexture())`· `dispose()` += `envmap.dispose()`.
  4. **NEW** `__tests__/studio-preview-environment.test.ts` — 4/4 (dims/FloatType/mapping, neutral RGB, HDR
     softbox >1, top>bottom). `jscpd:diff` καθαρό (3 αρχεία).
  **Απόφαση env = procedural, όχι HDRI file:** τα material previews των μεγάλων είναι synthetic studio
  softboxes (καθαρό read του υλικού, χωρίς busy δωμάτιο)· deterministic + offline + instant = πιο enterprise
  από async network fetch. **ACES στην preview (όχι στον ζωντανό viewport):** big-player material editors
  κάνουν tonemap το preview τους ανεξάρτητα από τη σκηνή (C4D editor sphere) — standard practice, όχι
  απόκλιση-λάθος. ✅ **Browser-verified Giorgio** (2 screenshots): metalness 0.79/rough 0.0 = καθαρά softbox
  reflections· metalness 1.0/rough 0.37 = σατινέ μέταλλο. «Big-player ποιότητα».
- **2026-07-23 (Opus 4.8) — Φ4 IMPLEMENTED: αυτοφωτισμός (emissive) + διαφάνεια (opacity) (UNCOMMITTED).**
  Mirror ακριβώς της Φ1 (schema→def→factory→registry→UI→i18n→tests). Revit «Generic»: Self-illumination +
  Transparency. **Αρχεία (7 src + 2 i18n + 1 test):**
  1. `bim/types/bim-material-types.ts` — `BimMaterialAppearance` += `emissiveHex?`/`emissiveIntensity?`/
     `opacity?` (ΟΛΑ optional → back-compat με τα Φ1 persisted objects· writer γράφει concrete → Firestore-safe).
  2. `bim/materials/material-catalog-defs.ts` — `PbrMaterialDef` += `emissive?`/`emissiveIntensity?`·
     `appearanceToDef()` map: `opacity`(clamp01,def 1)+`transparent`(<1)· `emissive`(hex→int,def black)+
     `emissiveIntensity`(clamp01,def 0).
  3. `bim-3d/materials/pbr-material-builder.ts` — `buildMat()` += `emissive`/`emissiveIntensity` στο
     MeshStandardMaterial (opacity/transparent σετάρονταν ήδη).
  4. `bim-3d/materials/user-material-registry.ts` — `appearanceSignature()` += emissive/opacity στο fingerprint.
  5. `ui/panels/materials/MaterialEditorSections.tsx` — **NEW `<PbrSlider>` SSoT component** (αντικαθιστά τα 2
     Φ1 slider blocks + 2 νέα = 4 sliders, μηδέν clone N.18)· `AppearancePreviewSection` += opacity + emissive
     intensity sliders· `AppearanceColorSection` += emissive-colour swatch → reuse **`EnterpriseColorDialog`**
     (μηδέν 2ος picker)· `FormState` += 3 πεδία.
  6. `ui/panels/materials/MaterialEditorDialog.tsx` — `appearanceSeed`/`buildInitialState`/`buildAppearance`
     += τα 3 πεδία (category opacity seed π.χ. glass 0.35· emissive colour seed = base — βλ. Φ4 browser-fix).
  7. i18n `el|en/bim-materials.json` — `appearance.*` += emissiveColor/emissive/emissiveHint/opacity/opacityHint.
  - **Tests:** `user-material-registry.test.ts` +4 Φ4 (emissive map, opacity+transparent, back-compat defaults,
    re-bump) → **16/16**· `MaterialCatalog3D-user-material.test.ts` **4/4** (καμία regression)· `jscpd:diff`
    καθαρό (6 αρχεία). **ΟΧΙ tsc (N.17).** **Φ5 (clearcoat/transmission) = out-of-scope μέχρι ρητή έγκριση.**
- **2026-07-23 (Opus 4.8) — Φ4 browser-fixes ×2 (Giorgio 6 screenshots + C4D σύγκριση, UNCOMMITTED).**
  **Γύρος 1:** (1) **Αυτοφωτισμός no-op:** emissive-colour default ήταν `#000000` → `black × intensity = 0`.
  Fix → seed emissive = base colour. (2) C4D backdrop: 1η προσπάθεια `scene.background` = studio texture.
  **Γύρος 2 (re-verify):** ο αυτοφωτισμός έβγαινε γκρι όταν άλλαζε το base ΜΕΤΑ το seed. **Fix → live-sync:**
  `FormState.emissiveCustom` (transient)· όσο δεν έχει οριστεί ρητά emissive colour, το base-colour change το
  συμπαρασύρει (glow-in-own-colour)· το emissive swatch παγώνει το χρώμα (`emissiveCustom=true`).
  **Γύρος 3 (backdrop):** ΔΥΟ αποτυχίες (tone-mapped `scene.background` texture· CSS gradient πίσω από «διάφανο»
  canvas — το gradient ήταν και πολύ subtle). Ο Giorgio διευκρίνισε: **«ριγωτό» = διαγώνιες εναλλασσόμενες
  ανοιχτές/σκούρες ρίγες** (το κλασικό material-preview transparency-checker των μεγάλων). **Ντετερμινιστικό
  fix — in-scene plane:** **NEW** `bim-3d/preview/preview-backdrop-texture.ts` `buildDiagonalStripeBackdropTexture()`
  (256×256 sRGB, 45° stripes σε `(x+y) mod period`, greys `#5b5b5b`/`#868686`)· ο renderer βάζει plane πίσω από τη
  σφαίρα (`MeshBasicMaterial` **`toneMapped:false`** → exact greys υπό ACES· `depthWrite:false`+far z → η σφαίρα
  μπροστά· ημιδιαφανές υλικό συνθέτει πάνω στις ρίγες → opacity ορατή). **Guaranteed** (ανεξάρτητο canvas-alpha/
  CSS/tone-mapping). Test 4/4· jscpd καθαρό. 🔴 Εκκρεμεί re-verify (ρίγες ορατές· διαφάνεια δείχνει ρίγες πίσω).
