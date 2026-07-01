# HANDOFF — Ειδοποιήσεις αλλαγής «σχέσεων» διατομής σε ΟΛΟΥΣ τους τύπους κολόνας

**Ημερομηνία:** 2026-07-02
**Θέμα:** Επέκταση του μηχανισμού προειδοποίησης (live 🟠 πορτοκαλί περίγραμμα φαντάσματος + παράθυρο confirm) που φτιάξαμε για την **ορθογώνια κολόνα** ώστε να δουλεύει σε **ΟΛΟΥΣ τους τύπους κολόνας**, όταν αλλάζουν οι διαστάσεις/«σχέσεις» τους ώστε η διατομή να βγαίνει εκτός λογικού/κανονιστικού εύρους.

**Τύποι (Giorgio):** «Γ» (L-shape), «Τ» (T-shape), «Π» (U-shape), «Πολύγωνο» (polygon), «Τοιχίο διάτμησης» (shear-wall — ήδη έγινε), «Σχήμα Ι» (I-shape) — **και** η ορθογώνια/circular όπου έχει νόημα.

**Γλώσσα απαντήσεων:** Ελληνικά (CLAUDE.md LANGUAGE RULE).

---

## 0. ΚΑΝΟΝΕΣ / ΠΕΡΙΟΡΙΣΜΟΙ (ΑΠΑΡΑΒΑΤΟΙ)

- ⚠️ **ΤΟ WORKING TREE ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT** → **surgical edits μόνο**, **ΠΟΤΕ `git add -A`**, άγγιξε μόνο τα δικά σου αρχεία.
- ⚠️ **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ Ο AGENT** (N.(-1)). Μην κάνεις commit/push.
- **Big-player level:** Revit / Maxon (Cinema 4D) / Figma-grade. **FULL ENTERPRISE + FULL SSOT.** Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθησε **την πρακτική τους** (για δομικά: Revit/ETABS/Tekla).
- **ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ** — reuse ό,τι υπάρχει (κεφ. 2 & 3). **ΜΗΔΕΝ διπλότυπα.**
- **N.17:** ΜΗΝ τρέχεις `tsc`/typecheck. **jest επιτρέπεται** (στοχευμένα).
- **Plan Mode ΠΡΩΤΑ:** παρουσίασε σχέδιο + **συγκεκριμένο παράδειγμα/mockup ανά τύπο** στον Giorgio ΠΡΙΝ κώδικα (προτιμά αριθμητικά/οπτικά παραδείγματα, όχι αφηρημένα).
- **ADR-driven (N.0.1):** ενημέρωσε **ADR-363** (επόμενο subsection = **§5.6c**). Code = source of truth.
- **GOL + SSOT + no `any`/inline styles/hardcoded strings** — τα warn μηνύματα μέσω `t('...')` σε `el`+`en` locales.
- **Model:** Opus (cross-cutting, πολλοί τύποι/αρχεία).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (UNCOMMITTED, ίδιο working tree — ΑΥΤΟ ΕΙΝΑΙ Η ΥΠΟΔΟΜΗ ΠΟΥ ΘΑ ΕΠΕΚΤΕΙΝΕΙΣ)

Δύο ολοκληρωμένα «warn» features για την **ορθογώνια κολόνα / τοιχίο** (ADR-363 §5.6 + §5.6b), με **live πορτοκαλί ghost + confirm dialog**:

### §5.6 — Κολόνα → Τοιχίο (aspect > 4)
- Ορθογώνια κολόνα που αλλάζει διαστάσεις ώστε rounded(long/short) > 4 (EC2 §9.6.1) → dialog «γίνεται τοιχίο» (Μετατροπή σε τοιχίο / Κράτα κολόνα / Άκυρο) + live πορτοκαλί περίγραμμα κατά το grip-drag.

### §5.6b — Ασυνήθιστες διαστάσεις τοιχίου (SOFT όρια)
- shear-wall με πάχος > 1.5m ή μήκος > 30m → dialog «εκτός τυπικού» (Συνέχεια / Άκυρο) + live πορτοκαλί. **ΠΟΤΕ block** (Ευρωκώδικες = κανένα μέγιστο· big-players = κανένα cap).

### Engineering συμπεράσματα (επιβεβαιωμένα με Giorgio)
- **Δεν υπάρχει** μέγιστο πάχος/μήκος στους Ευρωκώδικες — μόνο ΕΛΑΧΙΣΤΑ + οπλισμός.
- Οι μεγάλοι (Revit/ETABS/Tekla) **δεν κάνουν hard-block** γεωμετρίας· δίνουν **ζωντανή οπτική ανάδραση** στο σχήμα κατά το drag + **passive warn στο commit** — ΠΟΤΕ modal mid-drag, ΠΟΤΕ per-frame toast.
- Γι' αυτό επιλέχθηκε: **live χρωματισμός ghost (πορτοκαλί = προσοχή, ΟΧΙ κόκκινο=απαγορευτικό) + confirm στο release**. Μηδέν 60fps hot-path άγγιγμα (το ghost ήδη ξαναζωγραφίζεται κάθε frame).

---

## 2. SSOT ΠΟΥ ΘΑ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ (ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ — grep πρώτα)

### Χρώμα (ΕΝΑ SSoT)
- `bim/ghosts/ghost-status-color.ts` → `resolveGhostStatusColor(status)` με status **`'warning'` (🟠 `#f59e0b`)** [+ `'beam'` 🟢, `'overlap'` 🔴]. **Χρησιμοποίησέ το** — μη φτιάξεις νέο χρώμα.

### Live πορτοκαλί περίγραμμα (ΕΝΑ path)
- `hooks/tools/grip-ghost-preview-draw-helpers.ts` → **`drawColumnAspectWallWarning(ctx, original, transformed, t, vp)`**. Σήμερα gate = `detectRectColumnBecomesWall(...) ∨ detectShearWallExtentCrossing(...)`. **ΕΔΩ θα προσθέσεις το γενικευμένο per-type gate.** Διαβάζει `transformed.geometry.footprint.vertices` — **υπάρχει για ΟΛΟΥΣ τους τύπους** (L/T/U/I/polygon/circular) → το περίγραμμα γενικεύεται δωρεάν.
- Wired στο `hooks/tools/useGripGhostPreview.ts` (μετά το body ghost, `ctx` πάνω από το `bimPreview` — ίδιο canvas).

### Confirm store + dialog (pattern να αντιγράψεις)
- `bim/columns/column-becomes-wall-confirm-store.ts` + `ui/dialogs/ColumnBecomesWallDialog.tsx` (actions `convert`/`keep`/`cancel`).
- `bim/columns/shear-wall-extent-confirm-store.ts` + `ui/dialogs/ShearWallExtentDialog.tsx` (actions `proceed`/`cancel`).
- Mounts: `app/dxf-viewer-lazy-components.tsx` (lazy) + `app/DxfViewerDialogs.tsx` (Suspense mount).
- i18n: `src/i18n/locales/{el,en}/dxf-viewer-shell.json` → `columnBecomesWall.*`, `shearWallExtent.*`.

### Pure detectors (pattern)
- `bim/columns/column-aspect.ts` — `roundedRectAspect`, `isShearWallAspect`, `rectParamsAspect`, `detectRectColumnBecomesWall(prev,next)`, `reclassifyRectToShearWall`.
- `bim/columns/shear-wall-extents.ts` — `isShearWallExtentExceeded`, `detectShearWallExtentCrossing(prev,next)` (+ consts `MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM=1500`, `MAX_TYPICAL_SHEAR_WALL_LENGTH_MM=30000` στο `column-types.ts`).
- **Μοτίβο «crossing»:** επέστρεψε non-null ΜΟΝΟ στη ΝΕΑ υπέρβαση (prev εντός → next εκτός) ώστε **μηδέν re-nag**. Ίδιο μοτίβο για κάθε τύπο.

### ⭐ ΕΝΑ SSoT GUARD FLOW (κεντρικοποιήθηκε — ΕΔΩ μπαίνει το per-type βήμα)
**`bim/columns/column-edit-guard-flow.ts` → `runColumnEditGuards(prevParams, nextParams, finalize)`** είναι πλέον ΤΟ ΕΝΑ σημείο αλήθειας για τη σειρά ελέγχων (§5.6 becomesWall → §5.6b extent → finalize). Καλείται και από τα ΔΥΟ paths:
1. **Αριθμητικό (panel + ribbon):** `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` → `runColumnEditGuards(column.params, nextParams, commit)`.
2. **Grip resize:** `hooks/grips/grip-parametric-commits.ts` → `commitColumnGripDrag` → `runColumnEditGuards(originalParams, newParams, finalize)` (τρέχει **μία φορά στο mouse-up** → `grip-mouseup-handler.ts:119` → `commitDxfGripDragModeAware`).

➡️ **Το per-type generic check (validator-driven, κεφ. 3) θα το προσθέσεις ΩΣ ΝΕΟ ΒΗΜΑ μέσα στο `runColumnEditGuards`, ΠΡΙΝ το τελικό `finalize(nextParams)`.** Ένα edit → και τα δύο paths καλύπτονται αυτόματα. **ΜΗΝ** ξαναγράψεις guard σε κάθε path.

---

## 3. Η ΚΑΡΔΙΑ ΤΟΥ ΣΧΕΔΙΟΥ — «σχέσεις» ανά τύπο = Ο VALIDATOR (ΗΔΗ ΥΠΑΡΧΕΙ)

**ΚΡΙΣΙΜΟ SSoT εύρημα:** οι «σχέσεις» κάθε τύπου **είναι ΗΔΗ κωδικοποιημένες** στον validator. ΜΗΝ ξαναγράψεις κανόνες ανά τύπο — **reuse τον validator**.

- `bim/validators/column-validator.ts` → `validateColumnParams(params, codeId?)` επιστρέφει:
  - `hardErrors[]` (i18n keys) — σήμερα **μπλοκάρουν δημιουργία**.
  - `codeViolations[]` (i18n keys) — **non-blocking** (κόκκινο badge).
  - `bimValidation: { hasCodeViolations, violationKeys, lastValidatedAt }`.
- Per-type έλεγχοι μέσα στο `validateVariantParams`:
  - **L-shape (Γ):** `invalidLshapeArm` (armLength/armWidth ≤0 ή > bbox).
  - **T-shape (Τ):** `invalidTshapeWeb` / `invalidTshapeFlange` (web/flange proportions).
  - **U-shape (Π):** `invalidUshapeLeg`/`invalidUshapeBase` + `shearWallThicknessTooSmall` (min πάχος EC8).
  - **I-shape (Ι):** `invalidIShapePlateThickness`, `invalidIShapeFlangeOverlap` (2·tf ≥ h), `invalidIShapeWebOverflow` (web ≥ flange).
  - **polygon:** `invalidPolygonSides` (∉ [3,12]).
  - **shear-wall:** `shearWallThicknessNotConstructible` (<150), `shearWallAspectRatioBelow` (aspect<4).
  - Γενικά: `validateDimensions` (min πλευρές), `validateSlenderness` (`maxSlendernessExceeded`), `validateReinforcementRatio` (ρ min/max).
- `classifyColumnSectionSize(shortMm, isShearWall)` → tier `block`/`warning`/`ok`.
- ΗΔΗ υπάρχει **violations badge** στο ribbon: `useRibbonColumnBridge.getBadgeState` → `COLUMN_RIBBON_BADGE_KEYS.violations` → `column.validation.hasCodeViolations`. Δηλαδή υπάρχει ήδη surfacing — αλλά **παθητικό (badge)**, όχι live-ghost/dialog.

### Προτεινόμενη κατεύθυνση (επικύρωσέ την στο Plan Mode)
**Γενικός, type-agnostic detector μέσω validator-diff (FULL SSOT, μηδέν per-type διπλότυπο):**
```
detectColumnRelationshipWarning(prev, next):
  prevV = validateColumnParams(prev); nextV = validateColumnParams(next)
  newViolations = nextV.codeViolations \ prevV.codeViolations   // εμφανίστηκαν ΤΩΡΑ
  newHardErrors = nextV.hardErrors \ prevV.hardErrors           // (απόφαση: warn ή block;)
  → non-null αν υπάρχουν νέες → { violationKeys, hardErrorKeys }
```
- **Live 🟠 outline:** gate = `becomesWall ∨ extentCrossing ∨ detectColumnRelationshipWarning != null` (πάνω στο ΙΔΙΟ `drawColumnAspectWallWarning`).
- **Confirm dialog:** ΕΝΑ **generic** «section relationship warning» dialog που δείχνει τα specific μηνύματα (reuse `violationKeys` i18n → ήδη μεταφρασμένα). Actions: `proceed`/`cancel` (mirror `shearWallExtent`). Μη φτιάξεις dialog ανά τύπο.
- Τα §5.6 (aspect) + §5.6b (extents) **ΜΕΝΟΥΝ** ως ειδικές περιπτώσεις (ΔΕΝ είναι validator violations: aspect>4 rectangular = kind μένει rectangular χωρίς violation· extents = κανένα max στον validator). Ο generic detector τα **συμπληρώνει** για L/T/U/I/polygon.

### Ανοιχτά ερωτήματα για Plan Mode (ρώτησε Giorgio με συγκεκριμένα παραδείγματα ανά τύπο)
1. **hardErrors σε EDIT:** σήμερα μπλοκάρουν δημιουργία. Σε αλλαγή διάστασης υπάρχουσας κολόνας, ένα degenerate (π.χ. I-shape 2·tf ≥ h) → **warn+allow** (big-player) ή **warn+block**; Ερεύνησε τι κάνει το `UpdateColumnParamsCommand.validate()` σήμερα σε edit.
2. **Ποιες violations αξίζουν live-ghost+dialog** vs μόνο badge; Όλες οι νέες, ή curated subset ανά τύπο; (π.χ. slenderness/ρ ίσως μόνο badge, geometry-degeneracy → dialog.)
3. **polygon:** ποια «σχέση» αλλάζει; (sides count — όχι proportion· ίσως ελάχιστο). Circular; (μόνο διάμετρος).
4. Ένα **generic** dialog που παραθέτει τα μηνύματα, ή type-specific; (Πρόταση: ΕΝΑ generic — reuse violationKeys.)
5. Χρειάζεται και **«μετατροπή τύπου»** επιλογή (όπως το convert→shear-wall) σε κάποιον άλλο τύπο; (Μάλλον όχι — μόνο για rectangular→wall έχει νόημα reclassify.)

---

## 4. ΠΡΩΤΟ ΒΗΜΑ ΣΤΗ ΝΕΑ SESSION

1. **Model check** (N.14): δήλωσε **Opus** (cross-cutting) & περίμενε «ok» — ΕΚΤΟΣ αν ο Giorgio ήδη το όρισε.
2. **Διάβασε ΟΛΟ αυτό το handoff** + άνοιξε τα αρχεία του κεφ. 2 & 3 (grep/read).
3. **SSOT audit (grep):** `validateColumnParams`, `validateVariantParams`, `column-validator.ts` codeViolations, `drawColumnAspectWallWarning`, `useColumnParamsDispatcher`, `commitColumnGripDrag`, `ghost-status-color` `warning`, `ColumnEntity.validation` / violations badge. Επιβεβαίωσε πού «ζουν» οι σχέσεις κάθε τύπου.
4. **Big-player research:** τι κάνουν Revit/ETABS/Tekla όταν αλλάζουν οι αναλογίες διατομής ανά τύπο (passive warn on commit, non-blocking) → επιβεβαίωσε την κατεύθυνση §3.
5. **Plan Mode:** παρουσίασε σχέδιο (validator-driven generic detector + generic dialog + γενικευμένο 🟠 outline) + **concrete παράδειγμα/mockup ανά τύπο** (Γ/Τ/Π/Ι/polygon) ΠΡΙΝ κώδικα. Λύσε τα ανοιχτά ερωτήματα §3 με Giorgio.
6. Υλοποίηση σε ΟΛΟΥΣ τους τύπους + jest + **ADR-363 §5.6c**. **ΟΧΙ commit.**

---

## 5. ΓΡΗΓΟΡΗ ΛΙΣΤΑ ΑΡΧΕΙΩΝ (this session, UNCOMMITTED — reuse/extend)

**NEW:** `bim/columns/column-aspect.ts`, `bim/columns/shear-wall-extents.ts`, `bim/columns/column-edit-guard-flow.ts` (⭐ `runColumnEditGuards` SSoT — extend ΕΔΩ), `bim/columns/column-becomes-wall-confirm-store.ts`, `bim/columns/shear-wall-extent-confirm-store.ts`, `ui/dialogs/ColumnBecomesWallDialog.tsx`, `ui/dialogs/ShearWallExtentDialog.tsx` (+ 2 test suites).
**MOD:** `bim/columns/column-from-faces.ts`, `bim/types/column-types.ts` (consts), `bim/ghosts/ghost-status-color.ts` (+warning), `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts`, `hooks/grips/grip-parametric-commits.ts`, `hooks/tools/grip-ghost-preview-draw-helpers.ts` (+outline), `hooks/tools/useGripGhostPreview.ts` (wire), `app/dxf-viewer-lazy-components.tsx`, `app/DxfViewerDialogs.tsx`, i18n el+en, ADR-363 (§5.6 + §5.6b changelog).

**Tests πράσινα this session:** column-aspect 13/13, shear-wall-extents 10/10, bim/columns+ghost+grip 668/668. ⚠️ pre-existing failures (HEAD-verified, άσχετα): 1 MEP alt-bypass, 2 text-resize ghost.
