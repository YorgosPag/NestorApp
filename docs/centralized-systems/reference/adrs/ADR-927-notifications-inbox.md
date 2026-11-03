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
- Το `GET /api/notifications` (cursor που αγνοείται, `url().` που απορρίπτει σχετικές διαδρομές) δεν διορθώθηκε. Μετά από αυτό το ADR δεν το διαβάζει κανείς για λίστα. Το `NotificationClient` μένει μόνο για το `act`.
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

## Changelog

- **2026-11-03** — Δημιουργία και υλοποίηση (Κ1–Κ7). Το test έπιασε σφάλμα πριν από το commit: το πρώτο σχέδιο του retry άλλαζε αντικείμενο ροής, οπότε οι παλιοί δανειζόμενοι δεν μπορούσαν να την κλείσουν. Λύθηκε με τη γενιά σύνδεσης. Boy scout: `SEVERITY_ICON`/`SEVERITY_TEXT_CLASS` βγήκαν από το συρτάρι· το `info` έγινε `--text-info` αντί για `text-primary` (ADR-770). Το «Διαγραφή» στο κουμπί απόρριψης έγινε «Απόρριψη», γιατί δεν διαγράφει τίποτα. Άγκυρα `missing-tenant-is-not-a-failure` Β4: ο αναγνώστης μετακόμισε στη ροή.
