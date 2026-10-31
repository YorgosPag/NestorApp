# Εκδότης καταλόγου: πώς φτάνει το Typst στο Netcup

**Status:** Σχέδιο, δεν έχει εκτελεστεί
**Ιδιοκτήτης:** Γιώργος Παγώνης
**Σχετικά:** ADR-923 §5.6 · §5.6.1 · §21
**Ημερομηνία:** 2026-10-31

Σήμερα το Typst **δεν υπάρχει** στην παραγωγή. Όσο λείπει, κάθε έκδοση τελειώνει με `failed: engineUnavailable`, η προεπισκόπηση απαντά `unavailable`, και η εφαρμογή συνεχίζει κανονικά.

## Τι επαληθεύτηκε

| Θέμα | Τιμή | Πηγή |
|---|---|---|
| Τελευταία έκδοση | **0.15.1**, 2026-07-17 | GitHub API `repos/typst/typst/releases/latest` |
| Linux x86_64 | `typst-x86_64-unknown-linux-musl.tar.xz`, 17.462.992 bytes | ίδια πηγή |
| sha256 Linux | `a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c` | ίδια πηγή |
| sha256 Windows zip | `19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736` | ίδια πηγή |
| Εικόνα παραγωγής | `node:22-alpine` (`Dockerfile`) | ο κώδικας |
| Άδεια | Apache-2.0· στο `NOTICE` και MIT, LLVM exception, LPPL για μεταφράσεις | ADR-923 §21.1 |

**Τοπική επαλήθευση 2026-10-31 (Windows):** το zip κατέβηκε από το επίσημο release και το sha256 ταίριαξε ακριβώς. Το `typst --version` δίνει `typst 0.15.1 (9dfd3a08)`. Το `typst-real.test.ts` πέρασε ολόκληρο. Στον όγκο των 660 σελίδων: 13–15 s ανά προφίλ.

Η έκδοση musl είναι το σωστό κτίσμα για Alpine, που δεν έχει glibc. Το Typst τρέχει μόνο στον διακομιστή, δεν διανέμεται στον browser, άρα η ερώτηση για LPPL του §21.4 δεν ενεργοποιείται.

## Τι ΔΕΝ επαληθεύτηκε

- Η αρχιτεκτονική του διακομιστή Netcup. Το σχέδιο υποθέτει x86_64· σε ARM χρειάζεται το αντίστοιχο κτίσμα και το δικό του sha256.
- Αν το `tar` της εικόνας αποσυμπιέζει `.xz` χωρίς επιπλέον πακέτο.
- Η ροή `docker-build.yml` με το νέο βήμα.
- Πόση μνήμη και CPU έχει ελεύθερη ο διακομιστής την ώρα μιας απόδοσης. Το κτίσμα musl δεν έχει τρέξει πουθενά ακόμη· η μέτρηση των Windows δεν μεταφέρεται αυτούσια.

## Το βήμα που προτείνεται

Στο στάδιο `runner` του `Dockerfile`, πριν από την αλλαγή χρήστη:

```dockerfile
ADD --checksum=sha256:a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c \
  https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz /tmp/typst.tar.xz
RUN mkdir -p /opt/typst \
  && tar -xJf /tmp/typst.tar.xz -C /opt/typst --strip-components=1 \
  && install -m 0755 /opt/typst/typst /usr/local/bin/typst \
  && rm -rf /tmp/typst.tar.xz /opt/typst
ENV CATALOG_TYPST_BIN=/usr/local/bin/typst
```

Το `--checksum` κάνει το κτίσμα να αποτυγχάνει αν αλλάξει το αρχείο. Οι γραμματοσειρές υπάρχουν ήδη: το `public/` αντιγράφεται στην εικόνα, και το `public/fonts/Liberation*.ttf` είναι δηλωμένο στο `.font-assets.json`.

## Σειρά εκτέλεσης

1. Ο Giorgio εγκρίνει την αλλαγή του `Dockerfile`, αφού επιβεβαιωθεί η αρχιτεκτονική.
2. Χτίζεται η εικόνα και τρέχει `docker run --rm <εικόνα> typst --version`· περιμένουμε `0.15.1`.
3. Ανάπτυξη κανόνων και δεικτών: `catalog_publication_recipes`, `catalog_publication_runs` (`firebase deploy --only firestore:rules,firestore:indexes`). Ξεχωριστό βήμα από το push: το push πάει στο Netcup, ποτέ στο Firebase.
4. Push, με εντολή Giorgio.
5. Ζωντανή επαλήθευση: έκδοση λίγων σελίδων και στα δύο προφίλ, έλεγχος με `pdfinfo` και `pdffonts`, μετά πλήρης κατάλογος.

## Επιστροφή

Αφαίρεση των γραμμών από το `Dockerfile`. Ο κώδικας δεν χρειάζεται αλλαγή: χωρίς εκτελέσιμο δηλώνει `engineUnavailable`. Τα ήδη παραγμένα PDF μένουν διαθέσιμα.

## Αναβάθμιση έκδοσης

Νέα έκδοση Typst αλλάζει bytes. Αλλάζουν μαζί το `Dockerfile`, το `TYPST_EXPECTED_VERSION`, και ξανατρέχει το `typst-real.test.ts`. Το κλειδί ιδεμποτίας περιέχει την έκδοση μηχανής, άρα οι επόμενες εκδόσεις βγαίνουν νέα αρχεία.
