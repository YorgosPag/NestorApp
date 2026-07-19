# ADR-679 — PBR Material «Full Parity»: πλήρες σύστημα υλικών/υφών ανά όψη (C4D-grade)

**Status:** 🟡 PLANNING (Φ0 — σχεδιασμός· καμία υλοποίηση ακόμα)
**Date:** 2026-07-19
**Owner:** Giorgio
**Σχετικά:** ADR-413 (BimMaterial library + PBR textures) · ADR-539 (per-face appearance) · ADR-449 (structural finish) · ADR-678 (C4D↔Νέστωρ round-trip) · ADR-511 (wall-covering catalog)

---

## 1. Η επιθυμία (Giorgio 2026-07-19)

Full material parity με το C4D: «ό,τι χρώματα, υφές και υλικά βάζω, να τα βλέπω στον Νέστωρ». Ο χρήστης
θέλει να κάνει διπλό κλικ σε ένα υλικό και να ανοίγει **πλήρες πάνελ ρυθμίσεων** (όπως ο C4D Material
Editor), και το υλικό (με την **υφή** του) να αποδίδεται σε **οποιαδήποτε όψη** (σώμα ΚΑΙ σοβά).

## 2. Απόφαση αρχιτεκτονικής: PBR, ΟΧΙ κατά-γράμμα C4D R15

**PBR (Physically-Based Rendering), το industry standard** (Revit / Twinmotion / Enscape / glTF / νέο C4D)
— ΟΧΙ αντιγραφή των 13 legacy καναλιών του C4D **R15 (2013)** (Luminance/Fog/Glow/Environment/Displacement
= άχρηστα σε αρχιτεκτονική). Giorgio ενέκρινε PBR 2026-07-19.

**Κανάλια-στόχος (BIM-relevant):** Base Color + Texture (albedo) · Roughness · Metalness · Normal/Bump ·
Opacity/Transparency · (προαιρετικά) Emission. Δίνουν ~95% του οπτικού αποτελέσματος και ταξιδεύουν
καθαρά σε glTF **και** C4D.

## 3. Τι ΥΠΑΡΧΕΙ ήδη (ground truth 2026-07-19 — ΔΙΑΒΑΣΕ ΠΡΙΝ ΧΤΙΣΕΙΣ)

Ο Νέστωρ έχει **μεγάλο** μέρος της μηχανής — το όραμα είναι κυρίως **ΣΥΝΔΕΣΗ**, όχι from-scratch:

| Κομμάτι | Πού | Τι δίνει |
|---------|-----|----------|
| **BimMaterial library** (ADR-413) | `bim/types/bim-material-types.ts`, `bim/services/MaterialLibraryService.ts` | Πλήρες material def (id, name, category, ATOE/κόστος, **PbrMaterialTextures**) |
| **PBR texture set** | `PbrMaterialTextures` (ADR-413): `albedoUrl/normalUrl/roughnessUrl/aoUrl/tileSizeM` | Revit «Appearance asset» — albedo υποχρεωτικό, υπόλοιπα optional |
| **Texture registry + upload** | `bim/materials/bim-texture-registry.ts`, `bim/services/bim-material-texture-upload.service.ts`, `ui/panels/materials/hooks/useMaterialPbrTextureUpload.ts` | Ανέβασμα/αποθήκευση υφών |
| **PBR render** | `bim-3d/materials/pbr-material-builder.ts`, `bim-3d/materials/bim-texture-cache.ts`, `user-material-registry.ts` (`getUserMaterialTextureSet`) | THREE PBR materials από texture set |
| **Face-material palette UI** | «Υλικά όψης» (Σώμα/Σοβάς) — swatches wall-covering | Ήδη ζωντανό στο LevelPanel |

## 4. Το ΚΕΝΟ (γιατί οι υφές δεν φαίνονται ανά όψη σήμερα)

**Το per-face «βάψιμο» (ADR-539) είναι FLAT-COLOUR-ONLY.** Το `resolveFaceMaterial`
(`bim-3d/materials/face-appearance-material.ts`) παίρνει `FaceAppearance` → `faceAppearanceColorHex` →
`MeshStandardMaterial({ color })`. **Καμία υφή/normal/roughness ανά όψη.** Ο σοβάς (ADR-449) το ίδιο:
`FinishFaceOverride` έχει μόνο `materialId`/`colorOverride`/`thickness` — το ορατό χρώμα βγαίνει ΜΟΝΟ από
`colorOverride` (βλ. ADR-678 Φ1.1-c). Άρα ακόμη κι αν ένα materialId δείχνει σε textured BimMaterial, η
όψη αποδίδεται flat.

**Το κλειδί του project:** επέκταση του per-face appearance (σώμα ΚΑΙ σοβάς) ώστε να δείχνει σε **πλήρες
BimMaterial** (PBR texture set) και να το **render-άρει** μέσω του υπάρχοντος `pbr-material-builder`.

## 5. Phased roadmap

| Φάση | Περιεχόμενο | Μέγεθος |
|------|-------------|---------|
| **Φ2a** | **Import name→όλα τα υλικά.** `resolveImportAppearance` (ADR-678) να αναγνωρίζει user materials + όλους τους καταλόγους (όχι μόνο wall-covering) μέσω `MaterialLibraryService`. Name-based, όπως Revit/IFC. | Μικρό |
| **Φ2b** | **Per-face PBR (η καρδιά).** Επέκταση `FaceAppearance` + `FinishFaceOverride` να δείχνουν σε `BimMaterial.id`· `resolveFaceMaterial` + finish converter να χτίζουν PBR υλικό (texture) μέσω `pbr-material-builder`, όχι flat color. Σώμα + σοβάς. | **Μεγάλο** |
| **Φ2c** | **Material editor UI (C4D-parity).** Διπλό κλικ σε swatch → πάνελ PBR (Base Color/Texture upload, Roughness, Metalness, Normal, Opacity). Reuse `useMaterialPbrTextureUpload`. Εμφανές «όνομα για C4D». | Μεσαίο |
| **Φ3** | glTF PBR round-trip (το glTF ΕΧΕΙ πραγματικά PBR + textures — αντίθετα από το OBJ/R15). Προαιρετικό. | Μεσαίο |

**Σειρά:** Φ2a (γρήγορη νίκη, ξεκλειδώνει catalog/user materials στο round-trip) → Φ2b (η ουσία) → Φ2c (UX).

## 6. Κανόνες / SSoT (μην αναπαράγεις)

- **ΜΗΝ** φτιάξεις νέο material type — επέκτεινε το `BimMaterial` (ADR-413).
- **ΜΗΝ** φτιάξεις νέο PBR builder — reuse `pbr-material-builder.ts` + `bim-texture-cache.ts`.
- **ΜΗΝ** φτιάξεις νέο per-face σύστημα — επέκτεινε ADR-539 (`FaceAppearance`) + ADR-449 (`FinishFaceOverride`).
- Round-trip = **name-based** πάντα (C4D R15 δεν στέλνει data — μόνο `usemtl <όνομα>`· βλ. ADR-678).
- N.8: το Φ2b είναι orchestrator-scale (materials + rendering + import) — ζήτα έγκριση mode πριν.

## 7. Changelog

- **2026-07-19** — Δημιουργία ADR. Απόφαση PBR (όχι legacy C4D R15). Ground-truth της υπάρχουσας μηχανής
  (ADR-413 library + PBR textures + upload + builder ΥΠΑΡΧΟΥΝ· το κενό = per-face flat-colour-only).
  Phased plan Φ2a→Φ2b→Φ2c. Καμία υλοποίηση ακόμα.
