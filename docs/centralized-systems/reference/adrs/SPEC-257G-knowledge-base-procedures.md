# SPEC-257G: Knowledge Base — Διαδικασίες & Δικαιολογητικά

| Field | Value |
|-------|-------|
| **ADR** | ADR-257 (Customer AI Access Control) |
| **Phase** | 7 of 7 |
| **Priority** | HIGH — AI currently says "δεν έχω πληροφορία" |
| **Status** | PENDING |
| **Depends On** | None (independent) |

---

## Objective

Δημιουργία knowledge base με τυπικές διαδικασίες (πώληση, μεταβίβαση, δάνειο) και απαιτούμενα δικαιολογητικά, ώστε ο AI να απαντά αντί να λέει "δεν έχω πληροφορία".

## Current State

Buyer ρωτάει: "Τι δικαιολογητικά χρειάζομαι για τον συμβολαιογράφο;"
AI απαντάει: "ℹ️ Δεν έχω πρόσβαση σε πληροφορίες σχετικά με τα δικαιολογητικά..."
Αυτό είναι **ΜΗ ΑΠΟΔΕΚΤΟ** για buyer-facing AI.

## Target State

AI απαντάει:
```
✅ Για το οριστικό συμβόλαιο χρειάζεστε:
1. Τοπογραφικό διάγραμμα
2. Οικοδομική άδεια
3. Βεβαίωση μηχανικού (Ν.4495/2017)
4. Πιστοποιητικό ενεργειακής απόδοσης (ΠΕΑ)
5. Φορολογική ενημερότητα
6. Κτηματολογικό φύλλο

Από αυτά, τα #1, #2, #3, #4 τα έχω ήδη. Θέλεις να σου τα στείλω;
```

## Implementation Approach

### Option A: Firestore Document (Recommended)
- Document: `settings/knowledge_base`
- Structure: `{ procedures: [ { id, title, category, keywords, requiredDocuments, description } ] }`
- Admin μπορεί να ενημερώσει μέσω AI ή web UI

### Option B: Config File (Fallback)
- Αρχείο: `src/config/legal-procedures-config.ts`
- Static — αλλάζει μόνο με deploy

**Recommendation:** Option A (dynamic, admin-editable)

## Knowledge Base Content

### Procedure 1: Οριστικό Συμβόλαιο (Αγοραπωλησία)
```json
{
  "id": "final_contract",
  "title": "Οριστικό Συμβόλαιο Αγοραπωλησίας",
  "category": "sale",
  "keywords": ["συμβόλαιο", "αγοραπωλησία", "μεταβίβαση", "συμβολαιογράφος"],
  "requiredDocuments": [
    { "name": "Τοπογραφικό διάγραμμα", "source": "system", "storageKey": "topographic" },
    { "name": "Οικοδομική άδεια", "source": "system", "storageKey": "building_permit" },
    { "name": "Βεβαίωση μηχανικού (Ν.4495/2017)", "source": "engineer", "storageKey": null },
    { "name": "Πιστοποιητικό Ενεργειακής Απόδοσης (ΠΕΑ)", "source": "system", "storageKey": "energy_cert" },
    { "name": "Φορολογική ενημερότητα", "source": "buyer", "storageKey": null },
    { "name": "Κτηματολογικό φύλλο", "source": "system", "storageKey": "cadastral" },
    { "name": "Βεβαίωση ΕΝΦΙΑ", "source": "seller", "storageKey": null },
    { "name": "Πιστοποιητικό μη οφειλής ΤΑΠ", "source": "municipality", "storageKey": null }
  ],
  "description": "Υπογράφεται ενώπιον συμβολαιογράφου. Μεταβιβάζει κυριότητα."
}
```

### Procedure 2: Προσύμφωνο
```json
{
  "id": "preliminary_contract",
  "title": "Προσύμφωνο Αγοραπωλησίας",
  "category": "sale",
  "keywords": ["προσύμφωνο", "κράτηση", "δέσμευση"],
  "requiredDocuments": [
    { "name": "Ταυτότητα/Διαβατήριο", "source": "buyer" },
    { "name": "ΑΦΜ", "source": "buyer" },
    { "name": "Εκκαθαριστικό εφορίας", "source": "buyer" }
  ]
}
```

### Procedure 3: Δάνειο Τράπεζα
```json
{
  "id": "bank_loan",
  "title": "Αίτηση Στεγαστικού Δανείου",
  "category": "finance",
  "keywords": ["δάνειο", "τράπεζα", "στεγαστικό"],
  "requiredDocuments": [
    { "name": "Εκκαθαριστικό εφορίας (2 τελευταία)", "source": "buyer" },
    { "name": "Βεβαίωση εργοδότη", "source": "buyer" },
    { "name": "Μισθοδοτικές καταστάσεις (6 μηνών)", "source": "buyer" },
    { "name": "Εκτίμηση ακινήτου", "source": "bank" },
    { "name": "Προσύμφωνο αγοραπωλησίας", "source": "system" },
    { "name": "Τοπογραφικό", "source": "system" },
    { "name": "Οικοδομική άδεια", "source": "system" }
  ]
}
```

### Procedure 4: Μεταβίβαση (μετά εξόφληση)
```json
{
  "id": "property_transfer",
  "title": "Μεταβίβαση Ακινήτου",
  "category": "transfer",
  "keywords": ["μεταβίβαση", "εξοφλητήριο", "κτηματολόγιο"],
  "requiredDocuments": [
    { "name": "Εξοφλητήριο", "source": "system" },
    { "name": "Οριστικό συμβόλαιο", "source": "system" },
    { "name": "Πιστοποιητικό κτηματολογίου", "source": "cadastral_office" },
    { "name": "Πιστοποιητικό μη οφειλής ΤΑΠ", "source": "municipality" }
  ]
}
```

## Files to Modify

| File | Action | Details |
|------|--------|---------|
| Firestore `settings/knowledge_base` | CREATE | Knowledge base document |
| `src/services/ai-pipeline/agentic-loop.ts` | MODIFY | System prompt: read KB + match buyer question |
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | MODIFY | New tool: `search_knowledge_base` |
| `src/services/ai-pipeline/tools/agentic-tool-executor.ts` | MODIFY | Executor: query KB, match keywords |
| `src/config/firestore-collections.ts` | VERIFY | Αν χρειάζεται νέο collection |

## AI Behavior

```
Buyer: "Τι χρειάζομαι για τον συμβολαιογράφο;"

AI:
1. search_knowledge_base(keywords: ["συμβολαιογράφο"]) → matches "final_contract"
2. Reads requiredDocuments list
3. Checks which docs exist in system (source: "system") via documents collection
4. Responds:
   "✅ Για το οριστικό συμβόλαιο χρειάζεστε:
   1. Τοπογραφικό ✅ (το έχουμε — θέλεις να στο στείλω;)
   2. Οικοδομική άδεια ✅ (το έχουμε)
   3. Βεβαίωση μηχανικού — χρειάζεται από τον μηχανικό
   4. ΠΕΑ ✅ (το έχουμε)
   5. Φορολογική ενημερότητα — χρειάζεται από εσάς (εφορία)
   ..."
```

## Acceptance Criteria

- [ ] Buyer ρωτάει "τι χρειάζομαι για τον συμβολαιογράφο;" → πλήρης λίστα
- [ ] AI αναγνωρίζει ποια docs υπάρχουν ήδη στο σύστημα
- [ ] AI προσφέρει να στείλει τα διαθέσιμα ως συνημμένα
- [ ] Admin μπορεί να ενημερώσει KB μέσω AI ή web UI
- [ ] Keywords matching: "δάνειο" → bank_loan procedure
