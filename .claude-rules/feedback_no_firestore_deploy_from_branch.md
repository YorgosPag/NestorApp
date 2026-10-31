---
name: feedback-no-firestore-deploy-from-branch
description: Κανόνες/δείκτες Firestore φτάνουν στην παραγωγή μόνο μέσω main και γραμμής· deploy από κλαδί ρίχνει τη γραμμή σε DRIFT.
metadata:
  type: feedback
---

**Κανένα `firebase deploy --only firestore:*` από κλαδί ή worktree.** Κανόνες και δείκτες φτάνουν στην παραγωγή μόνο από το `main`, μέσω της γραμμής (`docker-build.yml`, `firebase-plan` → έγκριση → `firebase-apply`).

**Why:** 2026-10-31 (ADR-923 Φ6α): deploy κανόνων από κλαδί, ενώ έτρεχε run της γραμμής. Το `firebase-apply` ανέβασε τους δείκτες, αλλά το verify έπεσε με exit 2 (DRIFT), γιατί ζωντανοί κανόνες ≠ δέντρο. Το release παρακάμφθηκε και το T1 κοκκίνισε. Το ωμό `firebase deploy` δεν γράφει και το μητρώο ADR-865.

**How to apply:** Ακόμη και με ρητή εντολή, πριν από οποιοδήποτε deploy έλεγξε `gh run list --workflow docker-build.yml` και την κεφαλίδα του `scripts/firestore-deploy/record-deploy.js`. Αν υπάρχει run σε εξέλιξη ή το δέντρο δεν είναι το `main`, **σταμάτα και πες το στον Giorgio πριν εκτελέσεις**. Το rerun μόνο του αποτυχημένου job κρατά τους στόχους του παλιού πλάνου· θέλει ολόκληρο run ή `workflow_dispatch`.
