# HANDOFF — ADR-441 Slice JOIN (Corner-fill εσχάρας πεδιλοδοκών, follow-move-safe)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — grips: beam/axis-box/wall) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT — ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ, FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (signatures παρακάτω ΗΔΗ επιβεβαιωμένα — μην τα ξαναψάχνεις). Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`/`as any`, i18n ICU (ΟΧΙ _one/_other). Renderer/canvas/scene-write/guide-render touch → stage **ADR-040** (CHECK 6B/6D).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md`** — ΟΛΟ, ιδίως **§10 (Slices 0–3 DONE)** + changelog. §4.2 #2 «ένωση στις διασταυρώσεις» = αυτό το task.
2. **`ADR-040-preview-canvas-performance.md`** — η πιο πρόσφατη changelog entry (2026-06-11 «Associative grid hosting reconciler») περιγράφει το Slice 3 path που ΘΑ ΑΓΓΙΞΕΙΣ (derive). Cardinal rules.
3. **Αυτό το handoff** (§2 signatures· §3 σχέδιο).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slices 0+1+2+3 — DONE + BROWSER-VERIFIED + committed)

ADR-441 v1 (associative grid hosting) **ΟΛΟΚΛΗΡΩΘΗΚΕ**, browser-verified live από Giorgio 2026-06-11 (commits `3dc4d92e` + `28b02b78` + Slice 0/1/2 παλιότερα):
- **Slice 0** hosting types: `GuideBinding{guideId,slot}` σε `BimEntity.guideBindings?` + Zod.
- **Slice 1** grid persistence per-όροφο (`floorplan_grid_guides`, DEPLOYED pagonis-87766).
- **Slice 2** «Εσχάρα από κάναβο» (ribbon action): `buildStripGridFromGuides` → born-hosted strips, intersection-to-intersection (centerline offset→offset), 1 undo.
- **Slice 3** follow-on-move: `useHostingReconciler` (RAF-throttled imperative, guide-store.subscribe) → hosted strips ακολουθούν live όταν σύρεις άξονα· persist on settle (`bim:entities-moved`)· persist `guideBindings` round-trip. **Verified: live follow + θέση & hosting επιβιώνουν μετά reload.**

## 1.1 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ (βρέθηκε στο browser-verify)

Η εσχάρα έχει **κενά στις 4 εξωτερικές γωνίες**. Αιτία: κάθε λωρίδα σταματά στο **centerline** του ακραίου άξονα. Στους **εσωτερικούς** κόμβους η κάθετη+οριζόντια λωρίδα καλύπτουν πλήρως το `w×w` τετράγωνο (γι' αυτό και η σκόπιμη επικάλυψη). Στις **εξωτερικές γωνίες** (όπου τελειώνουν 2 λωρίδες) το εξωτερικό τεταρτημόριο `w/2 × w/2` **δεν καλύπτεται** → ορατό κενό.

**ΔΕΝ** υπάρχει κενό στις μέσες περιμετρικές άκρες (η διαμπερής λωρίδα τα καλύπτει) — **ΜΟΝΟ στις 4 γωνίες**.

**ΠΑΓΙΔΑ (γιατί δεν είναι one-liner):** αν απλώς αλλάξεις `params.start/end` στο build, το **Slice 3 `deriveFoundationParamsFromGuides` θα το ακυρώνει** σε κάθε follow-move (ξαναγράφει coord = offset του άξονα = centerline). Άρα η επέκταση πρέπει να **επιβιώνει του derive**.

---

## 2. SSoT ΠΟΥ ΥΠΑΡΧΟΥΝ — REUSE αυτούσια (signatures ΕΠΙΒΕΒΑΙΩΜΕΝΑ)

| Τι | Πού | Signature / σημείωση |
|---|---|---|
| **Hosting binding type** | `bim/hosting/guide-binding-types.ts` | `GuideBinding{readonly guideId, readonly slot}`· `GuideBindingSlot = start-x\|start-y\|end-x\|end-y\|center-x\|center-y`. **ΕΔΩ προσθέτεις `readonly extend?: number`** (mm, signed, κατά μήκος του άξονα του slot). |
| **Zod schema** | `bim/types/guide-binding.schemas.ts` | `GuideBindingSchema = z.object({guideId, slot}).strict()` — **`.strict()`! πρόσθεσε `extend: z.number().optional()`** αλλιώς restore validation σκάει. |
| **Grid builder** | `bim/foundations/foundation-from-grid.ts` | `buildStripGridFromGuides(reader, overrides, levelId, sceneUnits)`. Εσωτερικά: `uniqueSortedAxis(guides)→{offsets[], ids[]}` (sorted), `push(start, end, bindings)`. Loops: X-guides (κατακόρυφες) ανά Y-bay· Y-guides (οριζόντιες) ανά X-bay. **Το width = `overrides.width ?? DEFAULT_STRIP_WIDTH_MM`** (foundation-completion `KIND_DEFAULTS`). |
| **Derive (Slice 3)** | `bim/hosting/derive-params-from-guides.ts` | `deriveFoundationParamsFromGuides(params, bindings, getOffset)→FoundationParams\|null`. Γράφει slot→coordinate. **ΕΔΩ: μετά το offset, πρόσθεσε `extend` (με unit-conversion).** |
| **Scene units** | `utils/scene-units.ts` | `mmToSceneUnits(units: SceneUnits)→number` (multiplier). params coords = scene units· width = mm. **half-width σε scene units = `width_mm * mmToSceneUnits(sceneUnits) / 2`** (δες `foundation-geometry.buildBandFootprint`: `hw=(width*s)/2`). |
| **Geometry SSoT** | `bim/geometry/foundation-geometry.ts` | `computeFoundationGeometry(params)` — band start→end×width. Re-derive μετά το params change (ο reconciler το κάνει ήδη). |
| **Reconciler** | `bim/hosting/guide-hosting-reconciler.ts` | `reconcileHostedFoundations(entities, getOffset)` καλεί derive → geometry+validation. **Δεν χρειάζεται αλλαγή** (το extend ζει στο binding, το derive το honors). |
| **Persistence** | `bim/foundations/foundation-firestore-service.ts` + `hooks/data/useFoundationPersistence.ts` | `guideBindings` ΗΔΗ persist+restore (Slice 3). Το `extend` ride-along αυτόματα (plain object) — **αρκεί το Zod να το επιτρέπει**. |

---

## 3. ΣΧΕΔΙΟ — Corner-fill follow-move-safe (ΕΝΑ σύστημα, FULL SSoT)

### 3.1 Μοντέλο: `extend` στο binding endpoint
Το `GuideBinding` αποκτά optional `extend?: number` (mm, signed). Σημαίνει: «μετά το offset του άξονα, μετατόπισε το coordinate του slot κατά `extend` mm». Επιβιώνει του follow-move γιατί είναι **σταθερή απόσταση σχετικά με τον (μετακινούμενο) άξονα**.

### 3.2 Build — extend ΜΟΝΟ στα ΓΩΝΙΑΚΑ endpoints
Στο `buildStripGridFromGuides`, ένα endpoint παίρνει `extend = ±width/2` **μόνο αν**:
- η λωρίδα είναι σε **extreme parallel-axis** (πρώτος/τελευταίος άξονας της διεύθυνσής της), **ΚΑΙ**
- το endpoint είναι σε **extreme perpendicular-axis** (global min/max offset).

Πρόσημο = προς τα έξω: `start` σε min → `-width/2`· `end` σε max → `+width/2`.
- π.χ. κατακόρυφη λωρίδα στο `xs[0]` (ή `xs[last]`), bottom segment (`i==0`) → binding `start-y` με `extend=-width/2`· top segment (`i==last bay`) → `end-y` με `extend=+width/2`.
- αναλόγως για οριζόντιες (`start-x`/`end-x`).

⚠️ **ΜΗΝ** επεκτείνεις μη-γωνιακά περιμετρικά άκρα → θα προεξέχουν «δόντια» στις μέσες πλευρές (λάθος visual). Η επέκταση **μόνο** σε extreme-parallel × extreme-perpendicular = ακριβώς οι 4 γωνίες. (Minimal grid 2×2: όλα γωνιακά — OK.)

### 3.3 Derive — honor `extend` (με unit-conversion)
Στο `deriveFoundationParamsFromGuides`: για κάθε binding με `off=getOffset(guideId)` ορισμένο, το coordinate = `off + (extend ? mmToSceneUnits(params.sceneUnits ?? 'mm') * extend : 0)`. **ΠΡΟΣΟΧΗ:** το derive σήμερα ΔΕΝ κάνει conversion (γράφει offset σκέτο) — πρόσθεσε την conversion ΜΟΝΟ στο extend term. Κράτα idempotent (no-change → null): σύγκρινε το τελικό coordinate (offset+extend) με το τρέχον.

### 3.4 ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (incremental, test ανά βήμα)
1. `guide-binding-types.ts` +`extend?` · `guide-binding.schemas.ts` +`extend: z.number().optional()`.
2. `derive-params-from-guides.ts` honor extend + conversion + idempotent. **Tests:** extend εφαρμόζεται· follow-move (re-derive) διατηρεί extend· no-change→null.
3. `foundation-from-grid.ts` extend μόνο σε γωνιακά endpoints. **Tests:** 3×3 → μόνο 4 γωνιακά strips έχουν extend στα σωστά slots/πρόσημα· μεσαία/εσωτερικά δεν έχουν extend.
4. (αν εφικτό) integration: corner strip params μετά από derive(moved axis) διατηρεί το `w/2` offset.

### 3.5 ΡΙΣΚΑ
1. **follow-move regression:** ΜΕΤΑ το fix, σύρε γωνιακό άξονα → η γωνία πρέπει να ΠΑΡΑΜΕΝΕΙ κλειστή (το extend είναι σταθερό σχετικά με τον άξονα). Top priority browser check.
2. **unit conversion:** mm↔scene units ΜΟΝΟ στο extend term· μη χαλάσεις το offset write.
3. **«δόντια»:** extend μόνο σε extreme-parallel × extreme-perpendicular (4 γωνίες), ΟΧΙ σε όλα τα περιμετρικά.
4. **Zod `.strict()`:** χωρίς το schema update, restore από Firestore θα πετάει σε strips με extend.
5. **Slice 4 BOQ (DEFER):** η επικάλυψη/extend κάνει double-count όγκου στους κόμβους — λύνεται με `safeUnion` (ξεχωριστό Slice 4· ΜΗΝ το πιάσεις εδώ εκτός αν ζητηθεί).

### 3.6 ΕΝΑΛΛΑΚΤΙΚΗ (αν ο extend δεν αρκεί visually)
Πλήρες miter join στις γωνίες (όπως `wall-trims.ts`) — μεγαλύτερο scope. Ο extend είναι το enterprise-minimal SSoT path· πήγαινε miter μόνο αν ο Giorgio το ζητήσει μετά το browser-verify.

---

## 4. ΚΑΝΟΝΕΣ / WORKING TREE
- **Δικά σου:** `bim/hosting/guide-binding-types.ts`, `bim/types/guide-binding.schemas.ts`, `bim/hosting/derive-params-from-guides.ts`, `bim/foundations/foundation-from-grid.ts` (+`__tests__`), ADR-441 doc. **Stage ADR-040** μόνο αν αγγίξεις scene-write/renderer (εδώ μάλλον ΟΧΙ — όλα pure/build/derive).
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** grips (beam/axis-box/wall), `src/subapps/accounting/*`. **ΠΟΤΕ `git add -A`.**
- N.17: ΕΝΑ tsc τη φορά (`Get-CimInstance Win32_Process ... *tsc*` πρώτα).
- N.15 docs: ADR-441 changelog+§10 (Slice JOIN DONE) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY. **ΜΗΝ** adr-index (shared tree).
- **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO.**

## 5. QUICK START
1. Recognition: ADR-441 §10 + §2 αυτού του handoff (signatures).
2. `git status` (Slices 0-3 committed· πιθανόν grips files από άλλον agent — μην τα αγγίξεις).
3. Υλοποίησε §3.4 incremental (type+schema → derive+tests → build+tests), test ανά βήμα.
4. jest στα hosting+foundations. tsc (serialized). ΜΗΝ commit/push.
5. Πες στον Giorgio να browser-verify: εσχάρα από κάναβο → γωνίες κλειστές → σύρε γωνιακό άξονα → γωνία παραμένει κλειστή.
