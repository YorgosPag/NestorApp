# HANDOFF — Τοίχοι: εμφάνιση miter σε ΟΞΕΙΕΣ γωνίες (σταδιακά· Step 1 = δείξε τη μύτη, Step 2 = κόψε τη μύτη)

**Ημερομηνία:** 2026-07-01
**Προτεραιότητα:** 🟡 Feature refinement (συνέχεια wall-miter preview)
**Τρόπος εργασίας:** Big-player (Revit/Figma) + FULL SSoT (preview === commit). ΟΧΙ tsc (N.17)· jest επιτρέπεται. Commit = **μόνο ο Giorgio**.

---

## 🟢 ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (άλλαξε)
- **ΔΕΝ υπάρχει άλλος agent.** Ο Giorgio το ξεκαθάρισε.
- **Ο Giorgio έκανε COMMIT ΟΛΑ** τα παρακάτω 5 fixes + τη δουλειά wall-join (Phase 1M/1N/1O). Άρα το working tree είναι καθαρό στο HEAD· μπορείς να επεξεργαστείς ελεύθερα το `wall-trims-corner-resolve.ts` (δεν το μοιράζεσαι με κανέναν).
- Καθαρό restart dev server στην αρχή (`npx kill-port 3000` → `npm run dev`).

---

## ✅ ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (όλα COMMITTED, browser-verified από Giorgio)

1. **Live scene→canvas redraw** — νέα οντότητα (τοίχος) ζωγραφίζεται ΑΜΕΣΩΣ, χωρίς αλλαγή εργαλείου. Ρίζα: ο καμβάς έπαιρνε τη σκηνή μέσω μη-reactive `getLevelScene()` prop. Fix: reactive leaf subscription (`useLevelScene` → `useSceneSelectors.ts`) + `convertScene` (shared WeakMap) στο `DxfCanvasSubscriber`. ADR-040.
2. **Level 2 wall-DRAWING joint miter preview** — μετά το 1ο κλικ, live miter ghost + γείτονας. NEW `bim/walls/wall-joint-miter-preview.ts` (`applyJointMiterPreview`, reuse `computeWallTrims`/`applyTrimPatches` = preview===commit). Wire: `wall-preview-helpers.ts` + `PreviewRenderer.ts` (`jointNeighbors`). ADR-363 §wall-joint-miter-preview.
3. **Rotation ghost strip stale miter** — μιτραρισμένος τοίχος δεν παραμορφώνεται πλέον στην περιστροφή. Fix: strip `startMiter/endMiter/startBevel/endBevel` πριν το `computeWallGeometry` στο **wall branch** του `rendering/ghost/apply-entity-preview.ts`. ADR-363 §wall-rotate-ghost.
4. **Level 2b — live joint miter κατά rotate/move** — reuse `applyJointMiterPreview` στο `useGripGhostPreview.ts` (draw delegate): strip stale → live re-miter + neighbor render. ADR-363 §Επίπεδο2b.

**Γνωστός περιορισμός (και στο #2 και #4):** ο committed γείτονας (main canvas) κρατά το παλιό miter → πιθανό μικρό «peek» κάτω από το preview. Αν ενοχλήσει → neighbor dimming (reuse `movePreviewActive` pattern).

---

## 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (επόμενο βήμα)

**Σύμπτωμα (Giorgio, στιγμιότυπα 150039 = -30°, 150110 = -70°):** όταν στρέφω δεξιόστροφα (CW) τον λοξό τοίχο **από ~-30° έως ~-70°**, η **εσωτερική** γωνία των δύο ενωμένων τοίχων γίνεται οξεία και **ΔΕΝ εμφανίζεται miter** — οι τοίχοι «σπάζουν» (raw overlap) ή δείχνουν bevel/square-off.

**Απόφαση Giorgio (σταδιακά):**
- **Step 1 (ΤΩΡΑ):** **ΔΕΙΞΕ το miter** στις οξείες γωνίες — ακόμη κι αν βγάζει μακριά αιχμηρή **μύτη**. Αποδεκτό προσωρινά.
- **Step 2 (ΑΡΓΟΤΕΡΑ):** θα δούμε πώς **κόβουμε** τη «πολύ οξεία μύτη» (big-player miter-cut — approach TBD, ΟΧΙ το Phase 1M square-off που ο Giorgio θεωρεί λάθος μοντέλο).

**Σημαντικό:** ο Giorgio **έχει ήδη επισημάνει** ότι το **Phase 1M miter-limit (square-off σε οξείες) = ΛΑΘΟΣ μοντέλο** για τοίχους (Revit/ArchiCAD μητράρουν αιχμηρά). Άρα το Step 1 = ουσιαστικά αναίρεση της acute-suppression, **εγκεκριμένο**.

---

## 🔬 GROUND-TRUTH (probe: κάθετος γείτονας + περιστρεφόμενος τοίχος, ίδιο πάχος 210, μήκος 4m)

```
εσωτ. γωνία ≥ 30°  → miter καθαρό ✅
εσωτ. γωνία = 20°  → bevel (cornerMiter overflow)
εσωτ. γωνία < 15°  → trims=0 → ΚΑΜΙΑ ένωση (raw overlap = «σπάζουν»)
```

Ο ίδιος `computeWallTrims` οδηγεί ΚΑΙ preview ΚΑΙ commit → η διόρθωση είναι στον **shared solver** (όχι preview-only).

---

## 🛠️ STEP 1 — 3 LEVERS (αρχείο: `src/subapps/dxf-viewer/bim/walls/wall-trims-corner-resolve.ts` + ίσως `wall-trims-geometry.ts`)

Στο `resolveTwoWayCorner()` (γρ. ~302-355) η αλυσίδα fallback:

1. **`MIN_ANGLE_RAD`** (γρ.33, `= Math.PI/12 = 15°`) → γρ.304 `if (sinA < sin(MIN_ANGLE_RAD)) return;` **ΚΑΙ** στο `wall-trims.ts` classifyPair (γρ.202). → **Χαμήλωσέ το** (π.χ. 15°→~1-2°) ώστε near-parallel corners να ταξινομούνται & μητράρουν αντί για raw overlap.
2. **Phase 1M miter-limit** (γρ.334-340): `if (joinMode==='auto' && cornerMiterRatio(oa,ob) > MITER_LIMIT_RATIO) { squareOffCorner(); return; }` → **Απενεργοποίησε/παράκαμψε** για `auto` (εγκεκριμένο — Giorgio: λάθος μοντέλο). Η explicit `miter` override ήδη το παρακάμπτει.
3. **`cornerMiter` overflow → bevel** (γρ.347-354): όταν `cornerMiter()` επιστρέφει `null` (η μύτη ξεπερνά τα όρια/`MAX_BEVEL_FRACTION`) πέφτει σε bevel. → Για να **δείξεις** την αιχμηρή μύτη, χαλάρωσε το overflow guard μέσα στο `cornerMiter` (`wall-trims-geometry.ts`) ή/και ανέβασε `MAX_BEVEL_FRACTION`. **Έλεγξε** πρώτα με probe ποιο guard γυρίζει null στις οξείες.

**Επαλήθευση (ground-truth probe):** αντίγραψε το pattern — φτιάξε κάθετο γείτονα + περιστρεφόμενο τοίχο, `computeWallTrims` σε γωνίες 0→180 βήμα 10, τύπωσε `trims.size` + G/N kind. Στόχος Step 1: **miter σε ΟΛΟ το εύρος** (καμία NONE/bevel band).

---

## ⚠️ ΠΡΟΣΟΧΗ / TESTS
- **Θα σπάσουν τα Phase 1M tests** (`wall-trims.test.ts`: «acute→square-off», ratio unit/integration) — γιατί ΑΚΡΙΒΩΣ αυτή τη συμπεριφορά αναιρείς (εγκεκριμένο). **Ενημέρωσέ τα** να αντικατοπτρίζουν «acute → miter (σφηνί)» για Step 1.
- Πρόσεξε το **`wall-trims.ts` classifyPair** (γρ.202) ΕΠΙΣΗΣ `sinA < sin(MIN_ANGLE_RAD)` — ίδιο lever #1.
- Πρόσεξε regressions: **T-junctions** (bevel stem) + **Phase 1N free-end** + **Phase 1O axis-join** πρέπει να μείνουν άθικτα. Τρέξε `npx jest src/subapps/dxf-viewer/bim/walls src/subapps/dxf-viewer/bim/geometry`.
- Μετά: ενημέρωσε **ADR-363 §12 changelog** (νέα εγγραφή «§wall-acute-miter Step 1»).

---

## 🚦 ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Restart dev server.
2. Probe (ground-truth) → βρες ποιο lever (2 ή 3) γυρίζει null/square-off στο εύρος -30..-70.
3. Εφάρμοσε levers 1+2 (+3 αν χρειάζεται) → probe ξανά μέχρι «miter σε όλο το εύρος».
4. Ενημέρωσε Phase 1M tests + πρόσθεσε νέο test (acute→miter). ADR-363 changelog.
5. Παρουσίασε στον Giorgio → browser-verify (-30..-70 → miter με μύτη) → commit (Giorgio).
6. **Step 2** (χωριστά): πρόταση big-player miter-cut για την πολύ οξεία μύτη.
