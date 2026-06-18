# BASELINE — Foundation data state «Κτήριο Α1» (2026-06-18, πριν τις δοκιμές Giorgio)

Σκοπός: καταγραφή της τρέχουσας κατάστασης δεδομένων ΠΡΙΝ ο Giorgio σβήσει τα πρόχειρα/δοκιμαστικά & κάνει καθαρές δοκιμές του ADR-484.

## Scope
- Building «Κτήριο Α1» = `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d`
- Project = `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab`
- Company = `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`

## Floors (collection `floors`, 5)
| name | floorId | kind | elevation |
|---|---|---|---|
| **Θεμελίωση «F»** | `flr_c25e29a6-5ecf-4bd4-929d-bb6ebd0feb1a` | **foundation** | -1 |
| **Ισόγειο** | `flr_215e39f3-d958-4f97-ac59-6639131767d1` | ground | 0 |
| 1ος Όροφος | `flr_b48332d1-...` | standard | 3 |
| 2ος Όροφος | `flr_a0eea357-...` | standard | 6 |
| SP | `flr_a22c1670-...` | stair-penthouse | 9 |

→ Υπάρχει σωστός foundation level → ο ADR-484 resolver/redirect έχει έγκυρο target.

## DXF levels (collection `dxf_viewer_levels`, 6) — sceneFileId mapping
| level | levelId | floorId | sceneFileId |
|---|---|---|---|
| Ισόγειο | `lvl_21982f3b` | flr_215e39f3 (ground) | **`file_80efad96-6a75-40f9-8478-0ebaa5cfbcaf`** |
| **F (Θεμελίωση)** | `lvl_4b38b269` | flr_c25e29a6 (foundation) | **`file_80efad96-6a75-40f9-8478-0ebaa5cfbcaf`** ⚠️ ΙΔΙΟ |
| 1ος Όροφος | `lvl_be92cf2b` | flr_b48332d1 | `file_9d056241-...` |
| 2ος Όροφος | `lvl_cd8a82e9` | flr_a0eea357 | null |
| SP | `lvl_38d4a912` | flr_a22c1670 | null |
| Επίπεδο 1 (default) | `lvl_6ffe1248` | null | null |

## 🚨 ΡΙΖΑ «γιατί τα πράσινα πέδιλα φαίνονται στο Ισόγειο»
**Το Ισόγειο level ΚΑΙ η Θεμελίωση level μοιράζονται το ΙΔΙΟ scene file `file_80efad96` («Ισόγειο 1.dxf»).**
→ Είναι κυριολεκτικά το ΙΔΙΟ scene. Όποια foundation entities ζουν στο `file_80efad96` εμφανίζονται ΚΑΙ στους δύο ορόφους. ΔΕΝ είναι το provenance write-path που υπέθεσα αρχικά — είναι **cross-linked sceneFileId** (πρόχειρο/δοκιμαστικό setup).

## Αρχιτεκτονική αποθήκευσης (3-tier — enterprise-grade, ADR-288/ADR-040)
- **Scene content (geometry/entities) → Firebase Storage** ως `.scene.json` blob (ΟΧΙ inline Firestore — 1MB doc limit). `deriveScenePath` → `${base}.scene.json`.
- **File metadata → Firestore `files`** (storagePath, filename).
- **Levels → Firestore `dxf_viewer_levels`** (per-level bimRenderSettings/view + `sceneFileId` reference· ΟΧΙ τα entities).
- **Structured BIM (foundations) → Firestore `floorplan_foundations`** (queryable per-entity docs).
→ Σωστό pattern («μεγάλοι παίχτες»: Autodesk APS/Forge, Onshape, Speckle, Figma — heavy blob σε storage, metadata/refs σε DB).

## Model SSoT
- `floorplan_foundations` (top-level): **0 docs** (άδειο). Άρα τα foundations ΔΕΝ ζουν στο model SSoT — μόνο ως entities μέσα στο shared scene blob (`.scene.json` του `file_80efad96`).

## Συνέπειες για τον ADR-484 fix
- **Slice 1 (resolver fallback στο foundation-level store):** το store τροφοδοτείται από `floorplan_foundations` (άδειο) → δεν θα βρει cross-level footings ΜΕΧΡΙ να υπάρχουν model footings. Με καθαρό setup (νέα foundations → model) θα δουλέψει.
- **Slice 2 (redirect στο foundation level):** τα ΝΕΑ foundations θα γράφονται στο `floorplan_foundations` (foundation scope), σωστά. ⚠️ ΑΛΛΑ όσο το foundation level μοιράζεται sceneFileId με το Ισόγειο, ο cross-level writer.mutateFoundationScene μολύνει το shared scene → θα φαίνονται και στο Ισόγειο.

## ✅ Σύσταση πριν τις δοκιμές
1. Σβήσε τα πρόχειρα foundation entities από το shared scene `file_80efad96`.
2. **Το foundation level «F» ΔΕΝ πρέπει να μοιράζεται sceneFileId με το Ισόγειο** — δώσ' του δικό του (ή κανένα· τα foundations ζουν στο model `floorplan_foundations`). Revit-canonical: κάθε level = δικό του view/scene.
3. Μετά: σχεδίασε foundation στο Ισόγειο → με τον fix θα γραφτεί στο foundation model/level, ΟΧΙ στο shared Ισόγειο scene.
