# HANDOFF — ADR-930 · Τι(1) + Τι(2): ΕΝΑΣ γραφέας με ιστορικό + ΕΝΑ σχήμα ευκαιρίας

- **Ημερομηνία:** 2026-11-06
- **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` (§3.7 · §3.8 · §3.9 · **§4**)
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-05_ADR-930_leadslist-delete-activities_handoff.md` (εκεί και η ζωντανή απόδειξη §3.8 — §2.3)
- **Ratchet:** `.claude-rules/pending-ratchet-work.md` → «📈 Ευκαιρίες CRM…» — μένουν Τι (1) (2) (4)
- **Τρόπος (απόφαση Giorgio):** **Plan Mode**, όχι orchestrator. Έρευνα + audit + μέτρηση → σχέδιο → **ΣΤΑΜΑΤΑΣ για έγκριση** πριν τον κώδικα.

## 1. Κατάσταση (αλήθεια = git + ADR)

Commits στο κλαδί, **ΟΧΙ land / ΟΧΙ push**:
- `c26c58e4` — §3.8 μεταβίβαση κατόχου (Τι 6 + Τι 5).
- `bcafbe9c` — §3.9 ο ίδιος κριτής σε κάθε οθόνη (Τι 3): `LeadCard` (επεξεργασία + διαγραφή) και `QuickActions` (επεξεργασία)
  ρωτούν `useOpportunityAccess` / `useOpportunityLocks`· εξαγωγή `LockableAction` στο `OpportunityCardParts.tsx` (η ΜΙΑ μορφή
  «ορατό, απενεργό, με λόγο»· το `CardAction` τη χρησιμοποιεί).
- `e30d68d2` — §4 `activities` (Τι 4): πολιτική αποφασίστηκε (ανατεθειμένος αλλάζει, δεν διαγράφει)· υλοποίηση αναβάλλεται
  μέχρι την πρώτη οθόνη δραστηριοτήτων **πάνω στον γραφέα του Τι(1)**. Συλλογή μετρημένη: 0 έγγραφα, καμία οθόνη, μόνος
  γραφέας το AI pipeline (`ALLOWED_WRITE_COLLECTIONS` στο `src/services/ai-pipeline/tools/executor-shared-types.ts`).

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — Τι(1) + Τι(2)

### Το πρόβλημα (από το ratchet)
- **Τι(1)**: δημιουργία / επεξεργασία (σημειώσεις, αξία, επαφή…) / διαγραφή ευκαιρίας γράφονται από τον browser μέσω
  `src/services/opportunities.service.ts` (client SDK `setDoc`/`updateDoc`/`deleteDoc`) ⇒ **καμία γραμμή ιστορικού** (ADR-195).
  Το CHECK 3.17 δεν το πιάνει (η συλλογή ονομάζεται `OPPORTUNITIES_COLLECTION`, όχι `COLLECTIONS.OPPORTUNITIES`). Το **στάδιο**
  και ο **κάτοχος** έχουν ήδη έναν γραφέα με ίχνος (πόρτες `…/stage`, `…/owner`)· τα υπόλοιπα όχι.
- **Τι(2)**: `src/services/opportunities-server.service.ts` (Admin, `POST/PATCH/DELETE /api/opportunities`) γράφει **άλλο
  σχήμα**: `name`/`value`/`leadId` αντί για `title`/`estimatedValue`/`contactId` (`types/crm.ts`) ⇒ ό,τι γεννά ο server
  φαίνεται λάθος στον πίνακα (κενός τίτλος, χωρίς αξία).

### Μετρημένο μέγεθος (2026-11-06)
- Client service (137 γρ.) — 7 καταναλωτές: `components/crm/hooks/useOpportunities.ts` · `crm/leads/lead-detail/hooks/useLead.ts` ·
  `crm/leads/lead-detail/hooks/useContactOpportunities.ts` · `leads/hooks/useLeadsList.ts` · `crm/dashboard/TasksTab.tsx` ·
  `crm/tasks/TasksPageContent.tsx` · `services/crm/crm-mutation-gateway.ts`.
- Server service (261 γρ.) — καλούντες: `app/api/opportunities/route.ts` · `app/api/opportunities/[id]/route.ts` + δύο test
  ιδιοκτησίας (`lib/auth/__tests__/_harness/ownership-callsite-contract.ts`, `ownership-callsite-coverage-anchor.test.ts`,
  `services/__tests__/ownership-empty-pair-services.test.ts`).
- Εκτίμηση: ~12–15 αρχεία, 3 τομείς (οθόνη/hooks · server · κανόνες/πύλες). Ρίσκο μεσαίο-υψηλό.

### Σειρά εργασίας στη νέα συνεδρία
1. **Έρευνα στο διαδίκτυο**: πώς κάνουν οι μεγάλοι (Salesforce / HubSpot / Pipedrive — και Figma/Linear για τον «έναν
   γραφέα») το «κάθε αλλαγή εγγραφής περνά από τον server και αφήνει ιστορικό πεδίου» (Salesforce Field History Tracking,
   HubSpot property history). Αναζήτησε και κάτι εξυπνότερο (π.χ. ένα ιστορικό με διαφορές πεδίων + ποιος/πότε/από πού).
2. **SSoT audit με `git grep`** — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ό,τι υπάρχει:
   - πόρτες `app/api/opportunities/[id]/stage` + `…/owner` (πρότυπο: `defineRoute`, `requireOpportunityAccess`, CAS
     `versionedWrite`, `recordEntityUpdate`)· γραφείς `opportunity-owner-transfer.server.ts` / γραφέας σταδίου.
   - `services/crm/opportunity-access.ts` (κριτής, προθέσεις `edit`/`delete`/`transfer`) · `crm-mutation-gateway.ts`.
   - `src/services/entity-audit.service.ts` (ADR-195) · `enterprise-id.service` (N.6: `setDoc` + ID, ποτέ `addDoc`).
   - `.opportunity-stage-authority.json` + CHECK 3.114 (`docs/gates/3.114.md`).
3. **Μέτρηση δεδομένων** (μόνο ανάγνωση, Firestore MCP `firestore_count` / `firestore_query`): πόσα έγγραφα `opportunities`
   έχουν `name`/`value`/`leadId` χωρίς `title`/`estimatedValue`/`contactId` ⇒ χρειάζεται μετανάστευση ή ανάγνωση-και-των-δύο;
   Και ποιος καλεί σήμερα `POST /api/opportunities` (AI pipeline; MCP; κάποια οθόνη;).
4. **Σχέδιο** (Plan Mode) → **ΣΤΑΜΑΤΑ για έγκριση Giorgio**. Πρόταση-βάση από το ratchet: ΕΝΑ σχήμα (το του πελάτη,
   `types/crm.ts`), όλες οι εγγραφές μέσω server routes με `recordEntityUpdate` (όπως το στάδιο), μετά οι κανόνες κλείνουν
   το client write (`allow update: if false`, όπως οι άλλες συλλογές «ενός γραφέα»)· ενημέρωση `.opportunity-stage-authority.json`
   (το `opportunities.service.ts` φεύγει από τους κατόχους). Σειρά ανάπτυξης: οι κανόνες ανεβαίνουν **ΠΡΩΤΟΙ** (ADR-930 §5,
   `docker-build.yml` `needs: firebase-apply`) ⇒ ο νέος κώδικας πρέπει να δουλεύει **πριν** κλείσουν οι κανόνες.
5. Μετά την έγκριση: υλοποίηση → ADR-930 (νέα § + changelog) → αφαίρεση Τι(1)/(2) από το ratchet → `npm run jscpd:diff` →
   commit στο κλαδί με ρητή λίστα.

## 3. Κρίσιμο context
- Ο κριτής δεν ονομάζει ρόλο (CHECK 3.68). `requireOpportunityInTenant` έχει ΕΝΑΝ καλούντα· `applyOpportunityOwnerTransfer`
  έναν (πόρτα `…/owner`) — CHECK 3.114.
- Εισαγωγή από `components/network-messaging/*` σε οθόνη CRM σπάει τον γεννήτορα shell slice. Για αρχικά: `getInitials`.
- Νέα route με `defineRoute` ⇒ `npm run rate-limit-policy:baseline` · νέα κλειδιά locale ⇒ `generate:i18n-types` +
  `generate:i18n-shell-slice` · αλλαγή `docs/gates/*.md` ⇒ `gate-index:generate`.
- Σύνθετες εντολές git τις αρνείται ο φύλακας worktree ⇒ απλές εντολές, `git -C <worktree>`. `git grep` με επιλογές ΠΡΙΝ το pattern.
- Φρένο βαριών εργασιών (`C:\Users\user\.claude\heavy-task.lock`): αν μπλοκάρει, κάνε άλλη δουλειά και ξαναδοκίμασε — ΠΟΤΕ παράκαμψη.
- ⚠️ Προϋπάρχοντα κόκκινα jest (ΟΧΙ δικά μας): `email-type-preferences`, `notification-preference-policy`,
  `ownership-callsite-coverage-anchor` (19 αταξινόμητα) — το τελευταίο **αφορά** το server service· μην το «διορθώσεις» χωρίς εντολή.
- Ανοιχτά σημεία που είδα, **χωρίς εντολή** (μόνο πρόταση): το AI γράφει σε `activities` που δεν διαβάζει κανείς · το
  `LeadCard` δείχνει ωμό `lead.stage` αντί μεταφρασμένου.

## 4. ΜΗΝ
- ΜΗΝ commit στο `main`· commit μόνο στο `agent/crm-pipeline-dnd` με ρητή λίστα αρχείων· ποτέ `git add -A` / `--no-verify`.
- ΜΗΝ `wt:land` / push χωρίς ρητή εντολή Giorgio.
- ΜΗΝ tests/πύλες χωρίς έγκριση (N.(-2)) · ΜΗΝ dev server · ΜΗΝ `tsc` · ΜΗΝ μακριά αναμονή στο παρασκήνιο.
- ΜΗΝ ζωντανό `DELETE` ή εγγραφή σε πραγματική ευκαιρία — η μέτρηση δεδομένων είναι **μόνο ανάγνωση**.
- ΜΗΝ κώδικα πριν την έγκριση του σχεδίου.
