/**
 * =============================================================================
 * ΤΑ ΕΙΔΗ ΚΑΤΑΧΩΡΙΣΗΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §22) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * | Είδος | Τι πουλά |
 * |---|---|
 * | `product` | φυσικό προϊόν |
 * | `service` | εργασία ή μελέτη, χωρίς απόθεμα και αποστολή |
 * | `productWithInstallation` | προϊόν με δεσμό σε υπηρεσία τοποθέτησης: δύο SKU, ποτέ μία ενιαία τιμή |
 *
 * Το είδος ανήκει στην **οικογένεια**, γιατί εκείνη ορίζει το σχήμα και την πληρότητα. Κανένα νέο έγγραφο ή γραμμή τιμής:
 * η υπηρεσία είναι κανονικό SKU.
 *
 * @module subapps/catalog/vocabulary/listing-kinds
 */

export const CATALOG_LISTING_KINDS = ['product', 'service', 'productWithInstallation'] as const;

export type CatalogListingKind = (typeof CATALOG_LISTING_KINDS)[number];

/** Οικογένειες πριν από την §22 δεν έχουν το πεδίο: είναι προϊόντα. */
export const DEFAULT_LISTING_KIND: CatalogListingKind = 'product';
