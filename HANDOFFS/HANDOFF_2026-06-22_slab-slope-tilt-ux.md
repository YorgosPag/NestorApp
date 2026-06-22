# HANDOFF — Κεκλιμένη (sloped/tilted) ΠΛΑΚΑ: UX ribbon numeric (ADR-404 Phase 5c)

**Ημερομηνία:** 2026-06-22 · **Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ (ΠΑΝΤΑ).**
**Μοντέλο:** Opus (cross-cutting· ribbon + bridge + geometryType invariant).
**Working tree: ΜΟΙΡΑΖΕΤΑΙ με άλλον agent → stage ΜΟΝΟ δικές σου γραμμές. COMMIT τον κάνει ο Giorgio, ΟΧΙ εσύ (N.(-1)/N.16).**
**FULL ENTERPRISE + FULL SSOT, όπως Revit. ΠΡΙΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep, §3). Μηδέν διπλότυπα.**

---

## 1. Στόχος

Ο χρήστης να ορίζει την **κλίση/ρύση πλάκας** (Revit «Sloped slab / slope arrow», drainage) από το **UI ribbon**
— όχι μόνο μέσω 3D gizmo. Είναι το **τρίτο αδελφό** μετά την **κολώνα** (ADR-404 Phase 5, ✅) και τον **τοίχο**
(Phase 5b, ✅ browser-verified 2026-06-22). Reuse-only πάνω στο υπάρχον slope SSoT — **μηδέν νέα γεωμετρία**.

**ADR-487 (living structural organism):** η πλάκα είναι ζωντανό μέλος· η κλίση τροφοδοτεί απορροή/φορτία/BOQ.
Κράτα geometry/topology καθαρά (reuse SSoT), μηδέν παράλληλο μηχανισμό.

---

## 2. ΚΡΙΣΙΜΕΣ ΔΙΑΦΟΡΕΣ ΑΠΟ ΚΟΛΩΝΑ/ΤΟΙΧΟ — ΜΗΝ κάνεις copy-paste

| | Κολώνα (✅) | Τοίχος (✅) | **Πλάκα (αυτό)** |
|---|---|---|---|
| Μοντέλο | `ColumnTilt {direction, angle°}` | `WallTilt {angle°}` 1-DOF | **`SlabSlope {direction°, angle, pivotEdge?}`** |
| **angle units** | **μοίρες** | **μοίρες** | **⚠️ ΠΟΣΟΣΤΟ % (ρύση), ΟΧΙ μοίρες!** (`tan(deg)·100`· 2% drainage standard) |
| On/off | `tilt` undefined | `tilt` undefined | **⚠️ `geometryType: 'box'\|'tilted'` discriminator** — toggle αλλάζει ΚΑΙ τα δύο (slope required iff `'tilted'`, Zod/validator-enforced) |
| Φορά | direction (ελεύθερη) | πλευρά (±) | **`direction` (μοίρες CCW from +X) Ή `pivotEdge` (N/S/E/W/center)** — και τα δύο υπάρχουν στον τύπο |
| Drawing-mode | tool-bridge store (2-κλικ) | minimal tool-bridge store (born-tilted) | **❓ η πλάκα ΔΕΝ σχεδιάζεται γραμμικά** (outline/region/από-κάναβο) → «σχεδίασε ήδη κεκλιμένη» ίσως δεν έχει νόημα· **μάλλον selected-only** — ΑΠΟΦΑΣΙΣΕ με grep + ρώτα Giorgio |

**Δύο invariants που ΔΕΝ υπάρχουν σε κολώνα/τοίχο:**
1. **`geometryType` ↔ `slope` coupling** (Zod-enforced: `slope` required iff `geometryType==='tilted'`, forbidden αλλιώς).
   Το toggle «Κεκλιμένη» ΟΝ → `{geometryType:'tilted', slope:{...}}`· OFF → `{geometryType:'box'}` + **drop** `slope`.
2. **`angle` = ποσοστό %** (όχι μοίρες). Το gizmo κάνει `tan(deg)·100`.

---

## 3. ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Ο Giorgio το απαιτεί ρητά («υπάρχει διπλότυπο; ναι/όχι»). Τα παρακάτω **ΕΠΑΛΗΘΕΥΤΗΚΑΝ ΗΔΗ** (2026-06-22):

1. **Γεωμετρία/3D κλίσης πλάκας (ΥΠΑΡΧΕΙ — ΜΗΝ ξαναγράψεις):**
   - Τύπος: `bim/types/slab-types.ts` → `SlabSlope {direction, angle(%), pivotEdge?}` (γρ.75) + `geometryType` (γρ.116) + `slope?` (γρ.118)· Zod `slab.schemas.ts` `SlabSlopeSchema` (γρ.91) ✅
   - 3D shear: `bim-3d/converters/mesh-slope-shear.ts` → `applySlabSlope` (sibling των `applyColumnTilt`/`applyWallTilt`) ✅
   - plan offset: `bim/geometry/slab-slope.ts` → `slabSlopeOffsetZmm` ✅
2. **⭐ gizmo SSoT — ΤΟ ΚΛΕΙΔΙ ΓΙΑ ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΟ:** `bim-3d/gizmo/bim3d-tilt-bridge.ts`:
   - `computeSlabTiltParams(params, drag)` (γρ.199, **exported**) — γράφει `{geometryType:'tilted', slope:{direction, angle:tan(deg)·100, pivotEdge}}`.
   - `straightenSlab(params)` (γρ.214, **PRIVATE**) — το flatten→`box` + drop slope (το geometryType invariant).
   - `sameSlabSlope(a,b)` (γρ.220, **PRIVATE**) — equality.
   - ⚠️ **Το `geometryType↔slope` invariant ζει σήμερα ΜΟΝΟ εδώ (μερικώς private).** Το numeric ribbon ΧΡΕΙΑΖΕΤΑΙ το ΙΔΙΟ invariant. **ΜΗΝ το ξαναγράψεις inline** — **εξάγαγέ το** σε ΕΝΑ pure SSoT helper (π.χ. `slab-slope-edit.ts` ή στο `slab-slope.ts`): `withSlabSlope(params, slope|null): SlabParams` (slope=null → box+drop· slope set → tilted) + reuse στο gizmo (`straightenSlab` → delegate). Αυτό είναι το αντίστοιχο του `isWallTiltAngleActive` που εξήχθη στον τοίχο (μάθημα: μην ξαναγράφεις λογική που υπάρχει private).
3. **Slab ribbon/bridge (εδώ μπαίνει το UI):**
   - `ui/ribbon/hooks/bridge/slab-command-keys.ts` — `SLAB_RIBBON_KEYS` (stringParams/params), `isSlabRibbonKey`/`isSlabRibbonStringKey`. **ΔΕΝ έχει slope group** — πρόσθεσέ το.
   - `ui/ribbon/hooks/useRibbonSlabBridge.ts` — ο bridge (read selected slab / write μέσω `UpdateSlabParamsCommand`).
   - `ui/ribbon/data/contextual-slab-tab.ts` — τα panels (πρόσθεσε panel «Κλίση»).
   - **`UpdateSlabParamsCommand`** (`core/commands/entity-commands/`) — ΥΠΑΡΧΕΙ· ΙΔΙΑ εντολή για selected edit, **καμία νέα εντολή** (ίδιο undo με gizmo).
   - **Slab δεν έχει tool-bridge store** (grep: κανένα `slab-tool-bridge-store.ts`). Αν αποφασιστεί drawing-mode → mirror το **NEW `wall-tool-bridge-store.ts`** (minimal handle, έγινε στο Phase 5b).
4. **🔴 ΤΟ ΜΑΘΗΜΑ ΑΠΟ ΤΟΝ ΤΟΙΧΟ (μην το ξεχάσεις — κόστισε ένα bug round):** ο composer `useRibbonCommands.ts`
   δρομολογεί στον `slabBridge` ΜΟΝΟ για `isSlabRibbonKey || isSlabRibbonStringKey` (γρ.145 onComboboxChange + γρ.266
   getComboboxState). **Αν βάλεις τα slope keys σε νέο διακριτό set (`isSlabSlopeKey`), ΠΡΕΠΕΙ να το προσθέσεις
   ΚΑΙ στα 2 αυτά guards** — αλλιώς το command ΔΕΝ φτάνει ΠΟΤΕ στον bridge (no-op, «δεν ανταποκρίνεται»).
   *Εναλλακτικά:* βάλε τα slope keys ΜΕΣΑ στα `SLAB_RIBBON_NUMBER_KEYS`/`SLAB_RIBBON_STRING_KEYS` (όπως η κολώνα τα tilt) → ο composer τα πιάνει αυτόματα· τότε βάλε τον slope branch ΠΡΙΝ τους generic helpers στον bridge.
5. **i18n (N.11):** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `ribbon.commands.slabEditor.*` + `ribbon.panels.*`.
   Πρόσθεσε `slabEditor.slope.*` (mirror `wallEditor.tilt.*` / `columnEditor.tilt.*`) + `panels.slabSlope`.

**Reference υλοποίηση (το πρότυπο):** ο **ΤΟΙΧΟΣ Phase 5b** (μόλις έγινε) — `wall-tilt-param.ts`,
`wall-command-keys.ts` (tilt group + `isWallTiltKey`), `useRibbonWallBridge.ts` (tilt branch ΠΡΙΝ null-check),
`contextual-wall-tab.ts` (panel «Κλίση»), `useRibbonCommands.ts` (+`isWallTiltKey` στα 2 guards). **Πρότυπο, ΟΧΙ copy-paste.**

---

## 4. SSoT REUSE MAP (μηδέν διπλότυπο)

| Ανάγκη | Reuse (ΥΠΑΡΧΕΙ) — ΜΗΝ ξαναγράψεις |
|---|---|
| Γεωμετρία/3D κλίσης πλάκας | `applySlabSlope` + `slabSlopeOffsetZmm` (ADR-404) |
| **geometryType↔slope invariant + %** | `bim3d-tilt-bridge` (`computeSlabTiltParams` exported· `straightenSlab` private) → **ΕΞΑΓΑΓΕ** ΕΝΑ `withSlabSlope(params, slope\|null)` SSoT, reuse σε gizmo+ribbon |
| Selected-entity edit | `UpdateSlabParamsCommand` (ίδια με gizmo — **καμία νέα εντολή**, ΕΝΑ undo) |
| Ribbon routing | extend `slab-command-keys` (slope group) + slab bridge branch |
| Composer routing | `useRibbonCommands` guards (το μάθημα §3.4) |
| on/off toggle options | πρότυπο `wallEditor.tilt` / `TILT_ENABLED_OPTIONS` |
| (αν drawing-mode) tool store | NEW minimal `wall-tool-bridge-store.ts` (Phase 5b) |

⚠️ **ΜΗΝ φτιάξεις `slab-slope-from-points.ts`** ή νέο gizmo math — το numeric γράφει direction+angle(%) **απευθείας**.

---

## 5. ΑΠΟΦΑΣΕΙΣ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ Giorgio (ρώτα με concrete παράδειγμα, ΠΡΙΝ υλοποιήσεις)

1. **Μονάδα γωνίας στο UI:** % (ρύση, native — π.χ. «2% = 2cm/m») / μοίρες / ratio («1:20»);
   Το `SlabSlope.angle` είναι ΗΔΗ %. Revit slab = συνήθως % ή ratio. **Σύσταση: %** (zero conversion).
2. **Φορά κλίσης:** `direction` (μοίρες CCW, ελεύθερη — Revit slope-arrow) Ή `pivotEdge` (N/S/E/W/center, απλό dropdown);
   Concrete παράδειγμα: «κλίση 2% προς Βορρά (direction 90°)» vs «γέρνει γύρω από τη Νότια άκρη».
3. **Scope:** selected-only (η πλάκα σχεδιάζεται με outline/region — όχι linear tool) ή και drawing-mode born-sloped;
   **Σύσταση: selected-only** (grep αν υπάρχει `useSlabTool` με param overrides· αν όχι → selected-only).

---

## 6. Σχέδιο (μετά audit + αποφάσεις)

- **Φ-recognition:** grep §3 → επιβεβαίωσε δομή· εξάγαγε το `withSlabSlope` SSoT (gizmo reuse).
- **Wiring (data-driven, mirror τοίχου):**
  - slab-command-keys: NEW `slope` group (`slopeEnabled` string + `slopeAngle` number + `slopeDirection`/`slopePivot`) + `isSlabSlopeKey`.
  - NEW `slab-slope-param.ts` (pure SSoT, mirror `wall-tilt-param.ts`): resolve/apply· χρησιμοποιεί το `withSlabSlope` invariant + % handling· selected (+ drawing αν αποφασιστεί).
  - useRibbonSlabBridge: slope branch (delegate)· **useRibbonCommands: +`isSlabSlopeKey` στα 2 guards** (§3.4!).
  - contextual-slab-tab: NEW panel «Κλίση» (toggle + γωνία% + φορά).
  - i18n el+en: `slabEditor.slope.{enabled,angle,direction,on,off}` + `panels.slabSlope`.
- **Tests:** NEW `slab-slope-param.test.ts` (geometryType↔slope invariant, %, on/off, direction)· `withSlabSlope` test.
- **Docs (N.15, ΙΔΙΟ commit):** ADR-404 → NEW «Phase 5c — slab slope UX»· changelog· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` 1-2 γραμμές· MEMORY pointer· (αν εξαχθεί SSoT) pending-ratchet update.

---

## 7. Constraints / κανόνες
- **N.17 (tsc serialization):** ΠΡΙΝ tsc → έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance ... node.exe ... tsc`). ΕΝΑ tsc τη φορά.
- **CHECK 6B/6D:** pure-ribbon UI μάλλον δεν τα ενεργοποιεί· αν αγγίξεις converter/render → stage ADR-404 (+ADR-040).
- **Shared working tree:** `git add` ΜΟΝΟ δικά σου αρχεία/γραμμές (useRibbonCommands.ts + bim3d-tilt-bridge.ts = hot, πολλοί agents).
- **N.11 i18n:** καμία hardcoded string· keys el+en πρώτα. **N.2/N.3:** μηδέν `any`, μηδέν inline styles.
- **COMMIT: μόνο ο Giorgio.** Εσύ ετοιμάζεις + αναφέρεις (tsc/jest/browser-verify checklist).

## 8. Out of scope / DEFER
- **Στέγη (Roof):** `RoofEdgeSlope` = per-edge (πιο σύνθετο)· ξεχωριστό handoff αν ζητηθεί.
- **Δοκάρι slope:** `topElevationEnd` = ήδη μηχανισμός· μόνο αν Giorgio θέλει numeric «κλίση άκρου».
- **`createToolBridgeStore<T>()` factory** (14 stores, pending-ratchet): αν χρειαστεί drawing-mode store, σκέψου να φτιάξεις το generic factory (boy-scout) αντί 15ο αντίγραφο — ΑΛΛΑ αγγίζει committed αρχεία → ρώτα Giorgio.

## 9. Σχετικά ADR/αρχεία
- ADR-404 (`docs/.../adrs/ADR-404-3d-bim-element-tilt.md`) — Phase 5 (κολώνα) + Phase 5b (τοίχος) = τα πρότυπα· πρόσθεσε Phase 5c.
- ADR-369 §9 Q7 (slab geometryType 'box'|'tilted') · ADR-487 (vision).
- Memory: `reference_slanted_wall_ux.md` (τοίχος Phase 5b + το composer-guard μάθημα), `reference_slanted_column_ux.md` (κολώνα Phase 5).
