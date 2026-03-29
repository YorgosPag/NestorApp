# Accounting Phase 1b — Αποφάσεις Σχεδιασμού

**Ημερομηνία**: 2026-03-29
**Scope**: Customer Balances + Fiscal Period Management
**Μέθοδος**: Ερωτήσεις → Αποφάσεις Γιώργου → Τεκμηρίωση

---

## Ερωτήσεις & Αποφάσεις

### Q1: Customer Balances — Real-time ή Pre-computed;

**Ερώτηση**: Πώς θα υπολογίζουμε τα υπόλοιπα πελατών;

**Επιλογές**:
- **A) Real-time calculation** (Xero/QuickBooks pattern): Κάθε φορά που ζητάς balance, κάνει query στα ανοιχτά τιμολόγια και υπολογίζει on-the-fly. Πλεονέκτημα: πάντα ακριβές, zero maintenance. Μειονέκτημα: πιο αργό σε πολλά τιμολόγια.
- **B) Pre-computed snapshot** (SAP pattern): Ξεχωριστή collection `customer_balances` που ενημερώνεται ατομικά (transaction) κάθε φορά που αλλάζει τιμολόγιο/πληρωμή. Πλεονέκτημα: instant read. Μειονέκτημα: πολυπλοκότητα sync, risk αποσυγχρονισμού.
- **C) Hybrid** (NetSuite pattern): Pre-computed snapshot + periodic reconciliation job που ελέγχει accuracy. Best of both worlds.

**Πρόταση Claude**: Για ατομική επιχείρηση με <500 τιμολόγια/χρόνο, το **A (Real-time)** είναι αρκετό και πολύ πιο απλό. Αν θέλεις enterprise-ready, το **C (Hybrid)**.

**Απόφαση Γιώργου**: _(αναμονή)_

---

### Q2: _(αναμονή Q1)_
