# HANDOFF — ADR-930 · Τι(3) LeadsList delete → Τι(4) activities (+ ζωντανή απόδειξη §3.8 όταν γίνει land)

- **Ημερομηνία:** 2026-11-05
- **Worktree:** `C:\Nestor_Worktrees\crm-pipeline-dnd` · **Κλαδί:** `agent/crm-pipeline-dnd`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-930-crm-pipeline-stage-drag-drop.md` (§3.7 · **§3.8** · §4 · §6)
- **Προηγούμενο handoff:** `HANDOFFS/2026-11-05_ADR-930_owner-transfer_handoff.md`
- **Ratchet:** `.claude-rules/pending-ratchet-work.md` → «📈 Ευκαιρίες CRM…» — μένουν Τι (1) (2) (3) (4)

## 1. Κατάσταση (αλήθεια = git + ADR)

✅ **Τι(6) + Τι(5) ΕΚΛΕΙΣΑΝ στο κλαδί** (ADR-930 §3.8, commit του κλαδιού — `git log -1`). **ΔΕΝ** έχει γίνει land/push.
- Μία πόρτα κατόχου `GET|POST /api/opportunities/[id]/owner` · πρόθεση `transfer` στον κριτή (`opportunity-access.ts`:
  κάτοχος ∨ ικανότητα) · καθαρός πυρήνας `opportunity-owner-transfer.ts` (`planOwnerTransfer`, `OWNER_OWNED_FIELDS`) ·
  γραφέας `opportunity-owner-transfer.server.ts` (CAS, ενεργό μέλος, ιστορικό με ονόματα) · ειδοποίηση
  `opportunity-owner-notifier.ts` (`crm.opportunityAssigned`) · UI `src/components/crm/owner/*` + `extraFields` στο
  `OpportunityFormDialog`.
- Κλειστά: κανόνες (`assignedTo`/`createdBy`/`ownerHandoffNote` κλειδωμένα) · gateway · `PATCH` αρνείται `assignedTo`.
- CHECK 3.114 Κ7. Κανόνες 128/128 · jest κριτή/πυρήνα/πύλης πράσινα · `jscpd:diff` καθαρό.
- ⚠️ Προϋπάρχοντα κόκκινα jest (ΟΧΙ δικά μας): `email-type-preferences`, `notification-preference-policy`
  (`procurement.supplyConnection`), `ownership-callsite-coverage-anchor` (19 αταξινόμητα). Μην τα «διορθώσεις» χωρίς εντολή.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — σειρά εγκεκριμένη από Giorgio: **Τι(3) → Τι(4)**

### 2.1 Τι(3) — LeadsList delete
- `src/components/leads/LeadsList.tsx` · `hooks/useLeadsList.ts` (→ `deleteOpportunityWithPolicy`) δείχνουν «Διαγραφή» σε όλους.
- Fix: ρωτά τον ΙΔΙΟ κριτή — `useOpportunityAccess` + `useOpportunityLocks` (`src/components/crm/stage-move/useOpportunityAccess.ts`)
  + `CardAction` με λόγο, όπως η κάρτα του πίνακα. Ίδιο έλεγχο για `LeadDetailPageContent.tsx` / `PipelineTab.tsx`.
- Πριν τον κώδικα: έρευνα (HubSpot/Salesforce/Pipedrive: κρυμμένο vs απενεργό κουμπί με λόγο) + SSoT audit με `git grep`.

### 2.2 Τι(4) — `activities`
**Απόφαση Giorgio ΠΡΙΝ τον κώδικα**: ενημερώνει ο ανατεθειμένος τις δραστηριότητές του; (HubSpot/Salesforce: ο owner του
record επεξεργάζεται τις δικές του). Παρουσίασε έρευνα + πρόταση, και **σταμάτα** για απόφαση.

### 2.3 Όταν ο Giorgio δώσει εντολή land + push — ζωντανή απόδειξη §3.8 (nestorconstruct.gr)
Με `internal_user` `georgios.pagonis+staff@gmail.com` (uid `jlWQL73MyuXxMRVIa13RbmfDtYT2`):
(α) ξένη ευκαιρία: πεδίο «Κάτοχος» απενεργό με λόγο, `POST …/owner` → 403 · (β) δική του («Αναζήτηση διαμερίσματος έως
180.000 €», `opp_a1f20034-851a-4b54-bee5-c367444709ca`): μεταβίβαση → 200, ειδοποίηση, ιστορικό με ονόματα · (γ) κονσόλα browser
`updateDoc` σε `assignedTo`/`createdBy` → PERMISSION_DENIED. ⚠️ Ο νέος κάτοχος πρέπει να είναι **ενεργό μέλος** του χώρου:
αν ο super_admin (`WKBWEg3DSfcdSbLNJfzGEW3vkct1`) δεν είναι μέλος της εταιρείας, δεν θα εμφανιστεί — σωστό, όχι σφάλμα.
Πρώτα ανεβαίνουν οι κανόνες (`firebase-production`, CHECK 3.86). **ΚΑΝΕΝΑ DELETE.**

## 3. Κρίσιμο context
- Ο κριτής δεν ονομάζει ρόλο (CHECK 3.68). `requireOpportunityInTenant` έχει ΕΝΑΝ καλούντα· `applyOpportunityOwnerTransfer`
  έναν (πόρτα `…/owner`) — CHECK 3.114.
- Εισαγωγή από `components/network-messaging/*` σε οθόνη CRM φέρνει το namespace `network-messaging` στο route slice ⇒ ο
  γεννήτορας shell slice αποτυγχάνει (77 σφραγισμένα). Για αρχικά: `getInitials` (`@/types/contacts/helpers`).
- Νέα route με `defineRoute` ⇒ `npm run rate-limit-policy:baseline` · νέα κλειδιά locale ⇒ `generate:i18n-types` +
  `generate:i18n-shell-slice` · αλλαγή `docs/gates/*.md` ⇒ `gate-index:generate` (γράφει τον πίνακα του `CLAUDE.md`).
- Σύνθετες εντολές git τις αρνείται ο φύλακας worktree ⇒ απλές εντολές. Αναζήτηση με `git grep` (επιλογές ΠΡΙΝ το pattern).

## 4. ΜΗΝ
- ΜΗΝ commit στο `main`· commit μόνο στο `agent/crm-pipeline-dnd` με ρητή λίστα αρχείων· ποτέ `git add -A` / `--no-verify`.
- ΜΗΝ `wt:land` / push χωρίς ρητή εντολή Giorgio.
- ΜΗΝ tests/πύλες χωρίς έγκριση (N.(-2)) · ΜΗΝ dev server · ΜΗΝ `tsc` · ΜΗΝ μακριά αναμονή στο παρασκήνιο.
- ΜΗΝ ζωντανό `DELETE` σε πραγματική ευκαιρία.
- Πριν το «done»: `npm run jscpd:diff <αρχεία>` + ADR-930 changelog + αφαίρεση ό,τι έκλεισε από το `pending-ratchet-work.md`.
