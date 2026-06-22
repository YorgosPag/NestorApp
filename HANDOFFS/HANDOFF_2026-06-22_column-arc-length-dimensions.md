# HANDOFF — Κολώνα: **arc-length listening dimensions** σε ΚΥΚΛΟ/ΤΟΞΟ (ADR-398 §3.12)

**Ημ/νία:** 2026-06-22
**Τύπος:** Feature (listening dimensions — arc-length αντί ευθείας χορδής σε καμπύλους στόχους)
**Μοντέλο:** Opus (§dim model + rendering· 2 domains: framing + canvas-v2)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά (CLAUDE.md LANGUAGE RULE).

---

## 0. ΤΟ ΑΙΤΗΜΑ (Giorgio, verbatim + απόφαση)

> «Το πρόβλημα με τον κύκλο είναι πως οι αρχές μέτρησης αποστάσεων είναι πολύ μεγάλες ευθείες.
> Μήπως πρέπει να μετράει και μήκος τόξου;»

**Απόφαση Giorgio (επιλογή με AskUserQuestion):** **Α — Μήκος τόξου (Revit-grade).** Όταν ο στόχος
ολίσθησης είναι **κύκλος/τόξο**, η listening dimension πρέπει να δείχνει **ΜΗΚΟΣ ΤΟΞΟΥ** (`s = r·θ`)
και η dim line να **ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΚΑΜΠΥΛΗ** — όπως το AutoCAD «Arc Length Dimension» (⌒), ΟΧΙ
ευθεία χορδή που κόβει μέσα από τον κύκλο.

> «FULL ENTERPRISE + FULL SSOT, όπως η Revit. ΠΡΙΝ τον κώδικα, ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) για
> να μη δημιουργήσεις διπλότυπα.»

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ ΣΗΜΕΡΑ (γιατί βγαίνουν ευθείες)

Ο κύκλος μοντελοποιείται ως **πολλές ευθείες χορδές** (tessellation 24 τμημάτων μέσω `arcToPolyline`)
— βλ. §2 baseline. Όταν η κολώνα κουμπώνει σε ένα τμήμα, ο `resolveGhostFaceDimensions`
(`bim/framing/ghost-face-dim-references.ts`, ADR-508 §dim) μετράει **ευθύγραμμη** απόσταση κατά μήκος
του `axisDir` (της χορδής) και σχεδιάζει **ευθείες** witness/dim lines. Σε ευθεία (τοίχο/δοκάρι/
πλάκα/γραμμή) σωστό· σε **κύκλο** → ευθείες εφαπτόμενες που δεν ακολουθούν την καμπύλη + μετρούν
**χορδή αντί τόξου** (γεωμετρικά λάθος). Παράδειγμα r=1000, 90°: χορδή=1414mm (κόβει μέσα),
τόξο=1571mm (σωστό, ακολουθεί ⌒).

---

## 2. ✅ ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (baseline — ΟΛΟΚΛΗΡΩΜΕΝΟ, UNCOMMITTED, Giorgio θα κάνει commit)

**ADR-398 §3.11 center-on-axis ολίσθηση** δουλεύει ΗΔΗ (browser-verified από Giorgio για δοκάρι/
γραμμή· tests+tsc clean) σε: **ακμή πλάκας, δοκάρι, σκέτη γραμμή, πολυγραμμή, ορθογώνιο, κύκλο.**
Όλα = **zero-width edges** μέσω κοινού SSoT. 110 column/framing jest GREEN, tsc clean.

Αρχεία baseline (δικά μου, UNCOMMITTED):
- `bim/framing/member-snap-targets.ts` — `edgeBandTarget` (ΕΝΑ zero-width band SSoT), `polylineEdgeTargets`
  (ένα edge ανά τμήμα, slab+polyline κοινό), `slabEdgeTargets`/`lineTarget`/`polylineTargets`/
  `rectangleTargets` (reuse `rectangleCorners`)/**`circleTargets`** (reuse `arcToPolyline`, 360° τόξο).
- `bim/framing/scene-snap-targets.ts` — `SceneSnapTargets.lineTargets` (column-only· line/polyline/rect/circle).
- `bim/columns/column-face-snap.ts` — `resolveColumnEdgeSnap` (zero-width edges → center-on-axis §3.11 + flush),
  `resolveAxisCenterFoot`/`buildCenteredAxisFaceFrame`/`axisAlignmentRotationDeg` (κοινός SSoT).
- `bim/columns/__tests__/column-face-snap.test.ts` — 63 column tests.
- `docs/.../ADR-398-column-placement-snap.md` — §3.11 changelog.

⚠️ Το feature αυτό (§3.12 arc-length) **ΧΤΙΖΕΙ ΕΠΑΝΩ** στο §3.11. Ξεκίνα αφού ο Giorgio commit-άρει
το §3.11 (ή πάνω στο working tree).

---

## 3. 🚨 ΚΡΙΣΙΜΟ ΑΝΟΙΧΤΟ ΣΧΕΔΙΑΣΤΙΚΟ ΕΡΩΤΗΜΑ (κλείδωσέ το με Giorgio ΠΡΙΝ τον κώδικα)

Ο **κλειστός κύκλος ΔΕΝ έχει «άκρα»**. Το σημερινό §dim μετράει 3 νούμερα προς τα **άκρα** της
παρειάς (`leftGap`/`rightGap` → faceAlongMin/Max) + `centerToCenter`. Σε κύκλο **δεν υπάρχουν άκρα**
→ **arc-length από ΠΟΥ έως ΠΟΥ;** Πιθανές προσεγγίσεις (ρώτησε Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό/
οπτικό παράδειγμα — σκέφτεται σε γεωμετρία):
- **(α) Τεταρτημόρια datum:** arc-length από τα 0°/90°/180°/270° (ή το πλησιέστερο) → 4 references.
- **(β) Γωνία θέσης** αντί μήκους (π.χ. «45°») — απλούστερο, πολύ Revit/CAD.
- **(γ) Arc προς κοντινά snap points** (άλλες οντότητες/άξονες) πάνω στην περιφέρεια.
- **(δ) Συνδυασμός:** ακτίνα (r, σταθερό) + γωνία/μήκος-τόξου θέσης.

**Για ΤΟΞΟ** (ArcEntity, αν προστεθεί) υπάρχουν πραγματικά άκρα (startAngle/endAngle) → arc-length
προς αυτά + center έχει νόημα άμεσα. Πρότεινε στον Giorgio να ξεκινήσετε από το reference model.

---

## 4. SSoT ΠΡΟΣ REUSE (ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ κώδικα — εντολή Giorgio)

```
# arc/τόξο geometry + τυχόν υπάρχον arc-dimension
grep -rniE "arc.?length|arcLength|arc dimension|arcDimension" src/subapps/dxf-viewer
grep -rn "geometry-arc-utils\|arcToPolyline\|pointOnCircle\|degToRad\|TAU" src/subapps/dxf-viewer/utils src/subapps/dxf-viewer/rendering/entities/shared
# το §dim pipeline (μοντέλο + resolver + render)
grep -rn "resolveGhostFaceDimensions\|GhostFaceFrame\|GhostFaceDimension\|renderPreviewDimension" src/subapps/dxf-viewer
grep -rn "ghost-face-dim-paint\|preview-dimension-renderer" src/subapps/dxf-viewer/canvas-v2
```

Επιβεβαιωμένο σ' αυτή τη συνεδρία (2026-06-22): **arc-length listening dimension ΔΕΝ υπάρχει** → νέο.
Υπάρχει όμως arc GEOMETRY SSoT προς reuse — μην ξαναγράψεις:
- `utils/geometry/GeometryUtils.ts` — `arcToPolyline(arc, segments)`, `Arc` type, `degToRad`, `TAU`,
  `pointOnCircle` (γωνία→σημείο). **Το tessellation το χρησιμοποιεί ήδη το `circleTargets`.**
- `rendering/entities/shared/geometry-arc-utils.ts` — βοηθοί γεωμετρίας τόξου (grep για angle/arc-length).
- `rendering/entities/ArcRenderer.ts` — πώς σχεδιάζεται ένα τόξο (για curved dim line reference).

### Το §dim pipeline (εδώ ζει η αλλαγή):
| Αρχείο | Ρόλος |
|--------|-------|
| `bim/framing/linear-member-face-snap.ts` | `GhostFaceFrame` (το μοντέλο). **ΕΔΩ** πρόσθεσε optional `arc?: { center: Point2D; radius: number }` (καθαρό, μη-breaking). |
| `bim/framing/ghost-face-dim-references.ts` | `resolveGhostFaceDimensions` — **ΕΔΩ** ο arc-length κλάδος: αν `frame.arc`, η τιμή = `s = r·Δθ` (γωνίες σημείων μέσω `atan2`/`pointOnCircle` SSoT) αντί `|alongB−alongA|`. Πρόσθεσε `isArc`/sampled-arc points στο `GhostFaceDimension` για curved render. |
| `bim/columns/column-face-snap.ts` | `resolveColumnEdgeSnap`/`buildEdgeCenterSnap` — πέρασε το `arc` metadata στο `faceFrame` όταν ο στόχος προέρχεται από κύκλο. |
| `bim/framing/member-snap-targets.ts` | `circleTargets` — carry center/radius στο `LinearMemberSnapTarget` (NEW optional `arc?` πεδίο) ώστε να φτάσει στο faceFrame. |
| `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` | παίρνει τα dims + ζωγραφίζει. **ΕΔΩ** ο curved-dim branch. |
| `canvas-v2/preview-canvas/preview-dimension-renderer.ts` | `renderPreviewDimension` (ADR-362 SSoT). Δες αν υποστηρίζει ήδη arc/curved leader· αν όχι, πρόσθεσε καμπύλη dim line (reuse `arcToPolyline` για το sampling της καμπύλης). |

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επιβεβαίωσε με Plan Mode + το §3 reference model)

**Carry «curve» info μέσα από το pipeline (μηδέν νέος μηχανισμός):**
1. `LinearMemberSnapTarget` → NEW optional `arc?: { center, radius }` (μόνο τα circle/arc targets το θέτουν).
2. `GhostFaceFrame` → NEW optional `arc?` (περνά από τον resolver στο dim resolver).
3. `resolveGhostFaceDimensions` → αν `frame.arc`: value = arc-length (`s=r·Δθ`)· τα witness/dim
   points δειγματίζονται κατά μήκος του τόξου (reuse `arcToPolyline`/`pointOnCircle`).
4. `ghost-face-dim-paint` → curved leader αντί ευθείας (reuse το ίδιο sampling).

**FULL SSoT στόχος:** ΕΝΑ `GhostFaceDimension` που ξέρει αν είναι ευθύ ή τόξο· ΕΝΑΣ renderer που
χειρίζεται και τα δύο (μηδέν δεύτερο dim subsystem). Τα μαθηματικά τόξου (γωνία, s=r·θ, sampling)
**μόνο** από `geometry-arc-utils`/`GeometryUtils` SSoT — ΜΗΝ γράψεις νέο `atan2`/tessellation.

**ΠΡΟΣΟΧΗ:** μην αλλάξεις τη συμπεριφορά των listening dimensions για ΕΥΘΕΙΣ στόχους (τοίχος/δοκάρι/
πλάκα/γραμμή/πολυγραμμή/ορθογώνιο) — ο ευθύς κλάδος μένει byte-for-byte· ο arc κλάδος είναι ΝΕΟΣ,
gated σε `frame.arc`.

---

## 6. ⚠️ ΜΗΝ ΧΑΣΕΙΣ (διατήρηση)
1. §3.11 center-on-axis ολίσθηση (δοκάρι/γραμμή/πολυγραμμή/ορθογώνιο/κύκλος) — αμετάβλητη.
2. §dim listening dimensions ΕΥΘΕΙΩΝ στόχων — μηδέν regression (ο arc είναι νέος gated κλάδος).
3. §3.9/§3.10/§3.10b + flush + glyphs + place+rotate.
4. `edgeBandTarget`/`polylineEdgeTargets` κοινά SSoT — μην τα διπλασιάσεις.

---

## 7. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **N.0.1 ADR-driven:** ενημέρωσε **ADR-398** (νέο §3.12 arc-length dims) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15) + ADR-508 §dim αν χρειαστεί.
- **SSoT audit (grep) ΠΡΙΝ κώδικα** (§4) — εντολή Giorgio. Reuse, μην διπλασιάσεις.
- **Plan Mode** πρώτα· κλείδωσε το §3 reference model με αριθμητικό/οπτικό παράδειγμα.
- **Shared tree:** `git add` ΜΟΝΟ δικά σου· **ΟΧΙ commit** (Giorgio).
- **N.17:** ΕΝΑ tsc τη φορά (έλεγχος process πριν). **N.(-1.1):** ΟΧΙ `--no-verify`. **100% ειλικρίνεια.**
- ⚠️ `canvas-v2/preview-canvas/*` = ADR-040 critical (CHECK 6B/6D) → stage ADR-040 + ADR-398.

## 8. DEFINITION OF DONE
- Κολώνα σε **κύκλο** (και μετά ΤΟΞΟ): listening dimension = **μήκος τόξου** (`s=r·θ`), dim line
  **ακολουθεί την καμπύλη** (όχι ευθεία χορδή). Reference model κατά §3 (κλειδωμένο με Giorgio).
- Ευθείς στόχοι: §dim αμετάβλητο.
- jest GREEN (NEW arc-length dim tests) + tsc clean + browser-verify (κολώνα σε κύκλο → καμπύλη μέτρηση).
- ADR-398 §3.12 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ενημερωμένα.

## 9. DEFER (εκτός scope τώρα)
- ΤΟΞΟ entity (ArcEntity) ως slide target — πρώτα κύκλος, μετά τόξο (με πραγματικά άκρα).
- bulge arcs πολυγραμμής → τώρα ευθεία χορδή.
- λοξό ορθογώνιο (rotation) → τώρα axis-aligned (consistent με perimeter-from-faces).
