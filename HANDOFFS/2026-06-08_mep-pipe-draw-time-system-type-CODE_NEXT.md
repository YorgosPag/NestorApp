# HANDOFF — Draw-time «System Type» στον σωλήνα (Revit Type Selector, color-by-system) — CODE

**Ημ/νία:** 2026-06-08 · **Μοντέλο:** Opus 4.8 (Plan Mode — ζητήθηκε από Giorgio) · **ADR:** ADR-408 §Φ8/Φ14
**Στόχος Giorgio (αυτολεξεί):** «Όταν τοποθετώ σωλήνες, δεν γνωρίζω τι σωλήνες τοποθετώ επειδή όλοι έχουν το ίδιο χρώμα. Τι κάνει η Revit;» → **«όπως οι μεγάλοι παίχτες, σαν Revit — FULL ENTERPRISE + FULL SSOT».**

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (επιβεβαιωμένο στον κώδικα)
Ο γενικός «Σωλήνας» (`mep-pipe`) σχεδιάζεται **χωρίς classification** → όλοι οι σωλήνες ύδρευσης βγαίνουν με το ίδιο default χρώμα. Ο χρήστης δεν ξέρει αν βάζει κρύο/ζεστό νερό. (Η **αποχέτευση** `mep-drain-pipe` ΗΔΗ έχει preset `sanitary-drainage` → βγαίνει καφέ — άρα ο μηχανισμός χρωματισμού δουλεύει, λείπει μόνο η **επιλογή draw-time** στους υπόλοιπους.)

**Root cause (επαληθευμένο):** στο `contextual-mep-segment-tab.ts` το classification picker ζει σε panel με `visibilityKey: pipeDomain`, και ο bridge resolver `getPanelVisibility` κάνει `if (!segment) return false` → **κρύβεται κατά τη σχεδίαση**, εμφανίζεται μόνο μετά την επιλογή υπάρχοντος σωλήνα.

## 🏛️ ΤΙ ΚΑΝΕΙ Η REVIT
Δεν υπάρχει «άχρωμος/γενικός» σωλήνας. **Πριν** σχεδιάσεις διαλέγεις **System Type** (Domestic Cold Water / Hot Water / Sanitary / Hydronic Supply / Return) από τον Type Selector· ο σωλήνας παίρνει **αμέσως** το χρώμα του συστήματος (System Graphic Overrides / "color by system" View Filters). Συνδέεσαι σε υπάρχον δίκτυο → κληρονομεί.

## ✅ Η ΛΥΣΗ (Revit-grade, FULL SSOT — εγκεκριμένη κατεύθυνση)
Κάνε το **classification picker draw-time (dual-mode)** — ορατό όταν το pipe εργαλείο είναι ενεργό, ΠΡΙΝ τη σχεδίαση. Διαλέγεις «Σύστημα» → ο επόμενος σωλήνας βγαίνει με το σωστό χρώμα.

**ΚΡΙΣΙΜΟ — το pattern ΥΠΑΡΧΕΙ ΗΔΗ:** το «Ύψος άξονα» (`centerlineElevation`) έγινε ήδη draw-time dual-mode στον ΙΔΙΟ bridge (Φ8 EXT #2b). **Mirror-άρεις αυτό ακριβώς** για το classification → μικρή, καθαρή, μηδέν-fork αλλαγή. Το committed σωλήνα ΗΔΗ παίρνει χρώμα από το `classification` param μέσω `resolveSegmentClassificationColor` (το `mep-drain-pipe` το αποδεικνύει) → άρα μόλις μπει το draw-time override, ο σωλήνας βγαίνει χρωματιστός **δωρεάν**.

## 📐 ΑΠΟΦΑΣΕΙΣ ΣΧΕΔΙΑΣΜΟΥ (πάρε τες στο Plan Mode — η σύστασή μου)
1. **Default classification για `mep-pipe` = `domestic-cold-water` (μπλε)** ώστε ο γενικός σωλήνας να ΜΗΝ είναι ποτέ «ουδέτερος/ασαφής» (Revit: πάντα υπάρχει System Type). Ο χρήστης αλλάζει draw-time σε hot/drainage/hydronic. → αλλαγή στο `useSpecialTools-placement-tools.ts` (το `mep-pipe` branch σήμερα κάνει `classification: undefined`· βάλε `'domestic-cold-water'`). **Άφησε** το `mep-duct` χωρίς classification (αεραγωγός, όχι plumbing). **Άφησε** το `mep-drain-pipe` ως έχει (`sanitary-drainage`).
2. **«Σύστημα» picker draw-time** για `mep-pipe` **και** `mep-drain-pipe` (όχι `mep-duct`). Slope picker μένει **selection-only** (το slope είναι derived από endpoints — δεν έχει νόημα draw-time).
3. **Bonus (nice-to-have, ΟΧΙ blocker):** χρωματιστή κουκκίδα/swatch δίπλα σε κάθε επιλογή του dropdown για ακαριαία οπτική αναγνώριση — **ΜΟΝΟ αν** το `RibbonCombobox` υποστηρίζει ήδη per-option swatch· αλλιώς skip/defer (μην επεκτείνεις το combobox component για αυτό σε αυτό το slice).
4. **Ghost preview χρώμα (optional):** αν εύκολο, ο rubber-band ghost να παίρνει το classification χρώμα draw-time (WYSIWYG). Αν θέλει επέκταση του `MepSegmentPlacementGhost`/2D ghost → **defer** (το committed σωλήνα ήδη παίρνει σωστό χρώμα· αυτό αρκεί για το DoD).

---

## 📋 EXACT TOUCH-POINTS (επαληθευμένα — code = source of truth)

### 1. `ui/ribbon/hooks/bridge/mep-segment-command-keys.ts`
- **NEW visibility key** στο `MEP_SEGMENT_RIBBON_VISIBILITY_KEYS`: π.χ. `pipeClassification: 'mepSegment.visibility.pipeClassification'` (draw-or-select· διακριτό από το υπάρχον `pipeDomain` που μένει για το slope panel). Πρόσθεσέ το ΚΑΙ στο `MepSegmentRibbonVisibilityKey` union ΚΑΙ στο `MEP_SEGMENT_VISIBILITY_KEY_SET`.

### 2. `ui/ribbon/data/contextual-mep-segment-tab.ts`
- **Σπάσε** το υπάρχον `mep-segment-plumbing` panel (γρ. 252-286) σε **δύο**:
  - **NEW `mep-segment-classification` panel** — μόνο το classification combobox (commandKey `MEP_SEGMENT_RIBBON_KEYS.stringParams.classification`, options `CLASSIFICATION_OPTIONS` που ήδη υπάρχουν γρ. 81-87)· `visibilityKey: pipeClassification`· label key `ribbon.panels.mepSegmentClassification` (NEW i18n).
  - **Κράτα `mep-segment-plumbing` panel** μόνο με το slope combobox· `visibilityKey: pipeDomain` (selection-only, αμετάβλητο).

### 3. `ui/ribbon/hooks/useRibbonMepSegmentBridge.ts` (mirror του centerline dual-mode)
- **`getComboboxState`** — στο `if (!segment)` branch (γρ. 163-174, δίπλα στο centerlineElevation draw-time block) πρόσθεσε:
  ```ts
  if (toolHandle?.isActive && commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification) {
    return { value: toolHandle.overrides.classification ?? '', options: [] };
  }
  ```
- **`onComboboxChange`** — στο `if (!segment)` branch (γρ. 221-232) πρόσθεσε ΠΡΙΝ το `return`:
  ```ts
  if (commandKey === MEP_SEGMENT_RIBBON_KEYS.stringParams.classification) {
    mepSegmentToolBridgeStore.get()?.setParamOverrides({
      classification: value as PlumbingSystemClassification,
    });
  }
  ```
- **`getPanelVisibility`** — πρόσθεσε το νέο key check **ΠΡΙΝ** το `if (!segment) return false` (γρ. 302-303), γιατί πρέπει να δουλεύει draw-time:
  ```ts
  if (visibilityKey === MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.pipeClassification) {
    if (toolHandle?.isActive) return toolHandle.domain === 'pipe';   // draw-time
    const seg = resolveSegment();
    return seg?.params.domain === 'pipe';                            // selection
  }
  ```
  (Πρόσεξε: το `getPanelVisibility` deps array πρέπει να συμπεριλάβει `toolHandle`.)
- Επιβεβαίωσε ότι το `overrides` του `MepSegmentParamOverrides` περιέχει ήδη `classification?` (το `mep-segment-completion.ts` το χρησιμοποιεί· το `mep-drain-pipe` ήδη το θέτει μέσω `setParamOverrides`). Αν λείπει το πεδίο → πρόσθεσέ το (μάλλον υπάρχει).

### 4. `hooks/tools/useSpecialTools-placement-tools.ts` (γρ. 198-212 — το segment tool effect)
- Στο `activeTool === 'mep-pipe'` branch: άλλαξε `classification: undefined` → `classification: 'domestic-cold-water'` (default System Type, απόφαση #1).
- ⚠️ **RISK guard:** βεβαιώσου ότι το draw-time override που θέτει ο χρήστης ΔΕΝ σβήνεται από re-run αυτού του effect. Το effect deps = `[activeTool, setDomain, setParamOverrides]`· αν το `setParamOverrides` είναι stable `useCallback` (όπως είναι για το centerline που ήδη δουλεύει), δεν ξανατρέχει σε classification change → **OK**. Επαλήθευσέ το· αν όχι, το effect πρέπει να τρέχει μόνο σε `activeTool` change.

### 5. i18n `el/en dxf-viewer-shell.json`
- **NEW** `ribbon.panels.mepSegmentClassification` = «Σύστημα» / «System».
- Τα classification option labels **ΥΠΑΡΧΟΥΝ ΗΔΗ** (`ribbon.commands.mepClassification.domestic-cold-water` κ.λπ.) — μην τα ξαναφτιάξεις.

### 6. Tests
- EXT `useRibbonMepSegmentBridge.test` (ίδιο pattern με τα draw-time centerline tests):
  - draw-time: `getComboboxState(classification)` με active pipe tool → επιστρέφει το override value.
  - draw-time: `onComboboxChange(classification, 'domestic-hot-water')` → καλεί `setParamOverrides({classification:'domestic-hot-water'})`.
  - `getPanelVisibility(pipeClassification)` → true για active pipe tool, true για selected pipe, false για duct.

---

## 🎨 ΓΙΑΤΙ ΔΟΥΛΕΥΕΙ ΤΟ ΧΡΩΜΑ ΔΩΡΕΑΝ (μην ξαναγράψεις)
`resolveSegmentClassificationColor` (`bim/mep-systems/mep-system-color.ts`): system colour wins → **classification hint** (cold `#2563eb` μπλε / hot `#dc2626` κόκκινο / drainage `#b45309` καφέ / hydronic-supply κόκκινο / hydronic-return μπλε) → per-domain default. Wired ΗΔΗ σε 2D (`MepSegmentRenderer`) + 3D (`mep-segment-to-mesh`). Το completion περνά το `classification` override στα params → χρώμα αυτόματα.

## ✅ DEFINITION OF DONE
1. Ενεργοποίηση «Σωλήνας» → contextual tab δείχνει picker **«Σύστημα»** (draw-time, ΠΡΙΝ το κλικ).
2. Διάλεξε «Ζεστό Νερό» → σχεδίασε → ο σωλήνας βγαίνει **κόκκινος**· «Κρύο Νερό» → **μπλε**· «Αποχέτευση» → **καφέ**. (Default `mep-pipe` = μπλε.)
3. Το slope picker ΔΕΝ εμφανίζεται draw-time (μόνο σε επιλογή). Το `mep-duct` ΔΕΝ δείχνει «Σύστημα».
4. Επιλογή υπάρχοντος σωλήνα → ο picker «Σύστημα» εξακολουθεί να δουλεύει (selection mode, αμετάβλητο).
5. tsc 0 (δικά σου) · tests πράσινα.
6. 🔴 browser-verify (Giorgio) + commit (Giorgio).

## ⚠️ ΚΑΝΟΝΕΣ
- 🌐 **Ελληνικά** πάντα. 🚫 **COMMIT/PUSH μόνο ο Giorgio** — εσύ ΠΟΤΕ (ούτε «επειδή τελείωσε»).
- 🌳 **SHARED working tree** (συνεργάζεσαι με άλλον agent) → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ** `git add -A`.
- **ΕΚΤΟΣ ADR-040** (ribbon/bridge — κανένα canvas micro-leaf· `useRibbonMepSegmentBridge` είναι ribbon-level subscription, όχι CanvasSection/leaf). **ΜΗΝ** αγγίξεις adr-index.
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος (`wmic process where "name='node.exe'" get commandline | grep tsc`) ΠΡΙΝ ξεκινήσεις.
- **N.11:** μηδέν hardcoded strings (i18n keys). **N.2:** μηδέν `any` (χρησιμοποίησε `PlumbingSystemClassification`).
- **N.15:** μετά την υλοποίηση → ADR-408 changelog entry + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (`[[project_adr408_phi14_drainage]]`).

## 📌 SSOT POINTERS
- Pattern να καθρεφτίσεις (draw-time dual-mode): `useRibbonMepSegmentBridge.ts` γρ. 95-98 (`toolHandle`), 163-174 (getComboboxState draw-time), 221-232 (onComboboxChange draw-time).
- Tool bridge store handle: `ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store.ts` (`overrides`, `domain`, `setParamOverrides`).
- Χρώμα SSoT: `bim/mep-systems/mep-system-color.ts` `resolveSegmentClassificationColor`.
- Contextual trigger draw-time ΗΔΗ wired: `app/ribbon-contextual-config.ts` (`activeTool ∈ {mep-pipe,mep-duct,mep-drain-pipe} → MEP_SEGMENT_CONTEXTUAL_TRIGGER`) — **καμία αλλαγή εκεί**.
- Tool switching/preset: `hooks/tools/useSpecialTools-placement-tools.ts` γρ. 198-212.

## 🧾 ΠΑΡΑΛΛΗΛΟ ΕΚΚΡΕΜΕΣ (μην το χαλάσεις)
Το **ADR-408 Δρόμος B «Πλυντήριο» (connectable appliance)** μόλις ολοκληρώθηκε (κώδικας DONE, 40/40 jest, tsc 0) και είναι **🔴 pending commit από Giorgio** στο ίδιο working tree. Είναι ΑΣΧΕΤΟ με αυτό το task (διαφορετικά αρχεία) — απλώς μην κάνεις `git add -A` που θα τα μπλέξει. Δες `HANDOFFS/2026-06-08_adr408-washing-machine-appliance-CODE_NEXT.md`.
