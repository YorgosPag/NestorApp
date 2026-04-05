---
name: No hardcoded i18n defaultValue strings (SOS. N.11)
description: ΠΟΤΕ defaultValue με literal Greek/English text σε t() calls. Enforced by CLAUDE.md SOS. N.11 + pre-commit hook + ESLint rule.
type: feedback
---

**ΚΑΝΟΝΑΣ:** ΠΟΤΕ δεν γράφεις `t('key', { defaultValue: 'Greek/English text' })` στον κώδικα. Η i18n key πρέπει να υπάρχει ΠΡΩΤΑ στα `src/i18n/locales/{el,en}/*.json`.

**Why:** Γιώργος εντόπισε ότι hardcoded defaultValue strings παραβιάζουν SSoT — το ίδιο text ζει σε 2 μέρη (κώδικα + locale JSON). Αν μεταφραστεί στα αγγλικά, το Greek defaultValue fires fallback. Το θεωρεί "μπακάλικο γειτονιάς". Fix 2026-04-05.

**How to apply:**
- ΠΡΙΝ γράψεις `t('myKey')` → ΠΡΩΤΑ προσθέτεις την key σε `src/i18n/locales/el/*.json` ΚΑΙ `src/i18n/locales/en/*.json`
- Επιτρέπεται μόνο `defaultValue: ''` (empty string — safety net, ποτέ δεν εμφανίζεται)
- Επιτρέπεται template literal με variable: `defaultValue: \`${count} items\`` (dynamic, not literal)
- ΑΠΑΓΟΡΕΥΕΤΑΙ: `defaultValue: 'Προσθήκη Νέου Έργου'`, `defaultValue: 'Ακύρωση'`, `defaultValue: "Add New Project"`, κλπ.

**Enforcement (3 layers — automatic):**
1. **CLAUDE.md SOS. N.11** — top-level rule στο project CLAUDE.md
2. **Pre-commit hook** (`scripts/check-hardcoded-strings.sh`) — μπλοκάρει commits
3. **ESLint rule** (`custom/no-i18n-defaultvalue-literals`) — error στο dev time

Αν προσπαθήσεις να κάνεις commit με violation, ο pre-commit hook θα βγάλει:
```
🚫 COMMIT BLOCKED — Hardcoded i18n defaultValue strings
CLAUDE.md SOS. N.11 violation
```

**ΜΗΔΕΝΙΚΗ ΕΞΑΙΡΕΣΗ.** Ακόμα και "προσωρινά fallbacks" παραβιάζουν τον κανόνα.
