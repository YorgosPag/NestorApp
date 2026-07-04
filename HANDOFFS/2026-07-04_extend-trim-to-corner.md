# HANDOFF — «Προέκταση δύο γραμμών ώστε να ενωθούν στο σημείο τομής» (Extend/Trim to Corner)

**Ημερομηνία:** 2026-07-04
**Γλώσσα απαντήσεων:** Ελληνικά ΠΑΝΤΑ (κανόνας CLAUDE.md).
**Commit/Push:** ΜΟΝΟ ο Giorgio. Ο agent ΠΟΤΕ (N.-1). Το **working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent**.

---

## 🎯 ΤΙ ΘΕΛΕΙ Ο GIORGIO

Δύο γραμμές στον καμβά που **δεν** ακουμπάνε, αλλά αν προεκταθούν θα τμηθούν σε ένα σημείο.
Θέλει εργαλείο που **προεκτείνει (και/ή κόβει) και τις δύο γραμμές μέχρι το κοινό σημείο τομής**
ώστε να σχηματίσουν γωνία («corner»).

**Reference μεγάλων παικτών (πρώτα έρευνα, μετά κώδικας):**
- **Revit** → *«Trim/Extend to Corner»* (TR) — διάλεξε 2 στοιχεία, και τα δύο τμήματα
  προεκτείνονται/κόβονται στο σημείο τομής τους. **Αυτό είναι το κύριο μοντέλο.**
- **AutoCAD** → *FILLET με radius 0* ή *EXTEND* (boundary-based). Το «to corner» ≈ FILLET r=0.
- **Rhino/Maxon** → *Extend / Connect*. **Figma:** δεν έχει CAD-extend (μη-σχετικό εδώ).
- Αν οι μεγάλοι το κάνουν κάπως → **ακολουθούμε την πρακτική τους**, όχι δική μας επινόηση.

**Ζητούμενο ποιότητας (ρητό):** FULL ENTERPRISE + FULL SSOT, Google/Revit-level.

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Η προκαταρκτική σάρωση (2026-07-04) βρήκε ότι **υπάρχει ήδη πολλή σχετική υποδομή**. Αυτό το
feature είναι **σχεδόν σίγουρα επέκταση υπάρχοντος**, ΟΧΙ νέο σύστημα. **ΜΗΝ δημιουργήσεις
διπλότυπα.** Κάνε πραγματικό audit στα εξής πριν αποφασίσεις αρχιτεκτονική:

### (Α) Υπάρχον σύστημα EXTEND — audit πρώτο
- `systems/extend/ExtendToolStore.ts`
- `systems/extend/extend-intersection-caster.ts`  ← ρίχνει ray σε boundary/intersection
- `systems/extend/extend-types.ts`
- `components/dxf-layout/ExtendPreviewOverlay.tsx`
- `hooks/tools/useExtendDragCapture.ts`
→ **Ερώτημα προς έλεγχο:** υποστηρίζει ήδη «extend to another line's intersection»; Αν ναι,
  το «to corner» = extend ΚΑΙ των δύο (αμοιβαία) → πιθανώς ένα νέο *mode*, όχι νέο σύστημα.

### (Β) Υπάρχον σύστημα TRIM — audit (έχει «edge extender»!)
- `systems/trim/trim-edge-extender.ts`   ← το όνομα λέει ότι ΗΔΗ προεκτείνει άκρα
- `systems/trim/trim-intersection-mapper.ts`, `trim-boundary-resolver.ts`, `trim-cut-shared.ts`
- `systems/trim/TrimToolStore.ts`, `components/dxf-layout/TrimPreviewMount.tsx`,
  `hooks/tools/useTrimDragCapture.ts`
→ Revit ενοποιεί Trim+Extend σε ΕΝΑ εργαλείο· δες αν ο δικός μας διαχωρισμός επιτρέπει «corner».

### (Γ) Intersection math — ΥΠΑΡΧΟΥΝ ΠΟΛΛΑ (διάλεξε ΕΝΑ canonical, ΜΗΝ προσθέσεις νέο)
- `utils/geometry/GeometryUtils.ts` → `segmentIntersection()` / `segmentsIntersect()`
- `bim/walls/wall-trims-geometry.ts` → `lineLineIntersect()`  ← infinite-line intersection (ό,τι
  χρειάζεται το «extend»: τομή των ΑΠΕΙΡΩΝ γραμμών, όχι μόνο των segments)
- `utils/angle-entity-math.ts` → `lineIntersection()`
- `bim-3d/converters/wall-top-clip-internal.ts` → `lineIntersect()`
⚠️ **Υπάρχει ήδη διπλοτυπία intersection math** — αν χρειαστεί, κεντρικοποίησέ την (ΔΙΑΤΑΓΗ Giorgio:
  προϋπάρχοντα διπλότυπα που βρίσκεις, τα κεντρικοποιείς κι αυτά).

### (Δ) Line editing + command infrastructure (reuse)
- `systems/properties/line-geometry-edit.ts` → `endForLength`, `withCoord`, `endForDelta`… (reuse
  `geometry-vector-utils`) — για να μετακινείς endpoints.
- `core/commands/entity-commands/JoinEntityCommand.ts` — αν θέλει και ένωση/merge.
- `core/commands/entity-commands/UpdateEntityCommand.ts` — undoable patch endpoints (ίδιο με το
  line-tool bridge).
- `systems/tools/tool-definitions.ts` + ribbon command keys — εγγραφή νέου/υπάρχοντος tool.

**Παραδοτέο του audit:** πες ξεκάθαρα «υπάρχει X → το επεκτείνω» ή «δεν υπάρχει → νέο SSoT στο …».

---

## 📐 ADR-DRIVEN (κανόνας N.0.1)
1. Βρες το σχετικό ADR (πιθανώς **ADR-510 line-creation-system**, ή dedicated extend/trim ADR στο
   `docs/centralized-systems/reference/adr-index.md`). Διάβασε **τον κώδικα** (source of truth),
   ενημέρωσε το ADR αν αποκλίνει, μετά plan, μετά υλοποίηση, μετά ADR update **στο ίδιο commit**.
2. Επειδή αγγίζει tool + geometry + command + preview + ribbon → **Opus + Plan Mode** (N.8/N.14).

## 🧪 Testing
- Jest στοχευμένα (μαθηματικά τομής, endpoint patch, undo). **ΟΧΙ tsc** (N.17 — απαγορεύεται στον agent).
- Αν αγγίξεις canvas drawing / renderer αρχεία → **ADR-040 CHECK 6B/6D** (χρειάζεται staged ADR).

## 🔀 GIT — SHARED WORKING TREE (κρίσιμο)
- **ΠΟΤΕ** `git add -A` / bulk `git restore .` / `git reset --hard` / checkout αρχείων άλλου agent.
- ΜΟΝΟ `git add <specific files>` + verify `git diff --cached`. Commit/push **μόνο ο Giorgio**.

---

## 📌 ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ WORKING TREE (uncommitted — ΜΗΝ την πειράξεις/κάνεις revert)
Ολοκληρώθηκε (uncommitted) στην προηγούμενη συνεδρία — **άσχετο** με το νέο task, μην το αγγίξεις:
- **ADR-510 Φ4b** «Στη Γραμμή» contextual tab: πεδίο **Χρώμα** → κεντρικός dxf-color picker
  (`comboboxVariant:'dxf-color'`)· **Τύπος Γραμμής** → κοινές μικρογραφίες (`buildLinetypeRibbonOptions`).
- Νέος SSoT `systems/properties/resolve-entity-color.ts` (`resolveEntityLayer` + `resolveEntityColorHex`)·
  ο renderer (`dxf-renderer-style-resolve.ts`) χρησιμοποιεί το ίδιο `resolveEntityLayer` (ADR-040 stage).
- `EnterpriseColorDialog`: prop `dimBackdrop` (ribbon pickers = χωρίς dim) + **μνήμη θέσης** dialog.
- ⚠️ **Άλλος agent** προσθέτει παράλληλα **ADR-570 «Στυλ Γραμμής» (ByStyle)** στο `useRibbonLineToolBridge.ts`
  + `systems/line-styles/`. **Μην το αγγίξεις.**

---

## ✅ Checklist εκκίνησης νέας συνεδρίας
1. Διάβασε `.claude-rules/MEMORY.md` + `pending-ratchet-work.md` (STATUS).
2. **SSoT audit (Α)-(Δ) παραπάνω** — grep, διάβασε τον κώδικα, ανέφερε τι θα reuse.
3. Δήλωσε μοντέλο (Opus) + μπες Plan Mode· ρώτα Giorgio για UX λεπτομέρειες με **παραδείγματα** (ASCII).
4. Υλοποίηση → tests (jest) → ADR update → **σταμάτα** (commit ο Giorgio).
