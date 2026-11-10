# HANDOFF — ADR-936 (ΓΚΠΔ) Στάδιο 1: ΖΩΝΤΑΝΟ στην παραγωγή · ζωντανή επαλήθευση: Φάση 0 έγινε · επόμενο: canary Φάσεις 1–7

**Ημερομηνία**: 2026-11-10 · **Worktree**: `C:\Nestor_Worktrees\product-portal` · **Κλαδί**: `agent/product-portal`
Αντικαθιστά: `2026-11-10_ADR-935-gdpr_stage1-committed-land-blocked_next-rebase-renumber-land_handoff.md` (ιστορικό, μην το αλλάξεις).
⏸️ **ΣΕ ΑΝΑΜΟΝΗ** — ο Giorgio μετέφερε την προσοχή στο ADR-929 (αναγνώριση σχεδίων). Συνεχίζεται μόνο με δική του εντολή.

## 1. Κατάσταση (μετρημένη)
- Rebase πάνω στο main → `src/types/i18n.ts` λύθηκε με `--ours` (= main) + `generate:i18n-types` (διαφορά από main: μόνο αποτύπωμα + `erasedSubject`). Shell slice ξαναπαράχθηκε ⇒ ταυτόσημο.
- Αλλαγή αριθμού: ADR ΓΚΠΔ **935 → 936** (`aa524ae6`, 20 γραμμές/13 αρχεία, μόνο σχόλια/τίτλοι tests). Το ADR-935 = πωλήσεις (άλλη συνεδρία) δεν αγγίχτηκε.
- `wt:land` ⇒ main `aa524ae6` · **push έγινε** (`ba856147..aa524ae6`) · live ⊇ `aa524ae6` (deploys `2d78d5c`, `0876de7` — ξένα commits πάνω του).
- ⇒ **Η παραγωγή τρέχει πλέον τη νέα `gdpr-delete`** (ανωνυμοποίηση εταιρικών, σβήσιμο προσωπικών).

## 2. Ζωντανή επαλήθευση — Φάση 0 (read-only) ΕΓΙΝΕ
- 🔐 **Bearer κερδίζει το cookie** (`src/lib/auth/auth-context.ts:256-269`, επαληθευμένο): κλήση με token του canary ⇒ το cookie του Giorgio αγνοείται. Συν `credentials: 'omit'` (ζώνη + τιράντες). **ΠΟΤΕ κλήση από τη συνεδρία του Giorgio χωρίς Bearer canary — θα ανωνυμοποιούσε ΟΛΑ του τα αρχεία.**
- Canary χωρίς claims ⇒ `scope: 'personal'` (auth-context.ts:214-221)· η route δέχεται και τα δύο ⇒ **Επιλογή Α** (πολίτης, όχι μέλος) — επιλέχθηκε.
- Σάρωση εταιρικών = `files` όπου κάποιο από 9 πεδία δράστη == uid (ΧΩΡΙΣ φίλτρο εταιρείας) ⇒ εταιρικό αρχείο με `createdBy = canary` δοκιμάζει το Ε1.
- Συλλογές: `files` · `files_personal` · `file_comments` (`authorId`/`resolvedBy`) · `file_shares` (`createdBy`, σβήνονται) · `file_audit_log` (`performedBy`, ανωνυμοποίηση) · `file_audit_log_personal` (`userId`, σβήσιμο). `ERASED_SUBJECT = { ID:'anonymized', DISPLAY_NAME:'[GDPR ANONYMIZED]' }`. Body: `{confirmPhrase:"DELETE_ALL_MY_DATA"}`.
- Γραφείς για σπορά: αρχείο ⇒ `buildPendingFileRecordData` + `readyFileRecordData` (`src/services/file-record/ready-file-record.server.ts`· προηγούμενο με bytes: `src/server/catalog/media-quarantine.server.ts:187-191`) · κοινοποίηση ⇒ `createShareOnServer` (`src/server/sharing/share-create.ts:149`) · hold ⇒ route `src/app/api/files/[fileId]/hold/route.ts` (ΔΙΑΒΑΣΕ τη) · σχόλιο ⇒ μόνο client (`file-comment.service.ts:81`) ⇒ έγγραφο Admin με το **ίδιο σχήμα** (γρ. 85-96) — αποδεκτό.
- Διαπιστευτήρια: `C:\Nestor_Pagonis\.env.local` (`FIREBASE_SERVICE_ACCOUNT_KEY`, μοτίβο `scripts/audit-missing-auth-claims.js`). Δεν υπάρχει `.env.local` στο worktree. curl → 403 στην άκρη ⇒ κλήσεις μέσω Chrome.

## 3. Επόμενα (ΚΑΘΕ ένα με «ναι» Giorgio · scripts στο scratchpad, ΕΚΤΟΣ repo · δείξε τα ΠΡΙΝ τρέξουν)
1. Canary Auth χρήστης `gdpr-canary-<ημ/νία>@nestorconstruct.invalid` (RFC 2606) + σπορά: 1 εταιρικό αρχείο (bytes), 1 εταιρικό σε hold, 1 προσωπικό (bytes), 1 σχόλιο, 1 κοινοποίηση.
2. Απογραφή «πριν» (read-only, καλεί το `file-subject-scan.ts` — όχι δεύτερη υλοποίηση).
3. Custom token → ID token → `POST /api/files/gdpr-delete` μέσω Chrome με Bearer + `credentials:'omit'`.
4. Απογραφή «μετά»: εταιρικά υπάρχουν + bytes άθικτα + δράστης `anonymized` · hold άθικτο · προσωπικό: bytes σβησμένα + επιτύμβιο `purgedBy:'gdpr-erasure'` · σχόλιο ανωνυμοποιημένο · κοινοποίηση σβησμένη · γραμμή `gdpr_erasure` · UI «Διαγραμμένος χρήστης».
5. Ίδια κλήση ξανά ⇒ 200, μηδέν αλλαγές (ιδεμπότητα).
6. Καθάρισμα: εταιρικό στον κάδο · διαγραφή canary Auth (`getAdminAuth().deleteUser`). Η γραμμή ίχνους μένει.
7. Γραμμή changelog ADR-936 + commit στο κλαδί · land/push μόνο με εντολή.
Μετά: μέτρηση Ε7 (read-only) · στάδια Δ0–Δ5.

## 4. ΜΗΝ
- Tests/πύλες/tsc χωρίς έγκριση · `--no-verify`/`SKIP_*` · ξένα αρχεία · bare `git stash`.
- `firestore` MCP = CONNECTION_CLOSED.
