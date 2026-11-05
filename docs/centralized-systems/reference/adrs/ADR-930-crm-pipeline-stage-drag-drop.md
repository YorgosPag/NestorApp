# ADR-930 — Ροή πωλήσεων CRM: αλλαγή σταδίου με σύρσιμο, ΕΝΑΣ γραφέας σταδίου

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED — Φ1 θεμέλιο server · Φ2 `KanbanBoard` · Φ3 οθόνη · Φ4 κλείδωμα + CHECK 3.114 · §3.7 εξουσία κατόχου (κλαδί `agent/crm-pipeline-dnd`, 2026-11-04) |
| **Date** | 2026-11-04 |
| **Category** | CRM / Sales Pipeline |
| **Canonical Location** | `src/config/crm/opportunity-stages.ts` · `src/services/crm/opportunity-stage-transition*.ts` · `src/components/ui/sortable/KanbanBoard.tsx` · `src/components/crm/stage-move/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-195 (ιστορικό οντοτήτων) · ADR-812 (λεξιλόγια τομέα, CHECK 3.73) · ADR-872 (ιδεμποτία) · ADR-923 §5.2 (`VariantLevelBoard`) · ADR-602 (`defineRoute`) · ADR-298 (κανόνες) |

---

## 1. Το πρόβλημα

Ο πίνακας «Ενδιαφερόμενοι» / «Ροή Πωλήσεων» (ένα `PipelineTab → OpportunityColumns`, δύο σελίδες) έδειχνε στήλες σταδίων
αλλά οι κάρτες **δεν σέρνονταν**. Σε κάθε μεγάλο CRM (Pipedrive, HubSpot, Salesforce Kanban, Zoho) το σύρσιμο ανάμεσα σε
στήλες **είναι** ο τρόπος να αλλάξει στάδιο μια ευκαιρία. Η αναγνώριση βρήκε τρία θεμελιώδη προβλήματα πίσω από την οθόνη:

1. **Δύο ασύμβατα λεξιλόγια σταδίων** — τύπος/οθόνη/δεδομένα: `initial_contact … closed_won/closed_lost`· server
   (`opportunities-server.service.ts`): `lead/qualified/proposal/negotiation/won/lost`. Ο server **απέρριπτε κάθε
   πραγματικό στάδιο**. Έξι ακόμη δηλώσεις του ίδιου λεξιλογίου ήταν διάσπαρτες χωρίς δεσμό.
2. **Το στάδιο γραφόταν από τον browser απευθείας** (`updateDoc`, μέσω `crm-mutation-gateway` που δεν επέβαλλε τίποτα),
   από το MCP (λίστα απευθείας εγγραφής) και από το `PATCH` του server — χωρίς CAS, χωρίς ιδεμποτία, χωρίς επικύρωση.
3. **Μηδέν ιστορικό**: το `opportunity` δεν ήταν στο μητρώο ιστορικού (ADR-195).

## 2. Η απόφαση (πρακτική μεγάλων — έρευνα HubSpot / Pipedrive / Salesforce)

| Θέμα | Απόφαση | Πηγή πρακτικής |
|---|---|---|
| Σύρσιμο | Ανάμεσα σε στήλες = αλλαγή σταδίου. **Καμία** χειροκίνητη σειρά μέσα στη στήλη· ταξινόμηση με κανόνα ανά χρήστη | Pipedrive/HubSpot/Salesforce Kanban |
| Κλείσιμο ως επιτυχία | Διάλογος: τελικό ποσό + ημερομηνία (προσυμπληρωμένα). Άκυρο ⇒ η κάρτα γυρίζει | HubSpot «closed won» properties |
| Κλείσιμο ως απώλεια | Λόγος από **κλειστό κατάλογο** + προαιρετικό σχόλιο· και η απώλεια έχει ημερομηνία κλεισίματος | HubSpot/Pipedrive lost reason (dropdown, όχι κείμενο) |
| Πιθανότητα | Η αλλαγή σταδίου τη θέτει στην προεπιλογή του σταδίου· ο άνθρωπος τη διορθώνει από τη φόρμα | Salesforce Stage → Probability |
| Επανάνοιγμα | Επιτρέπεται με επιβεβαίωση· σβήνουν τα στοιχεία κλεισίματος· `reopenCount + 1` | Pipedrive (+ διόρθωση του παραπόνου ότι χαλά τις αναφορές) |
| Παγωμένη κάρτα | «Χ μέρες στο στάδιο», με όριο ανά στάδιο· κείμενο + χρώμα | Pipedrive rotting |
| Κεφαλίδα στήλης | Πλήθος · σύνολο · **σταθμισμένο** (αξία × πιθανότητα) | Salesforce expected revenue |
| Δικαίωμα | **Κάτοχος** (§3.7): ο διαχειριστής (ικανότητα `crm:opportunities:update`) όλες· ο ανατεθειμένος και ο δημιουργός τις δικές τους. Ο πίνακας δεν σέρνει ό,τι θα απορριφθεί — κλειδαριά με το όνομα του κατόχου | Salesforce Record Owner · HubSpot «Owned only» · Pipedrive deal owner · ADR-801 |

**Πέρα από τους μεγάλους** (εκεί όπου εκείνοι κάνουν last-write-wins):

- **Σύγκρουση κατά ΠΕΔΙΟ**: ο πελάτης στέλνει `expectedStage` (το στάδιο που **είδε**). Αν άλλος μετακίνησε την κάρτα στο
  μεταξύ ⇒ 409 με το πραγματικό στάδιο, η κάρτα επιστρέφει και ο άνθρωπος μαθαίνει **πού** βρίσκεται. Μια άσχετη αλλαγή
  (σημείωση) **δεν** ακυρώνει τη μετακίνηση — όπως θα έκανε έλεγχος έκδοσης όλου του εγγράφου.
- **Αναίρεση με CAS** (Gmail): μετά από μετακίνηση ανοιχτό→ανοιχτό, «Αναίρεση» που στέλνει πίσω με `expectedStage = νέο`.
  Κλείσιμο/επανάνοιγμα δεν έχουν αναίρεση: ήταν ήδη συνειδητή πράξη με διάλογο, και αναίρεση εκεί θα μετρούσε ψευδές
  επανάνοιγμα.
- **Ζωντανός πίνακας**: `useRealtimeOpportunities` + αισιόδοξη εικόνα που κλαδεύεται όταν την προλάβει η αλήθεια.
- **Μία μετακίνηση ανά κάρτα τη φορά**: η κάρτα κλειδώνει όσο πετά το αίτημα, αλλιώς η δεύτερη θα έστελνε `expectedStage`
  που ο server δεν έχει γράψει ακόμη (ψευδής σύγκρουση).

## 3. Αρχιτεκτονική

### 3.1 Μία ρίζα λεξιλογίου — `src/config/crm/opportunity-stages.ts`

`OPPORTUNITY_STAGE_IDS` (tuple, ρίζα του CHECK 3.73) + `Record<OpportunityStage, traits>` (`kind: open|won|lost`,
`defaultProbability`, `staleAfterDays`). Το `status` **παράγεται** (`STATUS_OF_STAGE_KIND`), ποτέ ανεξάρτητο. Δεμένες στη
ρίζα: `types/crm.ts`, server service, `status-helpers` (`LeadStageValue`), `ContactCard`, `AdvancedFilters`, lead-detail,
report-builder, executive report. Λόγοι απώλειας: `src/config/crm/opportunity-lost-reasons.ts`.

### 3.2 Ένας κανόνας, δύο εκτελεστές

- `services/crm/opportunity-stage-transition.ts` — **καθαρός** `planStageTransition(current, request, nowIso)` →
  `unchanged | invalid | apply { set, clear, reopened }`. Δηλώνει και το `STAGE_OWNED_FIELDS` (τη ΜΙΑ λίστα πεδίων της πόρτας).
- `services/crm/opportunity-stage-transition.server.ts` — ο ΕΝΑΣ γραφέας: Admin `runTransaction` (ανάγνωση → CAS στο
  `expectedStage` → εγγραφή με `versionedWrite`/`_v` → `FieldValue.delete()` για τα μπαγιάτικα στοιχεία κλεισίματος) και
  μετά το commit `recordEntityUpdate({ action: 'status_changed' })`.
- `POST /api/opportunities/[id]/stage` — `defineRoute` · `requireOpportunityAccess` (φράχτης + κάτοχος, §3.7) ·
  `rateLimit: 'sensitive'` · ιδεμποτία αυτόματα από το `withAuth`. Σχήμα: `opportunity-stage-schema.ts` (zod, δεμένο στους
  καταλόγους· ο τύπος του **είναι** ο τύπος του πυρήνα).
- Το γενικό `PATCH /api/opportunities/[id]` **αρνείται** το `stage` (400) αντί να το αγνοήσει.

### 3.3 Κεντρικός πίνακας στηλών — `src/components/ui/sortable/KanbanBoard.tsx`

Δίπλα στο `SortableList`/`SortableTree`, με τους **ίδιους** αισθητήρες (`useSortableSensors`, γενικεύτηκε να δέχεται
πλοήγηση πληκτρολογίου) και την ίδια κίνηση (`useDragTransform`). Καθαρός πυρήνας `kanban-model.ts`. Ο πίνακας **αναφέρει**
(`onMove(item, from, to)`), δεν αποφασίζει. Μη επιτρεπτές στήλες θολώνουν όσο σέρνεις· ←/→ πηγαίνουν στη γειτονική
επιτρεπτή στήλη· ανακοινώσεις `common:kanban.*`· το κλικ που ακολουθεί τη ρίψη καταπίνεται (αλλιώς η κάρτα θα «άνοιγε»).
Το `VariantLevelBoard` του καταλόγου (ADR-923 §5.2) μεταφέρθηκε πάνω του — ένας πίνακας στηλών αντί για δύο.

### 3.4 Η εντολή — `src/components/crm/stage-move/`

`useStageTransitionCommand` (ΜΙΑ εντολή για πίνακα, «Μετακίνηση σε…» και φόρμα επεξεργασίας) · `useStageDialogs`
(διάλογοι ως υποσχέσεις) · `CloseOpportunityDialog` / `StageMoveDialogs` · `useOptimisticStages` · `stage-move-api`.
Η `EditOpportunityModal` αφαιρεί το `stage` από τα πεδία της φόρμας και το περνά από την ίδια εντολή.

### 3.5 Κλείδωμα — τέσσερις δρόμοι, μία πόρτα

| Δρόμος | Φραγμός |
|---|---|
| Browser (client SDK) | `firestore.rules`: `affectedKeys().hasAny(STAGE_OWNED_FIELDS)` ⇒ deny· `crm-mutation-gateway` αρνείται τα ίδια πεδία |
| Server (Admin SDK) | CHECK 3.114 Κ1: κάθε αρχείο που ονομάζει τη συλλογή δηλωμένο με λόγο (`.opportunity-stage-authority.json`) |
| MCP | `opportunities` αφαιρέθηκε από το `WRITE_ALLOWED_COLLECTIONS` (προηγούμενο: `floors`, CHECK 3.102) — CHECK 3.114 Κ3 |
| AI pipeline | Δεν είναι στο `ALLOWED_WRITE_COLLECTIONS` — CHECK 3.114 Κ4 το κρατά έτσι |

### 3.6 Ιστορικό (ADR-195)

`opportunity` στο `audit-entity-registry.ts` (`server-direct`, βιβλίο `company`) · `OPPORTUNITY_TRACKED_FIELDS` (χωρίς
`status`: παράγωγο) · κατάλογοι `opportunityStage` / `opportunityLostReason` (camelCase, CHECK 3.14) · `OPPORTUNITIES` στο
CHECK 3.17. Η δήλωση αποκάλυψε ότι οι create/update/delete του `opportunities-server.service.ts` **δεν άφηναν ίχνος** —
διορθώθηκαν (το `recordEntityUpdate` δέχεται πλέον `AuditActor`, στενότερο από το `AuthContext`).

### 3.7 Εξουσία κατόχου — ποιος κινεί / επεξεργάζεται / σβήνει (απόφαση Giorgio 2026-11-04)

| Πρόθεση | Επιτρέπεται σε | `firestore.rules` `match /opportunities` |
|---|---|---|
| `edit` (στάδιο + πεδία) | bypass · ικανότητα `crm:opportunities:update` (εντός μισθωτή) · δημιουργός · **ανατεθειμένος** | `crmWriterIsPrivileged ∨ (crmIsAssignee ∧ crmNotForeignTenant)` |
| `delete` | bypass · ικανότητα · δημιουργός — **όχι** ο ανατεθειμένος | `crmWriterIsPrivileged` |

- **Ένας κριτής, ισομορφικός**: `src/services/crm/opportunity-access.ts` — `decideOpportunityAccess({ subject, opportunity, intent })`
  (καθαρός, χωρίς I/O, πρότυπο AuthZEN του `lib/auth/container-access.ts`) + `canEditOpportunity`. Ετυμηγορίες
  `granted-capability | granted-creator | granted-assignee | denied-foreign-tenant | denied-not-owner`, μαζί με `ownerUid`
  (ανατεθειμένος, αλλιώς δημιουργός). Η ικανότητα κρίνεται **μόνο** από τον `decideCapability` — κανένα όνομα ρόλου (CHECK 3.68).
  Ικανότητα εταιρείας **δεν** πιάνει legacy έγγραφο χωρίς `companyId` (όπως το `crmIsCompanyAdmin`).
- **Ένα σημείο επιβολής στον server**: `opportunity-access.server.ts` → `requireOpportunityAccess` = φράχτης μισθωτή (404) και
  μετά ο κριτής ⇒ 403 `{ errorCode: 'OPPORTUNITY_NOT_OWNER', reason, ownerUid }`. Το καλούν η πόρτα σταδίου (`edit`), το
  `PATCH` (`edit`) και το `DELETE` (`delete`). Η πόρτα **δεν** ζητά πλέον `permissions` στο `withAuth`: ο ανατεθειμένος δεν
  έχει την ικανότητα και πρέπει να φτάσει στον κριτή.
- 🔴 **Εύρημα της αναγνώρισης**: τα `PATCH`/`DELETE /api/opportunities/[id]` έκαναν **μόνο** φράχτη μισθωτή ⇒ **κάθε** μέλος
  της εταιρείας επεξεργαζόταν/έσβηνε **κάθε** ευκαιρία μέσω HTTP, πάνω από τους κανόνες (Admin SDK). Και κάθε άρνηση του
  φράχτη έβγαινε **500** αντί για 404 (`respondWithFailure`). Πέρασαν στο `defineRoute` και στον κριτή.
- **Κανόνες**: ο ανατεθειμένος στο `update` και στην ανάγνωση legacy εγγράφου (αλλιώς θα **έγραφε** έγγραφο που δεν
  διαβάζει)· όχι στο `delete`. Σουίτα: `describeCrmOwnerLeg({ assigneeIsOwner: true })` + ανατεθειμένος × στάδιο ⇒ deny,
  × διαγραφή ⇒ deny.
- **Οθόνη**: `stage-move/useOpportunityAccess.ts` δίνει στον **ίδιο** κριτή την ταυτότητα του browser (`pending` ≠ άρνηση).
  Κάρτα που δεν κινείται ⇒ **δεν σέρνεται**, κλειδαριά στη θέση της λαβής με Radix tooltip «Μόνο ο/η {κάτοχος} ή
  διαχειριστής…»· «Επεξεργασία»/«Διαγραφή» απενεργά με τον λόγο (όχι κρυμμένα). Ονόματα κατόχων με **ένα**
  `useUserDisplayNames` για όλο τον πίνακα. Φεύγει το χειρόγραφο `isBypass || permissions.includes(...)` του `PipelineTab`.
- **Πέρα από τους μεγάλους**: το 403 λέει **ποιος** μπορεί — η εντολή γράφει «Δεν αποθηκεύτηκε: την κινεί μόνο ο/η …» (δίχτυ
  για μπαγιάτικη εικόνα, π.χ. η ανάθεση άλλαξε στο μεταξύ). Το όνομα το βρίσκει ο πελάτης· ο server δεν διαβάζει προφίλ
  τρίτων για να συνθέσει μήνυμα.
- **CHECK 3.114**: Κ5 (ανατεθειμένος **μόνο** στο `update` των κανόνων) · Κ6 (ρόλοι του `role-catalogue.ts` με την ικανότητα
  του κριτή == ρόλος του `isCompanyAdminOfCompany`) · Κ1: το `requireOpportunityInTenant` έχει **έναν** καλούντα.
  Υπόλειμμα (στο `docs/gates/3.114.md`): ικανότητα ως ρητό claim — οι κανόνες δεν τη βλέπουν (στενότερο, όχι διαρροή).

## 4. Τι ΔΕΝ λύθηκε (καταγραμμένο στο `pending-ratchet-work.md`)

- `activities`: ίδιο ερώτημα ανατεθειμένου — ξεχωριστή απόφαση.
- Η λίστα «Ενδιαφερόμενοι» (`LeadsList` / `useLeadsList`) διαγράφει χωρίς να ρωτά τον κριτή στην οθόνη (οι κανόνες
  αρνούνται, το κουμπί όμως φαίνεται).

- Οι **μη σταδιακές** εγγραφές του πελάτη (σημειώσεις, αξία, διαγραφή) γράφονται ακόμη από τον browser χωρίς ίχνος.
- Το server service γράφει **άλλο σχήμα** (`name`/`value`/`leadId` αντί για `title`/`estimatedValue`/`contactId`).

## 5. Σειρά ανάπτυξης

⚠️ **Διορθώθηκε 2026-11-04**: εδώ έγραφε «κώδικας **πριν** τους κανόνες». Η γραμμή παραγωγής (`docker-build.yml`,
ADR-865 §11) κάνει το **αντίθετο, επίτηδες**: η «Κυκλοφορία στο Netcup» `needs: firebase-apply`, δηλαδή οι κανόνες
ανεβαίνουν **πρώτα** και ο κώδικας **μετά** την έγκρισή τους. Η πρόταση εδώ ήταν ανεφάρμοστη. Το παράθυρο όπου η
παλιά φόρμα αρνείται αλλαγή σταδίου είναι όσο διαρκεί η κυκλοφορία (λεπτά). Το deploy κανόνων εγκρίνεται στο
περιβάλλον `firebase-production` (CHECK 3.86).

## 6. Επαλήθευση

- jest: πυρήνας 15 · εντολή 6 · `kanban-model` + `pipeline-board` + αισιόδοξη εικόνα 25 · πύλη 3.114 9.
- Κανόνες (emulator): opportunities + leads + activities **118/118** (νέα ενότητα: 9 πεδία σταδίου ⇒ deny, σημειώσεις ⇒
  allow). Το κοινό συμβόλαιο κατόχου CRM άλλαξε από `status` σε ουδέτερο πεδίο (`NEUTRAL_EDIT`): για τις ευκαιρίες οι
  αρνητικές δοκιμές θα περνούσαν για **λάθος** λόγο.
- Πύλες: 3.14 · 3.16 · 3.17 · 3.47 · 3.66 · 3.73 · 3.113 · 3.114 πράσινες.
- **§3.7 (2026-11-04)**: κριτής 14 · εντολή 8 (+403 με όνομα) · πύλη 3.114 16 (+Κ1 φράχτης, Κ5×2, Κ6×3) ·
  `surface-authority-reachability` + `tenant-isolation` 104 · κανόνες opportunities + leads + activities **120/120**.
  Ζωντανά στο nestorconstruct.gr: εκκρεμεί (μετά από land + push + έγκριση `firebase-production`).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-04 | **§3.7 Εξουσία κατόχου** (απόφαση Giorgio). Ένας ισομορφικός κριτής `decideOpportunityAccess` (`services/crm/opportunity-access.ts`) + ένα σημείο επιβολής `requireOpportunityAccess` (πόρτα σταδίου · `PATCH` · `DELETE`)· κανόνες: ανατεθειμένος στο `update` και στην ανάγνωση legacy, όχι στο `delete`· οθόνη: κλειδωμένη κάρτα με όνομα κατόχου, απενεργά κουμπιά με λόγο· 403 με `ownerUid`. 🔴 Έκλεισε κενό: `PATCH`/`DELETE` έκαναν μόνο φράχτη μισθωτή (κάθε μέλος σε κάθε ευκαιρία) και απαντούσαν 500 αντί για 404 — μεταφορά στο `defineRoute`. CHECK 3.114 +Κ5/Κ6 (`scripts/lib/write-authority/opportunity-owner-parity.js`) + φρουρός του `requireOpportunityInTenant`. `Opportunity.createdBy` στον τύπο. Κλείνει το «ανοιχτό για απόφαση» της διόρθωσης `b0ba9ba1`. |
| 2026-11-04 | **Αναρίθμηση ADR-929 → ADR-930 (σύγκρουση αριθμού, CHECK 3.49).** Δύο κλαδιά πήραν ταυτόχρονα το 929: αυτό και το `ADR-929-raster-plan-recognition`. Κατά τον κανόνα (ADR-779) άλλαξε αριθμό το έγγραφο με τις **λιγότερες** αναφορές (55 αρχεία έναντι 137), με απόφαση Giorgio. Μετονομάστηκαν το έγγραφο και το handoff (`HANDOFFS/2026-11-04_ADR-930_crm-pipeline-dnd_handoff.md`), και άλλαξαν 68 αναφορές σε κώδικα, κανόνες, πύλη 3.114 και `pending-ratchet-work.md`. Το `adr-index.md` και ο πίνακας πυλών του `CLAUDE.md` ξαναπαράχθηκαν. Παλιά αναφορά «ADR-929» σε μηνύματα commit πριν από αυτή την ημερομηνία που αφορά το CRM σημαίνει **αυτό** το έγγραφο. |
| 2026-11-04 | **🔴 Διόρθωση μετά το deploy (`6db1147d`): η πόρτα σταδίου ήταν απρόσιτη.** Το `POST /api/opportunities/[id]/stage` ζητά `crm:opportunities:update`, που **κανένας** ρόλος του `role-catalogue.ts` δεν είχε ⇒ 403 σε όλους εκτός `super_admin` (bypass). Το έπιασε στο CI το `surface-authority-reachability.test.ts` (ADR-829 Κ2), που **δεν** τρέχει στο pre-commit. Δόθηκε στον `company_admin` (ήδη είχε `:view`). Ο server διαβάζει τον κατάλογο ζωντανά (`permissions.ts`), άρα δεν χρειάζεται ανανέωση claims. Ανοιχτό για απόφαση: ο **δημιουργός** μιας ευκαιρίας που δεν είναι διαχειριστής την επεξεργάζεται κατά τους κανόνες (`crmWriterIsPrivileged`) αλλά δεν αλλάζει το στάδιό της. Διορθώθηκε και η §5: η γραμμή παραγωγής ανεβάζει **πρώτα** τους κανόνες. |
| 2026-11-04 | Δημιουργία. Φ1 ρίζα σταδίων + πόρτα + ιστορικό · Φ2 `KanbanBoard` (+ μεταφορά `VariantLevelBoard`) · Φ3 οθόνη (σύρσιμο, διάλογοι, αναίρεση, ζωντανός πίνακας, σύνολα, ταξινόμηση, «μέρες στο στάδιο», φόρμα μέσω πόρτας) · Φ4 κανόνες + CHECK 3.114 + MCP. Boy Scout: `toCatalogKey` (κοινό snake→camel), `mcp-write-allowlist` (κοινό 3.113/3.114), ετικέτα ιστορικού `quoteIntake` που έλειπε από το `main` (`c16a02f6`). |
