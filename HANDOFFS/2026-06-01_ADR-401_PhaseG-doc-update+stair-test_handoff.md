# HANDOFF — ADR-401 Phase G: doc update + stair-vertical-profile test

- **Ημερομηνία**: 2026-06-01
- **Συντάκτης**: Claude (Opus 4.8)
- **Για**: επόμενη συνεδρία (μετά από /clear)
- **Εύρος**: ΔΥΟ μικρές/ασφαλείς εργασίες — (α) ενημέρωση ADR-401 doc για το Phase G + (β) test για `stair-vertical-profile.ts`
- **⚠️ COMMIT**: ΤΟ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ Ο AGENT. Μην κάνεις commit/push.

---

## 0. Τι έγινε στην προηγούμενη συνεδρία (context)

1. **ADR-396 hotfix (committed + pushed)** — νέο SSoT `bim/geometry/shared/safe-polygon-boolean.ts` (`safeUnion`/`safeIntersection`) που τύλιξε τη `polygon-clipping` με robustness scaling + try/catch· έλυσε το full `/dxf/viewer` RouteError crash («Unable to complete output ring») σε meter-scenes. Commit `0b89afd5`.
2. **3 grouped commits + push** (`30b05837..f256aa90`):
   - `0b89afd5` fix(bim): ADR-396 polygon-clipping crash guard
   - `cf76362b` feat(bim): **ADR-401 Phase G** stair attach + host-footprint-eval SSoT
   - `f256aa90` feat(bim): ADR-403 Phase 2 OSNAP 3D placement
3. Διαβάστηκε όλο το ADR-401 → εντοπίστηκαν 2 κενά που κλείνουν ΤΩΡΑ (α + β).

---

## 1. Το πρόβλημα που κλείνουμε

Το commit `cf76362b` πρόσθεσε τον **πυρήνα** του stair attach-to-structural (Phase G), ΑΛΛΑ:

- **Κενό #2 (doc↔code mismatch):** Το `ADR-401` doc **ΔΕΝ αναφέρει πουθενά** το Phase G. Το status header + changelog ακόμα λένε «❌ Εκκρεμεί: Sub-Phase 1 stair attach». → **Task α**.
- **Κενό #3 (ποιότητα):** Το `stair-vertical-profile.ts` commit-αρίστηκε **ΧΩΡΙΣ test** (όλες οι άλλες φάσεις A→F.3 είχαν πάντα tests). → **Task β**.

> ℹ️ Phase G = μόνο ο **resolver πυρήνας** (mirror του column F.1). Οι stair **consumers** (3D geometry / 2D / BOQ / auto-attach / ribbon / 3D grip = mirror F.2+F.3) **ΔΕΝ** είναι μέρος αυτού του handoff — είναι ξεχωριστή μεγαλύτερη εργασία (Plan Mode, άλλη συνεδρία).

---

## 2. TASK α — Ενημέρωση ADR-401 doc για Phase G

**Αρχείο:** `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md`

**3 σημεία:**

1. **Status header (γραμμή 3):** πρόσθεσε `+ G` στη λίστα φάσεων DONE και μια σύντομη περιγραφή Phase G (stair attach core). Άλλαξε το «🔴 browser verify A→F.3» → «A→G».
2. **§5 Φάσεις (μετά τη γραμμή ~202, το F.3 bullet):** πρόσθεσε νέο bullet:
   > **Phase G — Stair attach core ✅ DONE (2026-06-01)**: NEW SSoT `bim/geometry/stair-vertical-profile.ts` (`resolveStairBaseZmm` upper-envelope / `resolveStairTopZmm` lower-envelope / `resolveStairVerticalProfile` + **whole-step snap** Revit ίσα risers / `makeStairHostResolver`) + Boy-Scout (N.0.2) NEW `bim/geometry/host-footprint-eval.ts` (point-based host-face SSoT — `hostUndersideAt`/`hostTopsideAt`/`collectHostFootprints`/`makeHostFootprintResolver`, εξήχθη από `column-vertical-profile.ts` που πλέον re-exports). `stair.schemas.ts` strict attach Zod (mirror column) + `stair-types.ts`/`bim-binding.ts` attach binding fields. **❌ Εκκρεμεί: stair consumers (3D/2D/BOQ/auto-attach/ribbon/grip = mirror F.2+F.3).**
3. **§8 Changelog (νέα γραμμή στην ΚΟΡΥΦΗ του πίνακα, μετά το `|------|...|` στη γραμμή ~250):** ίδιο περιεχόμενο με το bullet #2, μορφή πίνακα `| 2026-06-01 | Giorgio + Claude (Opus 4.8) | **Phase G — STAIR ATTACH CORE IMPLEMENTED** (committed cf76362b)... |`. Σημείωσε ρητά «**committed cf76362b**» (όχι «pending commit» — έγινε ήδη commit).

**N.15 (ΑΠΑΡΑΒΑΤΟ):** ενημέρωσε ΚΑΙ:
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` — αν υπάρχει stair-attach item.
- `docs/centralized-systems/reference/adr-index.md` — αν χρειάζεται.
- `~/.claude/projects/C--Nestor-Pagonis/memory/` topic `project_adr401_wall_top_constraints.md` (one-liner: Phase G core committed).

---

## 3. TASK β — Test για `stair-vertical-profile.ts`

**Νέο αρχείο:** `src/subapps/dxf-viewer/bim/geometry/__tests__/stair-vertical-profile.test.ts`

**Mirror του:** `src/subapps/dxf-viewer/bim/geometry/__tests__/column-vertical-profile.test.ts` (19 tests — ίδιο fixture pattern).

**Exports προς test** (από `../stair-vertical-profile`):
`resolveStairBaseZmm`, `resolveStairTopZmm`, `resolveStairVerticalProfile`, `makeStairHostResolver`, types `StairVerticalParams`, `StairVerticalContext`, `StairVerticalProfile`.

**Fixtures (mirror column test):**
- `HostFootprintInput` από `../wall-host-plan-builder` — `{ hostId, hostType:'beam'|'slab', footprint: Pt2[], undersideZmm, topsideZmm? }`.
- `ctx = { resolveHostInput: makeStairHostResolver(hosts) }`.
- `StairVerticalParams`: `basePoint:{x,y,z}`, `direction` (deg), `totalRun` (mm), `width` (mm), `rise`, `stepCount`, `totalRise`, `topBinding`/`baseBinding`, `attachTopToIds`/`attachBaseToIds`.

**Sample points που πρέπει να καλύπτουν τα host footprints** (δες `topSamples`/`baseSamples` στις γραμμές 95-119 του source):
- **top samples** = κέντρο + ±width/2 (perp) στο σημείο `basePoint + dir·totalRun`.
- **base samples** = κέντρο + ±width/2 στο `basePoint`.

**Test cases (≥ ~12, mirror column):**
1. **fast path** — καμία attach (`topBinding`/`baseBinding` ≠ 'attached') → nominal `rise`/`stepCount`/`totalRise` byte-for-byte· `topHasAttach=false`, `baseHasAttach=false`.
2. **base upper-envelope** — `baseBinding='attached'`, host top-face καλύπτει base sample → `baseZmm = host topside` (ψηλότερο όταν 2 hosts).
3. **base ακάλυπτη** → nominal `basePoint.z`, `hasAttach=false`.
4. **top lower-envelope** — `topBinding='attached'`, host underside → `topZmm = χαμηλότερη underside` (όταν 2 hosts).
5. **top ακάλυπτη** → nominal `baseZmm + rise·stepCount`.
6. **whole-step snap** — π.χ. nominal rise=180, attached totalRise=1700 → `stepCount = round(1700/180) = 9`, `rise = 1700/9 ≈ 188.9`, `topZmm` = host underside (ακριβής).
7. **degenerate** — host underside ≤ base (top ≤ base) → `degenerate=true`, fallback nominal `stepCount`/`rise`, `topZmm = base + rise·stepCount`.
8. **missing host** — `attachTopToIds=['ghost']`, resolver επιστρέφει null → `missingHostIds=['ghost']`, fallback nominal.
9. **both attached** — base + top μαζί.
10. **`rise<=0` guard** → degenerate.
11. **`makeStairHostResolver`** — lookup by id / unknown → null.
12. **stepCount ≥ 1** (Math.max(1, ...)) — πολύ μικρό totalRise.

**tsc/test commands:**
```
npx jest stair-vertical-profile --silent
npx jest column-vertical-profile --silent   # regression (re-export άλλαξε)
npx tsc --noEmit -p tsconfig.json            # background, μην μπλοκάρεις
```

---

## 4. Κανόνες / προσοχή

- **ΓΛΩΣΣΑ:** απαντάς ΠΑΝΤΑ στα Ελληνικά.
- **❌ ΜΗΝ κάνεις commit/push** — ο Giorgio κάνει commit μόνος του. Όταν τελειώσεις α+β, ανέφερε «έτοιμο για commit» + λίστα αρχείων.
- **N.2:** μηδέν `any`/`as any`/`@ts-ignore`.
- **ΜΗΝ** αγγίξεις τους stair consumers (3D/BOQ/ribbon) — εκτός εύρους.
- **ΜΗΝ** προσπαθήσεις browser verify — είναι δουλειά του Giorgio.
- Μοντέλο: **Sonnet 4.6** αρκεί (2 αρχεία, 1 domain, doc + test). Πρότεινέ το στον Giorgio στην αρχή.

## 5. Verify ότι όλα δουλεύουν στο τέλος
- `npx jest stair-vertical-profile column-vertical-profile --silent` → όλα PASS.
- tsc clean στα αγγιγμένα.
- ADR-401 status/changelog + N.15 αρχεία ενημερωμένα.
- Working tree: μόνο `ADR-401.md` (M) + `stair-vertical-profile.test.ts` (new) + N.15 docs → έτοιμα για τον Giorgio να κάνει commit.
