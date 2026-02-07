# UC-010: Ερώτηση Κατάστασης (Status Inquiry)

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Pipeline**: [pipeline.md](../pipeline.md)

---

## Trigger

Εξωτερικός χρήστης (πελάτης, προμηθευτής, συμβολαιογράφος, μηχανικός) στέλνει μήνυμα ρωτώντας για την κατάσταση κάποιου θέματος.

### Παραδείγματα εισερχόμενων

- Πελάτης: "Τι γίνεται με το διαμέρισμα στον 3ο όροφο;"
- Προμηθευτής: "Πληρώθηκε το τιμολόγιό μου 1234;"
- Συμβολαιογράφος: "Στείλατε τα έγγραφα που ζήτησα;"
- Μηχανικός: "Εγκρίθηκε η μελέτη;"
- Αγοραστής: "Πότε θα είναι έτοιμο το σπίτι μου;"

---

## Ροή

1. **Intake**: Μήνυμα εισέρχεται (email / Telegram / in-app)
2. **Acknowledge**: Άμεση απάντηση → "Λάβαμε το ερώτημά σας, θα σας ενημερώσουμε σύντομα"
3. **Understand**: AI αναγνωρίζει:
   - intent: `status_inquiry`
   - Υπο-κατηγορία (τι ρωτάει):

   | Υπο-κατηγορία | Παράδειγμα | Collection αναζήτησης |
   |---------------|-----------|----------------------|
   | **invoice_status** | "Πληρώθηκε το τιμολόγιό μου;" | invoices, payments |
   | **property_status** | "Τι γίνεται με το διαμέρισμα;" | units, projects |
   | **document_status** | "Στείλατε τα έγγραφα;" | tasks, communications |
   | **project_status** | "Πότε θα τελειώσει το έργο;" | projects, milestones |
   | **appointment_status** | "Ισχύει το ραντεβού μου;" | calendar |
   | **general** | "Τι νέα;" | communications (πρόσφατο ιστορικό) |

4. **Company Detection**: Multi-Signal (βλ. [pipeline.md](../pipeline.md) → Company Detection)
5. **Lookup** (κρίσιμο βήμα):
   - Αναγνώριση αποστολέα στα **contacts / leads**
   - Ανάκτηση σχετικών records βάσει υπο-κατηγορίας:
     - `invoice_status` → τελευταία τιμολόγια του αποστολέα, κατάσταση πληρωμής
     - `property_status` → unit, πρόοδος κατασκευής, στάδιο πώλησης
     - `document_status` → εκκρεμή tasks, τελευταίες αποστολές
     - `project_status` → milestones, timeline, ποσοστό ολοκλήρωσης
     - `appointment_status` → επόμενο/τελευταίο ραντεβού
     - `general` → τελευταίες 5 communications με αυτόν τον αποστολέα
   - Σύνθεση **status summary** σε 3-5 bullets
6. **Propose**: Δείχνει στον operator:
   - Ποιος ρωτάει (contact card)
   - Τι ρωτάει (υπο-κατηγορία)
   - Draft απάντηση με status summary
   - Σχετικά links (project / invoice / unit) για γρήγορο drill-down
7. **Approve**: Ο operator επιβεβαιώνει ή τροποποιεί την απάντηση
   - **ΚΑΝΟΝΑΣ**: Ποτέ δεν αποκαλύπτονται εσωτερικές πληροφορίες (κόστη, margins, εσωτερικά σχόλια)
8. **Execute**: Αποστολή απάντησης στο ίδιο κανάλι

---

## Κανάλια επικοινωνίας

Email, Telegram, In-app, κ.λπ.

---

## Routing

Δρομολόγηση βάσει υπο-κατηγορίας:

| Υπο-κατηγορία | Ρόλος | Fallback |
|---------------|-------|----------|
| `invoice_status` | `accountant` | `defaultResponsible` |
| `property_status` | `salesManager` | `defaultResponsible` |
| `document_status` | `secretary` | `defaultResponsible` |
| `project_status` | `siteManager` | `architect` |
| `appointment_status` | `salesManager` | `secretary` |
| `general` | `secretary` | `defaultResponsible` |

---

## AI Model Tier

**FAST** (αναζήτηση records + σύνθεση status summary)

---

## Κανόνες Ασφαλείας

- **Ποτέ** δεν αποκαλύπτονται: κόστη κατασκευής, margins, εσωτερικά σχόλια, πληροφορίες άλλων πελατών
- **Ποτέ** δεν δίνεται οικονομική πληροφορία χωρίς έγκριση `accountant` ή `owner`
- Αν ο αποστολέας δεν αναγνωρίζεται → γενική απάντηση + εσωτερική ειδοποίηση
