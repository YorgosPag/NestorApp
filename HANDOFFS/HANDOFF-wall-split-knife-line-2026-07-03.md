# HANDOFF — «Χωρισμός Τοίχων» ως ΓΡΑΜΜΗ-ΜΑΧΑΙΡΙ (2-click knife split + live preview)

**Ημ/νία:** 2026-07-03
**Status:** 🔴 NOT STARTED — σχεδιασμός + υλοποίηση
**Μοντέλο:** Opus (νέο FSM + preview rendering + geometry, 4-6 αρχεία)
**⚠️ COMMIT:** ο Giorgio. Shared working tree.
**Context:** το feature αναδύθηκε ενώ το wall-MERGE (ADR-566) μόλις ολοκληρώθηκε UNCOMMITTED.

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (επιβεβαιωμένο με AskUserQuestion)

Ο τωρινός «Χωρισμός» (`wall-split`) είναι **ένα κλικ** (κλικ σε τοίχο → χωρίζεται στο σημείο).
Ο Giorgio θέλει να γίνει **ΓΡΑΜΜΗ-ΜΑΧΑΙΡΙ (2 κλικ)**:

1. Πάτα «Χωρισμός» → κλικ **σημείο 1** (οπουδήποτε).
2. Εμφανίζεται **ζωντανή γραμμή** από το σημείο 1 στο **κέντρο του σταυρονήματος** (rubber-band preview).
3. Κλικ **σημείο 2** → **ΟΛΟΙ οι τοίχοι που τέμνει το ευθύγραμμο τμήμα [σημείο1, σημείο2]** χωρίζονται
   στο **σημείο τομής** (knife). Loop για επόμενη κοπή· ESC/δεξί-κλικ = έξοδος.

Σκοπός: «να βλέπω πού θα χωριστούν οι τοίχοι» πριν κλικ 2.

---

## 1. ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (100% ειλικρίνεια)

Το `systems/wall-split/WallSplitStore.ts` **ΓΡΑΦΕΤΑΙ αλλά ΔΕΝ renderάρεται πουθενά** (stub —
κανένας consumer του `useWallSplitPreview`/`WallSplitStore.get`). Άρα ΚΑΙ ο τωρινός split **δεν
έχει κανένα visual**. Το νέο preview (γραμμή 1→κέρσορας) πρέπει να **renderαριστεί όντως** — αυτό
είναι το πιο σύνθετο κομμάτι.

**Preview render μηχανισμός (reuse):** `canvas-v2/preview-canvas/PreviewRenderer.ts` +
`preview-entity-paint.ts` + `drawing-preview-generator.ts`. Δες πώς το wall-drawing tool δείχνει
rubber-band: `bim/walls/wall-preview-store.ts` + `hooks/drawing/use-wall-preview-sync.ts` +
`wall-preview-helpers.ts`. **Το knife-line preview = mirror αυτού** (ζωγράφισε ΜΙΑ γραμμή
[p1, cursor] στο preview canvas, ADR-040 leaf, zero React state).

---

## 2. SSoT AUDIT — GREP ΠΡΙΝ ΚΩΔΙΚΑ

```
# Ο τωρινός split (mirror/επέκτεινε — ΜΗΝ ξαναγράψεις)
grep -rn "useWallSplitTool\|WallSplitStore\|computeSplitOffset\|computeSplitWallParams\|redistributeOpenings\|computeSplitIndicatorLine" src/subapps/dxf-viewer
# Preview canvas rubber-band (reuse για τη γραμμή)
grep -rn "PreviewRenderer\|preview-entity-paint\|wall-preview-store\|use-wall-preview-sync\|ImmediatePositionStore" src/subapps/dxf-viewer
# Segment/line intersection helpers (ΓΙΑ segment [p1,p2] ∩ wall axis)
grep -rn "segmentIntersect\|lineIntersection\|intersectSegments\|getLineIntersection\|segmentsIntersect" src/subapps/dxf-viewer/utils src/subapps/dxf-viewer/bim
# Undoable multi-split (composite command)
grep -rn "CompositeCommand\|composite-command\|executeCommand\|WallSplitCommand" src/subapps/dxf-viewer/core/commands
```

---

## 3. ΤΙ ΥΠΑΡΧΕΙ ΝΑ ΚΑΝΕΙΣ REUSE

- `hooks/tools/useWallSplitTool.ts` — **επέκτεινε το FSM** από 1-click σε 2-click knife
  (idle → firstPoint set → mousemove rubber-band → secondPoint → multi-split → loop).
  Ζει στο `hooks/tools/` (executeCommand για undo). Subscribe `ImmediatePositionStore` (ADR-040)
  για το mousemove → ενημέρωσε το preview store με [p1, cursor].
- `bim/walls/wall-split.ts` — `computeSplitOffset` (projection point→axis offset),
  `computeSplitWallParams` (split ενός τοίχου σε offset), `redistributeOpenings`. **NEW pure:**
  `wallsCrossedBySegment(walls, p1, p2) → Array<{wall, intersectionPoint}>` (segment ∩ wall axis,
  εντός των ορίων του τοίχου) — reuse υπάρχον segment-intersection helper (grep §2).
- `core/commands/entity-commands/WallSplitCommand.ts` — **ένα ανά τοίχο**· τύλιξέ τα σε
  **CompositeCommand** (grep §2) ώστε ΕΝΑ Ctrl+Z να αναιρεί ΟΛΕΣ τις κοπές της γραμμής.
- Preview: **NEW** `systems/wall-split/WallSplitKnifeStore.ts` (ή επέκτεινε το WallSplitStore) —
  κρατά `{ firstPoint, cursor }` (zero React). **NEW** leaf renderer στο preview-canvas (mirror
  wall-preview-sync) που ζωγραφίζει τη γραμμή [firstPoint, cursor] + προαιρετικά highlight στους
  τοίχους που θα κοπούν + κάθετες ενδείξεις στα σημεία τομής (`computeSplitIndicatorLine`).
- Wiring: το tool είναι ΗΔΗ wired (tool id `wall-split`, click branch, escape). Απλώς αλλάζει η
  ΕΣΩΤΕΡΙΚΗ ροή του click handler (1ο click = set firstPoint· 2ο click = multi-split).

---

## 4. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (προς Plan)

- **FSM (useWallSplitTool):** `firstPointRef: Point2D | null`.
  - `handleWallSplitClick(p)`: αν `firstPointRef==null` → set = p (snapped), ενημέρωσε store, return.
    Αλλιώς → `pts = wallsCrossedBySegment(walls, firstPointRef, p)`· για κάθε hit build
    `WallSplitCommand` (computeSplitOffset στο intersectionPoint + computeSplitWallParams +
    redistributeOpenings)· τύλιξε σε CompositeCommand· `executeCommand`· reset firstPoint· loop.
  - mousemove (ImmediatePositionStore): αν firstPoint set → store.set({firstPoint, cursor}).
  - ESC: reset firstPoint + store.reset + onToolChange('select').
- **Preview render:** leaf στο preview canvas, mirror `use-wall-preview-sync` — ζωγράφισε τη γραμμή.
  ⚠️ ADR-040: zero React state, leaf-only subscription, stage ADR-040 (CHECK 6B/6D).
- **i18n:** status prompts «κλικ 1ο σημείο κοπής» / «κλικ 2ο σημείο» (el+en, ns `dxf-viewer-shell`).

## 5. EDGE CASES (ρώτα Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ παράδειγμα αν χρειαστεί)
- Η γραμμή τέμνει τον ΙΔΙΟ τοίχο 2 φορές (διαγώνια σε παχύ τοίχο); → 1 κοπή στο 1ο crossing.
- Η γραμμή δεν τέμνει κανέναν τοίχο → toast «καμία κοπή» (mirror wall-merge toast pattern).
- Κοπή πολύ κοντά σε άκρο (MIN_SEGMENT_MM του computeSplitOffset) → skip αυτόν τον τοίχο.

## 6. VERIFY
- jest: `wallsCrossedBySegment` (τομή/όχι, εντός ορίων, πολλαπλοί τοίχοι) + CompositeCommand undo.
- browser: πάτα Χωρισμός → κλικ 1 → **η γραμμή ακολουθεί τον κέρσορα** → κλικ 2 → όλοι οι
  διασταυρούμενοι τοίχοι κόπηκαν στα σημεία τομής· ΕΝΑ Ctrl+Z τους επαναφέρει· openings επιβιώνουν.
- ADR: επέκταση ADR-363 §5.6 (wall split → knife-line mode) + changelog.

## 7. CONSTRAINTS
- N.-1 (ΟΧΙ commit/push). N.7.1 (≤500/≤40). N.11 (i18n el+en). N.17 (ΟΧΙ tsc· μόνο jest).
- ADR-040 CHECK 6B/6D: το preview render αγγίζει canvas → stage ADR-040.
- Shared tree: άγγιξε ΜΟΝΟ wall-split / preview / command αρχεία.
