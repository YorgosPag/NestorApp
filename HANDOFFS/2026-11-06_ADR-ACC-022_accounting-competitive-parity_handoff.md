# HANDOFF — Λογιστική: ισοτιμία με EntersoftOne / Epsilon Net (ADR-ACC-022…029)

**Ημερομηνία:** 2026-11-06 · **Κλαδί:** `agent/accounting-competitive-parity` · **Worktree:** `C:/Nestor_Worktrees/accounting-competitive-parity`
**Η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree.** Στο `main` δεν γίνεται commit. `wt:land` και push ΜΟΝΟ με εντολή Giorgio.

## 0. 🔴 ΠΡΩΤΑ ΑΠΟ ΟΛΑ — ΕΠΙΣΚΕΥΗ (εγκρίθηκε από Giorgio για τη νέα συνεδρία)
Το πρώτο commit στο κλαδί **ΔΕΝ ΕΓΙΝΕ**. Ο pre-commit hook (κάποιο self-test πύλης που στήνει δοκιμαστικό αποθετήριο git — πιθανώς διαρροή `GIT_DIR`/`GIT_INDEX_FILE` στα παιδιά-διεργασίες· η πύλη ΔΕΝ έχει εντοπιστεί) έτρεξε εντολές git στο ΠΡΑΓΜΑΤΙΚΟ αποθετήριο:
- `C:\Nestor_Pagonis\.git\config` → `core.bare=true` ⇒ το main αντίγραφο δεν δουλεύει («must be run in a work tree»).
- Κλαδί `agent/accounting-competitive-parity` → ~15 ψεύτικα commits «base» (δοκιμαστικά `src/a.ts`, `alpha.test.ts`…), index αντικατεστημένο. Το `main` (`3fdb55f5`) ΑΘΙΚΤΟ.

Βήματα:
1. `git -C C:/Nestor_Pagonis config core.bare false` → έλεγξε `git -C C:/Nestor_Pagonis status`.
2. `git -C C:/Nestor_Worktrees/accounting-competitive-parity reset --mixed 3fdb55f5` (τα αρχεία στον δίσκο μένουν) → το `git status` πρέπει να δείχνει ΜΟΝΟ τα 19 αρχεία της §2 + αυτό το handoff. Αν όχι → ΣΤΑΜΑΤΑ και ανέφερε.
3. ΜΗΝ ξαναδοκιμάσεις commit πριν βρεθεί και διορθωθεί η πύλη που διαρρέει (ξεχωριστή εργασία — πρότεινέ την στον Giorgio). ΠΟΤΕ `--no-verify`.
4. Αντίγραφα: οι ίδιες αλλαγές υπάρχουν ακόμη αδέσμευτες στο `C:\Nestor_Pagonis` (main working tree) και ως patch (μόνο tracked): `C:\Users\user\AppData\Local\Temp\claude\1c02e97d58ef4167\c3ce4ff5-701d-4145-80de-92d9e791cc83\scratchpad\acc.patch`. Μετά το επιτυχημένο commit στο κλαδί, ρώτα τον Giorgio πριν καθαρίσεις τα αντίγραφα από το main.
5. Μήνυμα commit έτοιμο: `C:\Users\user\AppData\Local\Temp\claude\1c02e97d58ef4167\c3ce4ff5-701d-4145-80de-92d9e791cc83\scratchpad\commit-msg.txt`. Το `HANDOFFS/*.md` είναι στο `.git/info/exclude` ⇒ `git add -f` για το handoff.

## 1. Στόχος (Giorgio)
Η λογιστική της πλατφόρμας να φτάσει και να ξεπεράσει τους μεγάλους (EntersoftOne, Epsilon Net) για τις μορφές Ατομική, ΟΕ, ΕΕ, ΙΚΕ, ΕΠΕ, ΑΕ, Κοινοπραξία. Πλεονέκτημα: ΜΙΑ πλατφόρμα για όλο τον κατασκευαστικό κλάδο. Ποιότητα full enterprise + full SSoT, χωρίς εκπτώσεις· όπου υπάρχει αβεβαιότητα → έρευνα στο διαδίκτυο, όχι μαντεψιά.

## 2. Τι έγινε (στο κλαδί)
- **ADR (PROPOSED)** στο `src/subapps/accounting/docs/adrs/`: ACC-022 ομπρέλα (Πυλώνας Α = πυρήνας, Πυλώνας Β = κατασκευαστικό πλεονέκτημα, §8 = επαληθευμένο νομικό πλαίσιο με πηγές), ACC-023 Ατομική, 024 ΟΕ, 025 ΕΕ, 026 ΙΚΕ, 027 ΕΠΕ, 028 ΑΕ, 029 Κοινοπραξία. README ενημερωμένο· ACC-001 → PARTIAL.
- **Κώδικας:**
  - ΕΦΚΑ 2026 = ΦΕΚ Β' 318/2026 + εγκ. 5/2026· υγεία ανά κατηγορία (`healthContributionByMainCategory`) — `services/config/efka-config.ts`, `types/efka.ts`.
  - Τέλος επιτηδεύματος ατομικής = 0 (2024+) — `services/config/tax-config.ts`, `types/tax.ts`.
  - Σχόλια: `types/entity.ts`, `services/engines/tax-engine.ts`.
  - `tax-engine.test.ts`: 650→0 — **76/76 πράσινα** (εγκεκριμένο τρέξιμο).

## 3. Επόμενα βήματα (σειρά — καθένα ΜΟΝΟ με έγκριση Giorgio)
1. **Test για τον υπολογισμό ΕΦΚΑ 2026** (`buildMonthlyBreakdown` στο `efka-config.ts`) — δεν υπάρχει κανένα σήμερα· το πράσινο του tax-engine ΔΕΝ το καλύπτει.
2. **Φόρος ΟΕ/ΕΕ** (ACC-024 §6): ο `calculatePartnershipTax` (`services/engines/tax-engine.ts`) φορολογεί διαφανώς ανά εταίρο· ο νόμος (ν.4172 άρθρα 45 §1β, 47) = οντότητα 22%. Πριν τον κώδικα χρειάζονται απαντήσεις (λογιστής ή επίσημη πηγή): (α) προκαταβολή ΟΕ 55% ή 80%; (β) αφαιρούνται οι εισφορές ΕΦΚΑ εταίρων από τα κέρδη της εταιρείας; (γ) 5% στη διανομή όταν τηρεί διπλογραφικά; Αλλάζει σχήμα αποτελέσματος → τύποι/UI/API/tests (>5 αρχεία) → Plan Mode.
3. **Πυλώνας Α** (ACC-022 §4.1), με αυτή τη σειρά:
   - **Α1 🔴 προθεσμία 31/01/2027**: σύνδεση με πιστοποιημένο πάροχο ηλεκτρ. τιμολόγησης (Φάση 2 από 02/11/2026, Α.1197/2026· από 01/02/2027 όχι διαβίβαση μέσω ERP).
   - Α2 myDATA πραγματικό (ACC-003).
   - Α3 διπλογραφικό καθολικό ΕΛΠ (ACC-001 Layer 3) — προϋπόθεση για ΙΚΕ/ΕΠΕ/ΑΕ/Κοινοπραξία.
   - Μετά: ΕΕ (επέκταση ΟΕ), ΙΚΕ (επέκταση ΕΠΕ), Κοινοπραξία, Πυλώνας Β.
4. Ανοιχτά νομικά ερωτήματα: ACC-022 §6.

## 4. Κρίσιμο πλαίσιο
- Κώδικας λογιστικής: `src/subapps/accounting` (355 αρχεία). Βιβλίο σήμερα = απλογραφικό για ΟΛΕΣ τις μορφές· το «ισοζύγιο» ομαδοποιεί κατηγορίες, όχι λογαριασμούς.
- Μορφές στον κώδικα: `types/entity.ts:19` (`sole_proprietor|oe|epe|ae`)· SSoT φορολογικού προφίλ: `services/tax/entity-tax-profile.ts`· κλίμακες: `services/config/tax-config.ts` (`GREEK_TAX_SCALES`).
- Οι πηγές της έρευνας διαβάστηκαν μέσω περίληψης (WebFetch)· «◐» στο ACC-022 §8 = δευτερογενής πηγή.
- Τα ποσά ΕΦΚΑ 2025 ΔΕΝ έχουν επαληθευτεί.

## 5. ΜΗΝ
- ΜΗΝ αλλάξεις τον `calculatePartnershipTax` πριν απαντηθούν τα (α)(β)(γ).
- ΜΗΝ τρέξεις tests / tsc / πύλες χωρίς έγκριση (CLAUDE.md N.(-2), N.17).
- ΜΗΝ κάνεις commit στο `main`, `wt:land` ή push χωρίς εντολή.
- ΜΗΝ γράψεις κώδικα χωρίς πρώτα SSoT audit (grep) για υπάρχοντα κώδικα.
