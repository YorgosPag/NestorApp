# ADR-057: Unified Entity Completion Pipeline

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `completeEntity()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `completeEntity()` from `hooks/drawing/completeEntity.ts`
- **Result**: 4 code paths → 1 function

## Changelog

- **2026-07-29 (ADR-729)** — 🔴 **`completeEntities` ΕΓΓΥΑΤΑΙ ΠΛΕΟΝ ΑΤΟΜΙΚΟΤΗΤΑ: μια παρτίδα N
  οντοτήτων = ΑΚΡΙΒΩΣ 1 εγγραφή ιστορικού = 1 αναίρεση.** Μέχρι τώρα ο βρόχος έγραφε **μία εγγραφή
  ανά οντότητα**: μετρημένο ζωντανά, ένα ψήσιμο 186 τοπογραφικών ετικετών παρήγαγε **187 εγγραφές**
  σε ιστορικό με `maxHistorySize: 100` ⇒ (α) η εντολή **δεν ξεκανόταν** (86 ορφανές οντότητες) και
  (β) η παρτίδα **σάρωνε όλο το προηγούμενο ιστορικό της συνεδρίας** — ο χρήστης έχανε **άσχετη**
  δουλειά. Ο βρόχος εξήχθη ως `completeEntitiesInGroup` και τυλίγεται **αδιαπραγμάτευτα** σε
  `CommandHistory.runAsSingleUndo`. Η υπογραφή **δεν άλλαξε** — μηδέν αλλαγή για τους 8+
  καταναλωτές. Η ατομικότητα είναι **ΔΟΜΙΚΗ**, όχι προαιρετική: κάθε μελλοντικός παραγωγός
  παρτίδας τη κληρονομεί χωρίς να την ξέρει (σε Revit/AutoCAD/C4D η παράλειψη του transaction group
  είναι **σιωπηλή** — εδώ δεν υπάρχει τρόπος να ξεχαστεί). Το `completeEntity` (ενικός) **δεν
  άλλαξε**. Βλ. `ADR-729-atomic-undo-groups.md`.

- **2026-05-11** — STEP 2 now routes every entity through `CreateEntityCommand` +
  `getGlobalCommandHistory().execute()` (ADR-031) instead of mutating the scene
  directly via `setScene()`. This wires Ctrl+Z / the toolbar undo button to all
  drawing tools (line, rectangle, circle, polyline, polygon, measure-*, arc,
  circle-best-fit). The caller-provided entity id is preserved through the
  command via the new `CreateEntityOptions.existingId` field so grip selection,
  AI tools, and `floorplan_overlays` persistence continue to address the same
  entity. `drawing:complete` event payload now carries the command's final
  entity reference. `trackForUndo` callback retained for continuous-measurement
  session bookkeeping (orthogonal to the global command stack).
