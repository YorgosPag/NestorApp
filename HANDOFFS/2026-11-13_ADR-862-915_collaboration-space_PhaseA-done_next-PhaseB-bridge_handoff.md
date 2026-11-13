# Handoff — Χώρος συνεργασίας μετά την ανάληψη (ανάθεση ΠΕΑ) · Φ-Α ✅ · επόμενο: **Φ-Β (γέφυρα)**

**Ημερομηνία:** 2026-11-13 · **Worktree:** `C:\Nestor_Worktrees\pea-sold-truth` · **Κλαδί:** `agent/pea-sold-truth`
**Τοπικό `main`:** `7d26c24f` (Φ-Α + το handoff της προσομοίωσης, μέσω `wt:land`). **ΔΕΝ έγινε push.**
**Προηγούμενο handoff (το πρόβλημα, ζωντανή προσομοίωση):** `HANDOFFS/2026-11-13_ADR-915_PEA-assignment-live-sim_next-collaboration-space-plan_handoff.md`
**Εγκεκριμένο σχέδιο (πλήρες):** `C:\Users\user\.claude\plans\effervescent-exploring-yeti.md` — το «ΣΥΝΟΛΙΚΟ ΣΧΕΔΙΟ» είναι η αυθεντία των φάσεων. Τα βασικά επαναλαμβάνονται εδώ (§2–§4).

---

## 1. Το πρόβλημα (μία πρόταση)

Ο επαγγελματίας (π.χ. ενεργειακός επιθεωρητής για ΠΕΑ) πατά «Αναλαμβάνω» στο `/document-request` (ADR-915 §27–§31, **χωρίς λογαριασμό**). Μετά **δεν έχει κανένα κανάλι** μέσα στην εφαρμογή: ούτε λογαριασμό, ούτε παράδοση αρχείου, ούτε μηνύματα. Ο Giorgio θέλει **όλη** η συνεργασία να γίνεται **μέσα** στο Nestor.

## 2. Αποφάσεις Giorgio (2026-11-13) — ΜΗΝ τις ξαναρωτήσεις

- ✅ **Υβριδικό μοντέλο καναλιών:**
  - επίσημο αρχείο **μέσα** στην εφαρμογή
  - ειδοποίηση στο **προτιμώμενο** κανάλι
  - κουμπί απευθείας επικοινωνίας **μόνο μετά την αποδοχή**
- ✅ **Σειρά καναλιών:** email + Telegram πρώτα → WhatsApp → Viber (όταν υπάρξει σύμβαση με πάροχο). ⛔ Messenger και Instagram **ΔΕΝ** γίνονται κανάλια ειδοποίησης: η Meta επιβάλλει παράθυρο 24 ωρών και οι ετικέτες καταργήθηκαν το 2026. Μένουν μόνο ως κουμπιά επαφής.
- ✅ **Αρχεία:** επίσημη παράδοση **χωριστά** από τη συζήτηση (submittal/transmittal όπως Procore/ACC, με εκδόσεις και «Αποδέχομαι» / «Επιστροφή για διόρθωση»). Τα μηνύματα μένουν κείμενο, με κάρτες γεγονότων.
- ✅ **Ε-9′** (καταγράφηκε στο ADR-862 §5.3.10): η πλατφόρμα **ποτέ** δεν αποκαλύπτει από μόνη της τηλέφωνο ή email. Δείχνει μόνο κανάλια που **δήλωσε ο ίδιος** ο άνθρωπος, **μόνο** όσο η συμμετοχή είναι `active`, με ίχνος.
- ✅ Ακίνητο **χωρίς έργο** ⇒ ίδια συμπεριφορά με τη μεταβίβαση (`no-project`), προς το παρόν.
- ✅ **Σειρά φάσεων:** Φ-Α → **Φ-Β** → Φ-Γ → Φ-Δ → Φ-Ε1 → Φ-ΣΤ → Ε2 → Ε3. Κάθε φάση σε **Plan Mode με Opus**.

## 3. ✅ Τι έγινε — Φ-Α (γενίκευση της συμμετοχής, ADR-862 §5.3.10)

Ο πυρήνας της συμμετοχής (ADR-862 Φ1) ήξερε **μόνο** τη μεταβίβαση. Τώρα δέχεται **δεύτερο είδος υπόθεσης**. **Μηδέν αλλαγή συμπεριφοράς** για τη μεταβίβαση, **καμία** μετανάστευση δεδομένων.

| Τι | Πού |
|---|---|
| `EngagementSubject = conveyance_case {caseId} \| document_issuance {assignmentId}` · `Engagement = ConveyanceEngagement \| IssuanceEngagement` · φρουροί `isConveyanceEngagement` / `isIssuanceEngagement` | `src/types/engagement.ts` |
| Ολικοί πίνακες ανά είδος: `SCOPE_OF_SUBJECT` · `ROLES_OF_SUBJECT` · `TEMPLATE_OF_SUBJECT` | `src/types/engagement.ts` |
| Ρόλος έκδοσης **`document_issuer`** (ΕΝΑΣ — η άδεια παράγεται από `src/config/document-validity/document-issuers.ts` → `src/config/professional-licences.ts` → αρχή `ypen`) | `src/types/engagement.ts` |
| Νέο πρότυπο CDE **`issuer`** (εμβέλεια = `legal`: μόνο ό,τι εκδόθηκε) | `src/types/container-access.ts` · `src/lib/auth/container-access.ts` |
| `isSameSubject` (ίδιο είδος **και** ίδιο κλειδί) | 🆕 `src/lib/auth/engagement-subject.ts` |
| Κριτής: εύρος άλλου είδους ⇒ `scope-missing` | `src/lib/auth/engagement-judge.ts` |
| Σχήμα: διακριτή ένωση υπόθεσης/ρόλου · ανάμειξη ειδών ⇒ `null` · ιδιότητα σε **κάθε** αρχή (ΥΠΕΝ, `chapter: null`) | `src/lib/auth/engagement-schema.ts` |
| Ερωτήματα: ρητό πεδίο ανά είδος (`subject.caseId` · `subject.assignmentId`) | `src/lib/auth/engagement-ref.ts` |
| Γραφέας: **παράγει** πρότυπο + εύρος · το `template` **έφυγε** από το `EngagementOfferRequest` | `src/lib/auth/engagement-write.ts` |
| Μεταβίβαση: στένεμα στο σύνορο ανάγνωσης με `asCaseEngagement` (ρίχνει σφάλμα κώδικα, ποτέ `as`) · ξένο είδος στις πόρτες ⇒ 404 | `src/services/conveyance/conveyance-engagement-support.ts` + 11 αρχεία `src/services/conveyance/*` + `engagement-invitation-redeem.ts` |
| Άγκυρες (ομάδα «§5.3.10», 6 περιπτώσεις) | `src/lib/auth/__tests__/engagement-anchor.test.ts` |

- **Πύλες:** pre-commit **και** `wt:land` πέρασαν (80 parallel · 3.22 · 12 suites Type Safety).
- ⚠️ **Δεν έτρεξαν ποτέ ρητά:** η `engagement-anchor.test.ts` με τις 6 νέες άγκυρες, και οι σουίτες της μεταβίβασης.
- ⚠️ **Πλήρης tsc:** δεν έτρεξε (N.17) — τον κάνει ο Giorgio ή το CI.

## 4. ⏭️ ΕΠΟΜΕΝΟ — Φ-Β · Γέφυρα: «Αναλαμβάνω» (χωρίς λογαριασμό) → συμμετοχή με λογαριασμό

**Στόχος:** μόλις ο επαγγελματίας πατήσει «Αναλαμβάνω», να αποκτήσει **πρόσκληση σε λογαριασμό** και να μπει σε **χώρο της ανάθεσης**, πάνω στο σύστημα συμμετοχής της Φ-Α.

Από το εγκεκριμένο σχέδιο:
1. **Έκδοση πρόσκλησης:** στο `respond: accept` της ανάθεσης (`src/server/issuance-invitations/issuance-invitation-answer.ts`), στην ίδια ροή, εκδίδεται **πρόσκληση συμμετοχής** μέσω της υπάρχουσας μηχανής πρόσκλησης. Είναι δεμένη στο `inviteeEmail` και **ιδεμποτική** (κλειδί ανά ανάθεση).
2. **Πού φαίνεται:** το email-απόδειξη (`issuance-answer-receipt.ts`) **και** η σελίδα `/document-request` δείχνουν «Ανοίξτε τον χώρο της ανάθεσης» → `/case-invite/[token]`.
3. **Ο σύνδεσμος χωρίς λογαριασμό ΜΕΝΕΙ** για γρήγορη απάντηση. Η συνεργασία απαιτεί λογαριασμό.
4. **Αποδοχή:** ζητά δηλωμένο **αριθμό μητρώου ΥΠΕΝ**. Η αρχή παράγεται από το είδος εγγράφου της ανάθεσης, μέσω `document-issuers` → `professional-licences`. Γεννιέται engagement `active` με `stageEngagementByInvitation`, `subject: {kind:'document_issuance', assignmentId}`, `role: 'document_issuer'`.
5. **Κάρτα γραφείου** (`src/components/document-registry/RegistryIssuanceStep.tsx`): «Αναμένεται είσοδος» / «Ο επαγγελματίας μπήκε στον χώρο». Το `ballInCourt` μένει **παραγόμενο**.
6. 🔑 **Μητρώο οικοδεσποτών** (`Record<EngagementSubjectKind, Adapter>`): **ΤΩΡΑ** μπαίνει, γιατί έρχεται ο **δεύτερος** καταναλωτής. Πρώτος adapter η μεταβίβαση (`conveyance-engagement-host.service.ts`), **μετακίνηση, όχι αντιγραφή**. Οι πόρτες `src/app/api/engagements/[engagementId]/*` και το «Οι υποθέσεις μου» (`listMyCases`, σήμερα **μόνο** μεταβίβαση) ρωτούν το μητρώο.

### Γνωστά σημεία προς απόφαση / έλεγχο στη Φ-Β (ΕΠΑΛΗΘΕΥΣΕ με grep — μπορεί να άλλαξαν)

- **Σχήμα πρόσκλησης συμμετοχής:** το `src/lib/conveyance/engagement-invitation-schema.ts` + `src/types/engagement-invitation.ts` είναι **δεμένα στη μεταβίβαση** (`caseId`, νομικός ρόλος, `propertyId`). Χρειάζεται γενίκευση ανά είδος, ή χωριστό είδος πρόσκλησης στη **ίδια** μηχανή (`src/server/invitations/*`, ADR-853 §20). Η επιλογή είναι απόφαση σχεδίου: **ρώτα**.
- **`engagement-invitation-redeem.ts` / `-preview.ts`:** σήμερα διαβάζουν `CONVEYANCE_CASES`. Το `preview :62` έχει ακόμη `template: 'legal'` σκληρά γραμμένο, που πρέπει να περάσει από το `TEMPLATE_OF_SUBJECT`.
- **Μηχανή token:** η ανάθεση έχει **δικό της** secret (`ISSUANCE_INVITE_SECRET`), η συμμετοχή άλλο (`ENGAGEMENT_INVITE_SECRET`), και ο πυρήνας είναι κοινός (`src/server/invitations/invitation-token.ts`).
- **Ταυτότητα επαγγελματία:** η επαφή **δεν** έχει `uid`. Η συμμετοχή δένεται στο **email** (`inviteeEmail`) με επαληθευμένο email λογαριασμού (`invitation-redeem.ts`).
- **Έργο:** το engagement ζει στο `companies/{host}/projects/{p}/engagements`. Η ανάθεση έχει `propertyId`, άρα πρέπει να βρεθεί το έργο του ακινήτου. Αν δεν έχει ⇒ `no-project` (απόφαση §2).
- **Κανόνες Firestore:** ο κανόνας των engagements κρίνει μόνο `uid`/admin (δεν αλλάζει). Τα `engagement_invitations` είναι deny-all.
- **Πύλες που θα κρίνουν:** 3.16 · 3.35 · 3.68 · 3.78 · 3.92 · 3.83 (email) · 3.15/3.91 · 3.86 (κανόνες/δείκτες **πριν** από τον κώδικα) · 3.8/3.115 (i18n el+en) · 3.53 (αναφορές `ADR §`).
- **ADR που ενημερώνονται:** ADR-915 (νέα § για τη γέφυρα) · ADR-862 §5.3.10 (adapter/μητρώο) · ADR-853 αν αγγιχτεί η μηχανή.

## 5. Μετά τη Φ-Β (για προσανατολισμό — όχι τώρα)

- **Φ-Γ:** επίσημη παράδοση.
  - Το γραφείο στέλνει στοιχεία (signed URL).
  - Ο επαγγελματίας παραδίδει: `files_personal` → contribution → στοίβα εκδόσεων ISO 19650 (μοτίβο `conveyance-contribution.service.ts`).
  - Το γραφείο αποφασίζει «Αποδέχομαι / Επιστροφή» μέσω του ενός γραφέα CDE `src/app/api/files/[fileId]/cde/route.ts`.
  - Με την αποδοχή: `energy-certificate-import` → `recordDocumentFacts`, + πεδίο **`fulfilledBy: {fileId, version}`** + στάδιο `delivered`.
  - 🔴 **Γνωστό σφάλμα που κλείνει εδώ:** το `isIssuanceFulfilled` (`src/lib/document-validity/issuance-assignment.ts:187`) κλείνει την ανάθεση με **οποιοδήποτε** νεότερο έγγραφο ίδιου είδους, όχι με το παραδοθέν.
- **Φ-Δ:** νήμα μηνυμάτων ADR-867 με νέο είδος πράξης `engagement` (`NETWORK_ACT_KINDS`), ακροατήριο = προβολή της ομάδας πράξης (CHECK 3.89). UI `src/components/network-messaging/*` στη σελίδα `/o/[ws]/cases/[engagementId]` **και** στην κάρτα γραφείου.
- **Φ-Ε1:**
  - leg εξωτερικού καναλιού στο **ένα** `dispatchNotification` (`src/server/notifications/notification-orchestrator.ts`)
  - προτίμηση + συναίνεση ανά κανάλι (ADR-849)
  - σύνδεση Telegram με `t.me/<bot>?start=<token>` στο υπάρχον webhook
  - ⚠️ πρώτα κλείνει το ανοιχτό θέμα rotation του token του bot (handoff 2026-11-12)
- **Φ-ΣΤ:** πόρτα αποκάλυψης καναλιών (μοτίβο Α21 `revealLocationChannels`) + deep links **μόνο** από `src/lib/contact/social-chat-links.ts`, μαζί με τη διόρθωση Viber για προσωπικούς αριθμούς (`viber://chat?number=`).

## 6. Ανοιχτά εκτός εμβέλειας (μόνο πρόταση στον Giorgio, όχι αυτοβούλως)

- **Διπλότυπο:** η `engagedNow` στο `src/services/conveyance/conveyance-case-participants.server.ts` επαναλαμβάνει την ομώνυμη του `conveyance-engagement-support.ts`.
- **Ευρήματα 2–4 της προσομοίωσης** (προηγούμενο handoff):
  - η επιλογή επαφής δεν φαίνεται στο πεδίο
  - «μη διαθέσιμη επαφή» για 1–2″
  - ο εξαψήφιος κωδικός χάνεται
- **Δεδομένα δοκιμής στην παραγωγή:** επαφή «Αλέξανδρος Μαυρίδης» + ενεργή ανάθεση ΠΕΑ στο Διαμέρισμα 95 τ.μ.

## 7. ⛔ ΚΑΝΟΝΕΣ

- **Πρώτο μήνυμα:** πρόταση μοντέλου (N.14) + τρόπου εκτέλεσης (N.8). Περίμενε «ok».
- **Πριν από κάθε κώδικα:** πραγματικός έλεγχος SSoT με grep. Έρευνα στο διαδίκτυο όπου υπάρχει αβεβαιότητα. Ποιότητα «όπως οι μεγάλοι και καλύτερα», χωρίς εκπτώσεις.
- **Χωρίς έγκριση:** κανένα test, tsc ή πύλη. Καμία πρωτοβουλία εκτός εντολής.
- **Git:**
  - **κανένα** commit στο `main`
  - commit μόνο στο `agent/pea-sold-truth`, με ρητή λίστα αρχείων
  - `wt:land` και push **ΜΟΝΟ** με ρητή εντολή Giorgio
  - ποτέ `--no-verify`
- **Bash στα Windows:** περιεχόμενο αρχείου μόνο με `Write` / `Edit` (N.19). Όχι `python` / `cat >` στο bash: η απομόνωση worktree αρνείται σύνθετες εντολές.
