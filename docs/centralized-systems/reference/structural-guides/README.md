# Structural Reference Guides

Πραγματικές, εγκεκριμένες στατικές μελέτες κωδικοποιημένες ως **πηγή αναφοράς**
για τη μηχανή `bim/structural/` — δίπλα στα δικά μας code providers και στις
συμβάσεις της Revit.

| Αρχείο | Τι είναι | Μορφή |
|---|---|---|
| [`greek-static-report-guide.md`](./greek-static-report-guide.md) | Οδηγός: δομή τεύχους, μεθοδολογία, κανονισμοί, έλεγχοι, worked examples, BOQ | MD (γνώση) |
| [`static-report-reference-parameters.json`](./static-report-reference-parameters.json) | Canonical παράμετροι (υλικά/φορτία/σεισμός/έδαφος/συνδυασμοί) — shared + per-building Κ1/Κ2/Κ3 | JSON (machine) |

**Γιατί υβριδικό:** το MD κρατά narrative/συμβάσεις/clauses (git-trackable,
αναγνώσιμο)· το JSON ό,τι μπορεί να καταναλώσει/ελέγξει ο κώδικας. Οι per-member
αριθμητικοί πίνακες (~254 σελ.) μένουν στα πρωτογενή PDF.

**Machine SSoT (ADR-479):** οι τιμές ζουν code-side στο
`src/subapps/dxf-viewer/bim/structural/presets/reference-static-report.ts`
(`THERMI_288_08`). Το JSON εδώ είναι **human mirror** — guarded από
`reference-static-report.test.ts` (σπάει σε divergence). Το reference έγινε **ενεργό**:
built-in Structural Presets (`greek-rc-ec8` / `greek-rc-legacy` / `blank`) που
αρχικοποιούν τα building `StructuralSettings` σαν Revit project template, +
cross-check regression test ότι τα engine defaults είναι συνεπή με την πραγματική μελέτη.

**Πηγή:** Τεύχη STATICS 2025 — έργο «2η Αναθεώρηση 288/08», Θέρμη Θεσσαλονίκης
(Κ1/Κ2/Κ3). Εξαγωγή 2026-06-18.

**Σχετικά:** ADR-456 (στατικά/ποσότητες) · ADR-474 (occupancy auto loads) ·
ADR-467 (load path engine) · `src/subapps/dxf-viewer/bim/structural/codes/`.
