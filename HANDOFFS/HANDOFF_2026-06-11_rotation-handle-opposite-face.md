# HANDOFF — Λαβή περιστροφής στην ΑΠΕΝΑΝΤΙ παρειά (όχι πάνω στη λαβή πάχους)

**Date:** 2026-06-11 · **Model:** Opus · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα)

> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: **ΕΝΑ tsc τη φορά** — έλεγξε διεργασίες πρώτα. **Απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.**
>
> 🎯 **Στόχος ποιότητας (Giorgio):** FULL ENTERPRISE + FULL SSOT, όπως Revit. **SEARCH FIRST** για υπάρχον SSoT πριν γράψεις νέο κώδικα.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (αναφορά Giorgio)

Σε **πολλές δομικές BIM οντότητες** το **σημάδι/λαβή ΠΕΡΙΣΤΡΟΦΗΣ** (το κέντρο του rotation glyph) πέφτει **στην ΙΔΙΑ παρειά (face) με τη λαβή μεταβολής ΠΑΧΟΥΣ/πλάτους** — πρακτικά **συμπίπτουν**, οπότε ο χρήστης δεν ξέρει ποια λαβή ενεργοποιεί όταν κάνει click.

**ΖΗΤΟΥΜΕΝΟ:** Μετέφερε τη λαβή περιστροφής στην **ΑΠΕΝΑΝΤΙ πλευρά, πάνω στην ΑΛΛΗ παρειά** (καθαρός διαχωρισμός, Revit-style — η περιστροφή είναι διακριτό control, ποτέ coincident με dimension handle).

---

## 2. ROOT CAUSE (εντοπισμένο)

### 2.1 Γραμμικά αξονικά (τοίχος ίσιος + δοκός ίσια + πεδιλοδοκός/συνδετήρια) — **ΤΟ ΚΥΡΙΟ**
Κοινό SSoT: **`src/subapps/dxf-viewer/bim/grips/axis-box-grips.ts`** → `getAxisBoxGrips()`.
Εκεί η λαβή `rotation` τοποθετείται **στην ΙΔΙΑ θέση** με το `width-edge`:
```ts
const widthEdgePos = rectEdgeWorld(frame, { axis: 'y', sign: faceSign });   // +perp face
return [
  { role: 'width-edge', type: 'edge',   position: widthEdgePos },           // +perp
  ...
  { role: 'rotation',   type: 'vertex', position: widthEdgePos },           // ⛔ ΙΔΙΟ σημείο!
];
```
`faceSign = params.widthFaceSign ?? 1` (ο τοίχος περνά `flip ? -1 : 1`). Η σύμπτωση κληρονομήθηκε από τον αρχικό τοίχο (grip 3 thickness == grip 9 rotation, +perp midpoint) και διαδόθηκε στα 3 entities μέσω του SSoT.

**Επειδή τα 3 entities μοιράζονται ΕΝΑ `getAxisBoxGrips`, μία αλλαγή εδώ τα διορθώνει ΚΑΙ ΤΑ ΤΡΙΑ.** Αυτό είναι το όφελος του SSoT — μην το διορθώσεις per-entity.

### 2.2 Centre-anchored (πέδιλο pad, κολώνα rect/shear-wall, + 8 placeable: mep-fixture/panel/furniture/radiator/boiler/water-heater/manifold/floorplan-symbol)
- **`bim/grips/centred-box-grips.ts`** → `centredBoxRotationHandleWorld()` βάζει rotation σε local `{x:0, y: length/2 + ROTATION_HANDLE_OFFSET_MM}` = **πέρα από την +Y (length) ακμή**, δηλ. στην **ΙΔΙΑ παρειά** με τη λαβή `length` (που είναι στο +Y). Stand-off 200mm — όχι ακριβής σύμπτωση, αλλά **ίδια πλευρά** → ίδιο πρόβλημα ευκρίνειας.
- **`bim/foundations/foundation-grips.ts`** (pad) → `rotationHandleWorld()` ίδιο μοτίβο (+Y, length/2 + 200).
- **Κολώνα:** `bim/columns/column-grips.ts` (ή `column-rect-adapter`) — **ΕΠΑΛΗΘΕΥΣΕ** πού βάζει το `column-rotation` (πιθανότατα ίδιο +depth/+Y μοτίβο).

---

## 3. Η ΛΥΣΗ (FULL SSOT — μία αλλαγή ανά shared module)

### 3.1 ΚΥΡΙΟ FIX — `axis-box-grips.ts` (διορθώνει τοίχο+δοκό+πεδιλοδοκό μαζί)
Βάλε το `rotation` στην **ΑΠΕΝΑΝΤΙ perp παρειά** από το `width-edge`:
```ts
const widthEdgePos    = rectEdgeWorld(frame, { axis: 'y', sign: faceSign });
const rotationFaceSign = (faceSign === 1 ? -1 : 1) as RectSign;             // αντίθετη παρειά
const rotationPos     = rectEdgeWorld(frame, { axis: 'y', sign: rotationFaceSign });
// ... { role: 'rotation', type: 'vertex', position: rotationPos }
```
- Το `width-edge` μένει στην +perp παρειά (μεταξύ corner-start-pos / corner-end-pos).
- Το `rotation` πάει στην −perp παρειά (μεταξύ corner-start-neg / corner-end-neg) — **ελεύθερο σημείο, κανένα άλλο mid-handle εκεί**.
- **Καμία αλλαγή στο rotation DRAG** (`applyAxisBoxGripDrag('rotation')`): είναι anchor-relative swept angle — η θέση είναι μόνο click target/anchor.
- (Προαιρετική βελτίωση Revit: αντί για midpoint της −perp ακμής, stand-off λίγα mm πέρα από την −perp παρειά ώστε να μην «κουμπώνει» οπτικά με τα −perp corners. Ρώτα Giorgio αν θέλει on-face ή stand-off. Default: on-face, όπως ζήτησε «πάνω στην άλλη παρειά».)

### 3.2 ΔΕΥΤΕΡΕΥΟΝ — centred-box (αν ο Giorgio το βλέπει και σε pad/κολώνα/placeable)
Ίδια αρχή «απέναντι πλευρά / καθαρός διαχωρισμός». Επειδή είναι **διαφορετικό anchoring model**, η αλλαγή πάει στα δικά τους shared σημεία:
- `centred-box-grips.ts` `centredBoxRotationHandleWorld` → μετέφερε σε **−Y** (απέναντι από τη `length` λαβή): `{x:0, y: -(length/2 + ROTATION_HANDLE_OFFSET_MM)}`. Διορθώνει **και τα 8 placeable μαζί** (SSoT).
- `foundation-grips.ts` pad `rotationHandleWorld` → ίδιο (−Y).
- κολώνα → το αντίστοιχο.
- **ΕΠΙΒΕΒΑΙΩΣΕ ΜΕ GIORGIO** αν θέλει και το centred-box family ή ΜΟΝΟ τα γραμμικά αξονικά (το αρχικό παράπονο = «ίδια παρειά με τη λαβή πάχους» → καθαρά τα αξονικά). Ξεκίνα από 3.1, δείξε, μετά αποφασίστε για 3.2.

---

## 4. TESTS ΠΟΥ ΘΕΛΟΥΝ UPDATE (περιμένουν τη νέα θέση)

- `bim/grips/__tests__/axis-box-grips.test.ts`:
  - `'places handles at the expected footprint positions'` → το `rotation` ΔΕΝ ισούται πια με `width-edge`· για horizontal box width 20 (halfLength 10): rotation στο **(50, −10)** (−perp), width-edge στο (50, 10).
  - `'honours widthFaceSign (-1 = −perp face)'` → με `widthFaceSign:-1`, width-edge στο (50,−10) ΚΑΙ rotation στο (50, **+10**) (αντίστροφα).
- `bim/walls/__tests__/wall-grips.test.ts` test **27** (`wall-rotation sits at the +perp face midpoint…`) → άλλαξέ το σε **−perp** midpoint (midpoint των corner-start-neg / corner-end-neg).
- `bim/beams/__tests__/beam-grips.test.ts` test **26** (`rotation == width-edge position`) → άλλαξε σε «rotation == −perp edge midpoint, ΟΧΙ width-edge».
- `bim/foundations/__tests__/foundation-grips.test.ts` → αν υπάρχει position assertion για `foundation-rotation` line, ενημέρωσέ το.
- Αν αγγίξεις 3.2: `centred-box-grips.test.ts` + όποιο pad/column rotation-position test.

**Commands:**
```
npx jest src/subapps/dxf-viewer/bim/grips src/subapps/dxf-viewer/bim/walls src/subapps/dxf-viewer/bim/beams src/subapps/dxf-viewer/bim/foundations --silent
# αν 3.2: + src/subapps/dxf-viewer/bim/columns src/subapps/dxf-viewer/bim/mep-fixtures
```
tsc (N.17, έλεγξε πρώτα): `npx tsc --noEmit` (background).

---

## 5. ΑΡΧΙΤΕΚΤΟΝΙΚΟ ΥΠΟΒΑΘΡΟ (γιατί ΕΝΑ σημείο)

Ολοκληρώθηκε 2026-06-11 (ADR-363 Slice E) η **πλήρης ενοποίηση** των γραμμικών αξονικών grips:
- `bim/grips/axis-box-grips.ts` = ο **axis-anchored** consumer του `rect-grip-engine` (τοίχος ίσιος + δοκός + πεδιλοδοκός). `getAxisBoxGrips` (emission) + `applyAxisBoxGripDrag` (drag) + `invertAxisBoxRoleMap`.
- Αδελφός: `bim/grips/centred-box-grips.ts` (centre-anchored, 8 placeable + via adapters pad/κολώνα).
- Κοινό core: `bim/grips/rect-grip-engine.ts` + `rect-frame.ts`.
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_axis_box_grips_ssot.md`.
- ADR: `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` (Slice E) + ADR-436 (foundation strip).

**ΜΗΝ** φτιάξεις νέο grip module — η αλλαγή είναι 1–3 γραμμές στα ΥΠΑΡΧΟΝΤΑ shared modules.

---

## 6. N.15 — ΕΝΗΜΕΡΩΣΕΙΣ ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ
1. ADR-363 Slice E changelog (+ ADR-436 αν αγγιχτεί foundation): «rotation handle → opposite perp face (καθαρός διαχωρισμός από width/thickness edge)».
2. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: ενημέρωσε τη γραμμή της ενοποίησης (ή πρόσθεσε 1 γραμμή) με 🔴 browser-verify rotation handle.
3. **ΟΧΙ adr-index** (shared tree).
4. **ΕΚΤΟΣ ADR-040** (δεν αλλάζει renderer/micro-leaf — μόνο grip positions). Αν το pre-commit hook ζητήσει ADR-040 για `wall-grips`, stage το.

---

## 7. ΠΑΡΑΔΟΤΕΟ
Browser-verify: σε τοίχο/δοκό/πεδιλοδοκό η λαβή περιστροφής (καμπύλο βέλος) είναι πλέον στην **απέναντι μακριά παρειά** από τη λαβή πάχους — ξεκάθαρα διαχωρισμένες. Commit ο Giorgio.
