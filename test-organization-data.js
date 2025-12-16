/**
 * 🧪 TEST ORGANIZATION DATA SCRIPT - COMPREHENSIVE ADAPTIVE UI DEMO
 *
 * Προσθέτει test data στη βάση δεδομένων για να δοκιμάσουμε το adaptive UI
 *
 * Θα δημιουργήσει:
 * - 1 εταιρεία με πολύπλοκη οργανωτική δομή
 * - 7 εργαζόμενους σε 4 διαφορετικά τμήματα
 * - 4 τμήματα (Διοίκηση, Πωλήσεις, IT, HR)
 * - 3 επίπεδα ιεραρχίας (CEO → Managers → Employees)
 */

// REALISTIC ENTERPRISE ORGANIZATION DATA
const COMPANY_DATA = {
  companyName: process.env.NEXT_PUBLIC_TEST_COMPANY_NAME || "TechCorp Solutions ΑΕ",

  // 🏢 ORGANIZATIONAL STRUCTURE
  departments: {
    "Διοίκηση": {
      description: "Στρατηγικός σχεδιασμός και γενική διοίκηση",
      budget: 500000,
      headCount: 1
    },
    "Πωλήσεις": {
      description: "Εμπορική ανάπτυξη και πωλήσεις",
      budget: 300000,
      headCount: 2
    },
    "Πληροφορική": {
      description: "Ανάπτυξη λογισμικού και τεχνική υποστήριξη",
      budget: 400000,
      headCount: 2
    },
    "Ανθρώπινο Δυναμικό": {
      description: "Διαχείριση προσωπικού και εκπαίδευση",
      budget: 200000,
      headCount: 2
    }
  },

  // 👥 COMPLETE EMPLOYEE HIERARCHY
  employees: [
    // 🎯 LEVEL 1: CEO (TOP EXECUTIVE)
    {
      firstName: "Γιάννης",
      lastName: "Παπαδόπουλος",
      position: "Chief Executive Officer",
      department: "Διοίκηση",
      relationshipType: "director",
      seniorityLevel: 1,
      salary: 120000,
      hireDate: "2020-01-15",
      email: "g.papadopoulos@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      responsibilities: ["Στρατηγικός σχεδιασμός", "Εταιρική διακυβέρνηση", "Επενδυτικές αποφάσεις"]
    },

    // 🎯 LEVEL 2: DEPARTMENT MANAGERS
    {
      firstName: "Μαρία",
      lastName: "Κωνσταντίνου",
      position: "Sales Director",
      department: "Πωλήσεις",
      relationshipType: "manager",
      seniorityLevel: 2,
      salary: 75000,
      hireDate: "2021-03-10",
      email: "m.konstantinou@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Γιάννης Παπαδόπουλος",
      responsibilities: ["Στρατηγική πωλήσεων", "Διαχείριση πελατών", "Ανάπτυξη αγοράς"]
    },
    {
      firstName: "Νίκος",
      lastName: "Γεωργίου",
      position: "IT Director",
      department: "Πληροφορική",
      relationshipType: "manager",
      seniorityLevel: 2,
      salary: 80000,
      hireDate: "2020-09-01",
      email: "n.georgiou@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Γιάννης Παπαδόπουλος",
      responsibilities: ["Τεχνολογική στρατηγική", "Διαχείριση συστημάτων", "Κυβερνοασφάλεια"]
    },
    {
      firstName: "Ελένη",
      lastName: "Δημητρίου",
      position: "HR Director",
      department: "Ανθρώπινο Δυναμικό",
      relationshipType: "manager",
      seniorityLevel: 2,
      salary: 70000,
      hireDate: "2021-01-20",
      email: "e.dimitriou@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Γιάννης Παπαδόπουλος",
      responsibilities: ["Διαχείριση ταλέντων", "Εκπαίδευση προσωπικού", "Εργασιακές σχέσεις"]
    },

    // 🎯 LEVEL 3: EMPLOYEES (OPERATIONAL STAFF)
    {
      firstName: "Κώστας",
      lastName: "Πετρόπουλος",
      position: "Senior Sales Representative",
      department: "Πωλήσεις",
      relationshipType: "employee",
      seniorityLevel: 3,
      salary: 45000,
      hireDate: "2022-06-15",
      email: "k.petropoulos@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Μαρία Κωνσταντίνου",
      responsibilities: ["B2B πωλήσεις", "Διαχείριση λογαριασμών", "Προσφορές & συμβόλαια"]
    },
    {
      firstName: "Σοφία",
      lastName: "Αντωνίου",
      position: "Senior Software Developer",
      department: "Πληροφορική",
      relationshipType: "employee",
      seniorityLevel: 3,
      salary: 55000,
      hireDate: "2021-11-01",
      email: "s.antoniou@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Νίκος Γεωργίου",
      responsibilities: ["Frontend ανάπτυξη", "UI/UX design", "Code reviews"]
    },
    {
      firstName: "Δημήτρης",
      lastName: "Βασιλείου",
      position: "HR Business Partner",
      department: "Ανθρώπινο Δυναμικό",
      relationshipType: "employee",
      seniorityLevel: 3,
      salary: 40000,
      hireDate: "2022-02-01",
      email: "d.vasileiou@${process.env.COMPANY_EMAIL_DOMAIN || 'techcorp.gr'}",
      reportsTo: "Ελένη Δημητρίου",
      responsibilities: ["Πρόσληψη προσωπικού", "Performance reviews", "Employee relations"]
    }
  ],

  // 📊 COMPREHENSIVE ORGANIZATION STATISTICS
  organizationStats: {
    totalEmployees: 7,
    totalDepartments: 4,
    hierarchyLevels: 3,
    averageSalary: 69285, // Calculated average
    totalPayroll: 485000,
    foundedYear: 2020,
    currentYear: 2024,
    companyAge: 4
  }
};

console.log(`
🧪 COMPREHENSIVE TEST DATA READY - ADAPTIVE UI DEMONSTRATION!

📊 COMPANY: ${COMPANY_DATA.companyName}
🎯 PURPOSE: Δείχνει πώς το OrganizationTree αλλάζει από "Απλό Οργανωτικό Σχήμα" → στατιστικές κάρτες

👥 EMPLOYEES (${COMPANY_DATA.employees.length}):
${COMPANY_DATA.employees.map((emp, index) =>
  `  ${index + 1}. ${emp.firstName} ${emp.lastName} - ${emp.position} (${emp.department}) [Level ${emp.seniorityLevel}]`
).join('\n')}

🏢 DEPARTMENTS (${Object.keys(COMPANY_DATA.departments).length}):
${Object.entries(COMPANY_DATA.departments).map(([dept, info]) =>
  `  • ${dept}: ${info.headCount} άτομα - ${info.description}`
).join('\n')}

📈 COMPLETE HIERARCHY STRUCTURE (${COMPANY_DATA.organizationStats.hierarchyLevels} levels):
  • Level 1 (CEO): ${COMPANY_DATA.employees.filter(e => e.seniorityLevel === 1).length} person
    - Γιάννης Παπαδόπουλος (Chief Executive Officer)

  • Level 2 (Managers): ${COMPANY_DATA.employees.filter(e => e.seniorityLevel === 2).length} people
    - Μαρία Κωνσταντίνου (Sales Director)
    - Νίκος Γεωργίου (IT Director)
    - Ελένη Δημητρίου (HR Director)

  • Level 3 (Employees): ${COMPANY_DATA.employees.filter(e => e.seniorityLevel === 3).length} people
    - Κώστας Πετρόπουλος (Senior Sales Representative)
    - Σοφία Αντωνίου (Senior Software Developer)
    - Δημήτρης Βασιλείου (HR Business Partner)

🎯 EXPECTED ADAPTIVE UI TRANSFORMATION:

ΠΡΙΝ (Απλό οργανωτικό σχήμα):
┌──────────────────────────────────────────────────────────────┐
│                 🏢 Απλό Οργανωτικό Σχήμα                    │
│   Αυτή η εταιρεία έχει βασική οργανωσιακή δομή χωρίς         │
│         πολύπλοκη ιεραρχία.                                  │
└──────────────────────────────────────────────────────────────┘

ΜΕΤΑ (Στατιστικές κάρτες με τα νέα data):
┌─────────────────┬─────────────────┬─────────────────┐
│   👥 7          │   🏢 4          │   📊 3          │
│ Συνολικοί      │ Ενεργά         │ Επίπεδα        │
│ Εργαζόμενοι    │ Τμήματα        │ Διοίκησης      │
└─────────────────┴─────────────────┴─────────────────┘

💰 FINANCIAL OVERVIEW:
  • Total Payroll: €${COMPANY_DATA.organizationStats.totalPayroll.toLocaleString()}
  • Average Salary: €${COMPANY_DATA.organizationStats.averageSalary.toLocaleString()}
  • Department Budgets: €${Object.values(COMPANY_DATA.departments).reduce((sum, dept) => sum + dept.budget, 0).toLocaleString()}

🚀 ADAPTIVE UI PROOF:
  ✅ totalEmployees: ${COMPANY_DATA.organizationStats.totalEmployees} (ΘΕΤΙΚΟΣ ΑΡΙΘΜΟΣ → θα εμφανιστεί η κάρτα)
  ✅ departmentCount: ${COMPANY_DATA.organizationStats.totalDepartments} (ΘΕΤΙΚΟΣ ΑΡΙΘΜΟΣ → θα εμφανιστεί η κάρτα)
  ✅ hierarchyDepth: ${COMPANY_DATA.organizationStats.hierarchyLevels} (> 1 → θα εμφανιστεί η κάρτα)

🎯 ΑΠΟΤΕΛΕΣΜΑ: Αντί για "Απλό Οργανωτικό Σχήμα", θα δούμε τις 3 στατιστικές κάρτες!

📋 NEXT STEPS:
  1. Προσθήκη αυτών των δεδομένων στη βάση (Firebase/Firestore)
  2. Refresh του UI για να δούμε το adaptive behavior
  3. Επιβεβαίωση ότι η OrganizationTree αλλάζει αυτόματα
`);

module.exports = { COMPANY_DATA };