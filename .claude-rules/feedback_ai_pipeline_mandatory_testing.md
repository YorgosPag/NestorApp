---
name: AI Pipeline Mandatory Testing
description: When touching ai-pipeline code, MUST run tests + create new tests for new functionality
type: feedback
---

Όταν αγγίζεις αρχεία στο `src/services/ai-pipeline/`, ΥΠΟΧΡΕΩΤΙΚΑ τρέχεις tests και γράφεις νέα.

**Why:** Ο Γιώργος θα ασχοληθεί εντατικά με AI agent εντολές τον επόμενο μήνα. Χωρίς tests = production bugs. Google Presubmit Pattern.

**How to apply:**
1. Τρέξε `npm run test:ai-pipeline:all` (62 suites, ~11s) πριν το commit
2. Αν προσθέτεις νέο tool/handler/service → ΓΡΑΨΕ test στο αντίστοιχο `__tests__/` directory
3. Αν αλλάζεις συμπεριφορά → ΕΝΗΜΕΡΩΣΕ τα υπάρχοντα tests
4. Το pre-commit hook τρέχει αυτόματα τα tests αν βρει ai-pipeline αλλαγές
5. Αν tests fail → ΜΗΝ κάνεις commit, διόρθωσε πρώτα
