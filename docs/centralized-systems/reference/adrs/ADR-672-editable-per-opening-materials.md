# ADR-672 — Επεξεργάσιμο υλικό ανά κούφωμα (Revit family surfaces: κάσα/φύλλο/υαλοστάσιο/χειρολαβή)

**Status:** ✅ ACTIVE — υλοποιημένο 2Δ+3Δ+export+UI+persistence· follow-ups §8
**Ημερομηνία:** 2026-07-18
**Σχετικά:** ADR-611 (opening frame profile — το resolver-idiom που αντιγράφτηκε),
ADR-412/421 (BIM family types — type→instance «type wins»), ADR-668 (3Δ export OBJ/glTF — ονομάζει το
`matId`), ADR-669 (mesh identity stamping — `matId` = νόμιμο raw augmentation, element boundary §6.1),
ADR-363/358 (wall/stair material catalog — το catalog-idiom), CLAUDE.md N.0.2 / N.11 / N.18

> **Σημείωση doc-trail:** τα commits της feature αναφέρουν «ADR-669» και ένα «ADR-449 opening material
> parity notes» — **και τα δύο λάθος** (ADR-669 = mesh identity stamping· ADR-449 = structural finish skin).
> Αυτό το ADR είναι το **σωστό, ενιαίο σπίτι** της feature. Τα δύο άλλα ADRs κρατούν μόνο ό,τι τους αφορά.

---

## 1. Το πρόβλημα

> «Θέλω ο χρήστης να επιλέγει το υλικό **ανά κούφωμα** — αυτή η πόρτα δρυς, εκείνη αλουμίνιο — όπως
> Revit / ArchiCAD, αντί για το σημερινό σταθερό ξύλο/γυαλί.» — Giorgio, 2026-07-18

Πριν: **κάθε** πόρτα έβγαινε ξύλο και **κάθε** παράθυρο γυαλί, hardcoded (`OPENING_FRAME_MATERIAL_ID='mat-wood'`,
`OPENING_GLASS_MATERIAL_ID='mat-glass'` στο `bim-three-wall-opening-attach.ts`). Το πεδίο `OpeningParams.material`
υπήρχε αλλά ήταν **νεκρό** — δεν διαβαζόταν πουθενά στο 3Δ/2Δ build.

## 2. SSoT Audit (2026-07-18 — grep, όχι υπόθεση)

| Ερώτημα | Εύρημα | Απόφαση |
|---|---|---|
| Υπάρχει πεδίο υλικού; | `OpeningParams.material?` + `OpeningTypeParams.material?` (νεκρά, single) | **Επέκταση** → per-part `materials`, legacy single κρατιέται ως base layer |
| Υπάρχει resolver-idiom; | `resolveOpeningFrameProfile` (fold: default→type→instance→overrides, LAST wins) | **Αντιγραφή** → `resolveOpeningMaterial`, ίδιο σχήμα |
| Υπάρχει «υλικό ανά υπο-μέρος»; | ΣΚΑΛΕΣ: `StairMaterials {tread,riser,stringer,landing}` | **Καθρέφτης** → `OpeningMaterials {frame,leaf,glass,hardware}` |
| Λύνεται οποιοδήποτε id σε υλικό; | `getMaterial3D(id)` (catalog `mat-*` + user `bmat_*`) | Επαναχρήση αυτούσιο |
| Υπάρχει 2Δ material→χρώμα SSoT; | `getMaterialFlatColorHex(id)` (`material-catalog-defs.ts`) — precedent finishes | Επαναχρήση (ΟΧΙ το wall hatch system) |
| Υπάρχει material picker UI; | `MaterialSwatch`· catalog-per-domain (`wall/stair-material-catalog.ts`) | Επαναχρήση swatch + **νέο** `opening-material-catalog` (mirror) |

## 3. Το μοντέλο των μεγάλων

- **Revit:** door/window family = υλικό ανά sub-category (Panel/Frame/Glass/Hardware), στον **Τύπο**, με **instance override**.
- **ArchiCAD:** door/window objects με **surfaces** ανά μέρος (frame/leaf/glass).
- **Κοινό:** υλικό **ανά μέρος**, στον **Τύπο**, override ανά instance. Ταιριάζει 1-1 με `StairMaterials` + το type→instance idiom.

## 4. Η απόφαση (Giorgio)

- **Granularity: πλήρες Revit sub-category (Γ)** — `OpeningMaterials { frame?, leaf?, glass?, hardware? }`.
- **2Δ parity: ΝΑΙ** — ενιαίο υλικό 2Δ + 3Δ + export (+ μελλοντικά BOQ), όπως Revit.

## 5. Αρχιτεκτονική — ένα SSoT id ανά μέρος οδηγεί όλο το pipeline

```
UI (EditOpeningTypeDialog + OpeningMaterialSelectCell)
   └─ γράφει OpeningTypeParams.materials.<part>   (catalog: opening-material-catalog.ts)
          │  (type→instance: resolveEffectiveOpeningParams spread «type wins»)
          ▼
   OpeningParams.materials  ──►  resolveOpeningMaterial(params, typeParams?)
                                    → ResolvedOpeningMaterials { frame,leaf,glass,hardware }  (πάντα populated)
                                    │
              ┌─────────────────────┼─────────────────────────┐
              ▼                     ▼                         ▼
     3Δ: getMaterial3D(id)   2Δ: getMaterialFlatColorHex   export: matId (ADR-668)
     per sub-mesh +          → elementOverride.color        (stampOpeningMaterialIds, ADR-669)
     stampOpeningMaterialIds   fallback (OpeningRenderer)
```

**Resolution order (LAST wins, ανά μέρος)** στο `resolveOpeningMaterial`:
1. Part default — frame/leaf=`mat-wood`, glass=`mat-glass`, hardware=`mat-metal`.
2. `typeParams.material` (LEGACY single) → frame + leaf.
3. `typeParams.materials.<part>` — ο Τύπος.
4. `params.material` (LEGACY single) → frame + leaf.
5. `params.materials.<part>` — instance override.

## 6. Zero regression

Κούφωμα **χωρίς** επιλεγμένο υλικό → resolver επιστρέφει τα part defaults → **ίδιο** ξύλο/γυαλί με πριν
(3Δ + export). Το legacy single `material` εφαρμόζεται μόνο στις στερεές παρειές (frame+leaf)· το γυαλί
μένει `mat-glass` εκτός αν οριστεί ρητά `materials.glass`. Στο 2Δ, ο χρωματισμός συνθέτει `elementOverride`
**μόνο** όταν υπάρχει ρητό material — legacy κουφώματα περνούν `styleOverride` αυτούσιο (byte-identical).

## 7. Το 2Δ bug που βρέθηκε & διορθώθηκε (§ live production)

Η πρώτη υλοποίηση 2Δ parity (`OpeningRenderer.ts`) έθετε `ctx.strokeStyle = _frameColor` **πριν** το
`resolveSubcategoryStyle()`, το οποίο μετά το **πατούσε** με τον subcategory default (`DEFAULT_OBJECT_STYLES`
βάζει non-null χρώμα σε κάθε opening subcategory) → **το material χρώμα δεν εμφανιζόταν ποτέ**· η parity ήταν
ουσιαστικά νεκρή. **Fix:** το material χρώμα δρομολογείται ως `elementOverride.color` **fallback** (το
top-priority `elem` hook του resolver, ADR-375 C.5) → κερδίζει τον subcategory default, ενώ ένα ρητό
`opening.styleOverride.color` του χρήστη κερδίζει ακόμα το material. Το test ενισχύθηκε ώστε να ελέγχει το
χρώμα τη στιγμή του `stroke()` (το παλιό loose `toContain` περνούσε ΚΑΙ με το bug). 15/15 ✅.

## 8. Follow-ups (εκκρεμή)

- **Hardware geometry:** το `hardware` υλικό λύνεται από τον resolver αλλά **δεν έχει 3Δ sub-mesh / 2Δ
  representation** ακόμα — ζει μόνο σε type/UI (+ μελλοντικό BOQ/export naming). Χρειάζεται νέα γεωμετρία χειρολαβής.
- **`bmat_*` user-library dropdown:** το UI δέχεται custom `bmat_*` id μέσω free-text· πλήρες dropdown από τη
  βιβλιοθήκη = swap του `OpeningMaterialCatalogProvider` (το seam υπάρχει έτοιμο), απαιτεί company-scope hook στο dialog.
- **BOQ / schedule hookup:** το υλικό ανά μέρος να τροφοδοτεί προμετρήσεις (`bim/schedule/`).
- **2Δ = μόνο χρωματισμός** (frame stroke + glass overlay)· τα κουφώματα είναι plan symbols, όχι poché fills —
  γι' αυτό `getMaterialFlatColorHex`, ΟΧΙ το wall `resolveAutoHatch`/`MATERIAL_HATCH_MAP` (διαφορετικό vocabulary).

## 9. Αρχεία (SSoT map)

| Αρχείο | Ρόλος |
|---|---|
| `bim/types/opening-types.ts` | `OpeningMaterials` interface + `OpeningParams.materials` |
| `bim/types/bim-family-type.ts` | `OpeningTypeParams.materials` (type default) |
| `bim/types/opening.schemas.ts` | `OpeningMaterialsSchema` (`.strict()`) — pre-write gate |
| `bim/family-types/resolve-opening-material.ts` | **Resolver SSoT** — fold ανά μέρος + defaults |
| `bim/family-types/opening-material-catalog.ts` | **Catalog SSoT** — presets + `MaterialCatalogProvider` seam |
| `bim-3d/converters/bim-three-wall-opening-attach.ts` | 3Δ — per-opening resolved `getMaterial3D` + stamp `matId` |
| `bim/renderers/OpeningRenderer.ts` | 2Δ — resolved χρώμα ως `elementOverride.color` fallback |
| `ui/ribbon/components/EditOpeningTypeDialog.tsx` + `OpeningMaterialSelectCell.tsx` | UI — 4 rows ανά μέρος |
| `bim/walls/opening-firestore-service.ts` + `opening-doc-hydration.ts` | Persistence — generic pass-through (spread) |

## 10. Changelog

- **2026-07-18** — Αρχική έκδοση. Feature υλοποιημένη πλήρως (resolver + zod schema + 3Δ wiring + 2Δ parity +
  per-part UI + persistence) — commits `401222e5` (resolver), `fd327ccf` (schema), `ffc588fd` (3Δ attach),
  `ea670cb5`+`892417ab` (2Δ parity + fix §7), `7f5e915b` (UI). **Boy Scout (N.0.2):** νέο κεντρικό
  `opening-material-catalog.ts` (mirror `wall/stair-material-catalog.ts`) — έκλεισε το SSoT gap του hardcoded
  preset list μέσα στο `OpeningMaterialSelectCell`· 5 tests. Gates: family-types **19 suites / 217 ✅**,
  2Δ renderer **15/15 ✅**, `jscpd:diff` καθαρό ✅. Doc-trail ενοποιήθηκε εδώ (ήταν λάθος σε ADR-669/449).
