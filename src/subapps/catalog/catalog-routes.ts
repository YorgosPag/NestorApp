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
  // ── Φάση 3β (ADR-923 §5.11) — τιμολόγηση ──
  priceLists: {
    ...entity('price-lists'),
    /** Νέα πρόχειρη έκδοση της λίστας (κενή ή «από την τρέχουσα»). */
    versions: (id: string) => `${API_ROOT}/price-lists/${encodeURIComponent(id)}/versions`,
  },
  priceListVersions: {
    item: entity('price-list-versions').item,
    /** Η δέσμη γραμμών: μία συναλλαγή, CAS στο `linesRevision`. */
    lines: (id: string) => `${API_ROOT}/price-list-versions/${encodeURIComponent(id)}/lines`,
    /** Συνέχιση σποράς από τον δρομέα (ιδεμπότητη). */
    seed: (id: string) => `${API_ROOT}/price-list-versions/${encodeURIComponent(id)}/seed`,
    /** Η διαφορά από την τρέχουσα δημοσιευμένη + το αποτύπωμα του φράχτη. */
    diff: (id: string) => `${API_ROOT}/price-list-versions/${encodeURIComponent(id)}/diff`,
    publish: (id: string) => `${API_ROOT}/price-list-versions/${encodeURIComponent(id)}/publish`,
    discard: (id: string) => `${API_ROOT}/price-list-versions/${encodeURIComponent(id)}/discard`,
  },
  discountGroups: entity('discount-groups'),
  customerGroups: entity('customer-groups'),
  customerAssignments: entity('customer-assignments'),
  discountConditions: entity('discount-conditions'),
  /** «Δες την τιμή σαν τον Χ» — εσωτερική προεπισκόπηση (3β απόφαση Δ). */
  priceQuote: `${API_ROOT}/price-quote`,
  /** Η τιμή ενός υποκειμένου μέσα από τις δημοσιευμένες εκδόσεις μιας λίστας («3δ» Τμήμα 3). */
  priceHistory: `${API_ROOT}/price-history`,
  /** Το βιβλίο τιμών κόστους του προϋπολογισμού («3ε»): master του χώρου + λίστες του έργου. */
  costRates: `${API_ROOT}/cost-rates`,
  /**
   * Όψεις τιμών (ADR-923 §5.11 «3δ» Ζ) — η ΜΟΝΗ πόρτα ανάγνωσης τιμών (`GET`, κριτής `pricingView`). Οι λίστες διαβάζονται
   * στο `priceLists.collection`, οι γραμμές στο `priceListVersions.lines(id)`· εδώ η όψη εκπτώσεων.
   */
  discounts: `${API_ROOT}/discounts`,
} as const;

/** Το έργο του βιβλίου τιμών κόστους (`GET …/cost-rates?projectId=…`). */
export const COST_RATES_PROJECT_PARAM = 'projectId';

/** Η παράμετρος αναθεώρησης της διαγραφής (`DELETE …?expectedRevision=N`) — ένα όνομα για πελάτη και route. */
export const EXPECTED_REVISION_PARAM = 'expectedRevision';

/** Ο δρομέας σελίδας μιας όψης (`GET …?cursor=<id εγγράφου>`) — ένα όνομα για πελάτη και route. */
export const CURSOR_PARAM = 'cursor';

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
  /** Τιμοκατάλογοι · εκδόσεις · γραμμές · δημοσίευση (ADR-923 §5.11 «3δ» Τμήμα 1) — προβολή με `catalog:pricing:view`. */
  priceLists: '/catalog/price-lists',
  /** Ομάδες έκπτωσης · ομάδες πελατών · πίνακας συνθηκών (ADR-923 §5.11 «3δ» Τμήμα 2) — προβολή με `catalog:pricing:view`. */
  discounts: '/catalog/discounts',
} as const;
