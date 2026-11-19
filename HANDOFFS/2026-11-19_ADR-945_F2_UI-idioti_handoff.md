# HANDOFF — ADR-945 Φ2: UI ιδιώτη για αίτημα προσφορών έκδοσης (Βήματα 2–7)

**Ημερομηνία:** 2026-11-19 · **Worktree:** `C:\Nestor_Worktrees\wt-prune` · **Κλαδί:** `agent/wt-prune`
**Η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree / κλαδί.** Στο `main` κανένα commit.
⛔ Jest / checks / jscpd / commit / `wt:land` / push **μόνο με ρητή εντολή Giorgio**. Ποτέ `tsc` (N.17), ποτέ `--no-verify`, ποτέ σκέτο `git stash`, ποτέ `git add -A`.

---

## 1. Κατάσταση (επαληθευμένη)
- `main` = `origin/main` = **`bffd72ca`**, **ζωντανό** στο nestorconstruct.gr (deploy επιτυχές, firebase-apply επιτυχές).
- Περιέχει: **Φ1β διακομιστή** (`GET/PUT /api/document-registry/issuance-requests`, service, κριτής), **κανόνες**
  `document_issuance_requests` (`allow read, write: if false` — μόνο Admin SDK), και τον διακόπτη
  **`OWNER_ISSUANCE_REQUESTS: false`** (`src/config/feature-flags.ts`) + άγκυρα στο `src/config/__tests__/feature-flags.test.ts`
  (⚠️ η άγκυρα **δεν έχει τρέξει ακόμη** — ρώτα πριν).
- Άγκυρες που προϋπήρχαν κόκκινες διορθώθηκαν (`8ce4d3ce`): personal-scope-consumers 8/8 · enterprise-id + rules-liveness 319/319 ·
  emulator `document-issuance-*` 56/56.
- Το κλαδί `agent/wt-prune` είναι **πίσω** από το `main` (HEAD κλαδιού `8ce4d3ce` + αυτό το handoff). Το `wt:land` κάνει rebase —
  μην κάνεις χειροκίνητο rebase/merge.

## 2. Επόμενο: Φ2 Βήματα 2–7 (εγκεκριμένο σχέδιο)
**Πηγές αλήθειας:** ADR-945 **§7.6** (`docs/centralized-systems/reference/adrs/ADR-945-private-owner-document-issuance.md`)
και το σχέδιο `C:\Users\user\.claude\plans\soft-honking-rose.md`. Διάβασέ τα **ολόκληρα** πρώτα.
**Απόφαση Giorgio:** όλο το σημείο εισόδου (ενότητα `/me` + «Ζήτησε προσφορά» στο `/pro`) μένει **ΚΛΕΙΣΤΟ μέχρι τη Φ3**·
κλειστός διακόπτης ⇒ καμία ενότητα, κανένα κουμπί, **καμία κλήση δικτύου**. Καμία αλλαγή server/κανόνων στη Φ2.

**Πριν από κάθε γραμμή κώδικα: πραγματικό SSoT audit (grep)** — επαναχρήση, όχι διπλότυπα (N.0 / N.12 / N.18).

| Βήμα | Τι |
|---|---|
| 2 | Client στο `src/services/document-registry/document-registry.client.ts`: `ISSUANCE_REQUESTS_URL` · `fetchIssuanceRequest(propertyId, kind)` ⇒ `ready \| unavailable \| failed` (ίδιο ιδίωμα με upkeep) · `saveIssuanceRequestAction(body)` μέσω του υπάρχοντος ιδιωτικού `putRegistryAction` (το `apiClient.put` βάζει ήδη `Idempotency-Key`, CHECK 3.92). Client-safe τύπος του `IssuanceRequestView` + `canAct` — αν ζει σε `.server.ts`, **μετακίνηση της διεπαφής** σε `lib/document-validity/` (ένας ορισμός). |
| 3 | Καθαρό `src/lib/document-validity/issuance-request-view-model.ts`: `expectedStagesOf` · `expectedCycleOf` (CAS για award/cancel) · `ownerBallOf` (μπάλα `office` ⇒ `owner`) · `requestPhaseOf` (`none\|inviting\|awarded\|closed`) · `canInviteMore` **από τον ίδιο πυρήνα** (`reduceIssuanceRequest` / `inviteCycleOf`), όχι δεύτερο όριο 3. |
| 4 | Hooks `hooks/document-registry/useIssuanceRequest.ts` (`useIdentityGatedResource` + `revalidate`, πρότυπο `usePropertyUpkeep.ts`) και `useIssuanceRequestAction.ts` — **ΟΧΙ αισιόδοξο** (πρότυπο `useUpkeepDeclaration.ts`: `inFlight` ref · `busyKey` · error από κλειστό πίνακα κωδικών · `useNotifications().success` · `revalidate`). |
| 5 | `components/owner-property/OwnerIssuanceRequestSection.tsx` + `OwnerIssuanceBidList.tsx` + `owner-issuance-labels.ts`· mount στο `OwnerPropertyDetailContent.tsx` **αμέσως μετά** το `PropertyUpkeepSection` (~γρ. 313), ίδιο ιδίωμα `dynamic()`, φραγμένο με `isAppFeatureEnabled('OWNER_ISSUANCE_REQUESTS')`. Χωρίς αίτημα ⇒ «Βρες επιθεωρητή» (Link στο `/pro` με πλαίσιο). Με προσφορές ⇒ `<ul>` καρτών: επαγγελματίας · στάδιο (`ISSUANCE_STAGE_KEYS`) · μπάλα ιδιώτη · `quoteLines(t, record)` · Επιλογή (award) · Ακύρωση (cancel) · Πρόσκληση κι άλλου όσο `canInviteMore`. Χρονολόγιο `<ol>` στο πρότυπο `IssuanceAdvanceTimelineList.tsx`. `canAct === false` ⇒ μόνο ανάγνωση. |
| 6 | Νέο `lib/agency/issuance-context-query.ts` (`parse/serializeIssuanceContext` → `{propertyId, documentKind}`, **υπόδειξη** — ο server ξανακρίνει κατοχή)· **επέκταση** του `documentIssuerSearchHref` στο `components/mandate/agency-directory-route.ts` (όχι δεύτερος δημιουργός URL)· πέρασμα πλαισίου σε `AgencyDirectoryContent` / `AgencyCard` (`<li>`) / `AgencyProfileContent`· νέο `components/mandate/AgencyRequestQuoteButton.tsx`, ορατό μόνο αν διακόπτης **και** πλαίσιο **και** `showcaseHasQualification` (`lib/agency/occupation-query.ts`)· ανώνυμος ⇒ `/login?next=…`· πλοήγηση **μόνο** μέσω `@/lib/workspace/navigation` (CHECK 3.61). |
| 7 | i18n el+en σε **υπάρχοντα** namespaces `document-registry` / `property-market`: κλειστοί πίνακες κλειδιών `t(TABLE[row])`, άρνηση ανά κωδικό `ISSUANCE_REQUEST_ERROR_CODES`, πληθυντικοί ICU (3.115)· έλεγχος route slice `offers__offerId` (ADR-744). |

Μετά: tests (view-model · round-trip πλαισίου · hook · ενότητα με διακόπτη κλειστό ⇒ τίποτα / ανοιχτό ⇒ ροή), `jscpd:diff`,
ενημέρωση ADR-945 (§7.6 + changelog) — **όλα τα tests/checks μόνο με εντολή**.

## 3. Κρίσιμο πλαίσιο
- **API Φ1:** `GET …/issuance-requests?propertyId&documentKind` → `{request, bids, canAct}`. `PUT` = ένωση στο `action`:
  `invite {propertyId, documentKind, professionalCompanyId, expectedCycle|null}` ·
  `award {…, bidId, expectedCycle, quoteRevision, expectedStages}` · `cancel {…, expectedCycle, expectedStages}`.
  `IssuanceBidView {bidId, stage: IssuanceStage|null, record: IssuanceAssignmentRecord|null}`.
- **Ετικέτες:** `issuance-labels.ts` (ISSUANCE_STAGE_KEYS · BALL_IN_COURT_KEYS · ISSUANCE_ERROR_KEYS)· `quoteLines` στο
  `registry-issuance-quote-lines.tsx`. **ΟΧΙ** επαναχρήση των όψεων `EngagedIssuance*` (πλευρά επαγγελματία, §5 διορθώθηκε).
- **Σελίδα ιδιώτη:** `src/app/(me)/offers/[offerId]/page.tsx` → `src/components/owner-property/OwnerPropertyDetailContent.tsx`.
- **/pro:** `src/app/(light)/pro/page.tsx`, φίλτρα `src/lib/agency/showcase-filter.ts` (occupation/area/lat/lng/r). Δεν υπάρχει
  μηχανισμός επιστροφής/πλαισίου — τον φτιάχνει το Βήμα 6.
- **Κανόνες ποιότητας:** ≤500 γρ./αρχείο, ≤40 γρ./συνάρτηση, όχι `any`, σημασιολογικό HTML, όχι inline styles, Radix select,
  καμία σκληροκωδικοποιημένη συμβολοσειρά (N.11).
- **Heavy-task lock** `C:\Users\user\.claude\heavy-task.lock`: πριν από εγκεκριμένο jest περίμενε να ελευθερωθεί (background `until`).
- **Bash:** εντολές >6000 χαρ. απορρίπτονται ⇒ `Write` + script· μηνύματα commit με `Write` + `git commit -F`.
- **wt:land:** squash με τίτλο από το παλαιότερο μη-`docs(handoff)` commit — κράτα τίτλους <70 χαρ.

## 4. ΜΗΝ
- Μην ανοίξεις τον διακόπτη σε commit (μόνο τοπικά για ζωντανή δοκιμή, με εντολή).
- Μην αγγίξεις server/κανόνες/route του Φ1.
- Μην φτιάξεις δεύτερο όριο προσφορών, δεύτερο δημιουργό URL `/pro`, ή αντίγραφο των ετικετών σταδίων.
- Μην κάνεις αισιόδοξη ενημέρωση στις πράξεις award/cancel/invite (CAS — ο server αποφασίζει).
- Εκτός Φ2: ειδοποίηση επαγγελματία / emails (Φ3) · πληρωμή (Φ4) · σύγκριση δίπλα-δίπλα (Φ5).
