/**
 * Η ετικέτα μιας οικογένειας μέτρησης της πλατφόρμας: **κλειδί i18n** στο namespace
 * `catalog` (N.11) — η πλατφόρμα μιλά στη γλώσσα του χρήστη, ενώ τα σύμβολα μονάδων
 * (kW, m³/h) μένουν αμετάφραστα όπως στο SI.
 * @module subapps/catalog/measurement/platform-families/platform-family-label
 */

export function platformFamilyLabel(code: string): { readonly kind: 'i18n'; readonly key: string } {
  return { kind: 'i18n', key: `catalog:measurement.family.${code}` };
}
