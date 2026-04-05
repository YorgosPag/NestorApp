---
name: No push to Vercel — temporary block
description: Vercel build queue overloaded (100+ deployments on 2026-03-14). Do NOT git push until further notice. Work locally on localhost:3000.
type: feedback
---

ΜΗΝ κάνεις git push origin main μέχρι νεωτέρας. Μόνο git commit τοπικά.

**Why:** Στις 2026-03-14 έγιναν 100+ deployments σε μία μέρα, γέμισε η ουρά του Vercel Hobby plan και τα builds κόλλησαν (Queued/Initializing χωρίς να ξεκινούν). Ο Γιώργος δουλεύει τοπικά στο localhost:3000.

**How to apply:**
- Μετά από κάθε εργασία: `git add` + `git commit` ΜΟΝΟ
- ΧΩΡΙΣ `git push origin main`
- ΧΩΡΙΣ BACKUP_SUMMARY.json / enterprise-backup.ps1
- Ο Γιώργος θα πει πότε μπορούμε να κάνουμε push ξανά
