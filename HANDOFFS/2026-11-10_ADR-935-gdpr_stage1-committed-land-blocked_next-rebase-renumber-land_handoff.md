# HANDOFF — ADR-935 (ΓΚΠΔ) Στάδιο 1: δεσμευμένο στο κλαδί, LAND ΜΠΛΟΚΑΡΙΣΜΕΝΟ — επόμενο: rebase + αλλαγή αριθμού ADR + land

**Ημερομηνία**: 2026-11-10 · **Worktree**: `C:\Nestor_Worktrees\product-portal` · **Κλαδί**: `agent/product-portal`
**Η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree.** Στο `main` δεν γίνεται commit. `wt:land` και push ΜΟΝΟ με ρητή εντολή Giorgio.

---

## 1. Κατάσταση (μετρημένη)

| | |
|---|---|
| Κορυφή κλαδιού | `d93c5084` fix(gdpr): erasure anonymizes company files… (ADR-935 stage 1) · πάνω σε `36f62771` (ADR-935 πρόταση) · `7c8f3bd0` (pending-ratchet: 14 `'system:…'` εκτός `SYSTEM_IDENTITY`) · `c473cc1d` (handoff Μ-β7) |
| merge-base με main | `f20f669f` |
| Τοπικό `main` HEAD | `ba856147` feat(sales): "sold" only after the final contract is signed (ADR-935) — **ήδη ανεπτυγμένο** (live ba85614) |
| Δικά μου commits στο main | **ΚΑΝΕΝΑ** — το land απέτυχε, push δεν έγινε. Η παραγωγή τρέχει την ΠΑΛΙΑ `gdpr-delete` (σβήνει εταιρικά αρχεία — Ε1). |
| Δέντρο | καθαρό |

## 2. Τα δύο εμπόδια του land

1. **Σύγκρουση rebase** στο `d93c5084`: μοναδικό κοινό αρχείο με το main = **`src/types/i18n.ts`** (ΠΑΡΑΓΟΜΕΝΟ, CHECK 3.33).
   Λύση: πάρε την εκδοχή του main και ξαναπαράγαγε (`npm run generate:i18n-types` + το generator του shell slice — CHECK 3.34),
   ώστε να έχει και τα κλειδιά του main και το δικό μου `audit.actors.erasedSubject`.
2. **🔴 Σύγκρουση αριθμού ADR (CHECK 3.49)**: στο main το **ADR-935** = `ADR-935-sold-means-ownership-passed.md` (άλλη συνεδρία).
   Το δικό μου = `ADR-935-account-level-data-subject-requests.md`. Αλλάζει αριθμό το **λιγότερο αναφερόμενο** = το δικό μου
   (δεν είναι στο main). Βρες τον επόμενο ελεύθερο με `ls docs/centralized-systems/reference/adrs/` **τη στιγμή εκείνη και ξανά
   πριν το commit**, μετακίνησε το αρχείο, και άλλαξε **κάθε** `ADR-935` που αφορά ΓΚΠΔ στα αρχεία του §3 (σχόλια κώδικα, tests,
   ADR-866 changelog, pending-ratchet αν αναφέρεται, adr-index αν υπάρχει γραμμή). ⚠️ ΜΗΝ αγγίξεις το ADR-935 των πωλήσεων.

## 3. Τα αρχεία μου (diff `f20f669f..HEAD`)
`.claude-rules/pending-ratchet-work.md` · `HANDOFFS/2026-11-10_ADR-934_Mb7-live-verified-migrated_next-open-items-decision_handoff.md` ·
`docs/.../adrs/ADR-866-owner-property-dossier.md` · `docs/.../adrs/ADR-935-account-level-data-subject-requests.md` ·
`scripts/lib/listing-model-custody/material-doors-contract.js` · `src/app/api/files/gdpr-delete/route.ts` + `__tests__/gdpr-delete-listing-refresh.test.ts` ·
`src/components/shared/audit/audit-actor.ts` + `__tests__/audit-sub-field-label-and-actor.test.ts` · `src/config/domain-constants.ts` ·
`src/i18n/generated/shell-slice.el.json` · `shell-slice.manifest.json` · `src/i18n/locales/{el,en}/common.json` · `src/lib/admin-batch-utils.ts` ·
`src/lib/files/file-actor-fields.ts` (νέο) · `src/lib/files/system-file-space.ts` · `src/server/files/gdpr-erasure.server.ts` (νέο) +
`__tests__/gdpr-erasure.server.test.ts` (νέο) · `src/services/file-record/file-subject-scan.ts` · `__tests__/file-companion-purge.test.ts` ·
`__tests__/file-hold.test.ts` · `src/types/i18n.ts` · + αυτό το handoff.

## 4. Τι κάνει το Στάδιο 1 (σύνοψη — λεπτομέρειες στο ADR §5.1)
- Εταιρικός χώρος ⇒ **ανωνυμοποίηση** πεδίων δράστη (`FILE_ACTOR_FIELDS`, 9 πεδία, και ένθετο `iso19650Source.overriddenBy`) σε `ERASED_SUBJECT.ID = 'anonymized'`· bytes άθικτα· δέσμευση (hold) ⇒ άθικτο.
- Προσωπικός χώρος ⇒ σβήσιμο bytes + επιτύμβιο `purgedBy: 'gdpr-erasure'` (bytes ΠΡΙΝ το επιτύμβιο· άρνηση ⇒ καμία εγγραφή).
- Σχόλια ⇒ ανωνυμοποίηση συντάκτη · κοινοποιήσεις ⇒ διαγραφή · ίχνος: εταιρικό ανωνυμοποιείται, προσωπικό σβήνεται.
- Δέσμες ≤450 (`commitInChunks` → `flushInBatches` / `deleteInBatches`) · ιδεμπότητο · μερική αποτυχία ⇒ 500 `retryable`.
- UI: `ERASED_SUBJECT.ID` ⇒ «Διαγραμμένος χρήστης» / "Deleted user".
- Ο hook πέρασε (12 σουίτες πράσινες στο commit). Η πύλη 3.76 θέλησε μεταφορά της πόρτας στο `material-doors-contract.js` — έγινε.

## 5. Επόμενα βήματα (ΚΑΘΕ ένα με «ναι» Giorgio)
1. `git rebase main` στο worktree → στη σύγκρουση: `git checkout --theirs`/main εκδοχή του `src/types/i18n.ts` → ξαναπαραγωγή → `git add` → `rebase --continue` (κανονικός hook, ποτέ `--no-verify`).
2. Αλλαγή αριθμού ADR (§2.2) — χωριστό commit με ρητή λίστα αρχείων.
3. `npm run wt:land -- product-portal` → αναφορά commit + νέου main HEAD.
4. Push **μόνο** με «push/στείλε/ανέβασε». ⚠️ Πριν το push έλεγξε `git log origin/main..main` — μπορεί να περιέχει ξένα commits (παλιότερα: `55b4e3ac` ADR-915 §38).
5. Μετά το deploy: ζωντανή επαλήθευση με **δοκιμαστικό** λογαριασμό (ΟΧΙ του Giorgio) — μόνο με «ναι».
6. Εκκρεμεί: μέτρηση read-only Ε7 (εταιρικά αρχεία χωρίς `companyId` που ζουν μόνο από `createdBy`) — μόνο με «ναι».
7. Μετά: στάδια Δ0–Δ5 του ADR (απογραφή → μητρώο+πύλη → ενορχηστρωτής/εξαγωγή → διαγραφή λογαριασμού → εργαλείο διαχειριστή → εκστρατεία).

## 6. ΜΗΝ
- Μην τρέξεις tests/πύλες/jscpd/tsc χωρίς έγκριση (σε προηγούμενη συνεδρία έτρεξα κατά λάθος `jscpd:diff` — καταγράφηκε στο changelog).
- Μην αγγίξεις το ADR-935 των πωλήσεων ούτε ξένα αρχεία του main.
- Μην κάνεις `git stash` χωρίς ετικέτα (κοινή στοίβα με άλλα worktrees).
- Το `firestore` MCP είναι CONNECTION_CLOSED.
