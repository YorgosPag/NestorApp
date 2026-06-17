# HANDOFF — ADR-467 Member Load Readout στις Ιδιότητες (κολώνα/δοκάρι/πλάκα)

**Ημ/νία:** 2026-06-17 · **Από:** Opus session (ADR-467 load path engine)
**Γλώσσα:** Πάντα Ελληνικά στις απαντήσεις (CLAUDE.md LANGUAGE RULE).

---

## 0. ΤΙ ΘΑ ΚΑΝΕΙΣ (το ζητούμενο)
Πρόσθεσε **read-only group «Φορτίο σχεδιασμού»** στην καρτέλα **Ιδιότητες** της **κολώνας** (μετά:
δοκάρι + πλάκα με το ίδιο pattern), που να δείχνει το `appliedLoad` (ADR-467) — **όπως το Revit δείχνει
φορτία μέλους**. FULL ENTERPRISE + FULL SSoT, Revit-grade.

**Να εμφανίζονται:**
- `N_dead` (G, kN) · `N_live` (Q, kN) · `N_Ed = 1.35·G + 1.5·Q` (ULS, kN) · πηγή (takedown/manual).

**ΓΙΑΤΙ:** Το ADR-467 πρόσθεσε το **δεδομένο** (`appliedLoad` persisted σε ColumnParams/BeamParams/
SlabParams — επιβεβαιωμένο στη βάση: κολώνες έχουν dead=596.40336/live=150) **αλλά όχι UI readout**. Το
**πέδιλο** το δείχνει επειδή το ADR-464 Slice 1b είχε προσθέσει group «Φορτία & Έδραση» **μόνο** στο
foundation panel. Άρα: data υπάρχει, καμία καρτέλα κολώνας/δοκαριού/πλάκας δεν το ζωγραφίζει.

---

## 1. GREP-FIRST (υποχρεωτικό — reuse, μηδέν διπλότυπα N.0.2)
Πριν γράψεις κώδικα, διάβασε & **αντίγραψε το pattern** του πεδίλου:

| Reuse | Αρχείο | Τι |
|---|---|---|
| `readout(commandKey, labelLeaf)` descriptor + section | `ui/foundation-advanced-panel/foundation-property-fields.ts` (γρ. 52, 100-135 «Φορτία & Έδραση») | πώς ένα read-only πεδίο μπαίνει στην καρτέλα |
| bridge resolver readout τιμών | `ui/ribbon/hooks/bridge/foundation-structural-bridge.ts` (+ `foundation-structural-param.ts`, `foundation-command-keys.ts`) | πώς υπολογίζεται η τιμή του readout (π.χ. bearingPMax) |
| **loads SSoT** | `bim/structural/loads/structural-loads-types.ts` (`resolveAppliedMemberLoad`) + `load-combinations.ts` (`combineUls`/`combineSls`) | G/Q → N_Ed (ΜΗΝ ξαναγράψεις τον συνδυασμό) |
| πού μπαίνει για κολώνα | `ui/column-advanced-panel/column-property-fields.ts` (descriptor) + `ColumnPropertyRow.tsx` + `ui/ribbon/hooks/bridge/column-structural-bridge.ts` + `column-command-keys.ts` | column panel SSoT (ADR-363 Φ4) |

**Format αριθμών:** χρησιμοποίησε τον υπάρχοντα number/locale formatter του project (ΜΗΝ hardcode· δες πώς
το πέδιλο φορμάρει p_max). i18n keys: **πρόσθεσε el ΚΑΙ en** σε `i18n/locales/{el,en}/dxf-viewer-shell.json`
(N.11 — μηδέν hardcoded strings· apply BEFORE χρήση).

**Σημείωση contract:** για την κολώνα ο readout είναι **απλούστερος** από το πέδιλο — δεν χρειάζεται
bearing engine· μόνο `resolveAppliedMemberLoad(params.appliedLoad)` → format G/Q + `combineUls` → N_Ed.

---

## 2. ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ (όλα COMMITTED)
- **HEAD:** `65d3d54f feat(dxf): ADR-467 load-path refinement + guide-store offset lookup SSoT`
- **Working tree: ΚΑΘΑΡΟ.** Το ADR-467 (Slices 1-6) είναι ΗΔΗ committed (από Giorgio/shared process).
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-467-load-path-engine.md` (Slices 1-6 + grid-anchored).
- **ADR-467 = διαδρομή φορτίων** slab→beam→column→footing, FEM-free Revit tributary mode. Κάθε μέλος
  παίρνει `appliedLoad` (source=takedown). **Slice 6 (grid-anchored):** tributary node κολώνας = τομή
  αξόνων κανάβου (`derivePointSlots`, reuse ADR-441) όχι κεντροειδές → 5×5 δίνει 25 m² (όχι 21.16).

### Επαληθευμένο test scene (μην το σβήσεις — χρησιμεύει για browser-verify)
- Όροφος **Ισόγειο** `flr_215e39f3-d958-4f97-ac59-6639131767d1` (DB project pagonis-87766).
- 4 κολώνες σε **κάναβο 5×5 m** (`floorplan_columns`), η καθεμία `appliedLoad: {dead 596.40336, live 150,
  source takedown}` — αυτές οι τιμές πρέπει να εμφανιστούν στην καρτέλα μετά την υλοποίηση.
- Building `bldg_58f47bf1…` `structuralSettings`: G=7.5, Q=2, σ_allow=300, ΕΚΩΣ/ΕΑΚ, C25/30· counted
  storeys=3 (Ισόγειο+1ος+2ος).
- N_Ed αναμενόμενο = 1.35·(596.40336−ίδιο βάρος δεν διαχωρίζεται· χρησιμοποίησε ΟΛΟ το dead) + 1.5·150 =
  1.35·596.403 + 1.5·150 = 805.14 + 225 = **1030.1 kN** (επιβεβαίωσέ το με `combineUls`).

### Επαλήθευση μέσω βάσης (MCP firestore tools)
BIM σε Firestore: `floorplan_columns/_beams/_foundations/_slabs` (πεδίο `floorId`). DXF γραμμές=Storage
`.scene.json` (μετρητής στο `files.processedData.sceneStats.entityCount`). Guides=`floorplan_grid_guides`
(container/όροφο, array `guides[]`). Query με filter `floorId == flr_215e39f3…`.

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Shared working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία. **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH = Giorgio**, ΟΧΙ εσύ (N.(-1)). Ετοίμασε, σταμάτα, ανάφερε τι να σταρισει.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε για άλλον tsc πριν τρέξεις.
- **GOL + SSoT + grep-first**· 40-line functions / 500-line files· μηδέν `any`/inline styles/hardcoded i18n.
- Μετά την υλοποίηση: update ADR-467 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory (N.15).
- Ελληνικά πάντα στις απαντήσεις.

## 4. DEFER (μην τα κυνηγήσεις εκτός αν ζητηθούν)
- Δοκάρια παίρνουν μόνο ίδιο βάρος (live=0) όταν δεν «καρφώνουν» σε κολώνα (καμία `column-bearing` ακμή)
  → slab→beam strip tributary (Option B, geometry) = DEFER.
- strip/tie-beam footing takedown· chained reaction tree (FEM)· slab nodes στον οργανισμό.

---

**Πρώτο βήμα νέας session:** GREP τα αρχεία του §1 (foundation readout pattern) → σχέδιο → υλοποίηση
κολώνας → browser-verify (επίλεξε κολώνα Ισογείου → καρτέλα Ιδιότητες δείχνει 596.4/150/N_Ed) → beam/slab.
