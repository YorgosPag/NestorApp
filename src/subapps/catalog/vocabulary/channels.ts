/**
 * =============================================================================
 * ΤΑ ΚΑΝΑΛΙΑ ΤΟΥ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.2) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * «Υποχρεωτικό **ανά κανάλι**» και «τιμή **ανά κανάλι**» (scopable) χρειάζονται ένα
 * σύνολο καναλιών. Στο Akeneo τα κανάλια τα ορίζει ο χρήστης· **εδώ είναι κλειστό
 * σύνολο της πλατφόρμας**, επειδή κάθε κανάλι είναι **επιφάνεια που χτίζουμε εμείς**:
 *
 * | Κανάλι | Επιφάνεια | Φάση |
 * |---|---|---|
 * | `print` | ο έντυπος/PDF κατάλογος του εκδότη (Typst, §5.6) | 5 |
 * | `storefront` | η δημόσια βιτρίνα του προμηθευτή | 6 |
 * | `portal` | η πύλη σύγκρισης της πλατφόρμας (§13) | 8 |
 * | `quote` | αίτημα προσφοράς / παραγγελία (§15) | 6 |
 *
 * Κανάλι που ορίζει ο χρήστης **χωρίς επιφάνεια από πίσω του** δεν θα έκανε τίποτα —
 * θα ήταν υπόσχεση που η εφαρμογή δεν μπορεί να τηρήσει. Νέο κανάλι = νέα επιφάνεια =
 * απόφαση προϊόντος, και τότε προστίθεται **εδώ**.
 *
 * @module subapps/catalog/vocabulary/channels
 */

export const CATALOG_CHANNELS = ['print', 'storefront', 'portal', 'quote'] as const;

export type CatalogChannel = (typeof CATALOG_CHANNELS)[number];

export function isCatalogChannel(value: unknown): value is CatalogChannel {
  return (CATALOG_CHANNELS as readonly unknown[]).includes(value);
}

/**
 * Χάρτης **ανά κανάλι**, εξαντλητικός εκ κατασκευής (τα κλειδιά είναι το `CATALOG_CHANNELS`).
 * Η μία ισχυροποίηση τύπου του `Object.fromEntries` ζει **εδώ**, όχι σε κάθε καταναλωτή.
 */
export function mapCatalogChannels<T>(build: (channel: CatalogChannel) => T): Record<CatalogChannel, T> {
  return Object.fromEntries(CATALOG_CHANNELS.map((channel) => [channel, build(channel)])) as Record<CatalogChannel, T>;
}
