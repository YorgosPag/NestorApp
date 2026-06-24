# HANDOFF — Κυκλική κολόνα: κούμπωμα με ΠΕΡΙΦΕΡΕΙΑ (tangent) σε παρειά & κεντρικό άξονα τοίχου, FULL SSoT

**Ημ/νία:** 2026-06-25
**Τύπος:** Feature (DXF/BIM Viewer — circular column placement snap). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent** → **ΠΟΤΕ `git add -A`**, stage ΜΟΝΟ τα δικά σου specific αρχεία. Ο άλλος agent αγγίζει ΕΝΕΡΓΑ `bim/columns/*`, `bim/framing/*-snap-targets*`, `column-*`, `bim/placement/*`, `mouse-handler-up.ts`, render files. **Re-grep/re-read στην αρχή** — paths/γραμμές μπορεί να μετακινήθηκαν.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT, όπως η Revit.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`· functions ≤40 γρ.· files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — cross-subsystem face-snap/geometry) & περίμενε «ok» πριν την υλοποίηση.
- **N.8:** αν 5+ αρχεία / 2+ domains → ενημέρωσε τον Giorgio (Plan/Orchestrator).
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance … node.exe … tsc` ΠΡΙΝ). Verify με **jest** + browser.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια.**
- **Boy-Scout (N.0.2):** βρεις προϋπάρχον διπλότυπο → κεντρικοποίησέ το (διαταγή Giorgio).

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio + screenshot)

> «Όταν ο χρήστης τοποθετεί κυκλική κολόνα σε υφιστάμενο **τοίχο**, να μπορεί να κουμπώσει σε **οποιαδήποτε παρειά** — **όχι μόνο με το κέντρο** της κολόνας, αλλά **και με την ΠΕΡΙΦΕΡΕΙΑ** της. Επίσης να μπορεί να **ταυτίσει την περιφέρεια της κολόνας με τον κεντρικό άξονα του τοίχου**. Όπως η Revit — FULL ENTERPRISE + FULL SSoT.»

**Screenshot (`Στιγμιότυπο οθόνης 2026-06-25 003318.jpg`):** εργαλείο Κολόνα, Τύπος=**Κυκλική**, Σημείο Στήριξης=**Κέντρο**. Οριζόντιος τοίχος (hatch). Η κυκλική κολόνα-φάντασμα έχει το **κέντρο** της κουμπωμένο στον **κεντρικό άξονα** του τοίχου (κάθετη διακεκομμένη). Διαστάσεις 1.014m / 1.001m κατά μήκος + «90° / 0.400 m». → Δηλ. το **κέντρο→άξονας ΗΔΗ δουλεύει** (§3.9). Λείπει η **περιφέρεια→reference**.

### Οι 4 modes κουμπώματος κυκλικής κολόνας σε τοίχο (Revit):
| # | Reference point κολόνας | Reference τοίχου | Κατάσταση |
|---|---|---|---|
| 1 | **κέντρο** | παρειά (flush) | ⚠️ μερικώς — §3.18 circular→bbox (αλλά δες ΡΙΖΑ §2) |
| 2 | **κέντρο** | κεντρικός άξονας | ✅ υπάρχει — §3.9 center-on-axis (αυτό βλέπει το screenshot) |
| 3 | **ΠΕΡΙΦΕΡΕΙΑ (tangent)** | παρειά | 🆕 ΝΕΟ — ο κύκλος εφάπτεται στην παρειά (κέντρο offset κατά R) |
| 4 | **ΠΕΡΙΦΕΡΕΙΑ (tangent)** | κεντρικός άξονας | 🆕 ΝΕΟ — ο κύκλος εφάπτεται στον άξονα (κέντρο offset κατά R από άξονα) |

**ΜΠΟΡΟΥΜΕ; ΝΑΙ.** Γεωμετρικά τετριμμένο: tangent placement = `center = tangentPointΣτηReference ± R · (μοναδιαία κάθετος της reference)`. Γενικεύεται σε **κάθε γωνία** (λοξός τοίχος/άξονας) γιατί η κάθετος υπολογίζεται από το frame της reference.

---

## 2. 🔬 SSoT AUDIT — Η ΑΛΗΘΕΙΑ ΤΟΥ ΚΩΔΙΚΑ (2026-06-25 · re-grep για επιβεβαίωση)

### Η ΡΙΖΑ του προβλήματος (επιβεβαιωμένη με grep)
**Η γεωμετρία της ΚΥΚΛΙΚΗΣ κολόνας ΑΓΝΟΕΙ το placement anchor** — το κέντρο μπαίνει ΠΑΝΤΑ στο `position`:
- `bim/columns/column-anchors.ts:149-151` (`localToWorld`): `if (params.kind === 'circular') return centredLocalToWorld({…, anchorOffset:{dx:0,dy:0}, dimX:0, dimY:0}, local)` — μηδέν anchor shift.
- `bim/geometry/column-geometry.ts` `transformFootprint`: ίδιο (circular = rotationally symmetric, anchor αγνοείται).
- Σχόλιο column-anchors.ts:19-22: «Circular: … `params.anchor` και `params.rotation` αγνοούνται».

➡️ Συνέπεια: ακόμη κι αν ο face-snap επιστρέψει `anchor:'s'` (κάτω σημείο), η κυκλική κολόνα **κεντράρει** στο `position` → το **κέντρο** πέφτει στην παρειά/άξονα, ΟΧΙ η περιφέρεια. Γι' αυτό σήμερα μόνο «κέντρο» δουλεύει.

### Τι ΥΠΑΡΧΕΙ ήδη (καλά νέα — reuse, μηδέν νέα geometry)
- **§3.9 center-on-axis (τοίχος):** `bim/columns/column-face-snap.ts` → `resolveMemberAxisCenter` → `resolveAxisCenterFoot` (`column-face-snap-helpers.ts`)· χρησιμοποιεί `MemberAxisFrame {a, u, alongMin/Max, halfThickness}` από `buildMemberAxisFrame(axis, outline)`. Επιστρέφει `anchor:'center'` + foot στον άξονα. **Mode #2.**
- **§3.18 circular→bbox flush:** `collectCircularColumnFootprints` → `circularFootprints` → `buildFaceTargets` → `resolveForTarget` flush σε N/S/E/W bbox. Επιστρέφει `position` στην παρειά + `anchor` (s/n/e/w). **Mode #1** (αλλά λόγω ΡΙΖΑΣ το κέντρο πέφτει στην παρειά, όχι tangent).
- **Περιφέρεια ΗΔΗ μοντελοποιημένη:** `column-anchors.ts` `circularAnchorLocal(anchor, radius)` → cardinals n/s/e/w στο `radius`, diagonals στο `radius·√2/2`. Τα 4 quadrant grips (ADR-519) ζουν στην περιφέρεια. → R = `params.width/2` (circular: width=diameter).
- **Wall frame (axis + faces):** `wallTargets {axis, outline}` (`member-snap-targets.ts` `wallTarget`/`wallOutlineRing`) + `MemberAxisFrame.halfThickness` (= ημι-πάχος → η παρειά απέχει halfThickness από τον άξονα).
- **GhostFaceFrame** (`linear-member-face-snap.ts`): `origin, axisDir, perpDir, facePerp, outwardSign, faceAlongMin/Max` → δίνει **τη μοναδιαία κάθετο (`perpDir`) και τη φορά (`outwardSign`)** για το tangent offset σε κάθε γωνία.
- **Anchor cycling / dropdown:** `bim/types/column-types.ts` `ColumnAnchor`/`ANCHOR_CYCLE_ORDER`/`ANCHOR_OFFSETS`· `hooks/drawing/use-column-anchor-tab-cycle.ts` (Tab cycle)· UI «Σημείο Στήριξης» dropdown (ribbon column bridge — εντόπισέ το· πιθανό i18n key, ΟΧΙ literal «Κέντρο»).

### ΚΡΙΣΙΜΟ: ο resolver ΔΕΝ έχει σήμερα το R
`resolveColumnFaceSnapFromTargets(cursor, targets, sceneUnits, opts?)` (`column-face-snap.ts:411`) **δεν δέχεται radius**. Καλείται από `bim/placement/bim-cursor-snap.ts:130` με `input.columnOpts` (PolarDiskSnapOptions). Για tangent (#3/#4) **πρέπει να φτάσει το R** (ghost diameter/2) στον resolver — gated σε circular + «circumference mode».

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (FULL SSoT — επιβεβαίωσε με grep ΠΡΩΤΑ)

**Κεντρική ιδέα (Revit-grade, angle-general):** το tangent placement = **offset του κέντρου κατά R κατά μήκος της καθέτου της reference**. Υπολογίζεται **στον resolver** (που ήδη έχει το frame), επιστρέφει `position = offsetCenter`, `anchor:'center'`, `rotation:0` → **η γεωμετρία της κυκλικής μένει αμετάβλητη** (center-anchored, μηδέν αλλαγή στο geometry pipeline). Δουλεύει σε **κάθε γωνία** (λοξός τοίχος) γιατί `perpDir` δίνεται από το frame.

### Βήματα (όλα reuse):
1. **Πέρασε το R στον resolver:** πρόσθεσε `ghostRadiusScene?` (ή `circleRadiusScene?`) στο `BimCursorSnapInput`/`columnOpts` (από τα ghost params `width/2 · mmToSceneUnits`). Gated: μόνο circular + όταν ενεργό το «circumference mode».
2. **Mode #4 (περιφέρεια→άξονας):** στο `resolveMemberAxisCenter` (ή νέο sibling `resolveMemberAxisTangent`), αντί `center=foot` → `center = foot + R · perp_outwardΠροςCursor`. Δηλ. ο κύκλος εφάπτεται στον άξονα στην πλευρά του cursor. `anchor:'center'`, position=offsetCenter, faceFrame κεντραρισμένο στον άξονα (CL dims).
3. **Mode #3 (περιφέρεια→παρειά):** στο flush path (§3.7/§3.18) ή στο `resolveFootprintEdgeSnap` — η παρειά απέχει `halfThickness` από τον άξονα· tangent = `center = facePoint + R · outwardNormal` (έξω από τον τοίχο). Reuse `GhostFaceFrame.perpDir`/`outwardSign`.
4. **UX επιλογή mode** (δες §4 — ΡΩΤΑ Giorgio): «Σημείο Στήριξης» dropdown → πρόσθεσε **«Περιφέρεια»** (ή «Εφαπτομενικά»)· ΟΤΑΝ επιλεγμένο, ο resolver κάνει tangent αντί center. Εναλλακτικά: extra snap candidates (center & tangent) + nearest-wins ή Tab-cycle.
5. **Listening dims:** οι αποστάσεις να μετρούν προς **κέντρο** ή **περιφέρεια** ανάλογα το mode (reuse `buildCenteredAxisFaceFrame`· για tangent ίσως ghostHalfWidth=R).

**ΜΗΔΕΝ νέα geometry/anchor pipeline** (option A). Εναλλακτική option B (να τιμήσει η circular geometry τα cardinal anchors) → απορρίπτεται: cardinals μόνο axis-aligned, ΟΧΙ λοξά → όχι Revit-grade. Σημείωσε το tradeoff αν ο Giorgio προτιμά anchor-based.

---

## 4. ❓ ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτα τον Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό παράδειγμα ΠΡΙΝ προχωρήσεις)
- **Πώς επιλέγει ο χρήστης center vs περιφέρεια;** (α) dropdown «Σημείο Στήριξης» → νέα τιμή «Περιφέρεια»· (β) **Tab-cycle** ανάμεσα στα modes· (γ) **auto candidates** (δείχνει center & tangent, κουμπώνει στο πλησιέστερο)· (δ) πλήκτρο/toggle. **Δείξε παράδειγμα:** κύκλος Ø400 (R=200) δίπλα σε τοίχο πάχους 200 — center-on-axis (κέντρο στο 0) vs tangent-on-axis (κέντρο στο ±200) vs tangent-on-face (κέντρο στο ±300 αν παρειά στο ±100).
- **Tangent προς ποια πλευρά;** Εσωτερικά ή εξωτερικά της reference; (μάλλον στην πλευρά του cursor → outwardSign).
- **Ποιες references;** Μόνο τοίχος (παρειές + άξονας) ή και δοκάρι/πλάκα/άλλη κολόνα; (το screenshot = τοίχος· ξεκίνα τοίχο, γενίκευσε αν εύκολο).
- **Λοξός τοίχος;** Επιβεβαίωσε ότι θες tangent σε κάθε γωνία (option A το καλύπτει· cardinals όχι).
- **Μη-κυκλικές;** Εκτός scope (το αίτημα = κυκλική). Επιβεβαίωσε.

---

## 5. ⚠️ ΣΥΓΚΡΟΥΣΗ — ΑΛΛΟΣ AGENT ΣΤΑ ΙΔΙΑ ΑΡΧΕΙΑ
Άλλος agent δουλεύει ΕΝΕΡΓΑ στα `column-face-snap*.ts`, `*-snap-targets*.ts`, `bim/placement/*`, `column-*`, render files. **Re-grep/re-read στην αρχή· stage ΜΟΝΟ τα δικά σου· μη δημιουργήσεις παράλληλο SSoT.** Πρόσφατο (UNCOMMITTED 2026-06-25): ADR-398 **§3.18 slant-following edges** (`collectFootprintEdgeTargets`/`resolveFootprintEdgeSnap`/`circularFootprints`) + SSoT cleanup `closedRingFromEdges`. Δες ADR-398/514 changelog.

## 6. ΕΠΑΛΗΘΕΥΣΗ
- **jest:** (α) tangent math — κύκλος R=200, τοίχος άξονας y=0 πάχος 200: mode#4 cursor πάνω → center.y = ±200· mode#3 cursor έξω από παρειά y=100 → center.y = 100+200=300· λοξός τοίχος 45° → center offset κατά R κατά μήκος της 45° καθέτου· (β) regression: center modes (#1/#2) ΑΜΕΤΑΒΛΗΤΟΙ· (γ) μη-κυκλικές ΑΜΕΤΑΒΛΗΤΕΣ.
- **Browser (Giorgio):** εργαλείο Κολόνα → Κυκλική → «Περιφέρεια» → κοντά σε τοίχο → ο κύκλος **εφάπτεται** στην παρειά / στον άξονα (κέντρο offset R), σε κάθε πλευρά + λοξό τοίχο. Center modes αμετάβλητα.
- ⚠️ CHECK 6B/6D (snap/preview canvas) → stage **ADR-040 + ADR-398 (+ ADR-514)** μαζί.

## 7. ΣΧΕΤΙΚΑ ADR
- **ADR-398** (Column placement snap — §3.9 center-on-axis, §3.18 circular bbox· εδώ ζει το νέο §3.19 circumference-tangent).
- **ADR-514** (Unified BIM Cursor Snap — ο εγκέφαλος).
- **ADR-363** (column anchors/geometry — circular ignores anchor).
- **ADR-519** (circular grips — 4 quadrants στην περιφέρεια· R = width/2).
- **ADR-040** (preview canvas perf — architecture-critical).

## 8. EXACT ANCHORS (re-grep — μπορεί να μετακινήθηκαν)
- ΡΙΖΑ: `bim/columns/column-anchors.ts:149-151` (`localToWorld` circular αγνοεί anchor)· `bim/geometry/column-geometry.ts` `transformFootprint`.
- Resolver: `bim/columns/column-face-snap.ts:411` `resolveColumnFaceSnapFromTargets` (+ `resolveMemberAxisCenter`, `resolveForTarget`, `buildFaceTargets`, `circularFootprints`)· helpers `column-face-snap-helpers.ts` (`resolveAxisCenterFoot`, `buildMemberAxisFrame`, `MemberAxisFrame`, `axisAlignmentRotationDeg`).
- Frame/κάθετος: `bim/framing/linear-member-face-snap.ts` `GhostFaceFrame` (`perpDir`/`outwardSign`/`facePerp`).
- Radius/περιφέρεια: `bim/columns/column-anchors.ts` `circularAnchorLocal`· `params.width/2`.
- Caller (πέρασμα R): `bim/placement/bim-cursor-snap.ts:130` (`input.columnOpts`/`BimCursorSnapInput`).
- UX: `hooks/drawing/use-column-anchor-tab-cycle.ts`· ribbon «Σημείο Στήριξης» dropdown (column bridge combobox — εντόπισε το i18n key).
- Preview consumers: `hooks/drawing/column-preview-helpers.ts` (`generateColumnPreview`)· commit `systems/cursor/mouse-handler-up.ts`.
