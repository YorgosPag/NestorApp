# UC-008: AI-Powered Dashboards & Statistics

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Pipeline**: [pipeline.md](../pipeline.md)
> **Related**: [UC-007 Reports](./UC-007-reports.md) (export), [observability.md](../observability.md) (AI metrics)

---

## Trigger

Εσωτερικός χρήστης ζητάει στατιστικά/dashboards ή βλέπει αυτόματα στην αρχική οθόνη

**Κατεύθυνση**: Εσωτερικό - on-demand ή real-time visualization

## Διαφορά από UC-007 (Reports)

- UC-007 = Αρχεία Excel/PDF (download, αρχειοθέτηση, αποστολή)
- UC-008 = Interactive γραφήματα στην οθόνη (real-time, drill-down, AI insights)

## 6 Δυνατότητες (Enterprise Standard)

Βάσει Procore, Autodesk BIM 360, Yardi, CBRE standards.

### 1. KPIs - Big Numbers (κορυφή dashboard)

Μεγάλοι αριθμοί που βλέπεις αμέσως:
- Σύνολο διαθέσιμων / πουλημένων / κρατημένων ακινήτων
- Σύνολο εσόδων μήνα / τριμήνου / έτους
- Ανοιχτά leads / conversion rate (leads → πελάτες)
- Εκκρεμή τιμολόγια (αριθμός + ποσό)
- Μέσος χρόνος απόκρισης AI

### 2. Predictive Analytics (AI Προβλέψεις)

Το AI δεν δείχνει μόνο τι **έγινε**, αλλά τι **ΘΑ γίνει**:
- "Με τον τρέχοντα ρυθμό πωλήσεων, το Έργο Κορδελιού θα εξαντληθεί σε ~4 μήνες"
- "Τα έξοδα του έργου τείνουν να υπερβούν τον προϋπολογισμό κατά 8%"
- "Ο προμηθευτής Χ καθυστερεί κατά μέσο όρο 5 ημέρες - πιθανή καθυστέρηση χρονοδιαγράμματος"
- "Με βάση τα leads αυτής της εβδομάδας, αναμένονται ~3 ραντεβού την επόμενη"

### 3. Anomaly Detection (Αυτόματες Ειδοποιήσεις)

Το AI εντοπίζει **ασυνήθιστα patterns** χωρίς να το ζητήσεις:
- "Τα έξοδα σκυροδέματος αυξήθηκαν 25% αυτόν τον μήνα"
- "0 νέα leads τις τελευταίες 2 εβδομάδες (ασυνήθιστο)"
- "3 τιμολόγια εκκρεμούν πάνω από 30 ημέρες"
- "Ο προμηθευτής Χ χρεώνει 12% πάνω από τον μέσο όρο αγοράς"

### 4. Natural Language Queries

Ο χρήστης ρωτάει σε **φυσική γλώσσα** → AI δημιουργεί το κατάλληλο γράφημα:
- "Δείξε μου πωλήσεις ανά μήνα για το 2026"
- "Σύγκρινε έξοδα Έργου Κορδελιού vs Έργου Θέρμης"
- "Πόσα τιμολόγια επεξεργαστήκαμε τον Ιανουάριο;"
- "Top 5 προμηθευτές σε ποσό τιμολογίων"

### 5. Drill-Down (Εμβάθυνση)

Πατάς σε μια μπάρα/πίτα → ανοίγει αναλυτικά:
- "Έξοδα Ιανουαρίου" → κάθε τιμολόγιο αναλυτικά
- "Leads αυτόν τον μήνα" → λίστα ενδιαφερομένων με status
- "Πωλήσεις Κορδελιού" → κάθε ακίνητο / αγοραστής

### 6. Saved Dashboards / Favorites

- Κάθε χρήστης αποθηκεύει τα **δικά του αγαπημένα** dashboards
- Customizable layout (ποια widgets, σε ποια θέση)
- Default dashboard ανά ρόλο (π.χ. ο λογιστής βλέπει οικονομικά, ο πωλητής βλέπει leads)

## Τύποι γραφημάτων

- Μπάρες (bar charts) - σύγκριση κατηγοριών
- Γραμμές (line charts) - τάσεις στον χρόνο
- Πίτες (pie charts) - κατανομή ποσοστών
- Area charts - εξέλιξη στον χρόνο με όγκο
- KPI cards - μεγάλοι αριθμοί με τάση (↑↓)
- Tables - αναλυτικά δεδομένα με sorting/filtering

## Κατηγορίες dashboards ανά ρόλο

| Dashboard | Περιεχόμενο | Ρόλοι |
|-----------|-------------|-------|
| **Οικονομικό** | Έσοδα, έξοδα, τιμολόγια, cash flow, budget vs actual | accountant, owner |
| **Πωλήσεων** | Leads, ραντεβού, conversions, pipeline, revenue forecast | salesManager, owner |
| **Κατασκευής** | Πρόοδος %, timeline, milestones, καθυστερήσεις | architect, civilEngineer, mechanicalEngineer, siteManager, owner |
| **Προμηθειών** | Προμηθευτές, κόστη υλικών, τιμολόγια, συγκρίσεις τιμών | procurementManager, owner |
| **AI Activity** | Αιτήματα, αυτόματες ενέργειες, χρόνοι απόκρισης, accuracy | owner, defaultResponsible |
| **Executive** | Συνολική εικόνα όλων - top KPIs από κάθε κατηγορία | owner |

## Permission Check

Κάθε dashboard ακολουθεί τους ρόλους - ο χρήστης βλέπει **μόνο** τα δεδομένα που ο ρόλος του επιτρέπει.

## Export

Οποιοδήποτε γράφημα/dashboard → εξαγωγή σε PDF/Excel (σύνδεση με [UC-007](./UC-007-reports.md)).

## AI Model Tier

- **FAST**: Natural language queries, anomaly detection
- **QUALITY**: Predictive analytics (πολύπλοκη ανάλυση)
