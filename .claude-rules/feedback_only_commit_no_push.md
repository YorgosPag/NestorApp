---
name: Only commit — NEVER push without explicit order
description: ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ: Μόνο commit επιτρέπεται αυτόνομα. Push ΜΟΝΟ με ρητή εντολή Γιώργου.
type: feedback
---

Μόνο `git commit` επιτρέπεται χωρίς εντολή. Το `git push` απαγορεύεται ΑΠΟΛΥΤΑ χωρίς ρητή εντολή του Γιώργου.

**Why:** Κάθε push = Vercel build = κατανάλωση credits ($). Ο Γιώργος πληρώνει και θέλει πλήρη έλεγχο πότε γίνεται deploy.

**How to apply:** Μετά από κάθε commit, ΣΤΑΜΑΤΑ και ΠΕΡΙΜΕΝΕ. Ο Γιώργος λέει "push", "στείλε", "ανέβασε" μόνος του. ΠΟΤΕ μην κάνεις push αυτόματα μαζί με commit.
