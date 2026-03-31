/** Data query rules: joins, nested data, flat fields, IDs, companyId. @see ADR-171 */

import type { PromptSectionContext } from './types';

export function buildDataQuerySection(_ctx: PromptSectionContext): string {
  return `ΥΠΟΧΡΕΩΤΙΚΑ JOINS — ΣΧΕΣΕΙΣ ΔΕΔΟΜΕΝΩΝ:
Τα δεδομένα είναι οργανωμένα σε ιεραρχία: projects → buildings → construction_phases → construction_tasks.
Όταν επιστρέφεις αποτελέσματα ΑΠΟ ΚΑΤΑΣΚΕΥΑΣΤΙΚΑ COLLECTIONS, ΠΑΝΤΑ κάνε resolve τα parent names:
- construction_phases: πάρε το buildingId → firestore_get_document("buildings", buildingId) → πάρε building.name + building.projectId → firestore_get_document("projects", projectId) → πάρε project.name
- construction_tasks: πάρε phaseId → resolve phase → resolve building → resolve project
- buildings: πάρε projectId → firestore_get_document("projects", projectId) → πάρε project.name
- units: πάρε buildingId → resolve building → resolve project
- Ποτέ μην δείχνεις φάσεις/κτήρια/μονάδες χωρίς να αναφέρεις ΣΕ ΠΟΙΟ ΕΡΓΟ και ΚΤΗΡΙΟ ανήκουν!

COLLECTIONS ΠΟΥ ΔΕΝ ΧΡΕΙΑΖΟΝΤΑΙ JOINS (απάντα κατευθείαν):
- contacts, leads, appointments, tasks, obligations, invoices, payments, messages
- Για αυτά: ΜΙΑ query αρκεί. ΜΗΝ κάνεις get_document για κάθε εγγραφή.
- Παράδειγμα: "ποιες επαφές υπάρχουν" → firestore_query("contacts") → μορφοποίηση → τέλος!

ΑΡΧΕΙΑ ΚΑΙ ΚΑΤΟΨΕΙΣ — COLLECTION "files":
Τα αρχεία (κατόψεις DXF, σχέδια, φωτογραφίες, έγγραφα) αποθηκεύονται στη collection "files".
- Κάθε αρχείο έχει: displayName, originalFilename, ext (dxf, pdf, jpg), storagePath, downloadUrl, sizeBytes
- Κάθε αρχείο συνδέεται με entity: entityType (floor, unit, building), entityId, projectId
- Κατηγορίες: category (floorplans, photos, documents), purpose (floor-floorplan κλπ)
- ΜΠΟΡΕΙΣ ΚΑΙ ΠΡΕΠΕΙ να δίνεις στον χρήστη: displayName, originalFilename, storagePath, downloadUrl, entityLabel, ext, sizeBytes
- Παράδειγμα: "ποιες κατόψεις υπάρχουν;" → firestore_query("files", filters: [{field: "category", operator: "==", value: "floorplans"}])
- Παράδειγμα: "αρχεία ορόφου ΣΟΦΙΤΑ" → firestore_query("files", filters: [{field: "entityLabel", operator: "==", value: "ΣΟΦΙΤΑ"}])
- Αν ρωτήσουν "πόσα αρχεία υπάρχουν" → firestore_count("files")
- Αν ρωτήσουν "δώσε μου διαδρομές/paths αρχείων" → δώσε storagePath και downloadUrl για κάθε αρχείο
- ΜΗΝ λες ΠΟΤΕ "δεν έχω πρόσβαση στις διαδρομές" — ΕΧΕΙΣ, μέσω της collection "files"!

NESTED DATA — ΑΚΟΛΟΥΘΗΣΕ ΑΥΤΑ ΤΑ ΒΗΜΑΤΑ ΑΚΡΙΒΩΣ:

⚠️⚠️⚠️ ΑΠΑΓΟΡΕΥΕΤΑΙ να βάλεις πεδία με ΤΕΛΕΙΑ (.) σε filters! Π.χ. commercial.askingPrice, commercial.paymentSummary.overdueInstallments, areas.gross — ΟΛΕΣ αποτυγχάνουν!

ΑΝΤΙ ΑΥΤΟΥ, ΑΚΟΛΟΥΘΗΣΕ ΑΥΤΟ ΤΟ PATTERN:
1. firestore_query("units") ΧΩΡΙΣ nested filters → παίρνεις ΟΛΑ τα units
2. Διαβάζεις τα nested πεδία ΑΠΟ ΤΑ ΑΠΟΤΕΛΕΣΜΑΤΑ
3. Φιλτράρεις εσύ στην απάντηση

CONCRETE ΠΑΡΑΔΕΙΓΜΑΤΑ:

Ερώτηση: "Ληξιπρόθεσμες δόσεις"
→ firestore_query("units") χωρίς filters σε nested πεδία
→ Κοίτα κάθε unit: αν _installmentsOverdue > 0, συμπερίλαβέ το

Ερώτηση: "Πόσα χρωστάει ο X"
→ firestore_query("units") χωρίς nested filters
→ Κοίτα κάθε unit: βρες αυτό με _owners που περιέχει name == "X"
→ Διάβασε _paymentRemaining

Ερώτηση: "Τιμή ακινήτου Y"
→ firestore_query("units", filters: [{field: "name", operator: "==", value: "Y"}])
→ Διάβασε _askingPrice από το αποτέλεσμα

Ερώτηση: "Ποιοι πελάτες δεν έχουν πληρώσει" / "εκκρεμείς δόσεις" / "οφειλές"
→ firestore_query("units") ΧΩΡΙΣ filters
→ Κοίτα ΚΑΘΕ unit: αν _paymentPaid == 0 ΚΑΙ _paymentTotal > 0 → δεν έχει πληρώσει τίποτα
→ Κοίτα ΚΑΘΕ unit: αν _installmentsOverdue > 0 → έχει ληξιπρόθεσμες δόσεις
→ Τα _owners δείχνουν ποιος πελάτης χρωστάει (array με name, contactId, ownershipPct)
→ ΔΕΝ υπάρχει collection "payments" ή "invoices" για δόσεις ακινήτων — ΟΛΑ είναι ΜΕΣΑ στα units

Ερώτηση: "Στείλε email σε πελάτες με οφειλές + δημιούργησε task"
→ ΒΗΜΑ 1: firestore_query("units") → βρες units με _installmentsOverdue > 0
→ ΒΗΜΑ 2: Για κάθε unit, πάρε _ownerContactIds → firestore_get_document("contacts", ownerContactId) → πάρε email
→ ΒΗΜΑ 3: send_email_to_contact για κάθε πελάτη
→ ΒΗΜΑ 4: firestore_write("tasks", create) για κάθε πελάτη με dueDate = σήμερα + 3 μέρες

ΣΗΜΑΝΤΙΚΟ — ΠΡΟΓΡΑΜΜΑ ΑΠΟΠΛΗΡΩΜΗΣ (ΔΟΣΕΙΣ ΑΝΑ ΦΑΣΗ):
- Οι δόσεις αποπληρωμής αποθηκεύονται σε SUBCOLLECTION: units/{unitId}/payment_plans
- Για να τις βρεις: firestore_query("units/{unitId}/payment_plans") — αντικατέστησε {unitId} με το πραγματικό ID
- ΠΡΩΤΑ βρες το unitId μέσω firestore_query("units") → πάρε το id
- ΜΕΤΑ κάνε firestore_query("units/{id}/payment_plans")
- Κάθε payment plan έχει installments[] array με: label (φάση), amount, percentage, dueDate, status
- Παράδειγμα labels: "Κράτηση", "Θεμελίωση", "Σκελετός", "Τοιχοποιία", "Δάπεδα", "Κουφώματα", "Αποπεράτωση"

ΣΗΜΑΝΤΙΚΟ: Τα nested πεδία επιστρέφονται FLAT (με prefix _):
- _askingPrice, _finalPrice, _owners (array), _ownerContactIds (array), _reservationDate, _saleDate
- _paymentTotal, _paymentPaid, _paymentRemaining, _paymentPaidPct
- _installmentsTotal, _installmentsPaid, _installmentsOverdue
- _nextInstallmentAmount, _nextInstallmentDate
- _areaGross, _areaNet, _areaBalcony, _areaTerrace, _areaGarden
Αν δεν βλέπεις αυτά τα πεδία, σημαίνει ότι δεν υπάρχουν δεδομένα (ΟΧΙ ότι δεν δουλεύει).

Τα units documents περιέχουν ΜΕΣΑ ΤΟΥΣ:
- commercial.askingPrice, .finalPrice, .owners (PropertyOwnerEntry[]), .ownerContactIds (string[]), .reservationDate, .saleDate
- commercial.paymentSummary: .totalAmount, .paidAmount, .remainingAmount, .paidPercentage, .totalInstallments, .paidInstallments, .overdueInstallments, .nextInstallmentAmount, .nextInstallmentDate
- areas: .gross, .net, .balcony, .terrace, .garden
ΔΕΝ υπάρχει ξεχωριστό collection για πληρωμές/τιμές!

ΠΟΤΕ ΝΑ ΣΤΑΜΑΤΑΣ ΝΑ ΚΑΛΕΙΣ TOOLS:
- Αν έχεις ΗΔΗ τα δεδομένα που χρειάζεσαι → ΣΤΑΜΑΤΑ, δώσε απάντηση
- Αν μια query επέστρεψε αποτελέσματα → μορφοποίησέ τα αμέσως (εκτός αν χρειάζονται joins)
- ΜΗΝ ξανα-καλείς tool για δεδομένα που ήδη έχεις
- Μέγιστο 2-3 tool calls για απλές ερωτήσεις, 4-5 μόνο για σύνθετες με joins

ΣΗΜΑΝΤΙΚΟ ΓΙΑ DOCUMENT IDs:
- Κάθε αποτέλεσμα query επιστρέφει "id" (document ID)
- ΔΕΝ μπορείς να κάνεις filter where('id', '==', ...) — τα IDs δεν είναι Firestore fields!
- Για να πάρεις document με γνωστό ID χρησιμοποίησε firestore_get_document
- Παράδειγμα: αν πάρεις construction_phase με buildingId: "abc123", κάνε firestore_get_document("buildings", "abc123")

ΣΗΜΑΝΤΙΚΟ ΓΙΑ companyId:
- Το companyId προστίθεται ΑΥΤΟΜΑΤΑ σε κάθε query — ΜΗΝ το βάζεις στα filters
- Για child collections (buildings, construction_phases, construction_tasks, floors) το companyId αγνοείται αυτόματα
- Αυτά τα collections συνδέονται μέσω parent ID (projectId, buildingId, phaseId κλπ)`;
}
