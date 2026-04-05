---
name: No push without explicit order
description: ΤΕΡΜΑΤΙΚΗ ΑΠΑΓΟΡΕΥΣΗ — ΠΟΤΕ git push χωρίς ρητή εντολή. Κάθε push = Vercel build = κόστος. ΚΑΝΟΝΑΣ N.(-1) στο CLAUDE.md.
type: feedback
---

**ΠΟΤΕ** μην κάνεις `git push` χωρίς ρητή εντολή από τον Γιώργο.

**Why:** Κάθε push trigger-άρει Vercel build που κοστίζει credits. Ο Γιώργος πληρώνει $20/μήνα Vercel Pro και τα credits εξαντλούνται γρήγορα αν γίνονται πολλά pushes. Στις 2026-03-21, 15+ pushes σε ένα session κατανάλωσαν 78% των monthly credits.

**How to apply:**
1. Μετά `git commit` → ΣΤΑΜΑΤΑ
2. Πες στον Γιώργο τι έκανες commit
3. ΠΕΡΙΜΕΝΕ να πει "push", "στείλε", "ανέβασε"
4. ΤΟΤΕ ΜΟΝΟ κάνε `git push origin main`

**ΕΞΑΙΡΕΣΕΙΣ: ΚΑΜΙΑ.** Ακόμα κι αν το CLAUDE.md λέει "αυτόνομα push", αυτός ο κανόνας υπερισχύει.
