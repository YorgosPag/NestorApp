/**
 * Οι **διαδρομές** του καταλόγου (ADR-923 §5.9) — API και σελίδες, σε **ένα** σημείο που διαβάζουν και τα
 * hooks της οθόνης και η πλοήγηση. Τα routes του Next.js ζουν στο σύστημα αρχείων· αυτό το αρχείο είναι η
 * μία ονομασία τους για τον πελάτη, ώστε μετονομασία φακέλου να σπάει **ένα** σημείο.
 * Οι σελίδες είναι τμήματα **μέσα** στον χώρο (`/o/<χώρος>/…`, ADR-787) — το πρόθεμα το βάζει η πλοήγηση.
 * @module subapps/catalog/catalog-routes
 */

const API_ROOT = '/api/catalog';

const entity = (collection: string) => ({
  collection: `${API_ROOT}/${collection}`,
  item: (id: string) => `${API_ROOT}/${collection}/${encodeURIComponent(id)}`,
});

export const CATALOG_API = {
  attributes: entity('attributes'),
  attributeGroups: entity('attribute-groups'),
  measurementFamilies: entity('measurement-families'),
  categories: {
    ...entity('categories'),
    move: (id: string) => `${API_ROOT}/categories/${encodeURIComponent(id)}/move`,
  },
  families: entity('families'),
  // ── Φάση 2 (ADR-923 §5.10) — δεδομένα ──
  productModels: {
    ...entity('product-models'),
    /** Η δέσμη παραλλαγών (επικόλληση TSV): μία συναλλαγή, CAS ανά παραλλαγή. */
    variants: (id: string) => `${API_ROOT}/product-models/${encodeURIComponent(id)}/variants`,
  },
  products: entity('products'),
  assets: {
    ...entity('assets'),
    /** Σύνδεση αρχείου (ή νέας έκδοσής του) με το μέσο — μέτρηση, αποδόσεις, CAS (ADR-923 §5.10.3). */
    file: (id: string) => `${API_ROOT}/assets/${encodeURIComponent(id)}/file`,
  },
  settings: `${API_ROOT}/settings`,
  /** Μία σελίδα της εργασίας επανυπολογισμού παραγώγων (δρομέας). */
  recomputeDerived: `${API_ROOT}/derived/recompute`,
} as const;

/** Η παράμετρος αναθεώρησης της διαγραφής (`DELETE …?expectedRevision=N`) — ένα όνομα για πελάτη και route. */
export const EXPECTED_REVISION_PARAM = 'expectedRevision';

/** Τμήματα σελίδων μέσα στον χώρο. */
export const CATALOG_PAGES = {
  /** Το ενιαίο πλέγμα προϊόντων + επεξεργαστής (ADR-923 §5.10.4 Β2/Β3) — η κύρια οθόνη, όπως στο Akeneo. */
  products: '/catalog/products',
  families: '/catalog/families',
  attributes: '/catalog/attributes',
  categories: '/catalog/categories',
  measurements: '/catalog/measurements',
  /** Βιβλιοθήκη μέσων (ADR-923 §5.10.4). */
  assets: '/catalog/assets',
  /** Κανάλια × γλώσσες (ADR-923 §5.10.4 Β5). */
  settings: '/catalog/settings',
} as const;
