/**
 * **Τα tags της μνήμης της δημόσιας βιτρίνας** (ADR-923 §5.13 Δ4), γραμμένα μία φορά.
 *
 * 🔑 Ξεχωριστό από τον αναγνώστη, ώστε γραφέας και ανάκληση να τα εισάγουν χωρίς το `unstable_cache`: ο αναγνώστης τα
 *    δηλώνει, ο γραφέας τα ακυρώνει. Το Admin SDK δεν περνά από `fetch`, άρα χωρίς tag η σελίδα ISR μένει ζωντανή ως το
 *    τέλος του παραθύρου.
 *
 * @module server/catalog/public/public-catalog-cache-tag
 */

export const publicCatalogCompanyTag = (companyId: string): string => `public-catalog:company:${companyId}`;

export const publicCatalogModelTag = (modelId: string): string => `public-catalog:model:${modelId}`;

/**
 * Οι τιμές της βιτρίνας ενός προμηθευτή (ADR-923 §5.13 Σ6). Χωριστό tag, γιατί η τιμολόγηση δεν περνά από το outbox: κάθε γραφή
 * που αγγίζει όψη τιμών (λίστα, έκδοση, γραμμή, συνθήκη, ανάθεση) το χτυπά μετά το commit.
 */
export const publicCatalogPricesTag = (companyId: string): string => `public-catalog:prices:${companyId}`;
