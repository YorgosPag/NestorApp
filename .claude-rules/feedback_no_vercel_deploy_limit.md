---
name: No Vercel deploy when limit reached
description: When Vercel Hobby plan hits 100 deployments/day, work on localhost:3000 instead. Never push to trigger deploys.
type: feedback
---

Σήμερα (2026-03-14) εξαντλήθηκαν τα 100 deployments/ημέρα στο Vercel Hobby plan.

**Why:** Πολλά commits+push σε μία μέρα κατανάλωσαν όλα τα deployments.

**How to apply:**
- Όταν ο Γιώργος λέει ότι δουλεύει σε localhost:3000, ΜΗΝ κάνεις `git push`
- Κάνε μόνο `git commit` — θα γίνει push μαζικά αργότερα
- Ο Γιώργος θα τεστάρει τοπικά στο http://localhost:3000
