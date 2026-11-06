# HANDOFF — ADR-930 · §3.10 Βήμα Β: κλείσιμο εγγραφών πελάτη στους κανόνες (+ ζωντανός έλεγχος Βήματος Α)

- **Ημερομηνία:** 2026-11-06
- **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` — **§3.10** (νέα) · §4 · §5
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-06_ADR-930_one-writer-one-schema_handoff.md`
- **Ratchet:** `.claude-rules/pending-ratchet-work.md` → «📈 Ευκαιρίες CRM: οι κανόνες επιτρέπουν ακόμη εγγραφή από τον browser + `activities`»

## 1. Κατάσταση (αλήθεια = git + ADR)

Commits στο κλαδί, **ΟΧΙ land / ΟΧΙ push**: `c26c58e4` (§3.8) · `bcafbe9c` (§3.9) · `e30d68d2` (§4 activities) · `e088bec2`
(handoff) · **+ το commit του Βήματος Α §3.10** (αυτό το handoff μπήκε μαζί του — `git log -1`).

**Βήμα Α (έγινε):** δημιουργία / επεξεργασία / διαγραφή ευκαιρίας **μόνο** από τον server, σε ΕΝΑ σχήμα, με ιστορικό.
- `src/services/crm/opportunity-fields-schema.ts` — ΕΝΑ σχήμα (strict), `OPPORTUNITY_EDITABLE_FIELDS`, `OPPORTUNITY_DATE_FIELDS`.
- `src/services/opportunities-server.service.ts` — ο ΕΝΑΣ γραφέας: create (μόνο ανοιχτό στάδιο, κάτοχος = ενεργό μέλος) ·
  update σε συναλλαγή με **σύγκρουση κατά πεδίο** (`expected`, 409 `{ fields, updatedBy }`) · delete με τις τελευταίες τιμές στο ιστορικό.
- Πόρτες: `src/app/api/opportunities/route.ts` (POST) · `[id]/route.ts` (PATCH/DELETE) — `defineRoute`.
- Πελάτης: `opportunities.service.ts` **μόνο διαβάζει** · `crm-mutation-gateway` → `components/crm/opportunity-write/opportunity-write-api.ts`.
- Κοινά: `lib/workspace/active-member-in-transaction.ts` · `services/crm/opportunity-audit-resolvers.server.ts` · `config/crm/opportunity-sources.ts`.
- Ιστορικό: +11 πεδία στο `OPPORTUNITY_TRACKED_FIELDS`, κατάλογος `opportunitySource`.
- Μέτρηση (μόνο ανάγνωση): 9 έγγραφα, όλα με `title` ⇒ καμία μετανάστευση.
- Tests: **κανένα δεν έτρεξε** (χωρίς έγκριση). Έτρεξαν: γεννήτορες i18n, `jscpd:diff` (καθαρό), `rate-limit-policy:baseline`, το hook του commit.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ

### 2.1 Ζωντανός έλεγχος Βήματος Α (μετά από land + push — ΜΟΝΟ με εντολή Giorgio)
Ο Giorgio στο UI: νέα ευκαιρία → επεξεργασία → καρτέλα Ιστορικό (γραμμές `created` / `updated` με ονόματα) · δύο καρτέλες, ίδιο πεδίο ⇒
μήνυμα σύγκρουσης · διαφορετικά πεδία ⇒ περνούν και τα δύο. **ΜΗΝ** εγγραφή/DELETE από πράκτορα σε πραγματική ευκαιρία.

### 2.2 Βήμα Β — χωριστό commit, ΜΕΤΑ το ζωντανό Βήμα Α (οι κανόνες ανεβαίνουν ΠΡΩΤΟΙ, ADR-930 §5)
1. `firestore.rules` `match /opportunities/{opportunityId}`: `allow create, update, delete: if false` (μένει μόνο το `read`).
   Ο κώδικας δεν γράφει πια από τον browser (grep: κανένα `setDoc/updateDoc/deleteDoc` στη συλλογή).
2. Σουίτα κανόνων opportunities (CHECK 3.16): create/update/delete ⇒ deny για όλους τους ρόλους.
3. CHECK 3.114 (`scripts/check-opportunity-stage-authority.js` + self-test + `docs/gates/3.114.md` ⇒ `gate-index:generate`):
   σήμερα Κ2/Κ7 ελέγχουν τη λίστα κλειδώματος του `update`· νέο κριτήριο «ο πελάτης δεν γράφει καθόλου».
   ⚠️ Το `STAGE_OWNED_FIELDS`/`OWNER_OWNED_FIELDS` μένουν (τα χρησιμοποιεί η `crm-mutation-gateway`).
4. ADR-930 §3.10 + changelog · ratchet: αφαίρεση του Βήματος Β.
Τρόπος: Plan Mode, σχέδιο → έγκριση Giorgio → κώδικας. Tests/πύλες μόνο με έγκριση.

## 3. Κρίσιμο context
- Αλλαγή συμπεριφοράς: νέα ευκαιρία μόνο σε **ανοιχτό** στάδιο· η φόρμα δημιουργίας δείχνει ακόμη και κλειστά (πρόταση, όχι εντολή).
- Διαγράφηκαν `src/app/api/opportunities/_service-response.ts` και `src/services/__tests__/opportunities-add-tenant.test.ts`.
- Προσαρμόστηκε `src/services/__tests__/ownership-empty-pair-services.test.ts` (νέα υπογραφή `update(id, { changes, expected }, actor)`) — **δεν έτρεξε**.
- Προϋπάρχοντα κόκκινα jest (ΟΧΙ δικά μας): `email-type-preferences`, `notification-preference-policy`, `ownership-callsite-coverage-anchor`.
- Σύνθετες εντολές git τις αρνείται ο φύλακας worktree ⇒ απλές εντολές. Φρένο `heavy-task.lock`: ποτέ παράκαμψη.
- Προτάσεις χωρίς εντολή: (α) η φόρμα δημιουργίας να δείχνει μόνο ανοιχτά στάδια · (β) η λίστα πηγών ζει ακόμη αυτολεξεί σε
  `config/report-builder/domain-defs-crm.ts` και `components/reports/sections/crm/LeadSourceChart.tsx` ⇒ δέσιμο στο `OPPORTUNITY_SOURCES` ·
  (γ) καθαρισμός κατοπτρικών `name`/`value` στα 8 demo έγγραφα · (δ) `sourceType` (UI/AI/API) στη γραμμή ιστορικού (ADR-195).

## 4. ΜΗΝ
- ΜΗΝ commit στο `main`· commit μόνο στο `agent/crm-pipeline-dnd` με ρητή λίστα· ποτέ `git add -A` / `--no-verify`.
- ΜΗΝ `wt:land` / push χωρίς ρητή εντολή Giorgio.
- ΜΗΝ tests/πύλες χωρίς έγκριση · ΜΗΝ dev server · ΜΗΝ `tsc` · ΜΗΝ μακριά αναμονή στο παρασκήνιο.
- ΜΗΝ ζωντανή εγγραφή/DELETE σε πραγματική ευκαιρία.
- ΜΗΝ κλείσεις τους κανόνες στο ίδιο push με το Βήμα Α.
