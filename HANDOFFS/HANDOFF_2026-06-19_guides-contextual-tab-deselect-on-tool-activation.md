# HANDOFF — Guides contextual tab δεν ανοίγει όταν προϋπάρχει επιλεγμένη οντότητα (deselect-on-tool-activation)

**Ημερομηνία:** 2026-06-19 · **Αφορμή:** Giorgio review του ribbon contextual system. · **Τύπος:** στοχευμένο bugfix (Revit-grade, full SSoT).
**Status εισόδου:** Διάγνωση **ΟΛΟΚΛΗΡΩΜΕΝΗ & επιβεβαιωμένη** (isolation test). Μένει ΜΟΝΟ η υλοποίηση + verify.

> ⚠️ **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία, **ΠΟΤΕ** `git add -A`.
> 🎯 Εντολή Giorgio: «όπως οι μεγάλοι παίχτες (Revit). FULL ENTERPRISE + FULL SSOT.»
> 🧱 **GOL + SSOT**: 40-line functions, 500-line files, μηδέν `any`/`as any`/`@ts-ignore`/inline-styles. **Πριν ΟΠΟΙΟΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟΣ SSOT audit (grep)** για να μη διπλασιάσεις (έγινε ήδη ένα πέρασμα — δες §3).
> 🔧 **N.17**: ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις.
> 🎯 **Μοντέλο:** Sonnet 4.6 (στοχευμένο, 1-2 αρχεία, 1 domain). Δήλωσε & περίμενε «ok» πριν κωδικοποιήσεις (N.14).
> 🧭 **Όραμα project:** διάβασε `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (north-star· δεν αφορά άμεσα αυτό το task, αλλά δίνει το γενικότερο πλαίσιο).

---

## 1. Το πρόβλημα (παρατήρηση Giorgio)

Στο 2Δ DXF viewer:
1. Επιλέγεις μια οντότητα (π.χ. κολώνα) → **ανοίγει** το contextual tab της. ✅
2. **Ύστερα** πατάς το κουμπί «Οδηγοί» (Home → Guides, ή dropdown variant) → το contextual tab «Οδηγοί» **ΔΕΝ ανοίγει**. ❌

## 2. Ρίζα — ΕΠΙΒΕΒΑΙΩΜΕΝΗ (μην ξανα-ψάχνεις)

**Isolation test (από Giorgio):** Χωρίς καμία επιλεγμένη οντότητα (φρέσκο / μετά από Esc), το κουμπί «Οδηγοί» **ανοίγει** κανονικά το tab → **ΝΑΙ**. Άρα το routing του εργαλείου είναι σωστό· ο ένοχος είναι **η προϋπάρχουσα επιλογή**.

Μηχανισμός:
- `RibbonSplitButton` main click → `onToolChange('guide-x')` (`ui/ribbon/components/buttons/RibbonSplitButton.tsx:66`).
- `handleToolChange` (`hooks/useDxfViewerState.ts:250-318`) κάνει `setActiveTool('guide-x')` + auto-open guide panel — αλλά **ΔΕΝ καθαρίζει την επιλογή οντότητας**.
- `useActiveContextualTrigger` (`app/ribbon-contextual-config.ts:144-328`) είναι **priority cascade**: ελέγχει την **επιλεγμένη οντότητα (γρ.228-232 `fromSelection`) ΠΡΙΝ** τον έλεγχο `activeTool.startsWith('guide-')` (γρ.300). Όσο μετράει η επιλογή τη στιγμή της εναλλαγής, το guides trigger **δεν παράγεται**.
- Το auto-switch του ορατού tab (`ui/ribbon/components/RibbonRoot.tsx:77-100`) έχει guard `if (ids === prev) return;` (γρ.80) → όταν το σύνολο contextual tabs δεν αλλάζει (γιατί το fromSelection κρατά το παλιό), **κλειδώνει** στο tab της οντότητας → οι Οδηγοί δεν αναδύονται.
- **Επιστρέφει `string | null` — ΕΝΑ tab τη φορά** (επιβεβαιωμένο· αυτό είναι by-design Revit-like, ΜΗΝ το αλλάξεις σε λίστα).

**Συμπέρασμα:** Δεν φταίει το routing ούτε το auto-switch· φταίει ότι **η εναλλαγή σε authoring tool δεν αποεπιλέγει** — οπότε η προτεραιότητα «επιλογή > εργαλείο» μπλοκάρει.

## 3. SSOT AUDIT (έγινε ήδη — REUSE, μηδέν διπλότυπο)

**Υπάρχει ήδη το ακριβές pattern.** Τα MEP ribbon bridges **ήδη** καλούν `universalSelection.clearAll()` όταν ενεργοποιείται το εργαλείο/placement τους:

| Bridge | Γραμμή |
|---|---|
| `useRibbonMepSegmentBridge.ts` | 302 |
| `useRibbonMepBoilerBridge.ts` | 305 |
| `useRibbonMepRadiatorBridge.ts` | 201 |
| `useRibbonMepManifoldBridge.ts` | 201 |
| `useRibbonMepUnderfloorBridge.ts` | 186 |
| `useRibbonMepWaterHeaterBridge.ts` | 164 |
| `useRibbonMepPipeNetworkBridge.ts` | 160 |
| `useRibbonMepCircuitBridge.ts` | 175 |
| `useRibbonElectricalPanelBridge.ts` | 162 |

**SSoT για καθαρισμό επιλογής:** `universalSelection.clearAll()` — interface `UniversalSelectionHook` (`systems/selection/SelectionSystem.tsx:85`), hook `useUniversalSelection()`. Ίδιο που χρησιμοποιεί ήδη το `useSelectionLevelReset.ts` (clear σε αλλαγή ορόφου) + canvas backdrop click (`CanvasSection.tsx:400`).

➡️ **ΜΗΝ φτιάξεις νέο deselect.** Χρησιμοποίησε `universalSelection.clearAll()`.

## 4. Το fix (Revit-grade)

Στο Revit, η **εκκίνηση εντολής** (Grid/Guides) **αποεπιλέγει**. Άρα: **όταν ενεργοποιείται εργαλείο οδηγών, κάλεσε `universalSelection.clearAll()` ατομικά με το `setActiveTool`** → `fromSelection` γίνεται null → trigger=`GUIDES` αμέσως → auto-switch δείχνει το tab (ίδιο μονοπάτι με το working «χωρίς επιλογή» Q1).

### Seam — απόφαση (διερεύνησε & διάλεξε το καθαρό):
- **Επιλογή Α (προτιμώμενη, generic-but-surgical):** στο `handleToolChange` (`useDxfViewerState.ts`), αν `tool.startsWith('guide-')` → `clearAll()` πριν/μαζί με `setActiveTool`. **ΠΡΟΣΟΧΗ:** επιβεβαίωσε αν το `useDxfViewerState` έχει πρόσβαση στο `universalSelection` — μάλλον **ΟΧΙ** (το `universalSelection` ζει στο `DxfViewerContent.tsx:136`). Αν όχι:
- **Επιλογή Β (mirror MEP, σίγουρα έχει πρόσβαση):** wrap το `handleToolChange` στο `DxfViewerContent` (όπου υπάρχει το `universalSelection`) ώστε για `guide-` tools να καλεί `clearAll()` πρώτα. Ίδιο πνεύμα με τα MEP bridges.
- **ADR-040 safety:** mutation σε **event** (tool activation), **ΟΧΙ** σε `useEffect` → μηδέν race με render path. Μην βάλεις effect που ακούει `activeTool`.

### Scope guard (surgical — ΜΗΝ το επεκτείνεις τώρα):
- ΜΟΝΟ `guide-` tools σε αυτό το fix. Αν δεις το ίδιο σε `dim-`/drawing tools, **σημείωσέ το** (πιθανό boy-scout: centralize «deselect on authoring-tool activation» αντί για scatter στα bridges) αλλά **ΜΗΝ** το αγγίξεις χωρίς εντολή Giorgio (feedback: «don't touch / only X»).

## 5. Verification (browser)
1. Επίλεξε οντότητα → tab της ανοίγει. Πάτα «Οδηγοί» → **τώρα ανοίγει** το tab Οδηγοί + η οντότητα αποεπιλέγεται. ✅
2. Regression Q1: χωρίς επιλογή → «Οδηγοί» ανοίγει (αμετάβλητο). ✅
3. **Modify tools ΑΘΙΚΤΑ:** move/copy/bim-copy που **δουλεύουν** πάνω στην επιλογή → **ΔΕΝ** πρέπει να αποεπιλέγουν (μην τα πειράξεις — το fix αφορά μόνο `guide-`). ✅
4. dropdown variants (guide-z/parallel/perpendicular/xz) → ίδια σωστή συμπεριφορά (όλα `guide-` prefix).

## 6. Υποχρεώσεις τέλους (N.0.1 / N.15) — ίδιο πακέτο, ΟΧΙ commit (ο Giorgio)
- **ADR:** ενημέρωσε το σχετικό ribbon-contextual ADR — **ADR-442** (guides) ή/και **ADR-345 §5.4** (contextual tabs auto-activate). Πρόσθεσε changelog entry για το deselect-on-guides-activation. Δες `adr-index.md`.
- **adr-index.md** (status, αν χρειάζεται).
- **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (αν ανοίξεις σχετικό item).
- **MEMORY** (topic file αν αξίζει + index pointer).
- Αν αγγίξεις canvas-critical → stage ADR-040 (CHECK 6B/6D). Εδώ μάλλον ΟΧΙ (ribbon/selection), αλλά τσέκαρε αν το pre-commit hook το ζητήσει.
- `git add` **ΜΟΝΟ** δικά σου αρχεία.

## 7. Key files (με γραμμές)
- `app/ribbon-contextual-config.ts:228-232` (fromSelection precedence), `:300` (guides check) — η αιτία της προτεραιότητας.
- `ui/ribbon/components/RibbonRoot.tsx:77-100` (auto-switch + `ids===prev` guard).
- `hooks/useDxfViewerState.ts:250-318` (`handleToolChange` — δεν αποεπιλέγει· seam Α).
- `app/DxfViewerContent.tsx:136` (`useUniversalSelection()`· seam Β).
- `systems/selection/SelectionSystem.tsx:85` (`clearAll()` SSoT).
- `ui/ribbon/data/home-tab-guides.ts` (το κουμπί· commandKey `guide-x` + variants).
- SSoT precedent: `ui/ribbon/hooks/useRibbonMepSegmentBridge.ts:302` (κ.ά. — §3).

## 8. Εκτίμηση
1-2 αρχεία, 1 domain (ribbon/selection). i18n: **καμία** νέα key (reuse). tsc: 🟡 targeted (μικρή αλλαγή· κάνε background tsc, μην μπλοκάρεις).
