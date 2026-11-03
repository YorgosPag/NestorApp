# Handoff: Ειδοποιήσεις Inbox (στάδιο 2) + εργαλεία δεδομένων του Admin Console

**Worktree:** `C:\Nestor_Worktrees\crm-notifications-page` · **Κλαδί:** `agent/crm-notifications-page`
**Συντονίστρια:** `project-scope-authorization-adr-926` (βρες τη με `ListAgents`). Της λες κάθε ολοκλήρωση και πριν από land.
**Γλώσσα:** απαντάς στον Giorgio ΠΑΝΤΑ στα ελληνικά.

## Εντολές Giorgio (ισχύουν)

- Commit μόνο στο `agent/crm-notifications-page`, με ρητή λίστα αρχείων. Ποτέ στο `main`.
- `wt:land` και push μόνο με δική του ρητή εντολή.
- Ποιότητα full enterprise + full SSoT, επίπεδο Figma · Linear · GitHub · Zillow · Idealista. Αν δεν είσαι σίγουρος για την πρακτική των μεγάλων, κάνε έρευνα στο διαδίκτυο. Κανένας συμβιβασμός στην ποιότητα, ο χρόνος δεν μετρά.
- Πριν από κώδικα: πραγματικό SSoT audit με grep (ή `git grep`, γιατί το Grep εδώ λήγει σε όλο το `src/`).
- Όχι `tsc`, `--no-verify`, `SKIP_*`, `firebase deploy`, εγγραφή στην παραγωγή. Μόνο στοχευμένα jest. Μεταλλάξεις: επαναφορά στο ίδιο tool call, ποτέ ταυτόχρονα με commit.
- Τα `HANDOFFS/*.md` αγνοούνται μέσω `.git/info/exclude`: το handoff μπαίνει με `git add -f -- <αρχείο>`.

## Ήδη έγινε

- `f9947206` (land στον `main` με εντολή Giorgio, **push εκκρεμεί**, το ζήτησε από τη συντονίστρια): η σελίδα `/crm/notifications` ήταν κλειστή στην παραγωγή από τις 2026-03-20 (`c78a69ba`, ADR-253), γιατί το `NODE_ENV === 'production'` έκλεινε όλη τη σελίδα αντί για το εργαλείο δοκιμών. Αφαιρέθηκε. Το κουμπί δοκιμής μένει μόνο σε development. Η κάρτα αποδίδει τίτλο/σώμα από το SSoT `components/notifications/notification-display-title.ts` (όπως ο drawer). Αφαιρέθηκαν τα νεκρά κουμπιά «Φίλτρα» και «Διαγραφή δοκιμής». Test: `src/components/crm/pages/__tests__/CrmNotificationsPageContent.test.tsx`, 3 tests, μεταλλάξεις 3/3.
- ⚠️ Δεν ελέγχθηκε σε τρέχουσα εφαρμογή ούτε στην παραγωγή.

## Επόμενο Α: Ειδοποιήσεις, στάδιο 2 (πλήρες Inbox)

Σημερινά κενά, μετρημένα στον κώδικα:
- Η κάρτα (`components/crm/notifications/NotificationCard.tsx`) δεν πατιέται: δεν ανοίγει την πηγή, δεν μαρκάρει αναγνωσμένη, δεν έχει απόρριψη. Είναι `div` (N.4).
- Δεν υπάρχουν φίλτρα (όλα / μη αναγνωσμένα / ανά τύπο), ομαδοποίηση ανά ημέρα, σελιδοποίηση.
- Τα κλειδιά `notifications.filters` και `notifications.test.delete` στο `locales/*/crm.json` δεν χρησιμοποιούνται πλέον.
- Η ροή `/api/notifications/seed` σε dev δεν επιστρέφει ids, άρα δεν υπάρχει καθαρισμός δοκιμαστικών.

SSoT που υπάρχουν ήδη και ΠΡΕΠΕΙ να επαναχρησιμοποιηθούν (ο drawer `components/NotificationDrawer.enterprise.tsx` τα έχει):
- `components/notifications/drawer-destination.ts` → `drawerDestination(n)`: ο ΕΝΑΣ δρόμος «Προβολή» (permalink `/n/{id}?via=inapp`, ADR-849 Β1). Ποτέ ωμό `router.push(url)`.
- `services/notificationService.ts`: `markNotificationsAsRead`, `dismissNotification`, `subscribeToNotifications`.
- `stores/notificationCenter` (`useNotificationCenter`: Map-based dedup, cursor) και `lib/notifications/notification-state.ts`.
- 🔴 Ερώτημα πρώτο: η σελίδα διαβάζει με `useNotifications` (`subscribeToNotifications`), ο drawer με `notificationCenter` + `NotificationClient`. Δύο πηγές για τα ίδια δεδομένα. Μέτρησε αν πρέπει να γίνουν μία πριν χτίσεις το Inbox. Αλλιώς ο αριθμός μη αναγνωσμένων θα αποκλίνει.

Πρότυπο αναφοράς: GitHub Notifications / Linear Inbox. Επιβεβαίωσε με έρευνα πριν από το σχέδιο. ADR: ADR-027 (CRM notifications), ADR-849, ADR-841 §7 Α18, ADR-253. Λογικά 5+ αρχεία → πρόταση εκτέλεσης στον Giorgio (N.8).

## Επόμενο Β: «Ενημέρωση Βάσης» και «Μετεγκατάσταση Enterprise» στο Admin Console

Μετρημένο στο `components/admin/pages/DatabaseUpdatePageContent.tsx`:
- Είναι **σενάριο δείγματος από τον browser**: γράφει δείγματα επαφών και ξαναγράφει έως 20 πραγματικά ακίνητα (`status`, `soldTo`, `ownerId`, `tenantId`) με επαφές από λίστα (`database-update-data.ts`, ids σκληρογραμμένα ή από `NEXT_PUBLIC_EXISTING_CONTACT_IDS`).
- ⇒ Η φραγή παραγωγής εδώ είναι **σωστή**: στην παραγωγή θα αλλοίωνε πραγματικά δεδομένα. Το λάθος είναι ότι ο σύνδεσμος μένει στο μενού (`components/admin/layout/AdminSidebar.tsx:102`) και οδηγεί σε νεκρή σελίδα.
- Το `/admin/enterprise-migration` (γρ. 103) δεν ελέγχθηκε. Κάν' το πρώτο.

Πρακτική των μεγάλων (να επιβεβαιωθεί με έρευνα): εργαλεία seed δεν ζουν στο UI του προϊόντος· τα δεδομένα δείγματος μπαίνουν με scripts/emulator· οι μεταναστεύσεις είναι server-side, εκδοσιοποιημένες, ιδεμποτικές, με dry-run και ίχνος ελέγχου.
Πρόταση για απόφαση Giorgio: (1) καμία νεκρή καταχώριση μενού στην παραγωγή, (2) το seed φεύγει από το προϊόν προς `scripts/` ή emulator, (3) πραγματική ανάγκη μετανάστευσης → server-side job με dry-run. Μην διαγράψεις σελίδα χωρίς απόφασή του.

## Άσχετα με αυτό το worktree, για να μην μπερδευτείς

- Η βιτρίνα ADR-923 Σ3 ζει στο `C:\Nestor_Worktrees\adr-923-phase6-sku-boq`, κλαδί `agent/adr-923-phase6b-s2`, παγωμένο στο `3ac836af`. Μπαίνει με το land της `nestor-pagonis-5d`. Μην το αγγίξεις.
- Το κύριο αντίγραφο `C:\Nestor_Pagonis` είναι κοινόχρηστο στο δίκτυο (`Everyone: Full`) και άλλος υπολογιστής (`192.168.0.114` / `fe80::fd5c:5ee3:4e99:41bd`) γράφει εκεί. Ποτέ `restore`/`stash` εκεί. Ο Giorgio ενημερώθηκε για τον κίνδυνο ασφαλείας.
