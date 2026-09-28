/**
 * @fileoverview **ΟΙ ΠΗΓΕΣ ΑΝΟΙΧΤΩΝ ΔΕΔΟΜΕΝΩΝ ΠΟΥ ΔΕΙΧΝΟΥΜΕ ΣΤΟ ΚΟΙΝΟ** — σύνδεσμοι και άδεια, μία φορά.
 * @related ADR-889 §2.1 (άδεια ΜΑΜΑ, γραπτή απάντηση ΥΠΕΘΟΟ 2026-09-28) · §2.3 (ζώνες) ·
 *   `components/market/OpenDataAttribution.tsx` (η μία απόδοση στην οθόνη) · `docs/legal/data-licenses/README.md`
 * @module config/open-data-sources
 *
 * 🔑 **Η ΑΝΑΦΟΡΑ ΕΙΝΑΙ ΥΠΟΧΡΕΩΣΗ ΑΔΕΙΑΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ.** Η CC-BY 4.0 ζητά (α) τον κύριο, (β) σύνδεσμο στην
 * άδεια, (γ) δήλωση αλλαγών. Αν ο σύνδεσμος ζούσε αντιγραμμένος σε κάθε κάρτα, η επόμενη αλλαγή URL στο
 * data.gov.gr θα διορθωνόταν σε μία και θα ξεχνιόταν στις άλλες — ίδιο μάθημα με το `map-attribution.ts`
 * (πέντε χάρτες, πέντε ξεχασμένες αποδόσεις).
 *
 * Τα **ονόματα** (κύριος, σύνολο δεδομένων) είναι κείμενο για τον άνθρωπο ⇒ i18n `market-contracts:source.*`,
 * με κλειδί το `id` της πηγής. Εδώ μένουν μόνο όσα δεν μεταφράζονται.
 *
 * ⚠️ **Φύλλο χωρίς εισαγωγές**: το διαβάζει και ο γεννήτορας (`tsx`), που γράφει την αναφορά στο ευρετήριο.
 */

export interface OpenDataLicense {
  /** Αναγνωριστικό SPDX. */
  readonly spdx: string;
  readonly url: string;
}

export interface OpenDataSource {
  readonly id: OpenDataSourceId;
  /** Η σελίδα του συνόλου δεδομένων στο data.gov.gr. */
  readonly datasetUrl: string;
  readonly license: OpenDataLicense;
}

const CC_BY_4: OpenDataLicense = { spdx: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

export const OPEN_DATA_SOURCE_IDS = ['transferValues', 'valueZones'] as const;
export type OpenDataSourceId = (typeof OPEN_DATA_SOURCE_IDS)[number];

export const OPEN_DATA_SOURCES: Readonly<Record<OpenDataSourceId, OpenDataSource>> = {
  /** Μητρώο Αξιών Μεταβιβάσεων Ακινήτων — κύριος ΥΠΕΘΟΟ (ADR-889 §2.1). */
  transferValues: {
    id: 'transferValues',
    datasetUrl: 'https://data.gov.gr/dataset/mitroo-axion-metavivaseon-akiniton',
    license: CC_BY_4,
  },
  /** Ζώνες αντικειμενικών αξιών (valuemaps) — κύριος ΥΠΕΘΟΟ (ADR-889 §2.3). */
  valueZones: {
    id: 'valueZones',
    datasetUrl:
      'https://data.gov.gr/dataset/geochoriki-apeikonisi-zonon-systimatos-antikeimenikoy-prosdiorismoy-axion-akiniton-kai-ypologismos-a',
    license: CC_BY_4,
  },
};
