# ADR-447 — Default Structural Concrete Textures + Revit-grade Wall Type Catalog

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · BIM 3D materials · Wall family types · Thermal envelope
**Related:** ADR-446 (Visual Styles — textures show in `realistic`), ADR-413 (PBR textures / `MATERIAL_TEXTURE_MAP`), ADR-412/414 (BIM family types + auto-typing), ADR-363 (wall DNA), ADR-396 (ETICS thermal envelope), ADR-436 (foundation discipline), ADR-445 (per-category colour identity)

---

## 1. Context / Problem

Στο realistic visual style (ADR-446) ο χρήστης έπρεπε να δηλώνει υλικό κάθε φορά:
- **Β.1** — τα δομικά/θεμελίωσης (πέδιλα/πεδιλοδοκοί/συνδετήριες/δοκάρια/πλάκες) **δεν** έδειχναν υφή σκυροδέματος, ενώ οι κολόνες ναι.
- **Β.2** — ο default εξωτερικός τοίχος ήταν **οπλισμένο σκυρόδεμα 210mm** (λάθος: σε ελληνικό RC-frame ο φέρων σκελετός είναι κολώνες/δοκάρια, οι τοίχοι είναι πληρωτική **τοιχοποιία από τούβλο**), και υπήρχε ΕΝΑΣ τύπος ανά category — όχι έτοιμες επιλογές 25/20/10cm ούτε παραλλαγή θερμοπρόσοψης.

Recognition (code=SoT): Β.1 = gap σε ΕΝΑ map· Β.2 = επέκταση του wall-type catalog 1→πολλούς τύπους.

## 2. Decision

### Β.1 — Default concrete texture (Revit «category material»)
`MATERIAL_TEXTURE_MAP` (`bim/materials/bim-texture-registry.ts`) είναι η SSoT element-key → texture slug. Προστέθηκαν/διορθώθηκαν:
- `elem-beam`: `'wood'` → **`'concrete'`** (RC δοκάρι).
- `elem-foundation` / `-pad` / `-strip` / `-tie-beam` → **`'concrete'`**.
- `elem-column` / `elem-slab` ήταν ήδη `'concrete'` (η εδαφόπλακα render-άρεται ως slab — ADR-436).

Οι per-category χρωματικές ταυτότητες (ADR-445, `MATERIAL_DEFS`) **αμετάβλητες** — η υφή φαίνεται μόνο σε `faceMode='realistic'`· σε shaded/consistent παραμένουν τα χρώματα.

### Β.2 — Revit-grade Wall Type Catalog (πολλαπλοί built-in τύποι)
Default τύποι (απόφαση Giorgio: **σταθερός σοβάς + κόκκινο τούβλο στο υπόλοιπο**), από έξω → μέσα:

| Τύπος (key) | Στρώσεις (mm) | Total |
|---|---|---|
| `exterior` «Εξωτερικός 25cm» | σοβάς `mat-plaster-ext` 25 · **τούβλο `mat-brick-masonry` 210** · Knauf `mat-plaster-int` 15 | 250 |
| `exterior-eps` «...με θερμοπρόσοψη» | **EPS `mat-eps` 100** · σοβάς 25 · τούβλο 210 · Knauf 15 | 350 |
| `exterior-20` «Εξωτερικός 20cm» | σοβάς 25 · τούβλο 160 · Knauf 15 | 200 |
| `interior` «Εσωτερικός 10cm» | Knauf 15 · τούβλο 70 · Knauf 15 | 100 |

Αρχιτεκτονική (πρότυπο `STAIR_SEEDS`/`ROOF_BUILDUP_KEYS`):
- `bim/types/wall-dna-types.ts`: νέοι DNA builders + **SSoT `WALL_TYPE_SEEDS: {key, category, dna}[]`** (7). `getDefaultDnaForCategory` → primary seed ανά category.
- `bim/family-types/built-in-types.ts`: `getBuiltInWallTypeId(key)` key-based· `getBuiltInWallTypes` iterate-άρει seeds. **PRIMARY key === category** → id `bimftype-builtin-wall-exterior` ΑΜΕΤΑΒΛΗΤΟ (existing walls resolve)· variants νέα ids (`-exterior-eps`, `-exterior-20`).
- `bim/family-types/wall-type-auto-assign.ts`: `resolveAutoWallTypeId` matchάρει ΟΛΟΥΣ τους seeds (category + thickness + dna deep-equal), first wins.
- i18n `dxf-viewer-shell` el+en: `ribbon.commands.bimFamilyType.builtin.wall.{exterior,exterior-eps,exterior-20,interior,...}` descriptive labels.

### EPS marriage με ADR-396 ETICS envelope (dedup — μηδέν διπλή μόνωση)
Revit: η μόνωση ζει ΩΣ στρώση στο wall type (όχι ξεχωριστό object). Εμείς έχουμε επιπλέον το auto building-envelope (ADR-396). **Marriage:** το DNA-EPS του τύπου = η SSoT της μόνωσης· το envelope **παρακάμπτει** τους ήδη-μονωμένους τοίχους.
- NEW SSoT predicate `isInsulationMaterial` (`wall-material-catalog.ts`, prefix `mat-eps`/`mat-xps`/`mat-mineral-wool`/`mat-plaster-thermal`) + `wallHasExteriorInsulation(dna)` (`wall-dna-types.ts`).
- `bim/geometry/envelope-shell.ts`: `resolveEdgeInsulation` force-off (όπως `envelopeFunction:'interior'`) όταν ο source wall ∈ `selfInsulatedWallIds`. Επαναχρησιμοποιεί τον δοκιμασμένο `extractRuns` open-runs μηχανισμό → ασφαλές (κανένα loop-break).

## 3. ADR-040
Όλα `bim/*` materials/types/family-types/geometry — εκτός 2Δ micro-leaf critical path (CHECK 6B/6D). Μηδέν high-freq subscriber.

## 4. Migration / risk
Το `exterior` primary DNA άλλαξε RC 210 → brick 210 (ίδιο total 250mm). Υπάρχοντες τοίχοι auto-typed `builtin.wall.exterior` που resolve-άρουν DNA από τον τύπο γίνονται brick στο επόμενο load (ίδιο πάχος → ίδια γεωμετρία· αλλάζει σύσταση/υφή/U-value). Dev mode + νέα πρόθεση → αποδεκτό· browser-verify.

## 5. Tests
- `bim-texture-registry.test.ts` — foundation/beam → concrete.
- `wall-dna-types.test.ts` (NEW) — seeds totals + brick core + `wallHasExteriorInsulation`.
- `wall-material-catalog.test.ts` — `isInsulationMaterial`.
- `wall-type-auto-assign.test.ts` — variant DNA → variant id.
- `built-in-types.test.ts` — 7 types, primary ids stable (+Boy-Scout fix: openings στο getAllBuiltInTypes count).
- `envelope-shell.test.ts` — DNA-EPS wall force-off (dedup).
275/275 jest PASS.

## 6. Deferred (v1.1)
- Advanced ξεχωριστά face/edge UI για τη μόνωση· thermal-render finish coat πάνω από EPS· per-category style overrides· 2Δ DXF visual styles.

---

## Changelog
- **2026-06-12** — v1: Β.1 default concrete textures (foundation+beam στο `MATERIAL_TEXTURE_MAP`) + Β.2 Revit wall-type catalog (`WALL_TYPE_SEEDS`, brick-cored 25/25+EPS/20/10) + EPS↔ETICS dedup (`wallHasExteriorInsulation` → `envelope-shell` force-off). 275 jest pass. 🔴 browser-verify + commit.
