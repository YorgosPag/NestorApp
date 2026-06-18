# ADR-493 — Κυκλική κολώνα: (A) σύνδεση δοκαριού στην παρειά + (B) επαλήθευση ορθότητας υπολογισμών

**Status:** ✅ APPROVED (UNCOMMITTED) · **Date:** 2026-06-18 · **Author:** Opus session · **Γλώσσα:** Ελληνικά
**Σχετικά:** ADR-487 (όραμα §3/§4) · ADR-458 (beam-column cutback «κολώνα νικάει») · ADR-460 (multi-shape column reinforcement) · ADR-441/363 §5.7 (location-line = παρειά) · ADR-472 S4 (M-N) · ADR-492 (associative reframe — ΑΛΛΟΥ agent, μη-επικαλυπτόμενο) · ADR-491 (FEM-driven M-N)

---

## 1. Το πρόβλημα (σενάριο Giorgio)

Οργανισμός: 2 ορθογώνιες κολώνες **400×400** + πέδιλα + δοκάρι. Αλλαγή της μίας κολώνας σε **ΚΥΚΛΙΚΗ Ø400** (anchor=Κέντρο). Δύο ζητήματα:

- **(A) ΓΕΩΜΕΤΡΙΑ** — το δοκάρι δεν κολλάει στην παρειά της κυκλικής· ορατό **μηνίσκος-κενό** στην κάτοψη.
- **(B) ΟΡΘΟΤΗΤΑ** — γίνονται σωστά στατικά/οπλισμός/M-N/utilization/ποσότητες με κυκλική;

---

## 2. (A) Root cause — repro-confirmed (400×400 → Ø400)

**Code = source of truth.** Η αρχιτεκτονική του cutback (ADR-458) είναι **DERIVED & footprint-based** (`computeBeamCutbackOutline` + `computeBeamAxisToColumnContact`, `safeDifference`). Το 2Δ render της κολώνας (`ColumnRenderer.drawPolygonPath(verts)`) χρησιμοποιεί το **ΙΔΙΟ** 32-gon footprint → parity. Άρα ΔΕΝ είναι θέμα segmentation (chord error Ø400 ≈ 0.96mm) ούτε render/footprint αναντιστοιχία.

Η πραγματική ρίζα — **carve-failure στο εφαπτομενικό όριο**:

- Το persisted άκρο του δοκαριού κόβεται στην **ΕΠΙΠΕΔΗ** παρειά (location-line = παρειά, ADR-441/363 §5.7) → ευθεία στο `x=200`.
- Ο κύκλος (32-gon) φτάνει `x=200` **μόνο** στο `y=0` και **υποχωρεί** εκατέρωθεν (`x≈156` στο `y=±125`).
- Beam (`x≥200`) ∩ circle (`x≤200`) ≈ **0** (εφάπτονται σε ένα σημείο) → `safeDifference` αφαιρεί ~μηδέν → **identity** → το δοκάρι κρατά ευθύ άκρο πάνω σε υποχωρούσα άψιδα → **μηνίσκος-κενό**.

> Για 400×400 → Ø400 η παρειά κατά τον άξονα είναι ίδια (=200), άρα ΔΕΝ είναι θέμα persisted recession (αρχική υπόθεση handoff #1 → απορρίφθηκε). Είναι **σχήμα-εξαρτώμενη carve-failure**.

---

## 3. (A) Λύση — Revit-grade, καθαρά DERIVED (ΟΧΙ persisted churn)

**Αρχή Revit:** location-line → **node (κέντρο κολώνας)**, join-geometry **derived** (κόβεται στην παρειά). Δεν αλλάζουμε το persisted άκρο (= ADR-492 domain άλλου agent). Αντ' αυτού, **πριν** το boolean επεκτείνουμε ΜΟΝΟ το **derived carve-outline** του πλαισιωμένου άκρου ΕΣΩΤΕΡΙΚΑ **μέχρι το κέντρο** της κολώνας. Το `safeDifference` τότε σκαλίζει την **ΑΚΡΙΒΗ** παρειά (άψιδα/επίπεδη/σύνθετη) για κάθε σχήμα.

**Γιατί στο κέντρο (centroid) και ΟΧΙ στην απέναντι παρειά:** επέκταση πέρα από το κέντρο αφήνει **far-side stubs** στις γωνίες (το πλάτος του δοκαριού ξεπερνά τη χορδή του κύκλου για βαθιά x). Το centroid (πάντα εντός για κυρτές διατομές) εγγυάται καθαρό near-arc carve χωρίς stub.

**Νέο SSoT (pure):** `extendBeamOutlineIntoFramingColumns(beamOutline, axisStart, axisEnd, columnFootprints)` στο `bim/geometry/beam-column-cutback.ts`. Framing gate: (α) κέντρο κολώνας εσωτερικά του άκρου, (β) εντός μισού-πλάτους από τον άξονα, (γ) κοντινή παρειά κοντά στο άκρο (≤ half-width). Straight 2-σημείων άξονας μόνο (curved/split → outline αυτούσιο).

**Consumers (parity):**
- 2Δ committed + WYSIWYG preview → `buildBeamCutbackDisplay` (`dxf-scene-beam-cutback.ts`): carve-outline = extended· location-line contact = **αρχικό** outline (μηδέν over-extend του άξονα μέσα στην κολώνα).
- 3Δ → `bim-three-structural-converters.ts` `buildBeam3DCarveOutline` (ίδιος SSoT, axis scaled με sceneToM).

**Regression-safe:** ορθογώνιο 400×400 → επέκταση στο centroid → carve δίνει την ίδια επίπεδη παρειά `x=200` (ταυτόσημο αποτέλεσμα). Mid-span / μακρινή κολώνα → καμία επέκταση (null).

---

## 4. (B) Επαλήθευση ορθότητας υπολογισμών κυκλικής — παραδοτέος πίνακας

Η αλυσίδα οπλισμού είναι **shape-aware** (ADR-460 `resolveColumnReinforcementSection`): κυκλική → `grossArea = π(d/2)²` (ακριβές), `perimeter = π·d`, `mode='circular'`, `minThickness = d`. Αυτό τρέφει `section-context → suggestColumnReinforcement / asStrengthColumn / utilization / ποσότητες`.

| # | Μέγεθος | Υπολογισμός κυκλικής | Ετυμηγορία | EC ref |
|---|---|---|---|---|
| 1 | Ac (μικτό εμβαδόν) | `π·(d/2)²` ρητά (όχι 32-gon shoelace) | ✅ ΣΩΣΤΟ | EC2 §3.1 |
| 2 | Περίμετρος → πλήθος ράβδων | `⌈π·d/βήμα⌉`, min 4 (7Ø16 ≥6 ✓) | ✅ ΣΩΣΤΟ | EC2 §9.5.2(4) |
| 3 | ρ_min / ρ_max επί Ac | επί ακριβούς Ac (ρ=1.12% ✓) | ✅ ΣΩΣΤΟ | EC2 §9.5.2(2)(3) |
| 4 | Αξονικό As = (N−f_cd·Ac)/f_yd | Ac ακριβές | ✅ ΣΩΣΤΟ | EC2 §6.1 |
| 5 | e₀ = max(d/30, 20mm) | h=d (bbox) | ✅ ΣΩΣΤΟ | EC2 §6.1(4) |
| 6 | **M-N μοχλοβραχίονας z** | ~~rectangular 0.81·d~~ → **πλαστικός δακτύλιος D_s/π** | ✅ **ΔΙΟΡΘΩΘΗΚΕ** (ADR-493) | EC2 §6.1 circular |
| 7 | Περίσφιγξη (κλειστός συνδετήρας vs **σπείρα**) | suggester έδινε closed-hooked και σε κύκλο → **τώρα `type='spiral'`** | ✅ **ΔΙΟΡΘΩΘΗΚΕ** (ADR-493) | EC2 §9.5.3 / EC8 §5.4.3.2.2 |
| 8 | Utilization As_req/As_prov | shape-aware Ac, self-consistent | ✅ ΣΩΣΤΟ | ADR-485 |
| 9 | FEM M_Ed (39.58 kNm) → designMoment | FEM ανεξάρτητο διατομής για M | ✅ ΣΩΣΤΟ | ADR-491 |
| 10 | Όγκος/ποσότητες (0.368 m³ καθαρό) | Ac·h − cutback | ✅ ΣΩΣΤΟ | — |

**Διόρθωση #6 (Slice B1):** Ένας πλήρως διαρρέων δακτύλιος χάλυβα ολικού εμβαδού `A_s` σε διάμετρο `D_s` δίνει `M = A_s·f_yd·(D_s/π)` → **`z = D_s/π` ≈ 0.27·d**, πολύ μικρότερο από τον ορθογώνιο `0.81·d` (όπου ο οπλισμός είναι σε δύο παρειές). Η χρήση του `0.81·d` σε κύκλο **υπερεκτιμούσε** το z → **υποεκτιμούσε** το A_s,M (μη-συντηρητικό). Νέος SSoT `columnLeverArmMm(ctx, h)` στο `suggest-reinforcement.ts`: κυκλική → `0.85·d/π` (D_s ≈ pitch-circle, cover-agnostic seed)· αλλιώς `0.81·h`. Σε χαμηλό M (κυριαρχεί ρ_min) μηδέν αλλαγή· σε υψηλό M → ~3× moment-steel (conservative).

**Διόρθωση #7 (Slice B2 — Giorgio: «ΝΑΙ ΘΕΛΩ»):** Η **spiral infrastructure ΥΠΑΡΧΕΙ ΗΔΗ** (`StirrupType='spiral'`, `spiralPitchMm`, `column-circular-layout.ts`, `column-confinement.ts`, 2Δ detail-sheet, 3Δ `column-rebar-3d`, BOQ, schema, UI dropdown «Τύπος συνδετήρα») — η αρχική εκτίμηση «λείπει» ήταν **ΛΑΘΟΣ**. Το πραγματικό gap: ο `suggestColumnReinforcementFrom` έδινε ΠΑΝΤΑ `DEFAULT_STIRRUP_TYPE` (closed-hooked) → ο auto-οπλισμός κυκλικής έβγαζε κλειστό συνδετήρα αντί σπείρα. FIX: για `ctx.mode==='circular'` → `stirrups.type='spiral'` (EC2 §9.5.3 / EC8 §5.4.3.2.2 — προτιμώμενη περίσφιγξη κυκλικής, καλύτερη ductility)· reuse ΟΛΗΣ της υπάρχουσας infra, μηδέν νέα γεωμετρία· user-overridable (manual→auto=false). `spiralPitchMm` absent ⇒ = `spacingMm`.

---

## 5. Αρχιτεκτονική ένταση (απάντηση handoff §2)

**DERIVED (cutback) vs PERSISTED (location-line + ADR-492 reframe).** Επιλογή **A/C (καθαρά DERIVED)**: η παρειά είναι derived join-geometry (Revit), ΟΧΙ persisted location-line. Το persisted centerline μένει αμετάβλητο· η σχήμα-σωστή κοπή είναι 100% derived. Μηδέν persisted churn, **μηδέν επικάλυψη με ADR-492** (που χειρίζεται persisted reframe σε transform commands, ΟΧΙ σε αλλαγή τύπου/διαστάσεων κολώνας).

---

## 6. Αρχεία

| Αρχείο | Αλλαγή |
|---|---|
| `bim/geometry/shared/polygon-utils.ts` | **NEW SSoT** `projectPointOnAxis` + `AxisProjection` (canonical along/perp· canonical core του entity wrapper `projectColumnCenterOnAxis`) |
| `bim/geometry/beam-column-cutback.ts` | **NEW** `extendBeamOutlineIntoFramingColumns` + helpers· **reuse** `polygonCentroid` + `projectPointOnAxis` (ΟΧΙ ίδιο vertex-mean/projection — κεντρικοποιήθηκε) |
| `hooks/canvas/dxf-scene-beam-cutback.ts` | carve-outline = extended (2Δ committed + preview)· contact = αρχικό |
| `bim-3d/converters/bim-three-structural-converters.ts` | **NEW** `buildBeam3DCarveOutline` (3Δ parity) |
| `bim/structural/codes/suggest-reinforcement.ts` | **NEW** `columnLeverArmMm` (#6 circular z=D_s/π)· **#7** circular → `stirrups.type='spiral'` (reuse spiral infra) |
| `bim/geometry/__tests__/beam-column-cutback.test.ts` | +5 jest (κυκλικό carve, ορθογ. regression, mid-span/far null) |
| `bim/geometry/shared/__tests__/polygon-utils-projection.test.ts` | **NEW** +4 jest (projectPointOnAxis along/perp) |
| `bim/structural/codes/__tests__/suggest-reinforcement-moment.test.ts` | +3 jest (#6 circular>perimeter lever arm· μηδέν-ροπή regression· #7 spiral default) |

**Κεντρικοποίηση (N.0.2):** το αρχικό `footprintMean` (vertex-mean) ήταν διπλότυπο του `polygonCentroid` → **διορθώθηκε** (reuse). Η along/perp προβολή εξήχθη ως canonical pure `projectPointOnAxis` (polygon-utils)· το entity `projectColumnCenterOnAxis` (column-face-trim, **ADR-492 set — coordinate**) flagged να delegate-άρει (pending-ratchet).

**jest:** όλα τα touched suites GREEN (cutback 17, projection 4, moment 8, multishape, stirrup-types, preview-parity). 2 pre-existing raft/slab fails = ADR-476 (ΟΧΙ δικά μου). **🔴 ΕΚΚΡΕΜΕΙ:** tsc (Giorgio) + browser-verify (2Δ+3Δ, διάφορες γωνίες δοκαριού· circular auto-οπλισμός→σπείρα) + commit.

---

## 7. DEFER

- Κοίλη/σύνθετη παρειά (L/T) framing — centroid μπορεί να πέφτει σε notch· τρέχουσα λύση εγγυημένη για κυρτές (κύκλος/ορθογ./πολύγωνο).
- BOQ net-volume: η οπτική επέκταση δεν αλλάζει το persisted μήκος δοκαριού (corner-sliver bearing αμελητέο).
- Biaxial circular M-N / πλήρες interaction diagram.
- `projectColumnCenterOnAxis` + `footprintCentroid` (column-face-trim / attach-coordinator, **ADR-492 set**) → delegate σε `projectPointOnAxis`/`polygonCentroid` on-touch (pending-ratchet, coordinate).

---

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | **Δημιουργία.** (A) Revit-grade derived carve-extension για κυκλική/υποχωρούσα παρειά (μηνίσκος-κενό) — pure SSoT `extendBeamOutlineIntoFramingColumns`, 2Δ+3Δ parity, μηδέν persisted churn / ADR-492 collision. (B) Πίνακας ορθότητας κυκλικής + διόρθωση #6 (M-N lever arm `0.81·d` → πλαστικός δακτύλιος `D_s/π`). |
| 2026-06-18 | **Κεντρικοποίηση + #7.** Διόρθωση μικρο-διπλότυπου: `footprintMean`→`polygonCentroid`· εξαγωγή canonical `projectPointOnAxis` (polygon-utils) + flag delegation του entity wrapper (pending-ratchet). **#7** (Giorgio «ΝΑΙ ΘΕΛΩ»): circular auto-οπλισμός → `stirrups.type='spiral'` (reuse υπάρχουσας spiral infra· η εκτίμηση «λείπει» ήταν ΛΑΘΟΣ). +4 projection jest, +1 spiral jest. |
