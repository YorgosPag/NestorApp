# HANDOFF — Ενιαίο attachment+font-aware Text-Box SSoT (λαβές = κείμενο = hover frame, 2D≡3D)

**Ημερομηνία:** 2026-06-30 (για ΝΕΑ/καθαρή συνεδρία)
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Προηγούμενο:** ADR-557 (λαβές κειμένου rect-box parity — IMPLEMENTED UNCOMMITTED). Αυτό το handoff = το **επόμενο βήμα** πάνω σε εκείνο.

---

## 0. Πλαίσιο εκτέλεσης (ΚΡΙΣΙΜΟ — διάβασέ το πρώτο)
- ⚠️ **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του task. **Ξαναδιάβασε ΚΑΘΕ αρχείο ΠΡΙΝ το edit** (αλλάζει).
- ⚠️ **COMMIT/PUSH τα κάνει Ο GIORGIO, ΟΧΙ εσύ.** Ετοίμασε, σταμάτα, ανέφερε. Ποτέ `git commit`/`push`/`--no-verify`.
- ⚠️ **ΟΧΙ `tsc`/typecheck (N.17).** Μόνο targeted jest.
- 🌐 **Απαντάς ΠΑΝΤΑ Ελληνικά.**
- 🏛️ **«Μεγάλοι παίκτες» (Revit / Maxon Cinema 4D / Figma-level) + FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι παίκτες ΔΕΝ προτείνουν κάτι, ακολούθησε την πρακτική τους. Reuse, μηδέν διπλότυπα.
- 🔎 **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep).** Βρες αν υπάρχει ήδη αντίστοιχος κώδικας/SSoT και **χρησιμοποίησέ τον** — μη φτιάξεις διπλότυπο. (Υπάρχει ήδη — βλ. §4.)
- Model: **Opus** (cross-cutting, 2D+3D+geometry).

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (λόγια Giorgio + screenshots)
> «ΚΕΙΜΕΝΑ, ΦΩΤΕΙΝΟ ΠΛΑΙΣΙΟ HOVER ΚΑΙ ΛΑΒΕΣ ΔΕΝ ΣΥΜΠΙΠΤΟΥΝ, ούτε στο 2Δ ούτε στο 3Δ. Και μάλιστα είναι σε ΔΙΑΦΟΡΕΤΙΚΕΣ θέσεις αυτά στο 3Δ και στο 2Δ. ΔΕΝ υπάρχει FULL PARITY. Επίσης το φωτεινό πλαίσιο hover ΔΕΝ εμφανίζεται στο 2Δ.»

**3 συμπτώματα (text «DDD», ύψος 250, attachment = BR):**
1. **Λαβές ≠ κείμενο**: το grip-box είναι μετατοπισμένο (στο 2Δ δεξιά του κειμένου· στο 3Δ αλλού/σκόρπιες).
2. **2Δ ≠ 3Δ**: οι θέσεις λαβών διαφέρουν μεταξύ 2D και 3D καμβά → όχι parity.
3. **Hover frame**: το φωτεινό πλαίσιο (bounding box) εμφανίζεται στο 3Δ αλλά **ΟΧΙ στο 2Δ** (στο 2Δ φωτίζεται μόνο το ίδιο το κείμενο, χωρίς πλαίσιο).

---

## 2. ROOT CAUSE (ισχυρή υπόθεση — επιβεβαίωσε με audit)
**Το `position` του κειμένου ΔΕΝ είναι πάντα κάτω-αριστερά — εξαρτάται από το `attachment` (TL/TC/TR/ML/MC/MR/BL/BC/BR, 9-point grid AutoCAD/MTEXT).** Στο screenshot το attachment ήταν **BR** → `position` = κάτω-**δεξιά**, το κείμενο εκτείνεται **αριστερά+πάνω**. Το `bim/text/text-grips.ts` (ADR-557) **κωδικοποιεί σταθερά lower-left** (`textToRectFrame` centre = `position + (w/2,+h/2)`) → λάθος για κάθε άλλο attachment.

**Δευτερεύον:** δεν υπάρχει **ΕΝΑ** text-box SSoT — υπάρχουν πολλαπλές, ασύμφωνες πηγές (down vs lower-left vs attachment-aware vs font-aware), και 2D-render / 3D-mesh / grips / hover-frame / hitTest / bounds η καθεμία υπολογίζει box αλλιώς → εξού το 2Δ≠3Δ + hover frame missing.

---

## 3. ΣΤΟΧΟΣ (πρακτική μεγάλων παικτών)
**ΕΝΑ text-box geometry SSoT — attachment-aware + (κατά προτίμηση) font-metrics-aware — που ΟΛΟΙ καταναλώνουν:** 2D text anchor, 3D text mesh, grips (`getTextGrips`), hover/selection frame, hitTest, bounds.
- **Revit / AutoCAD**: το text έχει ΕΝΑ insertion point + justification → ΕΝΑ box. Όλες οι όψεις/λαβές το διαβάζουν.
- **Figma**: το text node έχει ΕΝΑ bounding box· selection + handles + hover frame ΟΛΑ το ίδιο box.
→ Δηλαδή: **ΕΝΑ `resolveTextBox(entity)` SSoT**, N consumers. Μηδέν per-consumer math.

---

## 4. SSoT AUDIT — ΥΠΑΡΧΩΝ κώδικας προς REUSE (μη φτιάξεις νέο!)
**ΥΠΑΡΧΕΙ ΗΔΗ attachment SSoT — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟΝ:**
- `text-engine/layout/attachment-point.ts` → `offsetForJustification(attachment, bounds)` + 9-point grid (ADR-344 Φ3). **Αυτό λύνει το attachment offset.**
- `text-engine/layout/text-layout-engine.ts` → `getBoundingBox(node, opts): Rect` + `attachmentOffset` (font-aware, χρειάζεται textNode+Font — βαρύ· χρήσιμο ως ακριβές reference).
- `hooks/canvas/dxf-text-style-extractor.ts` → `extractFirstRunStyle` (attachment → `textAlign` H + `textBaseline` V — αυτό ΗΔΗ διαβάζει ο 2D renderer).
- `rendering/entities/TextRenderer.ts` → `render()` (screenPos + textAlign/textBaseline = η ΠΡΑΓΜΑΤΙΚΗ 2D τοποθέτηση) + `getGrips()` (ADR-557, καλεί `getTextGrips`) + `hitTest()` (κρατά ακόμα down-convention).
- `bim-3d/converters/dxf-text-3d.ts:121` → 3D mesh anchor (`position + (w/2, +h/2)`, σχόλιο «baseline-left, getEntityBBox lower-left»). **Δες αν χειρίζεται attachment — μάλλον ΟΧΙ.**
- `types/entity-bounds.ts` (`getEntityBounds`) → down-convention (top-left). `getEntityBBox` (ψάξε) → lower-left. **Δύο ασύμφωνες — μέρος του προβλήματος.**
- `bim/text/text-grips.ts` (ADR-557) → `textToRectFrame` = εδώ μπαίνει το attachment offset.
- **Hover/selection frame 2D**: ψάξε `rendering/passes/OverlayPass.ts`, `rendering/utils/ghost-entity-renderer.ts`, `config/color-config HOVER_HIGHLIGHT`, και πώς οι ΑΛΛΕΣ οντότητες (π.χ. κολόνα) ζωγραφίζουν hover frame στο 2Δ — το κείμενο μάλλον δεν το κάνει.

**Audit greps (τρέξε ΠΡΩΤΑ):**
```
grep -rn "offsetForJustification\|getBoundingBox\|attachmentOffset" src/subapps/dxf-viewer
grep -rn "getEntityBBox\|getEntityBounds" src/subapps/dxf-viewer/types src/subapps/dxf-viewer/systems/selection
grep -rn "HOVER_HIGHLIGHT\|hover.*frame\|selection.*frame\|drawSelection" src/subapps/dxf-viewer/rendering
grep -rn "attachment" src/subapps/dxf-viewer/bim-3d/converters/dxf-text-3d.ts
```

---

## 5. ΠΛΑΝΟ (Plan Mode πρώτα — single agent)
1. **AUDIT (grep §4)** → εντόπισε το ΕΝΑ σημείο που πρέπει να γίνει ο canonical `resolveTextBox`. Πιθανότατα: επέκταση του `attachment-point.ts`/`text-layout-engine.ts` ως light SSoT (χωρίς Font όπου αρκεί η approx) **ή** νέο thin `bim/text/text-box.ts` που ΚΑΛΕΙ `offsetForJustification`. Απόφαση μετά το audit.
2. **`textToRectFrame` attachment-aware** → centre = `position − offsetForJustification(attachment, {w,h})` (ή ισοδύναμο), ώστε το box να πέφτει ΑΚΡΙΒΩΣ εκεί που ζωγραφίζει ο 2D renderer (textAlign/textBaseline) ΚΑΙ ο 3D mesh.
3. **2D≡3D parity** → βεβαιώσου ότι ο 3D converter (`dxf-text-3d.ts`) + το grip box χρησιμοποιούν το ΙΔΙΟ box SSoT (αν ο 3D αγνοεί attachment, διόρθωσέ τον να το σέβεται).
4. **Hover frame στο 2Δ** → ζωγράφισε το ίδιο box ως hover/selection frame στο 2Δ (reuse ό,τι κάνουν κολόνα/τοίχος· SSoT χρώμα `HOVER_HIGHLIGHT`).
5. **hitTest + bounds** → ενοποίησε στο ίδιο attachment-aware box (τέλος της down/lower-left ασυμφωνίας).
6. **Tests** (pure: box ανά attachment TL..BR· 2D≡3D· grips στις σωστές γωνίες) + **ενημέρωσε ADR-557** (νέα φάση «attachment-aware text-box SSoT») ή ΝΕΟ ADR αν το κρίνεις (έλεγξε επόμενο free number· **απόφυγε 551** = census).
7. Μετά κάθε βήμα → ανέφερε· ο Giorgio αποφασίζει commit.

---

## 6. ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΤΟΙΜΟ (ADR-557, μην το ξαναφτιάξεις)
- `bim/text/text-grips.ts`: 10-grip adapter (rect-grip-engine reuse), `applyTextGripDrag`, defensive guards. **Λειτουργεί — απλώς το box αγνοεί το attachment.**
- Emission: `computeDxfEntityGrips case 'text'` + `TextRenderer.getGrips` (2D) + 3D raw-grips → ΟΛΑ καλούν `getTextGrips` (ΕΝΑ grip SSoT ✅).
- Commit: `UpdateTextTransformCommand` (top-level fields, drag-merge) + `commitTextGripDrag` + ghost (preview≡commit).
- Render: `TextRenderer` widthFactor X-scale (μόνο πρόσθεση), `scaleText` widthFactor, glyph registry text-move/rotation.
- 54 jest GREEN. UNCOMMITTED.

## 7. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ Νέο grip system / νέο bbox math χωρίς audit — **reuse `offsetForJustification`**.
- ❌ Per-consumer box (2D αλλιώς, 3D αλλιώς) — ΕΝΑ SSoT, N consumers.
- ❌ Αλλαγή rotation/zoom math στον `TextRenderer` (μόνο anchor/box).
- ❌ commit/push/--no-verify. ❌ tsc. ❌ αρχεία εκτός scope (shared tree).

## 8. Πρώτη κίνηση νέας συνεδρίας
1. Δήλωσε Opus + Plan Mode.
2. Τρέξε τα audit greps (§4) — επιβεβαίωσε attachment root cause + βρες το hover-frame seam.
3. Σχεδίασε τον canonical `resolveTextBox` SSoT, μετά υλοποίησε §5. ΟΧΙ tsc· targeted jest. COMMIT = Giorgio.
