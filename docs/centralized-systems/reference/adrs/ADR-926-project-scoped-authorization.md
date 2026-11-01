# ADR-926: Εξουσιοδότηση με εμβέλεια έργου

**Κατάσταση**: ACCEPTED (Giorgio, 2026-11-02) — υλοποίηση σε εξέλιξη, κανένα βήμα κώδικα ακόμη.
**Ημερομηνία**: 2026-11-01 · έγκριση 2026-11-02
**Σχετικά**: ADR-829 §7.1 · ADR-801 §2.8 · ADR-862 · ADR-923 §5.12

Σήμανση: **[Μ]** μετρήθηκε στο `origin/main` `94134210`. **[Σ]** συμπέρασμα. **[Π]** εξωτερική πηγή, §7.

## 1. Το πρόβλημα

Ο `project_manager` δεν μπορεί να ορίσει κτίριο ή όροφο στο έργο του, ενώ Procore και ACC το επιτρέπουν στον διαχειριστή έργου [Π].

- [Μ] Το `checkPermission` με `projectId` κρίνει **μόνο** τον ρόλο έργου: σε μέλος δεν περνά στον ρόλο εταιρείας, και μη μέλος παίρνει `no_project_membership`. Άρα ο `company_admin` που δεν είναι μέλος θα απορριπτόταν, και μέλος `viewer` θα έχανε δικαιώματα εταιρείας.
- [Μ] Οι διαδρομές `buildings` · `floors` δεν δίνουν `projectId` στον κριτή. Το Τ3.2 το κλειδώνει. Γραμμή στον κατάλογο σήμερα θα ήταν νεκρή.
- [Μ] Το `permissionOptions` δέχεται μόνο σύγχρονη συνάρτηση του αιτήματος, άρα δεν μπορεί να βρει το έργο από το κτίριο.
- [Μ] Ο ρητός καλών με `projectId` που βρέθηκε: `landowner-unlink-check/route.ts:44`. Το `withProjectPermission` δεν βρέθηκε να καλείται. Η πλήρης απογραφή, με κλήσεις πολλών γραμμών, είναι το βήμα 0.
- [Μ] Το `project-staffing-policy.ts` γράφει ότι ο ρόλος έργου «δεν διευρύνει ποτέ την πρόσβαση». Το ADR αυτό το αλλάζει, μόνο για δηλωμένες πράξεις.

## 2. Τι κάνουν οι μεγάλοι

| Παίκτης | Πρακτική |
|---|---|
| Procore | Το ποιος προσθέτει ή σβήνει τοποθεσίες κρίνεται στο εργαλείο Admin **του έργου**, με επίπεδο Admin ή με το λεπτομερές `Manage Locations` |
| Autodesk Build | Τοποθεσίες προσθέτουν μόνο οι διαχειριστές έργου. Η αφαίρεση δεν αναιρείται |
| GitHub | Η υψηλότερη πρόσβαση σε αποθετήριο υπερισχύει της βάσης οργανισμού |
| Google Drive | Χωριστές δυνατότητες για κάδο (`canTrash`) και οριστική διαγραφή, υπολογισμένες από τον διακομιστή |
| OpenFGA (μοντέλο Zanzibar) | Η πρόσβαση κληρονομείται από τον γονέα μέσω σχέσης, όχι με αντίγραφο σε κάθε αντικείμενο |
| OWASP | Άρνηση εξ ορισμού, ένα σημείο ελέγχου, κλειστή αστοχία |

## 3. Η πρόταση

**Κ1. Ένας κριτής, αθροιστικός.** Επιτρέπεται αν το δίνει ο ρόλος εταιρείας **ή** ο ρόλος έργου. Η ιδιότητα μέλους μόνο προσθέτει, ποτέ δεν αφαιρεί.

**Κ2. Κλειστός κατάλογος πράξεων έργου (`PROJECT_SCOPED_ACTIONS`).** Ο ρόλος έργου δίνει μόνο ό,τι δηλώνεται εκεί. Αρχικά: `buildings:buildings:create` · `update` · `delete` · `projects:floors:create` · `update` · `delete`. Έτσι τα 42 δικαιώματα του `project_manager` δεν ενεργοποιούνται σιωπηλά. Αυτή είναι η βελτίωση πάνω στους μεγάλους: κάθε νέα πράξη έργου είναι ρητή, με άγκυρα.

**Κ3. Το έργο προκύπτει από τον πόρο.** Νέο ασύγχρονο `permissionResource` στο `withAuth`. Τρέχει **μετά** τον φράχτη χώρου, άρα ξένος πόρος δίνει 404 πριν από κρίση ρόλου. Το `projectId` έρχεται από το κτίριο ή τον όροφο, ποτέ από το σώμα (AIP-203). Στη δημιουργία κτιρίου το έργο του σώματος περνά πρώτα από τον φράχτη έργου.

**Κ4. Κτίριο χωρίς έργο:** κρίνεται μόνο με ρόλο εταιρείας. Ο ρόλος έργου δεν έχει σημείο εφαρμογής.

**Κ5. Κλειστή αστοχία.** Αν η ανάγνωση μέλους απαντήσει `unknown` ή `unreadable`, ο κλάδος έργου αρνείται. Ο κλάδος εταιρείας κρίνεται κανονικά.

**Κ6. Ανάκληση άμεση.** Η ιδιότητα μέλους διαβάζεται ανά αίτημα, όχι από token, με το υπάρχον `PermissionCache`.

**Κ7. Μία αλήθεια και στο UI.** Ο πελάτης δεν ξαναϋλοποιεί τον κριτή: η απάντηση έργου δίνει `viewerCapabilities`, όπως το `capabilities` του Google Drive, που το υπολογίζει ο διακομιστής ανά αίτημα. Το `decideCapability` μένει για τα ερωτήματα χωρίς πόρο.

**Κ8. Ιχνηλασιμότητα.** Το `source: 'project_role'` καταγράφεται στην έγκριση και στο ιστορικό, ώστε να φαίνεται με ποιον ρόλο έγινε η πράξη.

## 4. Απόφαση για το `delete`

Απόφαση Giorgio 2026-11-02: **ναι στον `project_manager`, με εμβέλεια έργου, μόνο για μεταφορά στον κάδο.** Procore και Autodesk το δίνουν στον διαχειριστή έργου. Στο Nestor είναι ασφαλέστερο, γιατί ο κάδος είναι αναστρέψιμος και τα μπλοκαρίσματα εξαρτήσεων μένουν. Η οριστική διαγραφή μένει στον `company_admin`. Να επαληθευτεί στο βήμα 0 ότι υπάρχει χωριστή πράξη για την οριστική διαγραφή.

## 5. Βήματα μετά την έγκριση

0. Πλήρης απογραφή καλούντων με `projectId`, `withProjectPermission`, δικαίωμα οριστικής διαγραφής.
1. Κριτής: Κ1, Κ2, Κ5, με ενημέρωση `pdp-equivalence` και της άγκυρας του ADR-829.
2. `permissionResource` και μετάβαση των διαδρομών `buildings` · `floors`. Το Τ3 ξαναγράφεται με πίνακα ρόλων έργου.
3. `PROJECT_SCOPED_ACTIONS` με πύλη: κάθε πράξη έχει σημείο επιβολής και γραμμή στον πίνακα.
4. `viewerCapabilities` και κουμπιά.
5. Μεταλλάξεις: ξένος πόρος, μη μέλος, μέλος άλλου έργου, `viewer`, ανάγνωση μέλους `unknown`, `projectId` στο σώμα.
6. Ανεξάρτητη ανασκόπηση ασφαλείας και ζωντανός έλεγχος με λογαριασμό `project_manager`.

Το `role-catalogue.ts` το αγγίζει και το ADR-829 για την αναζήτηση: η σειρά land ορίζεται από τον συντονιστή. **ΜΗΝ** προστεθεί `buildings:*` στον `project_manager` πριν από το βήμα 1.

## 6. Απορρίφθηκαν

- **Γραμμή στον κατάλογο χωρίς αλλαγή κριτή:** νεκρή.
- **`buildings:*` ως δικαίωμα εταιρείας στον `project_manager`:** θα έπιανε κάθε έργο του χώρου.
- **Πλήρης μηχανή ReBAC:** δύο επίπεδα δεν δικαιολογούν δεύτερο σύστημα. Το Κ3 κρατά το ίδιο μοντέλο γονέα μέσα στον υπάρχοντα κριτή.

## 7. Πηγές

- [Procore: δικαιώματα εργαλείου Admin έργου](https://support.procore.com/products/online/user-guide/project-level/admin/permissions)
- [Procore: σβήσιμο τοποθεσιών](https://support.procore.com/products/online/user-guide/project-level/admin/tutorials/delete-multi-tiered-locations)
- [Procore: προσθήκη τοποθεσιών](https://support.procore.com/products/online/user-guide/project-level/admin/tutorials/add-multi-tiered-locations-to-a-project)
- [Autodesk Build: Locations](https://help.autodesk.com/view/BUILD/ENU/?guid=Project_Administration_Locations)
- [Autodesk Build: προσθήκη τοποθεσιών](https://help.autodesk.com/view/BUILD/ENG/?guid=Add_Import_Export_Locations)
- [GitHub: βασικά δικαιώματα οργανισμού](https://docs.github.com/en/enterprise-server@3.14/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/setting-base-permissions-for-an-organization)
- [Google Drive: πόρος files και capabilities](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Google Drive: κάδος και διαγραφή](https://developers.google.com/workspace/drive/api/guides/delete)
- [OpenFGA: σχέσεις γονέα-παιδιού](https://openfga.dev/docs/modeling/parent-child.md)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## 8. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-01 | Πρόταση με μετρήσεις και πηγές, χωρίς υλοποίηση |
| 2026-11-02 | Έγκριση Giorgio, μαζί με το `delete` μόνο για κάδο. Το βήμα 0 είναι το επόμενο |
