# HANDOFF — Έλεγχος αυτόματης δημιουργίας BIM οντοτήτων σε άδεια βάση

**Ημερομηνία:** 2026-06-13
**Branch:** `main` | **Working tree:** καθαρό (όλα committed έως `83a648af`)
**⚠️ Το working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ δικά μου αρχεία. **COMMIT τον κάνει ο Giorgio, ΟΧΙ εγώ.**

---

## 🎯 ΣΤΟΧΟΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ

Ο Giorgio **άδειασε τη βάση** — έμειναν μόνο **9 config συλλογές**. Θέλει να ελέγξουμε τι παράγει το pipeline αυτόματης δημιουργίας BIM οντοτήτων σε καθαρή κατάσταση.

### Ροή που ζήτησε:
1. **Baseline** — αποτύπωση τι υπάρχει τώρα στη βάση (οι 9 config συλλογές + counts), πριν αγγίξουμε οτιδήποτε.
2. **Τοποθέτηση οδηγών** (guides/κάναβος) — ο Giorgio θα τους βάλει στο UI.
3. **Εντολές αυτόματης δημιουργίας BIM** (grid-first: εσχάρα θεμελίωσης / κολώνες σε τομές / τοίχοι σε segments — ADR-441 GEN-COL/GEN-WALL/foundation grid).
4. **Έλεγχος ανά δημιουργία** τι γράφεται στη βάση:
   - ✅ **Enterprise IDs** — `setDoc()` + ID από `enterprise-id.service.ts` (N.6). ΟΧΙ `addDoc`/`Date.now()`/inline `crypto.randomUUID()`.
   - ✅ **`companyId`** — κάθε doc tenant-scoped (Firestore rules tenant isolation).
   - ✅ **Cascade** — storey-aware elevations, floor cascade, auto-attach (κολώνα→δοκάρι, τοίχος top/base attach).

---

## 🔧 ΕΡΓΑΛΕΙΑ ΕΛΕΓΧΟΥ

- **Firestore MCP** (deferred tools): `mcp__firestore__firestore_list_collections`, `firestore_count`, `firestore_query`, `firestore_get_document`. Φόρτωσέ τα με `ToolSearch query "select:..."` πριν τα καλέσεις.
- Για baseline: `firestore_list_collections` → επιβεβαίωσε τις 9 config + count η καθεμία.
- Μετά από κάθε εντολή δημιουργίας: query την αντίστοιχη collection, δες το νέο doc (ID prefix, `companyId`, σχέσεις/bindings).

---

## 📚 ΣΧΕΤΙΚΟ CONTEXT (πρόσφατα ολοκληρωμένα ADR — committed)

Το pipeline που θα δοκιμαστεί στηρίζεται στα:
- **ADR-441** GRID-FIRST θεμελίωση/ανέγερση (associative grid hosting· εσχάρα από κάναβο· GEN-COL/GEN-WALL· born-bound idempotent).
- **ADR-450/451** Floor-elevation cascade + Building Vertical Setup (elevation=SSoT, height=παράγωγο· server cascade).
- **ADR-448** Storey-Aware DXF Viewer (όροφοι→BIM elevations).
- **ADR-449** σοβάς δομικών (merged structural silhouette).
- **ADR-452** Cut-plane slider 2Δ+3Δ.

### Enterprise ID / Firestore SSoT κανόνες (N.6):
- ID generators: `@/services/enterprise-id.service` (60+ generators). Αν λείπει generator για collection → φτιάξε prefix+generator ΠΡΩΤΑ.
- Πρόσφατα collections: π.χ. `FLOORPLAN_FOUNDATIONS` (`generateFoundationId`). Δες `firestore-collections` + `audit-tracked-fields`.
- Pre-commit CHECK 3.10: queries με `where()` ΠΡΕΠΕΙ να περιέχουν `companyId`.

---

## ⚠️ ΚΑΝΟΝΕΣ (CLAUDE.md)

- **Γλώσσα:** πάντα Ελληνικά.
- **ΟΧΙ commit/push** χωρίς ρητή εντολή Giorgio (N.-1).
- **ΟΧΙ `--no-verify`** (N.-1.1).
- **ΕΝΑ `tsc` τη φορά** — έλεγξε για ενεργό tsc άλλου agent πριν τρέξεις (N.17).
- `git add` ΜΟΝΟ δικά μου αρχεία (shared tree).
- Μετά από υλοποίηση: update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (μόνο τι εκκρεμεί) + ADR changelog (N.15).

---

## ▶️ ΠΡΩΤΟ ΒΗΜΑ ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ

Πάρε **baseline** της άδειας βάσης (list collections + counts) και ανέφερέ το στον Giorgio. Μετά περίμενε να τοποθετήσει οδηγούς / τρέξει τις εντολές δημιουργίας, και έλεγχε ζωντανά κάθε νέο doc για enterprise ID + `companyId` + cascade.
