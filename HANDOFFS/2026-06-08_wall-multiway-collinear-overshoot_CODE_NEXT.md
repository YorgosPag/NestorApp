# HANDOFF — Τοίχοι: overshoot σε multi-way junction (collinear ζεύγος χωρισμένο από crossing wall)

**Ημ/νία:** 2026-06-08 · **Μοντέλο:** Opus 4.8 (Plan Mode) · **ADR:** ADR-363 §6 Phase 1L · **Session:** wall-join series (συνέχεια)

---

## 🎯 ΚΑΤΑΣΤΑΣΗ — τι έγινε & τι μένει

Ο Giorgio αναφέρει ότι region-fill τοίχοι **ξεπερνούν την παρειά** του γείτονα και φτάνουν στο **centreline** (αντί να σταματούν ορθογώνια). Μετά από εκτενές debugging με live diagnostics (browser console), **βρέθηκε η ακριβής ρίζα**.

### ✅ Τι δουλεύει (Phase 1L — committed-worthy, 33+ wall-trims tests PASS)
Στο `src/subapps/dxf-viewer/bim/walls/wall-trims.ts`:
- **2-way corner + «Disallow Join»:** `resolveTwoWayCorner` — miter ΜΟΝΟ όταν τα corner-άκρα συμπίπτουν (`gap ≤ JOIN_COINCIDENCE_FRACTION·min(halfA,halfB)`, fraction=0.5)· αλλιώς `squareOffCorner` (penetration-bevel).
- **T-junction (penetration-based):** οι T-branches στο `classifyPair` κόβουν τον stem στην όψη **μόνο κατά όσο τη διαπερνά** (`penetrationBevel` helper, SSoT).
- **`penetrationBevel(ex,ey, qx,qy,ux,uy, half, sinAngle, stemLen)`** + **`perpDistanceToAxis`** + **`squareOffCorner`** = νέοι pure helpers.
- Tests #28-33 στο `__tests__/wall-trims.test.ts` (edge-only, T face-ending, #4-extended→face, collinear-cross 2-way).

### ❌ Η ΕΝΑΠΟΜΕΙΝΑΣΑ ΡΙΖΑ (αυτό είναι το νέο task)
**`resolveMultiWayCorner`** (ίδιο αρχείο) χειρίζεται λάθος την περίπτωση: **3+ τοίχοι, εκ των οποίων 2 collinear που χωρίζονται από τον 3ο (crossing).**

**Live ground truth (browser console, units=m):**
```
f4356b (7.076,4.350)→(7.076,3.725) len=0.625 th=250   ← κάθετος ΠΑΝΩ, κάτω άκρο=3.725
5cc7f9 (7.076,3.600)→(7.076,0.500) len=3.100 th=250   ← κάθετος ΚΑΤΩ, πάνω άκρο=3.600
edaf31 (7.201,3.725)→(6.351,3.725) len=0.850 th=250   ← οριζόντιος (y=3.725, faces 3.600/3.850)
```
- Ο `edaf31` (οριζόντιος, th 250 → faces y=3.600 & y=3.850) είναι ο crossing wall.
- `f4356b` (πάνω κάθετος) κάτω άκρο = `y=3.725` = **centreline** του edaf31 → πρέπει να κοπεί στην **πάνω όψη y=3.850** (bevel 0.125). **ΔΕΝ κόβεται** → overshoot.
- `5cc7f9` (κάτω κάθετος) πάνω άκρο = `y=3.600` = **κάτω όψη** του edaf31 → ήδη σωστά, μηδέν trim.

**Γιατί αποτυγχάνει:** Τα 3 άκρα μπαίνουν σε ΕΝΑ cluster (union-find: `edaf31:start` συνδέεται με `f4356b:end` ΚΑΙ `5cc7f9:start`). Το `resolveMultiWayCorner` διαλέγει primary pair = `f4356b`+`5cc7f9` (tie-break «most anti-parallel» = collinear κάθετοι), καλεί `resolveTwoWayCorner(f4356b,5cc7f9)` → **collinear → `if (sinA<MIN_ANGLE) return`** (continuation, καμία κοπή). Μετά κόβει τον **edaf31** ως non-primary (λάθος). Αποτέλεσμα: `f4356b` ΑΚΟΠΟΣ → διαπερνά τον edaf31.

**Το βασικό λάθος:** δύο collinear τοίχοι αντιμετωπίζονται ως «συνεχόμενος through-wall» **ακόμη κι όταν τα άκρα τους ΔΕΝ συμπίπτουν** (εδώ gap 0.125 = χωρίζονται από τον crossing). Δεν είναι through-wall· είναι 2 stems που butt-άρουν στον crossing.

---

## 🔧 ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ (επιβεβαίωσε στον κώδικα πρώτα)

Στο `resolveMultiWayCorner`: ένα collinear primary pair πρέπει να θεωρείται «through-wall» (άρα ακοπο) **ΜΟΝΟ αν τα δύο άκρα του συμπίπτουν** (`hypot(p.px-q.px,p.py-q.py) ≤ small tol`). Αλλιώς (separated by crossing) δεν υπάρχει through-wall → **κάθε τοίχος του cluster που διαπερνά άλλον τοίχο του cluster πρέπει να κόβεται στην όψη του** (penetration-bevel, που ήδη υπάρχει ως `penetrationBevel`/`squareOffCorner`).

**Πιο καθαρή/γενική προσέγγιση (προτιμητέα, Revit-grade):** αντικατάστησε τη λογική «primary through-pair» με ομοιόμορφο κανόνα: για **κάθε** ζεύγος τοίχων στο cluster, αν το άκρο του ενός διαπερνά το σώμα του άλλου (`perpDist < otherHalf` κατά τον axis), κόψε το στην όψη με `penetrationBevel`. Through-wall (collinear coincident) = μηδέν penetration φυσικά → μένει ακοπος. Αυτό ενοποιεί 2-way/T/multi-way σε ΕΝΑ invariant: «κανένα άκρο δεν διαπερνά γείτονα στο junction». ΠΡΟΣΟΧΗ: γράψε tests που να μη σπάνε τα #25/#27 (thin partition + collinear through-wall + branch).

**ΥΠΟΧΡΕΩΤΙΚΑ νέα tests** (αναπαρ. ΑΚΡΙΒΩΣ το παραπάνω):
- 3-wall: collinear ζεύγος (πάνω/κάτω) χωρισμένο από crossing οριζόντιο → ο πάνω κόβεται στην πάνω όψη (eB≈halfCrossing), ο κάτω ήδη στην κάτω όψη (0), ο crossing **δεν** κόβεται λάθος.
- Regression: γνήσιος through-wall (2 collinear με coincident άκρα) + branch → through ακοπος, branch butt (όπως #27).

---

## 🧹 ΠΡΙΝ ΤΟ COMMIT — ΑΦΑΙΡΕΣΕ ΤΑ TEMP DIAGNOSTICS (unconditional console.log!)
1. `src/subapps/dxf-viewer/bim/walls/add-wall-to-scene.ts` — μπλοκ `[WALL-TRIM] addWallToScene ENTER` (top της fn) + μπλοκ `[WALL-TRIM] computed ...` (μετά το `computeWallTrims`). **Αφαίρεσε όλο το import `WallEntity` αν έμεινε αχρησιμοποίητο.**
2. `src/subapps/dxf-viewer/hooks/drawing/use-wall-commit.ts` — μπλοκ `[WALL-TRIM] buildFillingWalls ...` μέσα στο `buildFillingWalls` loop.
> Είναι **unconditional** (όχι flag) — θα γεμίσουν την κονσόλα/θα σπάσουν pre-commit (no-console). ΑΦΑΙΡΕΣΕ ΟΛΑ.

## 🧠 CRITICAL CONTEXT
- 🌐 Ελληνικά πάντα. 🚫 COMMIT/PUSH μόνο ο Giorgio (ρητή εντολή· «OK» ΔΕΝ είναι commit).
- 🌳 SHARED working tree → `git add` ΜΟΝΟ δικά σου· ΠΟΤΕ `-A`. ΜΗΝ αγγίξεις πλυντήριο/adr-index.
- **ΜΟΝΑΔΕΣ:** η σκηνή του Giorgio είναι σε **μέτρα** (`units=m`, coords 1-10, thickness σε mm 100/200/250). Το `wall-trims.ts` έχει `if (lenA < 1 || lenB < 1) return;` — το «1» είναι **unit-unaware** (1 μέτρο σε meters-scene!) → σκοτώνει τοίχους <1m. **ΔΕΝ φάνηκε να είναι ο overshoot** (οι κοντοί έμεναν στην όψη), αλλά **διόρθωσέ το ούτως ή άλλως** (scale με `mmToSceneUnits` ή tiny absolute) — latent bug. Flag στο memory.
- Τα tests χρησιμοποιούν coords σε mm (3000) → meters-scale bugs ΔΕΝ πιάνονται. Σκέψου ένα meters-scale test.
- N.15: ADR-363 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `[[project_adr363_wall_multiwall_junction]]`. Τα changelog/ΕΚΚΡΕΜΟΤΗΤΕΣ/memory ΗΔΗ ενημερώθηκαν για Phase 1L (penetration-bevel)· ενημέρωσέ τα για το multi-way fix.
- ΕΚΤΟΣ ADR-040 (pure geometry). N.17 single-tsc.

## 🚫 NON FARE
- ΜΗΝ commit χωρίς ρητή εντολή· ΜΗΝ `git add -A`.
- ΜΗΝ αφήσεις τα temp `[WALL-TRIM]` console.log.
- ΜΗΝ σπάσεις τα #25/#27 (through-wall + branch) όταν φτιάχνεις το multi-way.
