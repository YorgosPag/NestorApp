# HANDOFF — Κυανές «listening dimensions» + κάθετο κούμπωμα για το LINE tool (reuse wall SSoT)

**Ημερομηνία:** 2026-06-30
**Subapp:** `src/subapps/dxf-viewer`
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** COMMIT τον κάνει **ΜΟΝΟ ο Giorgio**, ποτέ ο agent. `git add -A` ΑΠΑΓΟΡΕΥΕΤΑΙ — stage μόνο συγκεκριμένα αρχεία.

---

## 🎯 ΣΤΟΧΟΣ (Session 2)

Όταν σχεδιάζω **τοίχο** κοντά σε υφιστάμενη οντότητα, εμφανίζονται **ΚΥΑΝΕΣ/ΣΙΕΛ** ενδείξεις (gap-left / gap-right / κέντρο-προς-κέντρο κατά μήκος της παρειάς του υπάρχοντος μέλους) **και** το φάντασμα κουμπώνει **κάθετα/flush** πάνω στην υπάρχουσα παρειά. Μακριά από οντότητες δείχνει μόνο τις **ΛΕΥΚΕΣ** ενδείξεις (μήκος/πάχος/ύψος).

**Στη ΓΡΑΜΜΗ:** οι λευκές ήδη κεντρικοποιήθηκαν (βλ. Session 1, §B). **Λείπουν οι ΚΥΑΝΕΣ.**

Ζητούμενο Giorgio (αυτολεξεί νόημα):
> «Μόλις πηγαίνω σε μια υφιστάμενη γραμμή, **αμέσως να κάθεται κάθετα** το φάντασμα της γραμμής πάνω στην υφιστάμενη και να έχω **πάλι τις ίδιες κυανές ενδείξεις** — τον **ίδιο κώδικα**, **μια και μοναδική πηγή αλήθειας**.»

Δηλαδή 2 συμπεριφορές, **και οι δύο reused από τον τοίχο**:
1. **Κυανές listening dimensions** όταν το ghost της γραμμής είναι κοντά σε υφιστάμενη οντότητα.
2. **Κάθετο/flush κούμπωμα** του ghost της γραμμής πάνω στην υπάρχουσα παρειά/γραμμή.

---

## 🚨 ΕΝΤΟΛΕΣ GIORGIO (απαράβατες, ισχύουν για ΟΛΗ τη Session 2)

1. **FULL ENTERPRISE + FULL SSoT.** Όπως **Revit / Maxon (Cinema 4D) / Figma**. Αν οι μεγάλοι παίχτες δεν προτείνουν κάτι, ακολούθησε την **πρακτική των μεγάλων παιχτών**.
2. **ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep.** Βρες αν υπάρχει ήδη αντίστοιχος κώδικας, **χρησιμοποίησέ τον**, **ΜΗΝ φτιάξεις διπλότυπα**.
3. **ΑΝ βρεις προϋπάρχοντα διπλότυπα (που δεν τα έφτιαξες εσύ) → τα κεντρικοποιείς κι αυτά.** = ΔΙΑΤΑΓΗ.
4. **ΟΧΙ commit / ΟΧΙ push** από τον agent. Ο Giorgio κάνει commit. Working tree shared → stage μόνο specific files.
5. **ΟΧΙ `tsc`** (κανόνας N.17). jest επιτρέπεται (στοχευμένα).
6. **Απαντάς ΣΤΑ ΕΛΛΗΝΙΚΑ.**
7. Στο τέλος: δήλωσε ρητά ✅/⚠️/❌ Google-level + ενημέρωσε ADR changelog (κανόνας N.0.1, code = source of truth).

---

## 🔑 SSoT ΣΗΜΕΙΑ-ΑΦΕΤΗΡΙΑΣ (επιβεβαιωμένα στη Session 1 — ΞΕΚΙΝΑ ΤΟ AUDIT ΑΠΟ ΕΔΩ)

### A) Κυανές listening dimensions (το «τι» πρέπει να δείξει η γραμμή)
- **Painter (SSoT):** `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` → `paintGhostFaceDimensions(ctx, meta, transform, viewport, project?)`. Χρώμα κυανό = `OVERLAY_LINE_COLORS.listeningDim`. Κάνει reuse το `paintAlignedOverlayDimension` (ίδιο `renderPreviewDimension` ISO-129 με τις λευκές).
- **Bridge:** `PreviewCanvas.tsx` handle `drawGhostFaceDimensions(meta)` → `PreviewRenderer.drawGhostFaceDimensions(meta, transform, viewport)`.
- **Όπου καταναλώνεται σήμερα:** `hooks/drawing/drawing-hover-handler.ts` (~γρ. 295-299):
  ```ts
  const overlay = previewEntity as PlacementOverlayFields;
  const faceDims = overlay.faceDimensions;
  if (faceDims) previewCanvasRef.current.drawGhostFaceDimensions(faceDims);
  ```
- **Canonical meta type:** `bim/placement/placement-overlay-fields.ts` → `PlacementOverlayFields` (πεδία `faceDimensions`, `polarDiskGrid`, `alignmentGuide`, …). ΕΝΑΣ τύπος, κοινός 2D/3D reader (ADR-544).
- **Πώς ο ΤΟΙΧΟΣ τα παράγει:** `hooks/drawing/wysiwyg-preview-shared.ts` → `resolveGhostFaceDimensionsMeta(...)` + `toWysiwygPreviewEntity(...)` (κρεμάει `faceDimensions` στο ghost entity). Καλείται από `hooks/drawing/wall-preview-helpers.ts` (`buildWallGhostEntity`).

### B) Κάθετο/flush κούμπωμα σε υπάρχουσα παρειά (το «πώς» κάθεται το ghost)
- **ΠΡΕΠΕΙ ΝΑ ΓΙΝΕΙ AUDIT (grep) — δεν επιβεβαιώθηκε πλήρως στη Session 1.** Leads για grep:
  - `hooks/drawing/bim-ortho-reference.ts` (wall face-relative reference / ortho).
  - Member face snap: ψάξε `resolveLinearMemberFaceSnap`, `buildMemberAxisFrame`, `collectFootprintEdgeTargets`, `resolveFootprintEdgeSnap` (ADR-398/514 — χρησιμοποιούνται από κολόνες/πέδιλα/τοίχους για flush σε παρειά).
  - Snap engines: `snapping/engines/*` (perpendicular / nearest / face).
  - Το wall ghost «flush» κούμπωμα: grep στο `wall-preview-helpers.ts` / `mouse-handler-*` για το πώς ο τοίχος ευθυγραμμίζεται κάθετα σε υπάρχον.
- **ΠΡΟΣΟΧΗ (μνήμη Session 1):** ο τοίχος **ΗΔΗ** εφαρμόζει OSNAP κεντρικά στον mouse-handler-up — μην βάλεις double-snap. Ίχνευσε ΟΛΟ το pipeline (event→dispatch→tool→preview), όχι μεμονωμένο hook.

### C) Λευκό line-HUD (έτοιμο από Session 1 — πρότυπο για το πώς «κρεμάμε» meta στη γραμμή)
- `ExtendedLineEntity.liveDimHud` (στο `hooks/drawing/drawing-types.ts`) κρεμιέται στο `hooks/drawing/drawing-preview-partial.ts` (`applyPreviewStyling`, **μόνο** `tool==='line'`) και ζωγραφίζεται στο `drawing-hover-handler.ts` μέσω `drawWallHud`.
- **ΑΝΑΛΟΓΙΑ:** για τις κυανές, το ghost της γραμμής πρέπει να αποκτήσει `faceDimensions` (ίδιο `PlacementOverlayFields` πεδίο) όταν είναι κοντά σε οντότητα — οπότε το **ήδη υπάρχον** block στο `drawing-hover-handler.ts:295-299` θα τις ζωγραφίσει **χωρίς νέο μηχανισμό**. Το ζητούμενο = να ΥΠΟΛΟΓΙΣΤΟΥΝ τα `faceDimensions` (+ το flush κούμπωμα) για τη γραμμή, με reuse του wall resolver.

---

## ✅ ΤΙ ΕΓΙΝΕ ΣΤΗ Session 1 (UNCOMMITTED — μην τα ξανα-αγγίξεις, μόνο context)

Όλα **🔴 pending browser-verify + commit (Giorgio)**. Tests πράσινα. Pre-existing κόκκινα suites `useWallTool` / `floorplan-symbol-completion` = **stash-verified ΑΣΧΕΤΑ** (αποτυγχάνουν & χωρίς τις αλλαγές).

**A. DXF διαστάσεις → import ως πραγματικό `DimensionEntity` με βέλη (ADR-362 Round 27).**
NEW: `utils/dxf-dimension-converter.ts` (rewrite/router), `utils/dxf-dimension-legacy-fallback.ts`, `utils/__tests__/dxf-dimension-converter.test.ts` (12/12). reuse `DimensionRenderer`+`registerImportedDimStyles`. ADR-362 §7 ενημερωμένο.

**B. Λευκό live HUD για τη ΓΡΑΜΜΗ (ADR-508 §line-hud).**
NEW: `buildSegmentHudMeta` (στο `wall-hud-paint.ts`), `ExtendedLineEntity.liveDimHud`. MOD: `wall-hud-paint.ts`, `wall-preview-helpers.ts` (delegate), `drawing-preview-partial.ts`, `preview-entity-renderers.ts` (skip inline όταν HUD), `drawing-hover-handler.ts`, `drawing-types.ts`. Test `wall-hud-paint-projector.test.ts` (9/9). `buildSegmentHudMeta` χρησιμοποιεί SSoT `calculateWorldDistance`/`calculateAngle`/`radToDeg`/`normalizeAngleDeg`. ADR-508 ενημερωμένο.

**C. Anti-collision cursor tooltips (ADR-357).**
NEW: `CURSOR_LABEL_SLOTS` (στο `overlay-text-style.ts` — `above`/`below`/`belowFar`). MOD: `polar-tracking-line-paint.ts`, `tracking-paint.ts`, `PreviewRenderer.ts` (conflict tooltip). preview-canvas 36/36. ADR-357 ενημερωμένο.

---

## 📐 ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (να επικυρωθεί ΜΕΤΑ το audit)

1. **Audit (grep)** A+B παραπάνω → βρες τον wall resolver των `faceDimensions` + τον flush/perpendicular snap.
2. Αν ο wall resolver είναι **ήδη generic** (δέχεται 2 σημεία/άξονα + γειτονικές οντότητες) → κάλεσέ τον για τη γραμμή. Αν είναι wall-specific → **εξάγαγε τον πυρήνα** (όπως έγινε με `buildSegmentHudMeta`) ώστε τοίχος+γραμμή να τον μοιράζονται.
3. Κρέμασε `faceDimensions` στο line ghost (στο `applyPreviewStyling` ή στον preview generator) → το υπάρχον block στον `drawing-hover-handler` τις ζωγραφίζει αυτόματα.
4. Flush κούμπωμα: reuse του **ίδιου** face-snap resolver που χρησιμοποιεί ο τοίχος (preview ≡ commit). ΜΗΝ φτιάξεις δεύτερο snap path.
5. Tests (jest) ανά pure helper. Δήλωσε Google-level. Ενημέρωσε ADR-508 (§line-cyan ή νέο §) + ADR-357 αν χρειαστεί.

**Anti-goals:** μηδέν νέος painter (υπάρχει `paintGhostFaceDimensions`), μηδέν νέο overlay-meta πεδίο (υπάρχει `faceDimensions`/`PlacementOverlayFields`), μηδέν δεύτερος snap μηχανισμός.

---

## 📌 Pointers
- ADR-508 (wall/line HUD + listening dims): `docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md`
- ADR-040 (preview canvas perf — CHECK 6B/6D αν αγγίξεις canvas-critical leaves)
- Κανόνες: `CLAUDE.md` (N.0.1 ADR-driven, N.0.2 Boy-Scout, N.7.x Google-level, N.14 model, N.17 no-tsc)
