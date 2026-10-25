/**
 * Προθέματα ταυτοτήτων του **καταλόγου προμηθευτή** (ADR-923 §5.9) — χωριστό αρχείο όπως
 * το `-dxf-bim` (N.7.1), απλωμένο στο `ENTERPRISE_ID_PREFIXES`. Η μη σύγκρουση με κάθε
 * άλλο πρόθεμα φυλάσσεται από το `enterprise-id-prefix-uniqueness.test.ts`.
 *
 * 🔑 Τα id του σχήματος είναι **ντετερμινιστικά** από `(companyId, code)`: ο κωδικός είναι
 * αμετάβλητος (§5.2.1), άρα το id είναι σταθερό, και η **μοναδικότητα του κωδικού** ανά
 * χώρο εγγυάται **δομικά** — η δημιουργία μέσα σε συναλλαγή αποτυγχάνει αν το έγγραφο
 * υπάρχει ήδη. Καμία συλλογή κρατήσεων, κανένα ερώτημα «υπάρχει ήδη;» με race.
 * @module services/enterprise-id-prefixes-catalog
 */

export const CATALOG_ID_PREFIXES = {
  CATALOG_ATTRIBUTE: 'cattr',          // catalog_attributes — ιδιότητα της βιβλιοθήκης
  CATALOG_ATTRIBUTE_GROUP: 'cagrp',    // catalog_attribute_groups — ομάδα ιδιοτήτων
  CATALOG_MEASUREMENT_FAMILY: 'cmfam', // catalog_measurement_families — οικογένεια μέτρησης χώρου
  CATALOG_CATEGORY: 'ccat',            // catalog_categories — κόμβος δέντρου κατηγοριών
  CATALOG_FAMILY: 'cfam',              // catalog_families — οικογένεια προϊόντων
} as const;
