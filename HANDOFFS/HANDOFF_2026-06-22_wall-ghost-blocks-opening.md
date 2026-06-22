# HANDOFF — Τοίχος-φάντασμα ΜΠΛΟΚΑΡΕΙ (🔴) μπροστά από άνοιγμα (πόρτα/παράθυρο) — 3D opening-conflict

**Ημ/νία:** 2026-06-22
**Τύπος:** NEW feature (Revit-grade, FULL ENTERPRISE + FULL SSoT) — wall smart-ghost opening conflict
**Μοντέλο:** Opus (1 domain wall-ghost placement· ~4-5 αρχεία· γεωμετρία+UX)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.

---

## 0. ΖΗΤΟΥΜΕΝΟ (Giorgio, verbatim πνεύμα)

Όταν το εργαλείο **«Τοίχος»** δείχνει το έξυπνο φάντασμα **κάθετο στην παρειά** υφιστάμενου τοίχου (ADR-508
T-framing, §3.6 wall mirror), και το φάντασμα **περνά μπροστά από άνοιγμα** (πόρτα ή παράθυρο) του
υφιστάμενου τοίχου, πρέπει να γίνεται **🔴 ΚΟΚΚΙΝΟ + ΜΠΛΟΚ commit** όταν ο νέος τοίχος θα **έκοβε** το
άνοιγμα — δηλ. όταν το **κατακόρυφο** εύρος του νέου τοίχου τέμνει το **κενό** του ανοίγματος, στο σημείο
που ακουμπά.

### Το κλειδί — είναι 3D έλεγχος (ύψος), όχι μόνο κάτοψη:
- **Πόρτα** (κενό 0→2m): τοίχος μπροστά της επιτρέπεται ΜΟΝΟ στο συμπαγές πάνω από το πρέκι (π.χ. 2→3m). Στο 0→2m → 🔴.
- **Παράθυρο** ποδιά 1m (κενό 1→2m): τοίχος επιτρέπεται κάτω από ποδιά (0→1m) **ή** πάνω από πρέκι (2→3m). Στο 1→2m → 🔴.
- **Εξαρτάται από το δηλωμένο ύψος/βάση του ΝΕΟΥ τοίχου:** αν ο χρήστης έχει δηλώσει τοίχο ύψους 1m μπροστά
  σε παράθυρο (ποδιά 1m) → `[0,1]∩[1,2]=∅` → 🟢. Αν ξεπερνά το 1m → κόβει το παράθυρο → 🔴.

### ΑΠΟΦΑΣΕΙΣ ΚΛΕΙΔΩΜΕΝΕΣ (Giorgio):
1. **Conflict → 🔴 + ΜΠΛΟΚ commit** (ίδιο με το σημερινό short-end overlap που ήδη μπλοκάρει). ΟΧΙ soft-warn.
2. (ερευνήθηκε — δες §2) πηγή ύψους/βάσης.
3. **Ανοίγματα: Πόρτες + Παράθυρα** (ο διαχωρισμός βγαίνει αυτόματα από το `sillHeight`).

---

## 1. 🎯 Ο ΚΑΝΟΝΑΣ (καθαρή τομή 2 διαστημάτων — μηδέν νέα γεωμετρία)

```
🔴 (block) ⇔
   οριζόντια:  [abut − t/2, abut + t/2]              ∩ [offsetFromStart, offsetFromStart+width] ≠ ∅
   ΚΑΙ
   κατακόρυφα: [wall.baseOffset, wall.baseOffset+wall.height] ∩ [op.sillHeight, op.sillHeight+op.height] ≠ ∅
```
- `abut` = mm offset του σημείου επαφής του ghost πάνω στον host άξονα· `t` = πάχος νέου τοίχου.
- Πόρτα = `sillHeight 0`· παράθυρο = `sillHeight > 0`. **ΕΝΑΣ κανόνας** καλύπτει και τα δύο.
- **Μερική επικάλυψη μετράει** ως 🔴 (τοίχος 1.5m μπροστά σε παράθυρο 1–2m → `[0,1.5]∩[1,2]=[1,1.5]` → 🔴).

---

## 2. SSoT AUDIT — ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ ΚΩΔΙΚΑ (όλα τα δεδομένα ΥΠΑΡΧΟΥΝ — reuse, ΜΗΝ διπλασιάσεις)

Η έρευνα (2026-06-22) επιβεβαίωσε ότι **ΟΛΑ** τα δεδομένα/SSoT υπάρχουν. Επανέλεγξέ τα με grep πριν γράψεις:

```
# (A) Z-extents SSoT (ADR-452) — δίνει ΗΔΗ [zBottom,zTop] mm για wall ΚΑΙ opening. ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ.
grep -n "getEntityZExtents\|EntityZExtentsMm\|case 'wall'\|case 'opening'\|baseOffset\|sillHeight" src/subapps/dxf-viewer/bim/visibility/entity-z-extents.ts

# (B) Opening params: wallId (host FK) + offsetFromStart + width + sillHeight + height
grep -n "wallId\|offsetFromStart\|sillHeight\|height\|width\|interface OpeningParams" src/subapps/dxf-viewer/bim/types/opening-types.ts

# (C) Openings ενός τοίχου (filter by wallId) — υπάρχον pattern, reuse/extend
grep -rn "params.wallId === \|wallId ===\|openingsOnWall\|hostedOpenings" src/subapps/dxf-viewer/bim/walls/opening-siblings.ts src/subapps/dxf-viewer/bim

# (D) world point ↔ host-relative mm offset + axis point (SSoT projectors)
grep -n "wallAxisPointAtOffsetMm\|offsetFromStart\|projectPointOnWallAxis\|host-relative mm\|getWallAxisVertices\|walkPolylineToDistance" src/subapps/dxf-viewer/bim/geometry/opening-geometry.ts

# (E) Το ΥΠΑΡΧΟΝ wall-ghost overlap gate (εδώ μπαίνει το νέο gate) + status 🔴
grep -n "isWallGhostOverlap\|status\|overlap\|memberTargets\|makeWallGhostBeforeClick" src/subapps/dxf-viewer/hooks/drawing/wall-preview-helpers.ts

# (F) Ghost status χρώμα + entity-overlap SSoT (§3.6) — reuse, ΜΗΝ φτιάξεις νέο κόκκινο
grep -rn "resolveGhostStatusColor\|findEntityOverlap\|ghost-status-color\|entity-overlap" src/subapps/dxf-viewer/bim/ghosts src/subapps/dxf-viewer/bim/geometry/entity-overlap.ts

# (G) πώς ταξιδεύει το status του wall ghost στο preview + tooltip/label path
grep -rn "drawStatusGhostPolygon\|ghostStatusColor\|drawGhostFaceDimensions\|tooltip\|statusLabel" src/subapps/dxf-viewer/hooks/drawing/drawing-hover-handler.ts src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewRenderer.ts
```

### Επιβεβαιωμένα ευρήματα έρευνας (μην τα ξανα-ανακαλύψεις από το μηδέν):
- **`getEntityZExtents(entity)`** (`bim/visibility/entity-z-extents.ts`, ADR-452) επιστρέφει `{zBottomMm,zTopMm}`:
  - `wall` → `{ baseOffset ?? 0, base + height }`
  - `opening` → `{ sillHeight, sillHeight + height }`
  - **Είναι ο SSoT για το κατακόρυφο εύρος. Reuse και για τον τοίχο-φάντασμα ΚΑΙ για το άνοιγμα.**
- **`OpeningParams`** (`bim/types/opening-types.ts`): `wallId` (host FK), `offsetFromStart` (mm), `width` (mm, από τον Type), `sillHeight` (mm· door 0 / window ~900), `height` (mm).
- **Ghost wall** χτίζεται με `buildWallEntity(buildDefaultWallParams(..., overrides))` (`wall-preview-helpers.ts`) → έχει `params.baseOffset` + `params.height` από τα **wall overrides** (δηλωμένα από χρήστη). Άρα `getEntityZExtents(ghostWallEntity)` δουλεύει ΑΜΕΣΑ.
- **Openings-of-wall:** `opening-siblings.ts` ήδη φιλτράρει `o.params.wallId === wallId`. Reuse/extract το pattern.
- **Horizontal projection:** `opening-geometry.ts` έχει `wallAxisPointAtOffsetMm` + projector «world point → host-relative mm offset» (SCENE-UNITS και mm variants — διάβασέ τα, ~γρ. 422-457).
- **🔴 status + κόκκινο:** `bim/ghosts/ghost-status-color.ts` (`resolveGhostStatusColor`) + `bim/geometry/entity-overlap.ts` (§3.6) — το wall ghost ήδη γίνεται 🔴 σε short-end/collinear overlap μέσω `isWallGhostOverlap`. **Πρόσθεσε τον opening-conflict ως νέο λόγο overlap, ΜΗΝ φτιάξεις νέο status μηχανισμό.**

---

## 3. 🔧 ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (FULL SSoT — κλείδωσε σε Plan Mode πριν τον κώδικα)

1. **NEW pure module** `src/subapps/dxf-viewer/bim/walls/wall-opening-conflict.ts`:
   - `wallGhostBlocksOpening(ghostWall, hostWall, openings): { blocked: boolean; opening?: OpeningEntity; zBand?: [number,number] }`
   - Καθαρή τομή διαστημάτων: **reuse `getEntityZExtents`** (κατακόρυφα) + offset projection (οριζόντια) + filter `wallId`.
   - Zero React/DOM/store. Pure, ≤40γρ/function (N.7.1· helpers αν χρειαστεί).
2. **Gate στο ΥΠΑΡΧΟΝ** `isWallGhostOverlap` (`wall-preview-helpers.ts`): όταν το ghost κάνει T-framing σε host τοίχο,
   τρέξε το `wallGhostBlocksOpening` για τα ανοίγματα **εκείνου** του τοίχου → conflict ⇒ `status='overlap'`
   (🔴 + **block commit**, ίδιο μονοπάτι με το σημερινό short-end overlap). **Μηδέν νέο status/χρώμα.**
3. **Tooltip (ΚΡΙΣΙΜΟ — 3D έλεγχος σε 2D κάτοψη):** ο χρήστης ΔΕΝ βλέπει το ύψος στην κάτοψη → το 🔴 πρέπει να
   εξηγείται: π.χ. «κόβει άνοιγμα — ύψος 1.00–2.00m». **i18n el+en** (N.11· ΟΧΙ hardcoded string).
   Δες πώς ταξιδεύει σήμερα label/tooltip του ghost (grep §2G) — reuse τον ίδιο μηχανισμό.
4. **Tests** (`bim/walls/__tests__/wall-opening-conflict.test.ts`): πόρτα (κενό 0–2 → 🔴 full-height· 2–3 → 🟢)·
   παράθυρο ποδιά 1m (0–1 🟢 / 1–2 🔴 / 1.5 μερική 🔴 / 2–3 🟢)· οριζόντια εκτός span → 🟢· πολλαπλά ανοίγματα.

**Σημείωση οριζόντιας επαφής:** πρότεινε να μετράς το πάχος του ghost (`[abut−t/2, abut+t/2]`), όχι σημείο —
αν οποιοδήποτε μέρος του πάχους τέμνει το άνοιγμα οριζόντια ΚΑΙ κατακόρυφα → 🔴. Κλείδωσέ το με Giorgio αν αμφιβάλλεις.

---

## 4. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (όλα UNCOMMITTED — shared tree)
- `bim/walls/wall-opening-conflict.ts` **[NEW]** + `__tests__/wall-opening-conflict.test.ts` **[NEW]** — δικά σου, ασφαλή.
- `hooks/drawing/wall-preview-helpers.ts` — gate στο `isWallGhostOverlap` (⚠️ ADR-508 shared, behavior-preserving).
- `canvas-v2/preview-canvas/PreviewRenderer.ts` ή `hooks/drawing/drawing-hover-handler.ts` — tooltip 🔴 (⚠️ ADR-040 CHECK 6B/6D).
- `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` — tooltip key (⚠️ shared).
- ADR: `docs/centralized-systems/reference/adrs/ADR-508-*` (ή ADR-398 §wall ghost — έλεγξε ποιο καλύπτει το wall T-framing ghost) + changelog + tracker (N.15).

---

## 5. ⚠️ ΜΗΝ ΣΠΑΣΕΙΣ
1. **Τοίχος 2-click + §3.6 short-end/collinear overlap 🔴** — το νέο gate είναι ΕΠΙΠΛΕΟΝ λόγος overlap, όχι αντικατάσταση.
2. **Beam ghost** (ίδιο `bim/framing/` SSoT) — μην αλλάξεις τη συμπεριφορά δοκαριού· το opening-conflict είναι wall-specific.
3. **getEntityZExtents** (ADR-452, cut-plane) — μην αλλάξεις τη λογική του· ΜΟΝΟ κατανάλωσέ το.
4. **Όταν δεν υπάρχει άνοιγμα / εκτός span / μηδενική κατακόρυφη τομή → 🟢** (μηδέν false-positive· π.χ. τοίχος δίπλα στο συμπαγές πόδι).

---

## 6. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **SSoT audit (grep §2) ΠΡΙΝ κώδικα** — εντολή Giorgio. Reuse `getEntityZExtents` / opening params / `isWallGhostOverlap` /
  `resolveGhostStatusColor`. **ΜΗΝ φτιάξεις νέο Z-extents/status/overlap μηχανισμό — υπάρχουν.**
- **Plan Mode πρώτα** (3+ αρχεία) — κλείδωσε τη συμπεριφορά (§3 σημείωση οριζόντιας επαφής + tooltip wording) με Giorgio.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πριν). **N.(-1.1):** ΟΧΙ `--no-verify`. **N.11:** ΟΧΙ hardcoded strings (tooltip → i18n).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου· ⚠️ CHECK 6B/6D (preview-canvas/hover-handler = ADR-040) → stage ADR-040 + το wall-ghost ADR. **COMMIT ο Giorgio.**
- jest δίχτυ + browser-verify [τοίχος 2m×3m, πόρτα κέντρο 1m×2m: ghost μπροστά στο 0–2m κενό → 🔴 block· πάνω από πρέκι → 🟢·
  παράθυρο ποδιά 1m: ghost ύψους 1m → 🟢, ύψους >1m → 🔴· δίπλα στο συμπαγές → 🟢].

## 7. DEFINITION OF DONE
- Wall smart-ghost μπροστά από πόρτα/παράθυρο → 🔴 + **block commit** ⇔ κατακόρυφη ΚΑΙ οριζόντια τομή με το κενό· αλλιώς 🟢.
- Πόρτα/παράθυρο ενιαίος κανόνας (sillHeight). Tooltip εξηγεί το ύψος conflict (i18n el+en).
- Reuse `getEntityZExtents` (ADR-452) + opening params + `isWallGhostOverlap` — μηδέν διπλότυπο (Giorgio SSoT audit).
- jest GREEN + tsc clean + browser-verify. ADR changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15). **Commit: Giorgio.**
