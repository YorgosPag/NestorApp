/**
 * Προθέματα ταυτοτήτων του **καταλόγου προμηθευτή** (ADR-923 §5.9) — χωριστό αρχείο όπως
 * το `-dxf-bim` (N.7.1), απλωμένο στο `ENTERPRISE_ID_PREFIXES`. Η μη σύγκρουση με κάθε
 * άλλο πρόθεμα φυλάσσεται από το `enterprise-id-prefix-uniqueness.test.ts`.
 *
 * 🔑 Τα id του σχήματος είναι **ντετερμινιστικά** από `(companyId, code)`: ο κωδικός είναι
 * αμετάβλητος (§5.2.1), άρα το id είναι σταθερό, και η **μοναδικότητα του κωδικού** ανά
 * χώρο εγγυάται **δομικά** — η δημιουργία μέσα σε συναλλαγή αποτυγχάνει αν το έγγραφο
 * υπάρχει ήδη. Καμία συλλογή κρατήσεων, κανένα ερώτημα «υπάρχει ήδη;» με race.
 *
 * 🔑 Φάση 2: το **SKU** παίρνει **τυχαίο** id (Akeneo 7 UUID · Revit GUID) — ο κωδικός του (016-15-001) είναι
 * ιδιότητα `unique` που μπορεί να διορθωθεί. Τη μοναδικότητά του την εγγυάται η **κράτηση** `cuval`, της οποίας
 * το id είναι ντετερμινιστικό από (χώρος, ιδιότητα, κανονικοποιημένη τιμή) — ίδιος μηχανισμός, άλλο κλειδί.
 * @module services/enterprise-id-prefixes-catalog
 */

export const CATALOG_ID_PREFIXES = {
  CATALOG_ATTRIBUTE: 'cattr',          // catalog_attributes — ιδιότητα της βιβλιοθήκης
  CATALOG_ATTRIBUTE_GROUP: 'cagrp',    // catalog_attribute_groups — ομάδα ιδιοτήτων
  CATALOG_MEASUREMENT_FAMILY: 'cmfam', // catalog_measurement_families — οικογένεια μέτρησης χώρου
  CATALOG_CATEGORY: 'ccat',            // catalog_categories — κόμβος δέντρου κατηγοριών
  CATALOG_FAMILY: 'cfam',              // catalog_families — οικογένεια προϊόντων
  // ── Φάση 2 (ADR-923 §5.10) — δεδομένα πάνω στο σχήμα ──
  CATALOG_PRODUCT_MODEL: 'cpmod',      // catalog_product_models — μοντέλο / υπο-μοντέλο (ντετερμινιστικό από κωδικό)
  CATALOG_PRODUCT: 'cprod',            // catalog_products — SKU (ΤΥΧΑΙΟ: ο κωδικός είναι ιδιότητα, όχι ταυτότητα — Δ3)
  CATALOG_ASSET: 'casst',              // catalog_assets — μέσο (ντετερμινιστικό από κωδικό)
  CATALOG_SETTINGS: 'cset',            // catalog_settings — ρυθμίσεις, ΕΝΑ ανά χώρο
  CATALOG_UNIQUE_VALUE: 'cuval',       // catalog_unique_values — κράτηση μοναδικής τιμής (χώρος, ιδιότητα, κλειδί)
} as const;
