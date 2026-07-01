# HANDOFF — Ορθογώνια κολόνα: φύλακας αναλογίας (aspect) κατά την αλλαγή διαστάσεων

**Ημερομηνία:** 2026-07-01
**Θέμα:** Όταν ο χρήστης αλλάζει τις διαστάσεις μιας **ορθογώνιας κολόνας**, αν η νέα αναλογία πλευρών περνά το κατώφλι **κολόνα → τοιχίο (shear-wall)**, το σύστημα να **προειδοποιεί** (ή/και να μπλοκάρει) ότι οι νέες διαστάσεις μετατρέπουν την κολόνα σε τοιχίο (χάνει ιδιότητες κολόνας, αποκτά ιδιότητες τοιχίου).

**Γλώσσα απαντήσεων:** Ελληνικά (CLAUDE.md LANGUAGE RULE).

---

## 1. Η ΣΧΕΣΗ (ήδη ερευνήθηκε — επιβεβαιωμένο στον κώδικα)

- **Σταθερά:** `SHEAR_WALL_MIN_ASPECT_RATIO = 4` — `src/subapps/dxf-viewer/bim/types/column-types.ts:469`
- **Κανόνας (Eurocode 2 §9.6.1 / Eurocode 8 §5.4.2.4):**
  `aspect = longSide / shortSide`
  - **aspect ≤ 4 → ΚΟΛΟΝΑ** (rectangular) — *ακριβώς 4 = κολόνα*
  - **aspect STRICTLY > 4 → ΤΟΙΧΙΟ** (shear-wall)
- **Στρογγυλοποίηση:** σε **1 δεκαδικό** πριν τη σύγκριση (ώστε 4.00000001 από float να μη γίνει τοιχίο). Βλ. `rectAspectKind` (`bim/columns/column-from-faces.ts`) και `perimeterAspectRatio` (ίδιο αρχείο).

---

## 2. SSOT AUDIT — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ, GREP ΠΡΩΤΑ — ΜΗΝ ΦΤΙΑΞΕΙΣ ΔΙΠΛΟΤΥΠΟ)

### Ταξινόμηση aspect (reuse — ΜΗΝ ξαναγράψεις τον κανόνα):
- `rectAspectKind(rect)` → `'rectangular' | 'shear-wall'` — `bim/columns/column-from-faces.ts`
- `perimeterAspectRatio(perimeter)` → rounded aspect — ίδιο αρχείο
- `isWallColumnKind(kind)` → `shear-wall | composite | U-shape` — ίδιο αρχείο
- `classifyColumnSectionSize(shortMm, isShearWall)` → tier `block | warning | ok` — `bim/validators/column-validator.ts`

### ΥΠΑΡΧΟΝ ΠΡΟΗΓΟΥΜΕΝΟ WARN (ΚΡΙΣΙΜΟ — πιθανό reuse pattern):
- **`requestColumnIsColumnWarn(aspect)`** — `bim/columns/column-perimeter-confirm-store.ts:101`
  Ήδη εμφανίζει confirm dialog που **προειδοποιεί για κολόνα-vs-τοιχίο βάσει aspect** (χρησιμοποιείται στο «Τοιχίο από περίγραμμα», `use-column-perimeter-commit.ts`). **Αυτό είναι το πιο κοντινό precedent.**
- **`requestColumnAdoptSizeConfirm(...)` + `ColumnAdoptSizeDialog`** — `bim/columns/column-adopt-size-confirm-store.ts` + `ui/dialogs/ColumnAdoptSizeDialog.tsx`. Δείχνει `isShearWall` flag + tier (block=κόκκινο). Άλλο precedent για warn UI.
- Οι 9 θέσεις που αγγίζουν το aspect/threshold: `use-column-rect-adopt.ts`, `column-types.ts`, `use-column-perimeter-commit.ts`, `column-from-faces.ts`, `column-adjacency-detector.ts`, `column-validator.ts`, `column-perimeter-confirm-store.ts` (+ tests).

### ΠΟΥ ΑΛΛΑΖΟΥΝ ΟΙ ΔΙΑΣΤΑΣΕΙΣ ΚΟΛΟΝΑΣ (candidate injection points — GREP/confirm στη session):
Ο φύλακας πρέπει να πιάνει **ΟΛΑ** τα paths αλλαγής width/depth υφιστάμενης κολόνας. Βρες το **ΕΝΑ κοινό commit point** (ή βάλε shared guard) — μην το διπλασιάσεις:
1. **Panel ιδιοτήτων:** `ui/column-advanced-panel/` (π.χ. `ColumnPropertiesTab`, `column-property-fields`).
2. **Ribbon param routing:** `ui/ribbon/hooks/bridge/column-bridge-param-routing.ts`, `useColumnParamsDispatcher.ts`, `column-command-keys.ts`, `column-bridge-combobox-resolvers.ts`.
3. **Grips (resize):** `hooks/grips/grip-parametric-commits.ts`, `bim/columns/column-rect-adapter.ts`, `bim/columns/column-grips.ts`, `column-variant-grips.ts`.
4. **Dynamic Input** (numeric width/depth).
5. Το τελικό write στη scene/Firestore (updateDoc / mergeDocsIntoScene / `completeColumnFromClick` ισοδύναμο για edit).

Στόχος big-player-grade: **ΕΝΑ SSoT σημείο** που κάθε αλλαγή διάστασης περνά → εκεί ο aspect-guard. Αν δεν υπάρχει, εξέτασε δημιουργία κεντρικού `applyColumnDimensionChange` (ή guard hook) που όλα τα paths καλούν.

---

## 3. BIG-PLAYER ΠΡΑΚΤΙΚΗ (ερεύνησέ το & ακολούθησέ το)

Giorgio: υλοποίηση **Revit / Maxon (Cinema 4D) / Figma-level**, **FULL ENTERPRISE + FULL SSOT**. Αν οι μεγάλοι δεν προτείνουν κάτι, **ακολούθησε την πρακτική τους**.
- **Revit:** columns & structural walls = διαφορετικές families· η αλλαγή διάστασης ΔΕΝ κάνει auto-reclassify — κρατά family, αλλά το αναλυτικό μοντέλο/validation μπορεί να flag-άρει. Συνήθως **warn**, όχι hard block.
- **ETABS/EC:** «wall vs column» ορίζεται από γεωμετρία (aspect) → reclassification με ειδοποίηση.
- **Πρόταση κατεύθυνσης (επιβεβαίωσε):** **WARN + inform** (non-blocking confirm: «οι νέες διαστάσεις (aspect X > 4) δημιουργούν ΤΟΙΧΙΟ — η κολόνα χάνει τις ιδιότητες κολόνας»), με επιλογή «Συνέχεια ως τοιχίο» / «Άκυρο». Το hard-block είναι λιγότερο big-player. Giorgio άφησε ανοιχτό «warn ή block» — αποφάσισε με βάση big-player + ρώτησέ τον αν χρειάζεται με συγκεκριμένο ASCII/mockup (προτιμά συγκεκριμένο παράδειγμα, όχι αφηρημένη ερώτηση).

---

## 4. SCOPE (ΤΩΡΑ)

- **ΜΟΝΟ ορθογώνιες κολόνες** (Giorgio: «προς το παρόν οι ορθογώνιες»).
- Trigger: αλλαγή width/depth υφιστάμενης `rectangular` κολόνας ώστε rounded(aspect) **> 4**.
- Αν περνά το κατώφλι → warn (ή block) + σαφές μήνυμα ότι γίνεται τοιχίο.
- Τα τοιχία (ήδη shear-wall) εκτός scope τώρα (μετέπειτα).

---

## 5. ΚΑΝΟΝΕΣ / ΠΕΡΙΟΡΙΣΜΟΙ (ΑΠΑΡΑΒΑΤΟΙ)

- ⚠️ **ΤΟ WORKING TREE ΜΟΙΡΑΖΕΤΑΙ ΜΕ ΑΛΛΟΝ AGENT** → **surgical edits μόνο**, **ΠΟΤΕ `git add -A`**, άγγιξε μόνο τα δικά σου αρχεία.
- ⚠️ **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ Ο AGENT** (N.(-1)). Μην κάνεις commit/push.
- **SSOT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ** — reuse `SHEAR_WALL_MIN_ASPECT_RATIO` + `rectAspectKind`/`perimeterAspectRatio` + `requestColumnIsColumnWarn` pattern. **ΜΗΔΕΝ διπλότυπο κατώφλι/κανόνας.**
- **N.17:** ΜΗΝ τρέχεις `tsc`/typecheck. **jest επιτρέπεται** (στοχευμένα).
- **ADR-driven (N.0.1):** βρες/ενημέρωσε σχετικό ADR (πιθανά ADR-398 column placement, ή column-validator ADR, ή νέο). Code = source of truth.
- **GOL + SSOT + no `any`/inline styles/hardcoded strings (i18n)** — τα warn μηνύματα μέσω `t('...')` με keys σε `el` + `en` locales.
- Απάντα **Ελληνικά**.

---

## 6. ΣΧΕΤΙΚΟ ΠΡΟΣΦΑΤΟ CONTEXT (uncommitted, ίδιο working tree)

Στην προηγούμενη session (ίδιο θέμα-οικογένεια, **UNCOMMITTED**):
- Σκέτος «Τοίχος» → auto-detect DXF παραλληλογράμμου (hover διακεκομμένη + κλικ γεμίζει) — ADR-363.
- Σκέτος «Κολόνα» → adopt ΚΑΘΕ σχήματος (ορθογώνιο + Γ/Τ/Π) με hover διακεκομμένη + adopt/default confirm — ADR-398 §3.17 shape ext. Νέα: `findAdoptableColumnPerimeter`, `resolvePerimeterAdoptInfo` (`column-adopt-rect.ts`), `onAdoptShape` (`useColumnTool.ts`).
Αυτά είναι **άσχετα** με το τρέχον task αλλά ζουν στο ίδιο working tree — μην τα πειράξεις.

---

## 7. ΠΡΩΤΟ ΒΗΜΑ ΣΤΗ ΝΕΑ SESSION

1. **Model check** (N.14): δήλωσε μοντέλο (πιθανό **Opus** — cross-cutting, πολλά edit paths) & περίμενε «ok».
2. **Grep SSOT audit** (κεφ. 2 & candidate injection points) → βρες το/τα σημείο(α) commit αλλαγής διάστασης.
3. **Big-player research** (κεφ. 3) → warn vs block.
4. **Plan Mode** → παρουσίασε σχέδιο (SSoT reuse) + concrete UX mockup στον Giorgio ΠΡΙΝ κώδικα.
5. Υλοποίηση + jest + ADR. **ΟΧΙ commit.**
