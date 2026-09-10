# ADR-849 — **ΜΟΝΤΕΛΟ ΠΡΟΤΙΜΗΣΕΩΝ ΕΙΔΟΠΟΙΗΣΕΩΝ: ΤΥΠΟΣ × ΚΑΝΑΛΙ — «ΟΧΙ EMAIL ΓΙΑ ΤΑΙΡΙΑΣΜΑΤΑ, ΝΑΙ ΓΙΑ ΕΝΤΟΛΕΣ»**

> **Κατάσταση**: 🟡 **Α1 υλοποιημένη** *(2026-09-10: μοντέλο + μία συγχώνευση + δύο πύλες server)* · ⏭️ Α2 (email/token/σελίδα) · ⏭️ Α3 (οθόνη ρυθμίσεων)
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
| Ε4 | Διακόπτες **απρόσιτοι** (ADR-749 §5): η κατηγορία **procurement** λείπει από την οθόνη (5 ζωντανοί τύποι) · `contactTrashed` · `contactPermanentlyDeleted` · `newBuilding`· οι διακόπτες ασφαλείας **φαίνονται** ότι κλείνουν ενώ δεν κλείνουν | ⏭️ Α3 |
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

🔶 Κανείς δεν τεκμηριώνει δημόσια τη συμπεριφορά της οθόνης όταν το email είναι καθολικά κλειστό — δική μας απόφαση (Δ5).

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

1. 🔴 **Μετά την Α1 το `emailCategories` είναι διακόπτης που ΚΑΝΕΝΑΣ ΑΝΘΡΩΠΟΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΓΥΡΙΣΕΙ** — δεν
   υπάρχει ακόμη ούτε οθόνη ούτε σύνδεσμος. Αδρανής φρουρός **κατά σχεδιασμό, για μία φάση** (ADR-749 §5): η Α2
   (σελίδα token) και η Α3 (οθόνη) τον κάνουν προσιτό. Η **δεύτερη πύλη** (Ε2) όμως δουλεύει **ήδη** για τους
   καθολικούς διακόπτες: η «Διακοπή» του ADR-848 τηρείται πλέον και για ό,τι περιμένει στην ουρά.
2. Αλλαγή **συχνότητας** μετά την ουρά (π.χ. `daily` → `realtime`) δεν μετακινεί ώρα που έχει ήδη προγραμματιστεί —
   μόνο η **σίγαση** ξανακρίνεται.
3. Καμία ζωντανή αποστολή (Π3)· όλες οι άγκυρες με ψεύτικο δίκτυο και ψεύτικη Firestore.

---

## 10. ΑΓΚΥΡΕΣ

`user-notification-settings-merge` (Μ0 = **εκτέλεση** της παλιάς ρηχής συγχώνευσης · Ο1/Ο2 διακομιστής ≡ πελάτης) ·
`notification-preference-policy` (σειρά λόγων · υποχρεωτικό · παλιό έγγραφο) · `email-send-gate` (ό,τι δεν κρίνεται ·
μία ανάγνωση · αποτυχία ⇒ ρίχνει) · `notification-email-leg` Τ1/Τ2 · `outbound-email-flush` Ψ1–Ψ3 + ισοζύγιο με
`suppressed`. **Όχι tsc (N.17).**

---

## 11. CHANGELOG

- **2026-09-10** — Γέννηση. Τεκμηρίωση του υπάρχοντος μοντέλου (έλειπε)· έρευνα με πηγές· Δ1–Δ7.
  **Α1 υλοποιημένη**: μοντέλο `emailCategories` · μία συγχώνευση (Ε1) · μία πολιτική · πύλη της αποστολής (Ε2) ·
  `eventType` στην ουρά. 17 σουίτες του επηρεαζόμενου συνόλου πράσινες (202 tests, μαζί με τις 3 νέες) ·
  CHECK 3.34 (8 σουίτες / 331 tests) πράσινο μετά την αναπαραγωγή του manifest.
