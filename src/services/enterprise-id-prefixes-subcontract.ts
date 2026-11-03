/**
 * Προθέματα ταυτοτήτων του **συμφωνητικού υπεργολαβίας** (ADR-928 §5.1) — χωριστό αρχείο όπως το
 * `-catalog` και το `-dxf-bim` (N.7.1), απλωμένο στο `ENTERPRISE_ID_PREFIXES`. Τη μη σύγκρουση με κάθε
 * άλλο πρόθεμα τη φυλάει το `enterprise-id-prefix-uniqueness.test.ts`.
 *
 * 🔑 **Ντετερμινιστικά** όπου υπάρχει φυσικό κλειδί, ώστε η μοναδικότητα να είναι **δομική** (δημιουργία
 * μέσα σε συναλλαγή ⇒ σύγκρουση, όχι διπλότυπο — ίδιο μοτίβο με τον κατάλογο, ADR-923 §5.9):
 * - ρήτρα: (χώρος, `clauseKey`) — το κλειδί είναι αμετάβλητο (`payment.schedule`).
 * - έκδοση ρήτρας: (ρήτρα, αριθμός έκδοσης).
 * - πρότυπο ειδικότητας: (χώρος, κωδικός προτύπου).
 * - αναθεώρηση συμφωνητικού: (συμφωνητικό, αριθμός αναθεώρησης) — δύο ταυτόχρονα «Έκδοση» ⇒ **ΜΙΑ** αναθεώρηση.
 *
 * 🎲 **Τυχαία** όπου καμία φυσική ταυτότητα δεν υπάρχει: το ίδιο το συμφωνητικό (ο αριθμός του είναι ιδιότητα
 * που δίνει μετρητής) και η ανάθεση εργοταξίου (ο ίδιος υπεργολάβος στέλνεται δύο φορές στο ίδιο έργο).
 * @module services/enterprise-id-prefixes-subcontract
 */

export const SUBCONTRACT_ID_PREFIXES = {
  SUBCONTRACT_AGREEMENT: 'sca',          // subcontract_agreements — προσφορά / συμφωνητικό (ΤΥΧΑΙΟ)
  SUBCONTRACT_REVISION: 'scrv',          // subcontract_agreements/{id}/revisions — αμετάβλητη έκδοση (από συμφωνητικό + αριθμό)
  SUBCONTRACT_ASSIGNMENT: 'scas',        // ανάθεση εργοταξίου σε συμφωνητικό `multi_project` (ΤΥΧΑΙΟ)
  SUBCONTRACT_CLAUSE: 'sccl',            // subcontract_clauses — ρήτρα βιβλιοθήκης (από χώρο + clauseKey)
  SUBCONTRACT_CLAUSE_VERSION: 'sccv',    // subcontract_clauses/{id}/versions — έκδοση ρήτρας (από ρήτρα + αριθμό)
  SUBCONTRACT_TRADE_TEMPLATE: 'sctt',    // subcontract_trade_templates — πρότυπο ειδικότητας (από χώρο + κωδικό)
} as const;
