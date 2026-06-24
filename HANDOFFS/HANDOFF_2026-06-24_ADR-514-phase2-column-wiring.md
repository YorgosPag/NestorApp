# HANDOFF — ADR-514 «Ένας Εγκέφαλος Έλξης» Φ2: wiring κολόνας

**Ημ/νία:** 2026-06-24 · **Στόχος session:** Φ2 του ADR-514 (Revit-grade unified BIM cursor snap)
**Γλώσσα απαντήσεων: ΕΛΛΗΝΙΚΑ πάντα** (CLAUDE.md language rule).

---

## 0. ΚΑΝΟΝΕΣ ΑΥΤΗΣ ΤΗΣ ΔΟΥΛΕΙΑΣ (μη τους παραβείς)

- **COMMIT/PUSH: ΜΟΝΟ ο Giorgio.** Εσύ ΠΟΤΕ. Ετοίμασε, σταμάτα, ανέφερε. (N.(-1))
- **Shared working tree με άλλον agent** → άγγιξε ΜΟΝΟ τα αρχεία του Φ2. Μη μαζικά `git add`. Πριν tsc έλεγξε αν τρέχει ήδη άλλος tsc (N.17 — ΕΝΑ tsc τη φορά).
- **ΠΡΙΝ γράψεις ΚΩΔΙΚΑ: ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** — βρες υπάρχοντα κώδικα/SSoT να επαναχρησιμοποιήσεις, ΜΗΔΕΝ διπλότυπα. (Ρητή εντολή Giorgio. Δες §4.)
- **Revit-grade, FULL ENTERPRISE, FULL SSoT.** Ένα σημείο εισόδου, preview ≡ commit by construction.
- **ADR-040 architecture-critical:** το `mouse-handler-up.ts` + `snap-scheduler.ts` είναι κρίσιμα. CHECK 6B/6D μπλοκάρουν commit αν τα αγγίξεις ΧΩΡΙΣ staged ADR → **stage ADR-040 + ADR-514 μαζί** όταν committαρει ο Giorgio.
- **Dead-code ratchet (CHECK 3.22):** ο εγκέφαλος είναι ΤΩΡΑ αχρησιμοποίητος. Το Φ2 wiring τον κάνει live → μετά το Φ2 ΔΕΝ είναι πια dead. Μην committαρει ο Giorgio τη βάση σκέτη πριν το wiring.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Φ1 — DONE, UNCOMMITTED)

Πλήρης χαρτογράφηση όλων των snap συστημάτων του `/dxf/viewer` → το snap είναι **ήδη ~90% SSoT**
(ADR-378 master). Δημιουργήθηκε η βάση του ενοποιημένου resolver:

- **NEW** `src/subapps/dxf-viewer/bim/placement/bim-cursor-snap.ts` — ο εγκέφαλος `resolveBimCursorSnap`.
  Pure, dispatch by `toolKind` ('wall'|'beam'|'column'|'point-only'), discriminated union return
  (`member-placement` | `column-placement` | `point`). Ζει πάνω από columns+framing → μηδέν cycle.
- **NEW** `src/subapps/dxf-viewer/bim/placement/__tests__/bim-cursor-snap.test.ts` — **6/6 jest GREEN**.
- **NEW** `docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md` — full design + φάσεις.
- **DELETED** ενδιάμεσο `bim/framing/unified-cursor-snap.ts` (+test) — στενότερο, αντικαταστάθηκε (μηδέν διπλό SSoT).
- **MEMORY:** νέο feedback `feedback_trace_full_pipeline_not_isolated_hooks.md`.

---

## 2. ΤΟ ΚΡΙΣΙΜΟ INSIGHT (μην το ξεχάσεις — αλλιώς double-snap bug)

Οι «δύο κόσμοι» (OSNAP point engine vs BIM face/placement snap) είναι **ΗΔΗ ενωμένοι στο cursor pipeline**:
- **OSNAP (Κόσμος Α)** εφαρμόζεται **ΚΕΝΤΡΙΚΑ**: `mouse-handler-up.ts` καλεί `findSnapPoint` στο click
  point ΠΡΙΝ φτάσει σε tool (commit)· `snap-scheduler` γράφει το snapped σημείο στο `ImmediateSnapStore`
  (preview, διαβάζεται με `resolveEffectivePreviewCursor`). **Ο cursor που φτάνει στους resolvers είναι ΗΔΗ OSNAP-snapped.**
- **BIM placement (Κόσμος Β)** τρέχει **πάνω** σε αυτόν τον ήδη-snapped cursor.

➡️ Άρα ο εγκέφαλος **ΔΕΝ πρέπει να ξανα-καλέσει `findSnapPoint`** στα σημεία wiring (double-snap).
**ΠΡΩΤΟ ΒΗΜΑ Φ2: κάνε το `findSnapPoint` OPTIONAL** στο `bim-cursor-snap.ts`: όταν λείπει → το point
branch επιστρέφει τον cursor **αυτούσιο** (ήδη snapped upstream). Ο εγκέφαλος μένει SSoT για το
**placement dispatch**· το point-snap παραμένει κεντρικά στο pipeline (ήδη σωστό).

---

## 3. Η ΑΣΥΜΜΕΤΡΙΑ ΠΟΥ ΛΥΝΕΙ ΤΟ Φ2

Η επίλυση «πού πάει ο BIM cursor» ζει διάσπαρτη:
- **Κολόνα:** στο `mouse-handler-up.ts` (commit, bespoke branch) + `snap-scheduler`/`column-preview-helpers` (preview).
- **Τοίχος/δοκάρι:** ΜΕΣΑ στα tool hooks (Φ3, όχι τώρα).

**Φ2 = wire ΜΟΝΟ την κολόνα** ώστε commit + preview να καλούν τον εγκέφαλο (`toolKind:'column'`).
Καθαρό refactor: ΙΔΙΟΙ resolvers (`resolveColumnFaceSnapFromTargets`), ένα σημείο εισόδου.

---

## 4. SSoT AUDIT (GREP) — ΚΑΝΕ ΤΟ ΠΡΩΤΟ, ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Τρέξε & διάβασε (επιβεβαίωσε ότι δεν υπάρχει ήδη ενοποιημένος wrapper, βρες ΟΛΑ τα call sites):

1. `grep -rn "resolveColumnFaceSnapFromTargets" src/subapps/dxf-viewer` → ΟΛΑ τα call sites (commit στο
   `mouse-handler-up.ts` ~γρ.249· preview στο `snap-scheduler.ts` ή `column-preview-helpers.ts`).
2. `grep -rn "resolveBimCursorSnap" src/subapps/dxf-viewer` → ο εγκέφαλος (μόνο το NEW αρχείο + test).
3. `grep -rn "resolveEffectivePreviewCursor\|getImmediateSnap" src/subapps/dxf-viewer` → επιβεβαίωσε ότι ο
   cursor είναι ήδη snapped και στα 2 paths (commit + preview).
4. `grep -rn "buildColumnPolarSnapOptions" src/subapps/dxf-viewer` → πώς χτίζονται τα `columnOpts` (να τα
   περάσεις ΙΔΙΑ στον εγκέφαλο → preview ≡ commit).
5. `grep -rn "setColumnFaceAnchor\|setColumnFaceRotation\|setColumnGhostStatus" src/subapps/dxf-viewer` →
   τα side-effect stores που γράφει το column commit/preview (πρέπει να συνεχίσουν να γράφονται ΙΔΙΑ).
6. **ΔΙΑΒΑΣΕ** `HANDOFFS/HANDOFF_2026-06-22_column-snap-unification-to-sync.md` (προηγούμενη column-snap
   ενοποίηση — context για το πώς preview≡commit συγχρονίστηκε).

Στόχος: μηδέν νέο geometry/store· ο εγκέφαλος **delegates** στους υπάρχοντες resolvers· τα side-effect
stores (anchor/rotation/status) γράφονται ΙΔΙΑ όπως τώρα.

---

## 5. Η ΥΛΟΠΟΙΗΣΗ Φ2 (μετά το audit)

**Βήμα Α — brain: `findSnapPoint` optional**
- `bim/placement/bim-cursor-snap.ts`: κάνε `findSnapPoint?` optional στο `BimCursorSnapInput`. Στο point
  branch: αν `findSnapPoint` υπάρχει → ως τώρα· αλλιώς → `{ kind:'point', point:{...cursor}, snapType:null, candidate:null }`.
- Ενημέρωσε το test (πρόσθεσε case «χωρίς findSnapPoint → cursor αυτούσιος»). Τρέξε jest.

**Βήμα Β — wire COMMIT (`mouse-handler-up.ts`, column branch ~γρ.244-265)**
Τρέχον (να αντικατασταθεί):
```ts
const faceSnap = resolveColumnFaceSnapFromTargets(effectiveCursor, sceneSnapTargetsStore.get(), colHandle.getSceneUnits(), polarOpts);
if (faceSnap) { worldPoint = faceSnap.position; setColumnFaceAnchor(faceSnap.anchor); setColumnFaceRotation(faceSnap.rotation); setColumnGhostStatus(faceSnap.status); }
else { setColumnFaceAnchor(null); setColumnFaceRotation(null); setColumnGhostStatus('neutral'); worldPoint = effectiveCursor; }
```
Νέο: κάλεσε `resolveBimCursorSnap({ toolKind:'column', cursor:effectiveCursor, targets:sceneSnapTargetsStore.get(), sceneUnits:colHandle.getSceneUnits(), columnOpts:polarOpts })` (ΧΩΡΙΣ findSnapPoint — cursor ήδη snapped). Branch:
- `kind==='column-placement'` → `worldPoint = r.placement.position`· set anchor/rotation/status από `r.placement`.
- αλλιώς (`point`) → `worldPoint = r.point`· clear anchor/rotation/status (`null`/`'neutral'`).

**Βήμα Γ — wire PREVIEW** (το ΑΛΛΟ call site του `resolveColumnFaceSnapFromTargets` — βρες το στο audit,
πιθανότατα `snap-scheduler.ts` ή `column-preview-helpers.ts`). ΙΔΙΑ αντικατάσταση με τα ΙΔΙΑ opts/targets
→ preview ≡ commit. **Κρίσιμο:** και τα 2 paths πρέπει να καλούν τον εγκέφαλο με ΠΑΝΟΜΟΙΟΤΥΠΑ inputs.

**Βήμα Δ — tests + tsc**
- jest στο placement + τυχόν column snap tests. tsc ΜΟΝΟ αν χρειαστεί (N.17, έλεγξε για άλλον tsc πρώτα).
- Ενημέρωσε ADR-514 changelog (Φ2 DONE) + §4 status πίνακα.

---

## 6. BROWSER-VERIFY CHECKLIST (δίνεται στον Giorgio μετά το Φ2)

`http://localhost:3000/dxf/viewer`, εργαλείο **Κολόνα**. Κριτήριο: **«ούτε μία διαφορά» από σήμερα**.
1. Παρειά μέλους (τοίχος/δοκάρι/κολόνα) → flush κούμπωμα + **συνεχής ολίσθηση** κατά μήκος· κλικ → μπαίνει ΑΚΡΙΒΩΣ στο φάντασμα.
2. Polar Magnet (μέσα σε κύκλο) + Cartesian (μέσα σε ορθογώνιο) → ίδια πλέγματα.
3. OSNAP fallback (endpoint γραμμής / grid μακριά από μέλη) → ίδιο.
4. Μηδέν regression: χρώμα 🟢/🔴, περιστροφή flush σε λοξή ακμή, listening dimensions.

---

## 7. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ

| Αρχείο | Ρόλος |
|--------|-------|
| `bim/placement/bim-cursor-snap.ts` | NEW εγκέφαλος (κάνε findSnapPoint optional) |
| `bim/placement/__tests__/bim-cursor-snap.test.ts` | NEW tests |
| `docs/.../adrs/ADR-514-unified-bim-cursor-snap.md` | NEW ADR (ενημέρωσε changelog) |
| `systems/cursor/mouse-handler-up.ts` | COMMIT column branch (~γρ.244-265) — wire |
| `systems/cursor/snap-scheduler.ts` ή `hooks/drawing/column-preview-helpers.ts` | PREVIEW column path — wire (βρες στο audit) |
| `bim/columns/column-face-snap.ts` | `resolveColumnFaceSnapFromTargets` (delegate target, ΜΗΝ αλλάξεις) |
| `bim/columns/column-polar-opts.ts` | `buildColumnPolarSnapOptions` (columnOpts source) |
| `systems/cursor/ColumnPlacementGhostStatusStore.ts` | anchor/rotation/status setters (γράψε ΙΔΙΑ) |

**Επόμενα (όχι τώρα):** Φ3 = wall+beam wiring· Φ4 = slab/roof/foundation uniform snap· Φ5 = SSoT registry + cross-links.
