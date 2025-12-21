import { ObligationSection, ObligationDocument } from './obligations';

// MOCK SECTIONS για testing - μόνο μερικά βασικά άρθρα
export const MOCK_SECTIONS: ObligationSection[] = [
  {
    id: 'building-terms',
    number: '1',
    title: 'ΟΡΟΙ ΔΟΜΗΣΗΣ',
    content: `Όλες οι εργασίες θα εκτελεσθούν σύμφωνα με:

• τα εγκεκριμένα σχέδια των μελετών
• την συγγραφή υποχρεώσεων
• την τεχνική περιγραφή
• τις ισχύουσες πολεοδομικές διατάξεις
• τον αντισεισμικό κανονισμό`,
    isRequired: true,
    category: 'general',
    order: 1
  },
  {
    id: 'delivery-time',
    number: '2',
    title: 'ΧΡΟΝΟΣ ΠΑΡΑΔΟΣΗΣ',
    content: `Ως χρόνος παράδοσης του κτιρίου ορίζεται ο αναφερόμενος στο συμβόλαιο.

Η παράδοση κάθε κατοικίας θα γίνεται με αντίστοιχο πρωτόκολλο παράδοσης και παραλαβής.`,
    isRequired: true,
    category: 'general',
    order: 2
  },
  {
    id: 'execution-materials',
    number: '3',
    title: 'ΕΚΤΕΛΕΣΗ - ΥΛΙΚΑ',
    content: `Οι εργασίες θα εκτελεσθούν με μέριμνα και δαπάνες της εργολάβου εταιρείας, με υλικά αρίστης ποιότητας.

Η εργολάβος εταιρεία έχει το δικαίωμα να καθορίζει τα υλικά που θα χρησιμοποιηθούν.`,
    isRequired: true,
    category: 'materials',
    order: 3
  },
  {
    id: 'contractor-obligations',
    number: '4',
    title: 'ΥΠΟΧΡΕΩΣΕΙΣ ΕΡΓΟΛΑΒΟΥ',
    content: `Οι δαπάνες για την σύνταξη και έκδοση της οικοδομικής αδείας βαρύνουν την κατασκευάστρια εταιρεία.

Η εργολάβος εταιρεία είναι υπεύθυνη σε όλες τις αρμόδιες αρχές.`,
    isRequired: true,
    category: 'general',
    order: 4
  },
  {
    id: 'earthworks',
    number: '5',
    title: 'ΧΩΜΑΤΟΥΡΓΙΚΕΣ ΕΡΓΑΣΙΕΣ',
    content: `Προβλέπονται:

• Εκσκαφές στο αναγκαίο βάθος για την κατασκευή των θεμελίων
• Γενικές εκσκαφές για τη μόρφωση του κτιρίου
• Φορτοεκφόρτωση και μεταφορά των προϊόντων εκσκαφών`,
    isRequired: true,
    category: 'construction',
    order: 5
  },
  {
    id: 'structural-frame',
    number: '6',
    title: 'ΦΕΡΩΝ ΟΡΓΑΝΙΣΜΟΣ',
    content: `Η κατασκευή του φέροντα οργανισμού θα γίνει με οπλισμένο σκυρόδεμα σύμφωνα με την εγκεκριμένη στατική μελέτη.

Γενικά η κατασκευή των σκυροδεμάτων θα γίνει με έτοιμο σκυρόδεμα που θα μεταφέρεται με ειδικά οχήματα.`,
    isRequired: true,
    category: 'construction',
    order: 6
  }
];

// MOCK OBLIGATION DOCUMENTS για testing
export const MOCK_OBLIGATIONS: ObligationDocument[] = [
  {
    id: "1",
    title: "Συγγραφή Υποχρεώσεων - Οικόπεδο Αθανασιάδη",
    projectName: "Επέκταση Θέρμης",
    contractorCompany: "Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.",
    owners: [
      { id: "1", name: "Αθανασιάδης Απόστολος", share: 33.33 },
      { id: "2", name: "Αθανασιάδης Αντώνης", share: 33.33 },
      { id: "3", name: "Αθανασιάδης Γιώργος", share: 33.34 }
    ],
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-02-01"),
    status: "completed",
    sections: [...MOCK_SECTIONS],
    projectDetails: {
      location: "Θεσσαλονίκη",
      address: "Σαμοθράκης 16, Κορδελιό",
      plotNumber: "125",
      buildingPermitNumber: "2024/156",
      contractDate: new Date("2024-01-10"),
      deliveryDate: new Date("2024-12-31"),
      notaryName: "Παπαδόπουλος Γεώργιος"
    }
  },
  {
    id: "2",
    title: "Συγγραφή Υποχρεώσεων - Πολυκατοικία Κεντρικής",
    projectName: "Νέα Πολυκατοικία",
    contractorCompany: "Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.",
    owners: [
      { id: "4", name: "Παπαδόπουλος Γιάννης", share: 100 }
    ],
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-02-20"),
    status: "draft",
    sections: MOCK_SECTIONS.slice(0, 3), // Μόνο τα 3 πρώτα άρθρα
    projectDetails: {
      location: "Θεσσαλονίκη",
      address: "Κεντρικής 45"
    }
  },
  {
    id: "3",
    title: "Συγγραφή Υποχρεώσεων - Διαμέρισμα Τσιμισκή",
    projectName: "Ανακαίνιση Κτιρίου",
    contractorCompany: "ΤΕΧΝΙΚΗ ΕΤΑΙΡΕΙΑ ΑΕ",
    owners: [
      { id: "5", name: "Κωνσταντίνου Μαρία", share: 50 },
      { id: "6", name: "Κωνσταντίνου Πέτρος", share: 50 }
    ],
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2024-03-01"),
    status: "draft",
    sections: [],
    projectDetails: {
      location: "Θεσσαλονίκη",
      address: "Τσιμισκή 120",
      plotNumber: "89"
    }
  }
];

// DEFAULT TEMPLATE για νέες συγγραφές
export const DEFAULT_TEMPLATE_SECTIONS = MOCK_SECTIONS;

export const COMPLETE_SECTIONS = MOCK_SECTIONS;
