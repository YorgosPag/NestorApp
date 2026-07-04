# HANDOFF — Αναδιάταξη contextual tab «Στυλ Γραμμής»: μεγάλα εικονίδια modify + zero-scroll + thumbnails στο line-style dropdown

**Ημερομηνία:** 2026-07-04
**ADRs:** ADR-510 §Φ4 (ribbon layout του line tool) · ADR-357 §G15 · ADR-570 (Στυλ Γραμμής/ByStyle) · ADR-507 Φ2 (lineweight)
**Τύπος:** UI/ribbon reorg + thumbnail dropdown. **Domain:** dxf-viewer ribbon. **Εκτίμηση:** 3–6 αρχεία (data tab + ίσως bridge + line-style-options + thumbnail renderer + i18n + ADR).

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- 🗣️ Απαντάς **Ελληνικά** πάντα.
- 🚫 **ΟΧΙ commit / ΟΧΙ push** — τα κάνει ο Giorgio. **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → μόνο `git add <specific>`, verify με `git diff --cached`, **ΠΟΤΕ** `git add -A` / `git restore .` / `reset --hard`.
- 🚫 **ΟΧΙ tsc** (N.17)· **jest OK** (στοχευμένα, όπου έχει νόημα — εδώ κυρίως UI, άρα ίσως λίγα/καθόλου).
- 🧩 **ΞΕΚΙΝΑ ΣΕ PLAN MODE.** Πρότεινε μοντέλο (N.14 — μάλλον **Opus**: cross-cutting UI + SSoT) και περίμενε «ok».
- 🏆 **Big-player fidelity: Revit / Maxon (Cinema 4D) / Figma-level.** FULL enterprise + FULL SSoT. **ΑΝ οι μεγάλοι παίκτες δεν το προτείνουν → ακολουθείς ΤΗ ΔΙΚΗ ΤΟΥΣ πρακτική**, δεν το υλοποιείς «επειδή γίνεται».
- 🧱 **ADR-driven (N.0.1):** διάβασε ΠΡΩΤΑ κώδικα, ενημέρωσε ADR-510 §Φ4 στο ίδιο πλαίσιο.

---

## 1. 🔴 ΤΟ ΑΙΤΗΜΑ ΤΟΥ GIORGIO (ακριβώς)
Στο **contextual tab «Στυλ Γραμμής»** (`line-tool-style`):

1. **Μεγάλα εικονίδια (large buttons)** για: **ψαλίδισμα (trim) · επέκταση (extend) · παράλληλη μετατόπιση (offset) · συναρμογή (fillet) · λοξοτομή (chamfer)** — με σειρά **αριστερά → δεξιά** από την αρχή του ribbon.
2. **ZERO SCROLLING** πουθενά στο ribbon αυτής της καρτέλας: **ΟΛΑ τα πεδία ορατά χωρίς scroll** (ούτε κάθετο, ούτε flyout ▼ που κρύβει πεδία).
3. Το **dropdown «Στυλ Γραμμής»** μέσα στο ribbon δείχνει σήμερα **μόνο κείμενα** → θέλει **μικρογραφίες (thumbnails)** (όπως το linetype dropdown που ΗΔΗ έχει thumbnails).

---

## 2. 🔴 PHASE-1 (ΠΡΙΝ γράψεις κώδικα): SSoT AUDIT (grep) + big-player verify
**Ο Giorgio ζητά ρητά πραγματικό SSoT audit για να ΜΗΝ φτιάξεις διπλότυπα.** Τα building blocks ΥΠΑΡΧΟΥΝ ήδη — grep/read για να τα επιβεβαιώσεις & να τα χρησιμοποιήσεις:

| Ανάγκη | Υπάρχον SSoT (reuse, ΜΗΝ ξαναγράψεις) |
|---|---|
| Μεγάλα κουμπιά | `ui/ribbon/data/ribbon-large-button-helpers.ts` + `size: 'large'` στο `RibbonCommand` (δες `ribbon-types.ts`). Grep άλλα tabs που χρησιμοποιούν `size: 'large'` (π.χ. `contextual-*-tab.ts`) ως πρότυπο. |
| Thumbnails σε dropdown | `ui/ribbon/components/buttons/RibbonComboboxThumbnail.tsx` (component) + `rendering/linetype-thumbnail.ts` (SVG/canvas thumbnail generator). Πρότυπο: το **linetype** πεδίο δίνει thumbnails **live από το bridge** — δες `contextual-dimension-tab.ts` + `useRibbonDimBridge.ts` (arrowhead/linetype thumbnails, πρόσφατο ADR-362/562). |
| Line-style options | `ui/ribbon/data/line-style-ribbon-options.ts` + `systems/line-styles/` (`line-style-registry.ts`, `line-style-resolver.ts`, `line-style-templates.ts`). Εδώ πρέπει να προστεθεί το thumbnail ανά στυλ. |
| Bridge (τροφοδοτεί options live) | `ui/ribbon/hooks/useRibbonLineToolBridge.ts` (η lineStyle τροφοδοτείται από `LineStyleRegistry` snapshot — options `[]` στο data tab, γεμίζουν στο bridge). |
| Command keys | `ui/ribbon/hooks/bridge/line-tool-command-keys.ts` (`LINE_TOOL_RIBBON_KEYS`, `LINE_TOOL_PANEL_VISIBILITY_KEYS`). |

**Big-player verify (γράψε 3-4 γραμμές στον Giorgio):** πώς οργανώνουν Revit (Modify panel: μεγάλα/στοιχισμένα κουμπιά + contextual options), Maxon, Figma τα modify tools + τα style pickers με previews. **Αν κάτι δεν το κάνουν οι μεγάλοι → μην το κάνεις.**

---

## 3. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (ακριβές, από έρευνα 2026-07-04)
**Κύριο αρχείο-στόχος:** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-line-tool-tab.ts` (`CONTEXTUAL_LINE_TOOL_TAB`, id `line-tool-style`).

Panels (σειρά σήμερα): **1) `line-modify`** (Τροποποίηση) → 2) `line-general` (Γενικά) → 3) `line-appearance` (Εμφάνιση) → 4) `line-geometry` (Γεωμετρία, line-only, self-hides).

Ευρήματα προς διόρθωση:
- **`line-modify` είναι ήδη πρώτο** (αριστερά) ✅ — **ΑΛΛΑ** τα trim/extend/offset είναι `size: 'small'`, και fillet είναι **split-button** με το chamfer ως variant. → Ο Giorgio θέλει **5 ΜΕΓΑΛΑ εικονίδια** (trim, extend, offset, fillet, chamfer) αριστερά→δεξιά. **Απόφαση για plan:** 5 ξεχωριστά `size:'large'` κουμπιά, ή κρατάμε fillet split (fillet/chamfer) μεγάλο; (δες τι κάνει το Revit Modify — μάλλον ξεχωριστά).
- **Πηγή scroll:** το `line-modify` έχει 5 comboboxes (filletRadius, chamferDist1, chamferDist2, chamferAngle + buttons) + 4 panels συνολικά → πλάτος. **Big-player pattern για zero-scroll:** τα numeric options (fillet radius / chamfer d1/d2/angle) να εμφανίζονται **contextually** μόνο όταν το αντίστοιχο εργαλείο είναι ενεργό (Revit «Options Bar»/contextual). Έτσι το ribbon δεν φουσκώνει. Το `visibilityKey` mechanism ΥΠΑΡΧΕΙ ήδη (δες `line-geometry` panel + `getPanelVisibility` στο bridge) → reuse.
- **Line-style dropdown (text-only):** `lineToolStyle.lineStyle` (commandKey `LINE_TOOL_RIBBON_KEYS.lineStyle`) = plain `type:'combobox'`, `options:[]` (bridge-fed). → χρειάζεται thumbnail variant (όπως το `linetype` που έχει ήδη thumbnails). Δες πώς το `linetype` πεδίο δηλώνεται και πώς το bridge βάζει thumbnails.
- **Το `visibilityKey`/horizontal-panel design ήδη υπάρχει** (ADR-510 Φ4: panels laid out horizontally, `.dxf-ribbon-panel-body` = flex-row) — άρα το zero-scroll είναι ΣΤΟΧΟΣ που ήδη υπάρχει μερικώς· πρέπει να διορθωθεί ώστε να τηρείται με τα μεγάλα κουμπιά + όλα τα πεδία.

---

## 4. ΤΙ ΝΑ ΚΑΝΕΙΣ (μετά το plan approval)
1. **Μεγάλα κουμπιά modify** (trim/extend/offset/fillet/chamfer) `size:'large'`, σειρά αριστερά→δεξιά, στην αρχή του `line-modify` panel. Reuse `ribbon-large-button-helpers.ts` + υπάρχοντα icons (`trim`/`extend`/`offset`/`fillet`/`chamfer` — υπάρχουν ήδη). **ΙΔΙΑ command keys** (`trim`/`extend`/`offset`/`fillet`/`chamfer`) — μηδέν νέο wiring.
2. **Zero-scroll:** αναδιάταξε panels/πεδία ώστε ΟΛΑ ορατά χωρίς scroll. Πιθανή προσέγγιση (big-player): contextual εμφάνιση των numeric fields (fillet radius / chamfer dists / angle) ανά ενεργό εργαλείο μέσω `visibilityKey`. Επιβεβαίωσε ότι δεν μένει flyout ▼ που κρύβει πεδία.
3. **Thumbnails στο line-style dropdown:** πρόσθεσε thumbnail ανά στυλ (reuse `RibbonComboboxThumbnail` + `linetype-thumbnail.ts` ή αντίστοιχο line-style renderer· τροφοδότηση live από `useRibbonLineToolBridge` + `line-style-ribbon-options.ts`). Πρότυπο: το linetype/arrowhead dropdown στο dimension tab.
4. **i18n:** αν χρειαστούν νέα keys → πρόσθεσέ τα ΠΡΩΤΑ σε `src/i18n/locales/el/*.json` **ΚΑΙ** `en/*.json` (N.11· zero hardcoded).
5. **ADR-510 §Φ4** (+ ADR-570 αν αγγίξεις line-style) → ενημέρωση + changelog στο ίδιο πλαίσιο (Phase 3).

---

## 5. VERIFICATION
- **jest** όπου έχει νόημα (π.χ. tab data structure test — δες `data/__tests__/contextual-dimension-tab.test.ts` ως πρότυπο). **ΟΧΙ tsc.**
- **Browser-verify (Giorgio):** άνοιξε line tool → καρτέλα «Στυλ Γραμμής» → (α) 5 μεγάλα εικονίδια αριστερά, (β) κανένα scroll/κρυμμένο πεδίο, (γ) dropdown στυλ γραμμής με μικρογραφίες.

## 6. ΣΧΕΤΙΚΟ ΠΛΑΙΣΙΟ (μην μπερδευτείς)
- Στο ίδιο (uncommitted, shared) tree υπάρχει **πρόσφατη δουλειά Fillet/Chamfer (ADR-510 Φ4e.2/Φ4f.2)** — άσχετη με ΑΥΤΟ το task (εκείνο = γεωμετρία· αυτό = ribbon layout). Το ribbon ήδη δείχνει fillet/chamfer ως live. Μην τα ακουμπήσεις.
- `.claude-rules/pending-ratchet-work.md`: 3 pending (arc-angle split, findPolylineSegment ×2, wall-scaffold ×3) — άσχετα, μην τα πιάσεις εκτός αν σου το πει ο Giorgio.
