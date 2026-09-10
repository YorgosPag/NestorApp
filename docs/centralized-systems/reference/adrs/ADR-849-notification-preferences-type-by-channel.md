# ADR-849 — **ΜΟΝΤΕΛΟ ΠΡΟΤΙΜΗΣΕΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ: ΤΥΠΟΣ × ΚΑΝΑΛΙ — «ΟΧΙ EMAIL ΓΙΑ ΤΑΙΡΙΑΣΜΑΤΑ, ΝΑΙ ΓΙΑ ΕΝΤΟΛΕΣ»**

> **Κατάσταση**: ✅ **Α1 + Α2 + Α3 υλοποιημένες** *(2026-09-10: μοντέλο + μία συγχώνευση + δύο πύλες server · token με εμβέλεια + one-click ανά τύπο + σελίδα ανά τύπο · στήλη email στην οθόνη ρυθμίσεων, κλειδωμένα υποχρεωτικά, εγγραφές χωρίς πάγωμα)* · 🔶 όρια στο §9
> **Πηγή**: Giorgio 2026-09-10 — «όπως στο LinkedIn: όχι email για ταιριάσματα αγγελιών, αλλά ναι για εντολές» (ADR-848 §9 #4)
> **Σχετικά**: ADR-848 *(σύνδεσμοι email, διαγραφή ενός κλικ)* · ADR-777 §8.23–§8.29 *(αγωγός email, παράθυρα, ζώνη, γλώσσα)* · ADR-749 *(μία αλήθεια, αδρανείς φρουροί)*

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ

Ένας διακόπτης `categories.<κατηγορία>.<κλειδί>` ελέγχει **και** το κουδούνι **και** το email.
Το email κλείνει μόνο **ολόκληρο** (`emailEnabled` · `emailFrequency`). Ο άνθρωπος που δεν θέλει
email για ταιριάσματα αγγελιών έχει δύο κακές επιλογές: να χάσει **και** το κουδούνι γι' αυτά,
ή να χάσει **όλα** τα email — και τις απαντήσεις εντολών που θέλει.

---

## 2. ΤΟ ΜΟΝΤΕΛΟ ΠΟΥ ΥΠΗΡΧΕ — ΚΑΙ ΔΕΝ ΕΙΧΕ ADR

⚠️ Ο κώδικας παρέπεμπε σε **«ADR-025 Notification Settings Centralization»** και **«ADR-026
Notification Events Registry»**. Και οι δύο αριθμοί ανήκουν σε **άλλα** θέματα (Property Linking ·
DXF Toolbar Colors). **Κανένα έγγραφο δεν περιέγραφε το μοντέλο προτιμήσεων** πριν από αυτό.

| Πεδίο (`user_notification_settings/{uid}`) | Σημασία | Ποιος το κρίνει |
|---|---|---|
| `globalEnabled` | Όλα κλειστά | κουδούνι + email |
| `inAppEnabled` | Κουδούνι | orchestrator |
| `emailEnabled` · `emailFrequency` (`realtime·daily·weekly·disabled`) | Email καθολικά, ρυθμός | `email-delivery-window` |
| `categories.<κατ>.<κλειδί>: boolean` | **Κύριος** διακόπτης τύπου | κουδούνι + email |
| **`emailCategories.<κατ>.<κλειδί>: 'on'\|'off'`** 🆕 | **Email** του τύπου — μόνο στενεύει | email |
| `quietHours` · `timezone` · `language` | ADR-777 §8.28 · §8.29 | email |

Συμβάν → διακόπτης: `src/config/notification-events.ts` → `EVENT_CATEGORY_MAP` (`category` ·
`settingKey` · `isMandatory`). ⚠️ Ο διακόπτης **δεν ταυτίζεται** πάντα με τον τύπο
(`building.created`→`properties.newBuilding` · `quoteScanCompleted`→`quoteReceived`) ⇒ η σίγαση
δένεται στον **διακόπτη**, όχι στο όνομα του συμβάντος.

### 2.1 Μετρημένα ευρήματα (grep, 2026-09-10)

| # | Εύρημα | Κατάσταση |
|---|---|---|
| Ε1 | 🔴 **Δύο συγχωνεύσεις με τις προεπιλογές, διαφορετικού βάθους**: διακομιστής **ρηχά** (`{...defaults.categories, ...stored.categories}`), πελάτης **ανά κλειδί**. Έγγραφο χωρίς `demandListingMatch` ⇒ `undefined` στον server, `true` στην οθόνη | ✅ Α1: **μία** (`user-notification-settings.merge.ts`) |
| Ε2 | 🔴 **Κανένας έλεγχος τη στιγμή της αποστολής** — ο αγωγός δεν διάβαζε ρυθμίσεις. «Διακοπή» 15:00 ⇒ η σύνοψη 20:00 έφευγε | ✅ Α1: `email-send-gate.ts` |
| Ε3 | **10 από τους 30** τύπους έχουν παραγωγό· οι **4 υποχρεωτικοί** (ασφάλεια) έχουν **0** | Δηλωμένο — ο υποχρεωτικός δρόμος δεν εκτελείται σήμερα |
| Ε4 | Διακόπτες **απρόσιτοι** (ADR-749 §5): η κατηγορία **procurement** λείπει από την οθόνη (5 ζωντανοί τύποι) · `contactTrashed` · `contactPermanentlyDeleted` · `newBuilding`· οι διακόπτες ασφαλείας **φαίνονται** ότι κλείνουν ενώ δεν κλείνουν | ✅ Α2 (γραμμές) + Α3 (υποχρεωτικά = 🔒 «Πάντα», κανένας διακόπτης) |
| Ε5 | Παραπομπές-φαντάσματα ADR-025/026 | ✅ Α1 στα αρχεία που αγγίχθηκαν |

---

## 3. 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ *(έρευνα με πηγές, 2026-09-10)*

| Θέμα | Πρακτική | Πηγή |
|---|---|---|
| Εμβέλεια του one-click | *«removes the recipient only from the mailing list associated with the message»* — ανά λίστα, **όχι** όλα | Google «Email sender guidelines FAQ» (support.google.com/a/answer/14229414) |
| Λίστες ανά συνδρομή | Ξεχωριστό `List-Id` ανά λίστα | Google «Email subscription guidelines» (support.google.com/mail/answer/15263077) |
| RFC | Το URI αναγνωρίζει «τον παραλήπτη **και τη λίστα**» — η εμβέλεια είναι του αποστολέα | RFC 8058 §3 |
| Ακίνητα | *«unsubscribe you from this type of email, only»* · συχνότητα **ανά αποθηκευμένη αναζήτηση** | Zillow Help · Idealista · Rightmove |
| Κοινωνικά | Κατηγορία × συχνότητα (Individual · Daily · Weekly · No email) | LinkedIn Help a517979 *(υποσέλιδο ανά τύπο: δευτερογενείς πηγές)* |
| Εργαλεία | Μήτρα τύπος × κανάλι· «unsubscribe from this thread» | GitHub Docs «Configuring notifications» |
| Πλατφόρμες | Κατηγορία × κανάλι· ο πιο ειδικός κανόνας κερδίζει· προεπιλογές από κάτω· η παράκαμψη των υποχρεωτικών δηλώνεται **από τον αποστολέα** | Knock Docs «Preferences overview» |
| Υποχρεωτικά | Δεν έχουν «κλειστό» | Figma Help (mentions email ακόμη και σε «Nothing») |
| Μήτρα οθόνης *(Α3)* | Jira: τύποι × κανάλια με checkboxes + καθολικός «Send me emails for work item activity» · GitHub: ανά τύπο «On GitHub / Email» · Airbnb · Figma: τύπος × κανάλι | Atlassian Support «Manage your Jira personal settings» · GitHub Docs · Airbnb Help 14 · Figma Help 360039813234 |
| Υποχρεωτικά στην οθόνη *(Α3)* | Airbnb: «can't be turned off» (Account activity, Security) · Figma: τα σημαντικά email φεύγουν πάντα · Google: οι ειδοποιήσεις ασφαλείας δεν κλείνουν | Airbnb Help 14 · Figma Help · Google Account Community |
| Tooltip σε ανενεργό *(Α3)* | Το Radix Tooltip **δεν** εμφανίζεται σε `disabled` trigger — και σε αφή δεν υπάρχει | radix-ui/primitives#1914 |
| Switch ή checkbox *(Α3)* | Switch = άμεση αποθήκευση· checkbox = φόρμα με «Αποθήκευση» | NN/g «Toggle-Switch Guidelines» · Primer «Saving» |
| Απορριφθείσα εγγραφή *(Α3)* | Το SDK αφαιρεί την εγγραφή από την ουρά, **εκπέμπει snapshot με την επαναφερμένη τιμή**, απορρίπτει το promise — τα docs το αφήνουν ανείπωτο, ο **κώδικας** το λέει | firebase-js-sdk `packages/firestore/src/core/sync_engine_impl.ts` → `syncEngineRejectFailedWrite` |
| Ομαδικές ενέργειες *(Α3)* | **Δεν** επαληθεύτηκαν σε GitHub · Jira · LinkedIn· τις ζητούν χρήστες Asana (δεν υπάρχουν) | forum.asana.com (Product Feedback) |

🔶 Κανείς δεν τεκμηριώνει δημόσια τη συμπεριφορά της οθόνης όταν το email είναι καθολικά κλειστό — δική μας απόφαση (Δ5). *(Ξαναψάχτηκε στην Α3: Jira · Linear · Slack — ούτε αυτοί.)*

---

## 4. ΟΙ ΑΠΟΦΑΣΕΙΣ *(εγκρίθηκαν από τον Giorgio, 2026-09-10)*

| # | Απόφαση |
|---|---|
| **Δ1** | `emailCategories` **ίδιου σχήματος** με το `categories`, **μόνο στενεύει**, απουσία = `'on'`. Τιμή `'on'\|'off'` (ένωση, όχι boolean ⇒ αύριο `'daily'` ανά τύπο χωρίς migration). **Μία** πολιτική (`notification-preference-policy.ts`) για κουδούνι, email, οθόνη, σελίδα token. Καμία migration |
| **Δ2** | `List-Unsubscribe`: μεμονωμένο email ⇒ **μόνο αυτός ο τύπος**· σύνοψη ⇒ **όλα** (όπως σήμερα)· υποσέλιδο σύνοψης «Λάβατε: …» προς τη σελίδα προτιμήσεων *(Α2)* |
| **Δ3** | Token v2 με εμβέλεια **μέσα στην υπογραφή**· τα v1 γίνονται δεκτά για πάντα = «όλα» *(Α2)* |
| **Δ4** | Δεύτερος έλεγχος **τη στιγμή της αποστολής**, με το **ίδιο** `emailSuppressionReason` · `eventType` στην ουρά ως γεγονός *(Α1)* |
| **Δ5** | Υποχρεωτικά = κλειδωμένα «Πάντα» με εξήγηση· email καθολικά κλειστό ⇒ γραμμές απενεργοποιημένες, τιμές **διατηρούνται** *(Α3)* |
| **Δ6** | Εκτός εύρους, ονομασμένα: σίγαση **ανά ζήτηση** (το «saved search» του Zillow) · συχνότητα ανά τύπο |
| **Δ7** | Boy Scout: μία συγχώνευση (Ε1) · γραμμές που λείπουν (Ε4, Α3) · αυτό το ADR (Ε5) |
| **Δ8** | *(Α3)* Μήτρα **ιεραρχική**, όχι καναλιών: «Ειδοποίηση» (κύριος) · «Και με email» (στενεύει) — μια στήλη «Στην εφαρμογή» θα έλεγε ψέματα για το Δ1. Switch (αυτόματη αποθήκευση), variant **`success`** — το `default` είναι **αόρατο** ανοιχτό στο σκούρο θέμα (μετρημένο, §6β). Υποχρεωτικά = 🔒 «Πάντα» **χωρίς** διακόπτη + **ορατή** εξήγηση (όχι tooltip). Email κλειστά ⇒ στήλη ανενεργή, τιμές ορατές + σύνδεσμος που **εστιάζει** τη ρύθμιση email — **δεν γράφει** (καμία μαντεψιά συχνότητας). **Χωρίς** ομαδικές ενέργειες. **Χωρίς** τοπικό αντίγραφο: snapshot = αλήθεια, εγγραφές από **ένα** σημείο, κανένα πάγωμα |

🔑 **Γιατί δεν είναι δεύτερη αλήθεια (ADR-749)**: το `categories` απαντά *«θέλω αυτόν τον τύπο;»*, το
`emailCategories` *«…και με email;»*. Κανένας συνδυασμός δεν στέλνει email για τύπο που ο άνθρωπος
έκλεισε ολόκληρο, και τα δύο τα διαβάζει **μία** συνάρτηση.

---

## 5. Η ΡΟΗ (μετά την Α1)

```
παραγωγός ─▶ dispatchNotification
               ├─ categorySettingEnabled(settings, mapping)  ──(κλειστό)──▶ ούτε κουδούνι ούτε email
               └─ queueNotificationEmail({ eventType, … })
                    └─ decideEmailDelivery(settings, { isMandatory, setting })
                         └─ emailSuppressionReason ─(λόγος)─▶ καμία εγγραφή στην ουρά
                    └─ ουρά: metadata.{ recipientId, eventType, notificationId? }
outbound-email-flush ─▶ toPendingEmail ─▶ gateQueuedEmails  (ΜΙΑ getAll για όλους τους παραλήπτες)
                         ├─ σιγασμένο ─▶ status:'cancelled' + suppressedReason   (κάδος `suppressed`)
                         └─ υπόλοιπα ─▶ planEmailDelivery (σύνοψη/μεμονωμένα) ─▶ αλυσίδα παρόχων
```

**Σειρά ελέγχων (συμβόλαιο)**: υποχρεωτικό ⇒ **ποτέ** σίγαση → `global-disabled` → `email-disabled`
→ `frequency-disabled` → `category-disabled` → `type-email-disabled`.

---

## 6. ΤΙ ΑΛΛΑΞΕ (Α1)

**Νέα**: `services/user-notification-settings/{user-notification-settings.merge, user-notification-settings.email-types,
notification-preference-policy}.ts` · `server/notifications/email-send-gate.ts` · `lib/cron/jobs/outbound-email-queue-doc.ts`
(εξαγωγή κατά ευθύνη από τον αγωγό, 499 → 452 γραμμές).

**Αλλαγμένα**: `…types.ts` (`NotificationCategorySettingsMap` · `NotificationCategory` **παράγεται** από αυτόν ·
`isEmailFrequency` · `emailCategories`) · `…mapper.ts` και `server/notifications/user-notification-settings-store.ts`
(**αναθέτουν** στη μία συγχώνευση· + `loadUserNotificationSettingsMany` με `getAll`) · `email-delivery-window.ts`
(`emailSuppressionReason` · δύο νέοι λόγοι) · `notification-email-leg.ts` (`eventType`) · `notification-orchestrator.ts`
(πολιτική· περνά τον τύπο) · `server/comms/orchestrator.ts` (τύπος `metadata.email.eventType`) · `email-digest.ts`
(`PendingEmail.eventType`) · `outbound-email-flush.job.ts` (πύλη · κάδος `suppressed` στο ισοζύγιο) ·
`config/notification-events.ts` (`isNotificationEventType`) · `lib/notifications/email-subscription-contract.ts`
(ο ιδιωτικός πίνακας συχνοτήτων → `isEmailFrequency`) · `src/i18n/generated/shell-slice.manifest.json`
(μόνο αποτυπώματα εισόδων· **κανένα** μέγεθος slice δεν άλλαξε).

---

## 6α. Α2 — Ο ΔΙΑΚΟΠΤΗΣ ΑΠΟ ΤΟ ΙΔΙΟ ΤΟ EMAIL *(2026-09-10)*

```
μεμονωμένο email τύπου X ─▶ List-Unsubscribe: token v2 [email-sub, v2, uid, "X"] ─▶ one-click ⇒ { type, [X], off }
                          └▶ υποσέλιδο «Να μη λαμβάνω τέτοια email» ─▶ σελίδα με τον X ΜΠΡΟΣΤΑ
σύνοψη (τύποι X,Y)       ─▶ List-Unsubscribe: token v2 [..., "all"] ─▶ one-click ⇒ unsubscribe (Δ2)
                          └▶ «Διαχείριση ειδοποιήσεων email» ─▶ σελίδα με X,Y μπροστά (εμβέλεια στο token)
παλιό email (token v1)   ─▶ δεκτό ΓΙΑ ΠΑΝΤΑ, ως «όλα»
```

| Κομμάτι | Πού | Σημείωση |
|---|---|---|
| Εμβέλεια | `lib/notifications/email-subscription-scope.ts` | `all` \| τύποι· **ποτέ** υποχρεωτικός· `emailScopeOf(eventTypes)` (δύο συμβάντα ίδιου διακόπτη ⇒ ένας) |
| Διαδρομή διακόπτη | `notification-preference-policy.ts` | `settingPathOf` · `parseSettingPath` (έλεγχος έναντι των **προεπιλογών** — όχι δεύτερη λίστα) · `isMandatorySetting` · `mutedEmailTypes` |
| Token v2 | `email-subscription-token.service.ts` | Η εμβέλεια **μέσα στην υπογραφή** ⇒ «μόνο ταιριάσματα» δεν γίνεται «όλα» |
| Συμβόλαιο | `email-subscription-contract.ts` | `EmailGlobalState` / `EmailSubscriptionState` (+`mutedTypes`) · αλλαγή `type` · `restore` = **μόνο καθολικά** |
| Συγγραφέας | `server/notifications/email-subscription.ts` | Γράφει **μόνο** `emailCategories.<κατ>.<κλειδί>` (`merge:true` σε βάθος) |
| Φάκελος/απόδοση | `notification-email-envelope.ts` · `notification-email-render.ts` · `email-texts.ts` (`links.manageType`) | `EmailLinks` παίρνουν εμβέλεια· `RenderableMessage.eventType` |
| Μητρώο γραμμών | **`config/notification-preference-rows.ts`** (νέο SSoT) | Το `CATEGORY_CONFIGS` της οθόνης **παράγεται** από αυτό· **πλήρες** (άγκυρα Μ1): μπήκαν procurement + `contactTrashed` · `contactPermanentlyDeleted` · `newBuilding` |
| Σελίδα | `EmailPreferencesPanel.tsx` + **`EmailTypePreferences.tsx`** | Εστίαση πάνω · όλες οι ομάδες σε `<details>` · υποχρεωτικά = «Πάντα» · email κλειστά ⇒ διακόπτες ανενεργοί, τιμές ορατές |

🔶 **Εκλέπτυνση του Δ2 (εγκρίθηκε με το πλάνο)**: το υποσέλιδο της σύνοψης **δεν** γράφει ονόματα τύπων. Ο server
δεν διαβάζει locale (δόγμα `email-texts.ts`) — ονόματα μέσα στο email θα ήταν δεύτερη αλήθεια δίπλα στις ετικέτες της
οθόνης. Το email κουβαλά **ποιους** τύπους (στο token)· τα **ονόματα** τα δείχνει η σελίδα.

🔴 **Εύρημα που άλλαξε το εύρος**: ο σύνδεσμος «Να μη λαμβάνω τέτοια email» θα οδηγούσε και σε τύπους **χωρίς γραμμή** —
οι 5 ζωντανοί τύποι procurement δεν είχαν ούτε γραμμή ούτε ετικέτα (Ε4). Άρα το μητρώο έγινε **πλήρες ήδη στην Α2**,
όχι στην Α3. Παρενέργεια (θετική): η οθόνη ρυθμίσεων δείχνει πλέον την κατηγορία procurement και τις 3 γραμμές.

Route slice `/email/preferences/[token]`: **1804 → 4665** bytes, **μετρημένο** (ο γεννήτορας αρνήθηκε σωστά, Κ2)· λόγος
στο `.i18n-shell-slice.json` → `history`.

---

## 6β. Α3 — Η ΣΤΗΛΗ EMAIL ΣΤΗΝ ΟΘΟΝΗ ΡΥΘΜΙΣΕΩΝ *(2026-09-10)*

```
/o/<χώρος>/account/notifications
  NotificationSettings ─ useSettingsSubscription   snapshot = η ΜΟΝΗ αλήθεια (η αρχική ανάγνωση δεν πατά snapshot)
                       ─ useNotificationSettingsWrites   ΕΝΑ σημείο εγγραφών · κανένα πάγωμα · αποτυχία ⇒ toast
                       ─ NotificationPreferenceMatrix ◀── PREFERENCE_TABLE (κοινό με τη σελίδα token)
                            [Είδος] [Ειδοποίηση = categories] [Και με email = emailCategories]
                            υποχρεωτικό        ⇒ 🔒 Πάντα | 🔒 Πάντα       (κανένας διακόπτης)
                            κύριος κλειστός    ⇒ email ανενεργό, τιμή ορατή
                            !emailsAreOn       ⇒ στήλη ανενεργή, τιμές ορατές + «Μετάβαση στη ρύθμιση email» (εστίαση)
```

| Κομμάτι | Πού | Σημείωση |
|---|---|---|
| Πίνακας γραμμών | `services/user-notification-settings/notification-preference-table.ts` (νέο) | **Ανύψωση** από τη σελίδα token (N.0.2): `PREFERENCE_TABLE` · `preferenceRowOf` · `hasMandatory`· η διαδρομή περνά από το `parseSettingPath` |
| Εγγραφή email τύπου | `UserNotificationSettingsService.setEmailTypeMode` | Dotted path `emailCategories.<κατ>.<κλειδί>`. `writableSettingRef`: άγνωστος ή υποχρεωτικός ⇒ ρίχνει — **και** στο `toggleCategorySetting` |
| Εγγραφές οθόνης | `components/account/useNotificationSettingsWrites.ts` (νέο) | Αντί για 6 handlers + κοινό `isSaving`· `saveState` (Google Docs)· αποτυχία ⇒ `useNotifications().error`, και η κεφαλίδα **δεν** λέει «αποθηκεύτηκαν» |
| Μήτρα | `components/account/NotificationPreferenceMatrix.tsx` (νέο) | `<th scope>` + `aria-labelledby` γραμμή+στήλη · `emailsAreOn` (**το ίδιο** με τη σελίδα token) · υπότιτλος στήλης = συχνότητα |
| Εμφάνιση | `components/account/useNotificationSettingsUi.ts` (νέο) | Τα 5 design hooks + `t`, **μία** φορά — το jscpd (CHECK 3.28) έπιασε δίδυμα μπλοκ οθόνης ↔ μήτρας |
| Config οθόνης | `notification-settings-config.ts` | `CATEGORY_ICONS` · `FREQUENCY_LABEL_KEYS` (**ένας** πίνακας: επιλογέας **και** υπότιτλος) · `EMAIL_FREQUENCY_OPTIONS` · `DELIVERY_CONTROL_IDS`· το `CATEGORY_CONFIGS` **διαγράφηκε** |
| Λεξιλόγιο | `common-account:account.notificationSettings.preferences.*` | «Πάντα» · εξήγηση υποχρεωτικών · «τα email είναι κλειστά» **μετακόμισαν** από το `auth:` — τα διαβάζουν **και οι δύο** επιφάνειες |

🔴 **Ευρήματα που διορθώθηκαν στο πέρασμα**: (1) η αρχική `getSettings` μπορούσε να **πατήσει πάνω σε νεότερο
snapshot** — γρήγορο κλικ πριν τελειώσει η ανάγνωση ⇒ η οθόνη έδειχνε την παλιά τιμή· πλέον εφαρμόζεται μόνο αν δεν έχει
έρθει snapshot· (2) `'Firebase not initialized'` ωμό αγγλικό στην οθόνη (N.11) → `loadError`· (3) ο inline
`onSettingsChange` του γονέα **ξανάνοιγε τη συνδρομή** σε κάθε απόδοσή του → ref· (4) ο καθολικός διακόπτης δεν είχε
προσβάσιμο όνομα → `aria-labelledby`· (5) `value as EmailFrequency` → `isEmailFrequency`· (6) δύο δίδυμοι επιλογείς στο
τμήμα παράδοσης → `EmailSubSetting`· (7) 🔴 **βρέθηκε ΜΟΝΟ στον browser** (τα tests ήταν πράσινα): με `variant="default"`
ο **ανοιχτός** διακόπτης ήταν **αόρατος** στο σκούρο θέμα — μετρημένο `getComputedStyle`: track `rgb(29,40,58)` ≡ φόντο
κάρτας (`--primary` ≡ `--card`, CHECK 3.38). → `success` (πράσινο/γκρι) στη μήτρα **και** στη σελίδα token.

**Περπάτημα στον browser (2026-09-10, σκούρο θέμα, χώρος γραφείου)**: 5 πίνακες · 56 διακόπτες μήτρας · 8 «Πάντα» ·
εξήγηση υποχρεωτικών ορατή · κεφαλίδες «Είδος / Ειδοποίηση / Και με email · Ημερήσια σύνοψη» · όνομα διακόπτη =
«…ταιριάζει στη ζήτησή μου | Και με email» · email ανενεργό στις 5 γραμμές με κλειστό κύριο · 0 ωμά κλειδιά i18n ·
καμία οριζόντια κύλιση · κονσόλα: μόνο θόρυβος επέκτασης Chrome.

**Επαλήθευση**: 6 σουίτες / 63 tests (3 νέες) · **μεταλλάξεις 3/3 πιάστηκαν** (φρουρός υποχρεωτικού στο service · `!master`
στη μήτρα · toast αποτυχίας) · CHECK 3.34 8/331 · φρεσκάδα τύπων 56 · `jscpd:diff` 0 κλώνοι σε 15 αρχεία · route slice
σελίδας token 4665 → 4685 (εντός σφράγισης).

---

## 7. ΠΑΛΙΑ ΔΕΔΟΜΕΝΑ — ΚΑΘΕ ΑΠΟΥΣΙΑ ΣΒΗΝΕΙ ΜΟΝΟ Ο,ΤΙ ΤΗΣ ΑΝΗΚΕΙ

| Λείπει | Αποτέλεσμα |
|---|---|
| `emailCategories` στο έγγραφο | Όλοι οι τύποι `'on'` — **καμία** migration |
| `eventType` σε έγγραφο της ουράς (πριν την Α1) | Η πύλη κρίνει **μόνο** τους καθολικούς διακόπτες |
| `recipientId` (πριν το ADR-848) | Δεν κρίνεται — **ποτέ** μαντεψιά από διεύθυνση |
| Τύπος που δεν υπάρχει πια (`isNotificationEventType`) | Μόνο καθολικοί έλεγχοι |
| Ρυθμίσεις μη αναγνώσιμες τη στιγμή της αποστολής | Ο αγωγός **ρίχνει πριν αγγίξει τίποτα** ⇒ `pending` για το επόμενο πέρασμα |

---

## 8. ΕΝΑΛΛΑΚΤΙΚΕΣ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΑΝ

- **Αλλαγή του `categories` σε `{ inApp, email }` ανά κλειδί** — migration κάθε εγγράφου και κάθε αναγνώστη, για
  συμμετρία που κανείς δεν ζήτησε («email ναι, κουδούνι όχι» δεν είναι σενάριο σήμερα).
- **Λίστα εξαιρέσεων `emailMuted: string[]`** — κλειδιά με τελεία (`properties.demandListingMatch`) δεν δένονται από
  τον μεταγλωττιστή στους διακόπτες, και δεν επεκτείνονται σε `'daily'`.
- **Boolean αντί για κατάσταση** — θα έκανε migration τη συχνότητα ανά τύπο (Δ6).
- **Σίγαση κατά όνομα συμβάντος** — δύο συμβάντα μοιράζονται διακόπτη (Ε-§2)· ο άνθρωπος βλέπει **διακόπτες**.
- **Πύλη αποστολής «fail-open»** (στείλ' τα αν δεν διαβάζονται οι ρυθμίσεις) — θα αγνοούσε ρητή «Διακοπή».
- **Σιγασμένο ⇒ `failed`** — θα φούσκωνε το dead-letter με μηνύματα που **σωστά** δεν έφυγαν· **διαγραφή** — θα
  έσβηνε την απάντηση στο «γιατί δεν μου ήρθε;».

---

## 9. 🔶 ΔΗΛΩΜΕΝΑ ΟΡΙΑ

1. ✅ ~~Μετά την Α1 το `emailCategories` ήταν διακόπτης που κανένας άνθρωπος δεν μπορούσε να γυρίσει.~~ **Η Α2 τον
   έκανε προσιτό από το ίδιο το email** (one-click ανά τύπο + σελίδα)· **η Α3 από την οθόνη ρυθμίσεων** (στήλη email,
   υποχρεωτικά κλειδωμένα — §6β).
2. Αλλαγή **συχνότητας** μετά την ουρά (π.χ. `daily` → `realtime`) δεν μετακινεί ώρα που έχει ήδη προγραμματιστεί —
   μόνο η **σίγαση** ξανακρίνεται.
3. Καμία ζωντανή αποστολή (Π3)· όλες οι άγκυρες με ψεύτικο δίκτυο και ψεύτικη Firestore.
4. 🔶 **`List-Id` ανά λίστα** (σύσταση των Google subscription guidelines) — δεν μπήκε ακόμη. Το `List-Unsubscribe`
   ανά τύπο δουλεύει χωρίς αυτό· το `List-Id` βοηθά το πρόγραμμα email να **ονομάσει** τη λίστα.
5. 🔶 **Σίγαση ανά ζήτηση** (Δ6, το «saved search» του Zillow) — εκτός εύρους, ονομασμένο.
6. 🔶 Κανένα περπάτημα **της σελίδας token και της οθόνης ρυθμίσεων** στον φυλλομετρητή — οι διακόπτες κλειδώνονται από
   άγκυρες jsdom, όχι από ζωντανό πέρασμα (ούτε το πλάτος 400px της μήτρας).
7. 🔶 **Ομαδικές ενέργειες** ανά ομάδα/στήλη («όλα τα email των Προμηθειών κλειστά») — **όχι**: δεν επαληθεύτηκαν σε
   κανέναν από τους μεγάλους (§3)· αν ανοίξει, **μία** εγγραφή με πολλά dotted paths (ατομική), ποτέ ανάγνωση-και-γραφή
   όπως το αχρησιμοποίητο `toggleCategory` (που κουβαλά ήδη `TODO(ADR-253-RC-8)`).
8. 🔶 `globalEnabled = false` **κρύβει** τις ομάδες (όπως πριν την Α3) — δεν τις δείχνει ανενεργές με τις τιμές τους.
9. 🔶 Ο **ιδιώτης** (`/o/me/*`) δεν έχει οθόνη ρυθμίσεων (ADR-848 §9 #6)· η μόνη του επιφάνεια είναι η σελίδα token.
10. 🔶 Οι καθολικοί διακόπτες (ειδοποιήσεις · κουδούνι · email) κρατούν το variant `status` (πράσινο/κόκκινο)· η μήτρα
    και η σελίδα token χρησιμοποιούν `success` (πράσινο/γκρι) — ~60 κόκκινοι διακόπτες θα διαβάζονταν ως σφάλματα.
    🔴 Το `default` **δεν** είναι επιλογή στο σκούρο θέμα: `--primary` ≡ `--card` (CHECK 3.38) ⇒ αόρατο «ανοιχτό».

---

## 10. ΑΓΚΥΡΕΣ

`user-notification-settings-merge` (Μ0 = **εκτέλεση** της παλιάς ρηχής συγχώνευσης · Ο1/Ο2 διακομιστής ≡ πελάτης) ·
`notification-preference-policy` (σειρά λόγων · υποχρεωτικό · παλιό έγγραφο) · `email-send-gate` (ό,τι δεν κρίνεται ·
μία ανάγνωση · αποτυχία ⇒ ρίχνει) · `notification-email-leg` Τ1/Τ2 · `outbound-email-flush` Ψ1–Ψ3 + ισοζύγιο με
`suppressed` · *(Α3)* `notification-preference-matrix` (Π1–Π6γ: δύο διακόπτες ανά γραμμή · **0** διακόπτες στα
υποχρεωτικά · email ανενεργό με τιμή ορατή · `disabled` συχνότητα = κλειστά · Δ1–Δ4: κάθε διακόπτης ζητά τον **δικό** του
τύπο, ο σύνδεσμος **εστιάζει** χωρίς εγγραφή · Ο1: όνομα = γραμμή + στήλη) · `notification-settings-writes` (Ε1 αποτυχία
ορατή, όχι «αποθηκεύτηκαν» · Π1 δύο κλικ ⇒ δύο εγγραφές αμέσως) · `user-notification-settings-service` (Γ1–Γ3 μόνο το πεδίο
της · Φ1–Φ3 υποχρεωτικός/άγνωστος/`__proto__` ⇒ καμία εγγραφή). **Όχι tsc (N.17).**

---

## 11. CHANGELOG

- **2026-09-10** — Γέννηση. Τεκμηρίωση του υπάρχοντος μοντέλου (έλειπε)· έρευνα με πηγές· Δ1–Δ7.
  **Α1 υλοποιημένη**: μοντέλο `emailCategories` · μία συγχώνευση (Ε1) · μία πολιτική · πύλη της αποστολής (Ε2) ·
  `eventType` στην ουρά. 17 σουίτες του επηρεαζόμενου συνόλου πράσινες (202 tests, μαζί με τις 3 νέες) ·
  CHECK 3.34 (8 σουίτες / 331 tests) πράσινο μετά την αναπαραγωγή του manifest.
- **2026-09-10 (β)** — **Α2 υλοποιημένη** (§6α): token v2 με εμβέλεια στην υπογραφή (v1 δεκτό για πάντα) ·
  one-click **ανά τύπο** στα μεμονωμένα, «όλα» στη σύνοψη · υποσέλιδο «Να μη λαμβάνω τέτοια email» · σελίδα με
  διακόπτη ανά τύπο, εστίαση στους τύπους του email, «Πάντα» στα υποχρεωτικά, αναίρεση **μόνο ό,τι άλλαξε** ·
  **κοινό, πλήρες** μητρώο γραμμών (procurement + 3 γραμμές — Ε4 για τη σελίδα **και** την οθόνη) · route slice
  1804 → 4665 (μετρημένο). Εκλέπτυνση Δ2: ονόματα τύπων μόνο στη σελίδα.
- **2026-09-10 (γ)** — **Α3 υλοποιημένη** (§6β, Δ8): μήτρα **ιεραρχική** «Ειδοποίηση · Και με email» στην οθόνη
  ρυθμίσεων · υποχρεωτικά = 🔒 «Πάντα» χωρίς διακόπτη + ορατή εξήγηση (Ε4 έκλεισε) · email κλειστά ⇒ στήλη ανενεργή,
  τιμές ορατές, σύνδεσμος που εστιάζει · υπότιτλος στήλης = συχνότητα · `setEmailTypeMode` + φρουρός υποχρεωτικού/αγνώστου
  στον πελάτη · **ένα** σημείο εγγραφών χωρίς πάγωμα, αποτυχία ορατή · πίνακας γραμμών **ανυψωμένος** και κοινός με τη
  σελίδα token · λεξιλόγιο «Πάντα»/«κλειστά» → `common-account` · διόρθωση αγώνα αρχικής ανάγνωσης ↔ snapshot.
  Έρευνα με πηγές (§3): Jira · Airbnb · Figma · NN/g · Primer · Radix #1914 · **πηγαίος κώδικας** του Firestore SDK για την
  επαναφορά απορριφθείσας εγγραφής. 6 σουίτες / 63 tests · μεταλλάξεις 3/3 · CHECK 3.34 · jscpd 0.
