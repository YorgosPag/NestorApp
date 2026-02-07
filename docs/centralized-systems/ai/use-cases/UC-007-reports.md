# UC-007: Αναφορές On-Demand (Reports)

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Pipeline**: [pipeline.md](../pipeline.md)

---

## Trigger

Εσωτερικός χρήστης ζητάει αναφορά: "Δώσε μου οικονομική αναφορά για το Έργο Κορδελιού, Ιανουάριος"

**Κατεύθυνση**: Εσωτερικό αίτημα → Αυτόματη δημιουργία αναφοράς

## Ροή

1. **Εντολή**: Χρήστης ζητάει αναφορά (μέσω in-app, email, Telegram)
2. **Understand**: AI αναγνωρίζει:
   - `reportType`: οικονομική / προόδου / πωλήσεων / AI activity / custom
   - `scope`: εταιρεία / έργο / συγκεκριμένο θέμα
   - `period`: μήνας / τρίμηνο / έτος / custom εύρος ημερομηνιών
   - `format`: Excel / PDF / και τα δύο
3. **Permission Check**: Έλεγχος αν ο ρόλος του χρήστη επιτρέπει πρόσβαση στα δεδομένα (π.χ. οικονομικά → μόνο accountant/owner/defaultResponsible)
4. **Data Collection**: Η εφαρμογή μαζεύει δεδομένα από Firestore (ΟΧΙ το AI - αυτό κοστίζει)
5. **File Generation**: Βιβλιοθήκες Node.js δημιουργούν το αρχείο:
   - **Excel** → `exceljs` (φίλτρα, φόρμουλες, formatting, sheets)
   - **PDF** → `pdfkit` ή `react-pdf` (εταιρικό branding, εκτυπώσιμο)
6. **Delivery**: Αποστολή στον χρήστη (download in-app, email attachment, Telegram file)

## Τύποι αναφορών

| Τύπος | Περιεχόμενο | Ρόλοι με πρόσβαση |
|-------|-------------|-------------------|
| **Οικονομική** | Τιμολόγια, πληρωμές, έξοδα ανά έργο/μήνα | accountant, owner, defaultResponsible |
| **Προόδου** | Φάση κατασκευής, ολοκλήρωση %, εργασίες | architect, civilEngineer, mechanicalEngineer, siteManager, owner |
| **Πωλήσεων** | Leads, ραντεβού, conversions, ενδιαφερόμενοι | salesManager, owner |
| **AI Activity** | Τι χειρίστηκε το AI, audit trail summary | owner, defaultResponsible |
| **Εγγράφων** | Ποια έγγραφα υπάρχουν / λείπουν ανά έργο | secretary, owner, defaultResponsible |
| **Προμηθειών** | Προμηθευτές, τιμολόγια, δελτία αποστολής | procurementManager, accountant, owner |
| **Custom** | Ό,τι ζητήσει ο χρήστης - AI συνθέτει | Ανάλογα με τα δεδομένα |

## Κόστος

Ελάχιστο - AI χρησιμοποιείται **μόνο** για κατανόηση αιτήματος (FAST tier). Η συλλογή δεδομένων και δημιουργία αρχείου γίνεται **χωρίς AI** (καθαρός κώδικας + βιβλιοθήκες).

## Μορφές εξαγωγής

- **PDF**: Παρουσίαση, εκτύπωση, αρχειοθέτηση, αποστολή σε τρίτους
- **Excel**: Ανάλυση, φιλτράρισμα, επεξεργασία, αποστολή σε λογιστήριο

## AI Model Tier

**FAST** (μόνο intent detection)
