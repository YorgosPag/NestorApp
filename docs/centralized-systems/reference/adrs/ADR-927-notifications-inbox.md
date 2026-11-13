# ADR-927: Inbox ειδοποιήσεων — μία ροή, ένα store, ενέργειες σε ένα hook

**Κατάσταση**: IMPLEMENTED (2026-11-03) — κλαδί `agent/crm-notifications-page`, χωρίς land. Ο ζωντανός έλεγχος στην εφαρμογή μένει ανοιχτός.
**Ημερομηνία**: 2026-11-03
**Σχετικά**: ADR-849 Β1 (μόνιμος σύνδεσμος) · ADR-841 §7 Α18 (προορισμός από τον παραγωγό) · ADR-867 Ε10 (`withdrawn`) · ADR-834 (κουδούνι/συρτάρι στο κέλυφος) · ADR-892 §13 (`bodyKey`) · ADR-866 §2.10 Β2 (toast με ενέργεια) · ADR-253

Σήμανση: **[Μ]** μετρήθηκε στον κώδικα (`24020208`). **[Σ]** συμπέρασμα. **[Π]** εξωτερική πηγή, §7.

> ⚠️ Ο κώδικας παρέπεμπε σε «ADR-027 — CRM Notifications Integration». **Φάντασμα**: το ADR-027 είναι τα DXF Keyboard Shortcuts. Οι παραπομπές του Inbox δείχνουν πλέον εδώ.

## 1. Το πρόβλημα

- [Μ] **Δύο ακροατές για τα ίδια έγγραφα.** Το κουδούνι γέμιζε το `stores/notificationCenter` (`useFirestoreNotifications`). Η σελίδα `/crm/notifications` άνοιγε **δεύτερο** `subscribeToNotifications` με δική της μνήμη (`crm/notifications/useNotifications.ts`).
- [Μ] **Δύο αλήθειες.** Το store έκρυβε `dismissed`/`withdrawn` (`isHiddenFromInbox`), η σελίδα όχι. Απόρριψη στο συρτάρι ⇒ η ειδοποίηση έμενε στη σελίδα και μετρούσε στο «Σύνολο».
- [Μ] **Χαμένο σώμα.** Η ζωντανή σύνδεση είχε χειρόγραφο αντίγραφο της `toNotification` χωρίς `bodyKey`/`bodyParams`. Κάθε ειδοποίηση που έφτανε ζωντανά έχανε το μεταφρασμένο σώμα.
- [Μ] **Μαντεμένος τύπος.** Η σελίδα έψαχνε λέξεις στο `source.feature` (`'lead'` ⇒ «Νέο Lead»), κάτι που απαγορεύει το ADR-841 Α18. Ο δηλωμένος τύπος (`meta.eventType`) υπήρχε στη βάση, αλλά ο πελάτης δεν τον τυποποιούσε.
- [Μ] **«Φόρτωση περισσότερων» νεκρό.** Το `GET /api/notifications` **αγνοεί** το `cursor` ⇒ γυρνούσε πάντα την πρώτη σελίδα. Επιπλέον, το `NotificationAction.url` του zod είναι `.url()` και απορρίπτει τις σχετικές διαδρομές.
- [Μ] **Κάρτα που δεν πατιόταν**: `div`, χωρίς άνοιγμα, χωρίς απόρριψη, χωρίς φίλτρα και ομαδοποίηση.
- [Μ] Οι ενέργειες (αναγνωσμένη · απόρριψη · Προβολή) ζούσαν **μόνο** μέσα στο συρτάρι.

## 2. Τι κάνουν οι μεγάλοι

| Παίκτης | Πρακτική |
|---|---|
| GitHub Notifications | Προβολές Inbox/Done, φίλτρο «Unread», `E` = Done, `Shift+I`/`Shift+U` αναγνωσμένη/μη, φίλτρο στη διεύθυνση (`?query=`) [Π] |
| Linear Inbox | Φίλτρο ανά τύπο, αναβολή (`H`), διαγραφή (`E`/`Backspace`) — **όχι** αρχειοθέτηση [Π] |
| Gmail | Αναίρεση στο snackbar μετά την αρχειοθέτηση· `j`/`k`· η εστίαση πάει στο επόμενο |
| Firestore SDK | Ένας ακροατής στόχου μοιράζεται ανάμεσα σε ταυτόσημα queries |
| WAI-ARIA APG | Roving tabindex σε λίστα· κουμπιά εναλλαγής (`aria-pressed`) για φίλτρα, όχι tabs |

## 3. Η απόφαση

**Κ1. Μία ροή ανά χρήστη, δανεική** (`stores/notification-feed.ts`). Όποιος θέλει ειδοποιήσεις καλεί `acquireNotificationFeed(uid)` και παίρνει πίσω ιδεμποτικό `release`. Ο πρώτος ανοίγει τη ροή, ο τελευταίος την κλείνει και **αδειάζει** τη μνήμη. Αλλαγή χρήστη ⇒ κλείσιμο και άδειασμα πριν ανοίξει η νέα. Το «Δοκιμή ξανά» αλλάζει **σύνδεση** (γενιά), όχι ροή, ώστε οι δανειζόμενοι να μη χάνουν το `release` τους· απαντήσεις παλιάς γενιάς πετιούνται. Το `useFirestoreNotifications` απλώς δανείζεται.

**Κ2. Ένα store** (`notificationCenter`). Το διαβάζουν το κουδούνι, το συρτάρι και η σελίδα. Ο κέρσορας-συμβολοσειρά αντικαταστάθηκε από `hasMore`/`loadingOlder`. Νέο `setDeliveryState(ids, state)`. Η σειρά «νεότερη πρώτη» έχει ισοπαλαιστή το `id`.

**Κ3. Σελιδοποίηση με δρομέα-τιμή** (`fetchNotificationsBefore`): `orderBy(createdAt ↓) · orderBy(__name__ ↓) · startAfter(createdAt, id)`, στη βάση και όχι μέσω REST. Το `id` λύνει τις ισοπαλίες στο ίδιο χιλιοστό. Ο υπάρχων δείκτης `userId ↑ · createdAt ↓` αρκεί, γιατί το `__name__` μπαίνει σιωπηρά. Το παράθυρο και η σελίδα έχουν **ένα** μέγεθος (`NOTIFICATION_PAGE_SIZE`).

**Κ4. Μία μετατροπή** (`toNotification`) και για τη ζωντανή σύνδεση και για τις σελίδες.

**Κ5. Ενέργειες σε ένα hook** (`components/notifications/useNotificationActions.ts`): `markRead` · `markUnread` · `dismiss` (με **Αναίρεση**, που γράφει πίσω την **προηγούμενη** κατάσταση) · `open` (ο ΕΝΑΣ δρόμος `drawerDestination`). Όλες αισιόδοξες, με ανάγνωση τη στιγμή του γεγονότος (`getState()`). Το συρτάρι και η σελίδα το καλούν· ο κώδικας του συρταριού έχασε ~90 γραμμές.

**Κ6. Η κατηγορία είναι δηλωμένη**: `meta.eventType` → `EVENT_CATEGORY_MAP` → κατηγορία των **ρυθμίσεων** (ίδια σειρά, ίδια ετικέτα `NOTIFICATION_PREFERENCE_GROUPS[].titleKey`, ίδιο εικονίδιο `CATEGORY_ICONS`). Χωρίς `eventType` ⇒ `other`. Νέος τύπος πελάτη `NotificationMeta`.

**Κ7. Το Inbox** (`crm/notifications/NotificationInbox*`):
- φίλτρα «Όλες / Μη αναγνωσμένες» και ανά κατηγορία, με μετρητές μη αναγνωσμένων· **στη διεύθυνση** (`?view=unread&category=crm`), η προεπιλογή χωρίς παράμετρο·
- ομάδες «Σήμερα / Χθες / ημερομηνία» στη **ζώνη του ανθρώπου** (`useUserTimeZone`)· το «χθες» είναι ημερολογιακό, όχι `now − 24h` (μέρες 23/25 ωρών)· αλλάζει τα μεσάνυχτα χωρίς ανανέωση·
- γραμμή `<article>` με τίτλο-κουμπί, «μη αναγνωσμένη» και χωρίς χρώμα (έντονα · τελεία · `sr-only`), ενέργειες με tooltip·
- πλήκτρα `j`/`k`/βέλη · `Home`/`End` · `Enter`/`o` · `e` (η εστίαση πάει στο επόμενο) · `Shift+I`/`Shift+U`, μόνο πάνω σε γραμμή, ποτέ με Ctrl/Alt/Meta·
- «Παλαιότερες» ως κουμπί (όχι άπειρη κύλιση, WCAG 2.4.3), με ορατή αποτυχία και επανάληψη.

**Πάνω από τους μεγάλους** [Σ]: η κατηγορία του Inbox είναι **η ίδια** με τη μονάδα σίγασης των ρυθμίσεων· η αναίρεση επαναφέρει την **ακριβή** προηγούμενη κατάσταση (`seen`/`acted`/`delivered`), όχι «μη αναγνωσμένη»· ένας ακροατής ανά χρήστη, όσες επιφάνειες κι αν ανοίξουν.

## 4. Όρια

- Φίλτρα και μετρητές κρίνουν **ό,τι έχει φορτωθεί** (παράθυρο 50 + όσες σελίδες ζητήθηκαν). Ο αριθμός του σήματος είναι επίσης του παραθύρου, όπως ήταν και πριν.
- Οι κανόνες επιτρέπουν σε πελάτη `withdrawn` → `delivered`, γιατί η λίστα επιτρεπτών καταστάσεων δεν κοιτά την προηγούμενη. Το UI δεν το κάνει ποτέ, αφού οι αποσυρμένες δεν φτάνουν στη λίστα. Το περιεχόμενο είναι ήδη αναγνώσιμο από τον κάτοχο, άρα δεν υπάρχει διαρροή, αλλά ο κανόνας είναι πιο χαλαρός από την πρόθεση.
- Το `GET /api/notifications` **αποσύρθηκε** (2026-11-14, ADR-939 §6.1 βήμα 6Δ). Διάβαζε με client SDK μέσα στον server, άρα απαντούσε πάντα 500 «Missing or insufficient permissions», και δεν το καλούσε κανείς. Η λίστα έχει μία πηγή, τη ροή αυτού του ADR. Το `NotificationClient` μένει μόνο για το `act`, δηλαδή `POST /api/notifications/action`.
- Αναβολή (snooze) τύπου Linear: όχι. Χρειάζεται πεδίο και server-side επανεμφάνιση.

## 5. Δοκιμές

- `stores/__tests__/notification-feed.test.ts`: ένας ακροατής · κλείσιμο στον τελευταίο · ιδεμποτικό `release` · αλλαγή χρήστη · παλιά στιγμιότυπα · «δεν έχεις εταιρεία» · retry με γενιά · δρομέας-τιμή · `hasMore`.
- `components/notifications/__tests__/notification-inbox-model.test.ts`: κατηγορία από τον τύπο · φίλτρα · μετρητές · ζώνη ώρας και αλλαγή ώρας · διεύθυνση.
- `services/__tests__/notification-service-mapping.test.ts`: `bodyKey` στη ζωντανή σύνδεση · περιορισμοί σελίδας.
- `crm/pages/__tests__/CrmNotificationsPageContent.test.tsx`: μία πηγή με το συρτάρι · φίλτρο από τη διεύθυνση · `e` + αναίρεση · άνοιγμα μόνο από τον μόνιμο σύνδεσμο · «μη αναγνωσμένη».
- Μεταλλάξεις 6/6 πιάστηκαν: `bodyKey` στη ζωντανή σύνδεση · χωρίς μέτρηση αναφορών · ωμή διαδρομή · λάθος κατάσταση αναίρεσης · μαντεμένη κατηγορία · μέρα σε UTC.

## 6. Αρχεία

Νέα: `stores/notification-feed.ts` · `components/notifications/{useNotificationActions,notification-inbox-model,notification-inbox-url,notification-severity}.ts` · `components/crm/notifications/{NotificationInbox,NotificationInboxItem,NotificationInboxFilters,NotificationInboxOlder}.tsx` · `{useInboxKeyboard,inbox-category-presentation}.ts`.
Διαγράφηκαν: `crm/notifications/{useNotifications,notification-utils}.ts` · `NotificationCard.tsx`.

## 7. Πηγές

- GitHub — keyboard shortcuts (notifications): https://docs.github.com/en/enterprise-server@3.2/get-started/using-github/keyboard-shortcuts
- Linear — Inbox: https://linear.app/docs/inbox
- WAI-ARIA APG — Keyboard navigation inside components (roving tabindex): https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

## 8. Τα εργαλεία δεδομένων του Admin Console βγαίνουν από το προϊόν

**[Μ] «Μετεγκατάσταση Enterprise» (`/admin/enterprise-migration`)**: δεν μπορούσε να πετύχει ποτέ.
- Η πρόοδος ήταν ψεύτικη: έξι στάδια με `setTimeout`, ~19″ αναμονής, χωρίς δουλειά.
- Μετά ο browser έκανε `setDoc` στα `system/company` και `system/settings` με σκληρογραμμένα στοιχεία μιας εταιρείας. Αυτό είναι το παλιό μοντέλο με μία μόνο εταιρεία.
- Οι κανόνες έχουν `match /system/{docId}` → `allow write: if false` ⇒ κάθε πάτημα κατέληγε σε άρνηση πρόσβασης.
- Δεν είχε φραγή παραγωγής και έλεγχε την «υγεία» κάθε 30″.
- Το υποσύστημα `core/configuration/*` (~3.000 γραμμές: διαχειριστής ρύθμισης, hooks, tabs, μηχανή μετεγκατάστασης, «testing-validation») είχε **μόνο** αυτή τη σελίδα ως καταναλωτή.

**[Μ] «Ενημέρωση Βάσης» (`/admin/database-update`)**: σενάριο δείγματος από τον browser. Έγραφε επαφές και ξανάγραφε έως 20 πραγματικά ακίνητα (`status`, `soldTo`, `ownerId`) με σκληρογραμμένα ids. Η φραγή παραγωγής ήταν σωστή, αλλά ο σύνδεσμος του μενού οδηγούσε σε νεκρή σελίδα.

**[Π] Πρακτική των μεγάλων**: τα δεδομένα δείγματος μπαίνουν με scripts ή στον emulator, όχι από το UI του προϊόντος. Οι μεταναστεύσεις τρέχουν στον διακομιστή, εκδοσιοποιημένες, ιδεμποτικές, με dry-run και ίχνος ελέγχου. **Το repo τα έχει ήδη**: `scripts/emulator-seed-*.ts` (ADR-745, αρνείται να τρέξει εκτός emulator) και `api/admin/migrations/execute` (μηχανή με `dryRun`).

**Απόφαση** (Giorgio, 2026-11-03: «επίλεξε τον πιο επαγγελματικό τρόπο»):
- Αφαιρούνται και οι δύο σελίδες, οι καταχωρίσεις μενού, τα `LazyRoutes` και τα κλειδιά i18n.
- Αφαιρείται το νεκρό υποσύστημα `core/configuration/*`. Μένει **μόνο** το `business-rules.ts`, αυτοτελές, με τις τέσσερις τιμές των obligations **αμετάβλητες**.
- Αφαιρείται το `config/contact-info-config.ts` (δοκιμαστικά τηλέφωνα/email): μοναδικός του καταναλωτής ήταν το seed. Το βρήκε το CHECK 3.22. Βγήκε και η εγγραφή του στο `.ssot-registry.json`.
- Οι εξαιρέσεις και τα baselines των πυλών που έδειχναν τα αρχεία καθαρίστηκαν: 3.17 · 3.38 · 3.51 · catalog-columns. Το κείμενο του `.workspace-scope.json` ενημερώθηκε.

## 9. Ο drawer ζει πάνω από τον πάροχο toasts

Ο καθολικός drawer αποδίδεται στο ριζικό `app/layout.tsx` (ADR-834 §6), ενώ ο `NotificationProvider` ζει στα `(app)`/`(me)` layouts. Άρα από τον drawer το context των toasts **δεν είναι προσβάσιμο**.

Το `useNotificationActions` ζητούσε το `useNotifications`, που πετά έξω από τον πάροχο. Το prerender του `/_not-found` και του `/debug/token-info` έσπασε, και μαζί όλο το production build του `384bb147`. Η παραγωγή έμεινε στην προηγούμενη έκδοση. Τα jest tests δεν το έπιασαν, γιατί αποδίδουν τη σελίδα χωρίς το ριζικό layout.

- Νέο `useOptionalNotifications()` στον πάροχο: επιστρέφει `null` αντί να πετά.
- Το hook ενεργειών το χρησιμοποιεί. Στη σελίδα Inbox η απόρριψη έχει toast αναίρεσης. Στον drawer γίνεται **χωρίς** αναίρεση, όπως πριν από αυτό το ADR.
- Άγκυρα: `useNotificationActions.outside-provider.test.tsx`. Η μετάλλαξη (επαναφορά του `useNotifications`) πιάνεται.
- ⚠️ Ανοιχτό: για αναίρεση και στον drawer χρειάζεται ξενιστής toasts **πάνω** από τον drawer, ΕΝΑΣ μόνο `Toaster`, ώστε να μη διπλασιάζονται τα toasts.

## Changelog

- **2026-11-14** — §4: διαγράφηκε το `GET /api/notifications` (`src/app/api/notifications/route.ts`). Ο έλεγχος με grep βρήκε μηδέν καλούντες: ούτε `NotificationClient.list()/subscribe()`, ούτε `contracts/`, ούτε πύλες. Τα `ack/` και `action/` (Admin SDK) δεν αλλάζουν. Δες ADR-939 §6.1 βήμα 6Δ.

- **2026-11-03 (γ)** — §9: το production build του `384bb147` έσπασε στο prerender (`useNotifications must be used within NotificationProvider`). Διορθώθηκε με το `useOptionalNotifications` και άγκυρα με μετάλλαξη.

- **2026-11-03 (β)** — §8: «Ενημέρωση Βάσης» και «Μετεγκατάσταση Enterprise» βγήκαν από το προϊόν, μαζί με το νεκρό `core/configuration/*` (−5.433 γραμμές). Το `business-rules.ts` έγινε αυτοτελές.

- **2026-11-03** — Δημιουργία και υλοποίηση (Κ1–Κ7). Το test έπιασε σφάλμα πριν από το commit: το πρώτο σχέδιο του retry άλλαζε αντικείμενο ροής, οπότε οι παλιοί δανειζόμενοι δεν μπορούσαν να την κλείσουν. Λύθηκε με τη γενιά σύνδεσης. Boy scout: `SEVERITY_ICON`/`SEVERITY_TEXT_CLASS` βγήκαν από το συρτάρι· το `info` έγινε `--text-info` αντί για `text-primary` (ADR-770). Το «Διαγραφή» στο κουμπί απόρριψης έγινε «Απόρριψη», γιατί δεν διαγράφει τίποτα. Άγκυρα `missing-tenant-is-not-a-failure` Β4: ο αναγνώστης μετακόμισε στη ροή.
