/**
 * =============================================================================
 * ΟΙ ΤΥΠΟΙ ΣΥΝΗΜΜΕΝΩΝ ETIM xChange (ATX) → ΡΟΛΟΣ ΜΕΣΟΥ (ADR-934 §5.2 Μ2 · Μ11) — ΡΙΖΑ, CHECK 3.73
 * =============================================================================
 *
 * **ΕΝΑΣ** πίνακας για τις δύο κατευθύνσεις: η εισαγωγή διαβάζει `ATX → ρόλος`, η εξαγωγή (Μ10) θα γράφει
 * `ρόλος → ATX` από τον **ίδιο** πίνακα. Δύο πίνακες θα απέκλιναν, και η εξαγωγή → εισαγωγή δεν θα έδινε «Αμετάβλητο».
 *
 * ⚠️ **Ο πίνακας ATX στο PDF του ETIM τυπώνεται μετατοπισμένος κατά μία γραμμή.** Η αντιστοίχιση εδώ επαληθεύτηκε από
 * το changelog του ίδιου εγγράφου (ATX023 = 360° · ATX024 = deeplink · ATX025 = ανταλλακτικά · ATX026 = περιβαλλοντική
 * σήμανση) και από τρίτη πηγή (ATX015 = κύρια φωτογραφία). Ο **κατάλογος** των κωδικών είναι το enum `AttachmentType`
 * του επίσημου σχήματος 2.0 (`interop/etim/__tests__/fixtures/xchange-2.0.schema.json`), και ένα test απαιτεί ο πίνακας
 * να το καλύπτει **ακριβώς**: νέος κωδικός στο πρότυπο ⇒ κόκκινο, όχι σιωπηλό «άλλο».
 *
 * 🔑 Ο ρόλος λέει **τι είναι** το μέσο (ADR-923 §5.10 Δ9). Η «κύρια» φωτογραφία (ATX015 · `AttachmentOrder = 1`) είναι
 * **χρήση** και την αποφασίζει η ιδιότητα εικόνας της οικογένειας — γι' αυτό ο κωδικός ATX ταξιδεύει μαζί με το μέσο.
 *
 * @module subapps/catalog/vocabulary/etim-attachments
 */

import type { CatalogAssetRole } from './asset-roles';

/** Το enum `AttachmentType` του σχήματος ETIM xChange 2.0 (προϊόν και εμπορεύσιμο είδος). */
export const ETIM_ATTACHMENT_TYPES = [
  'ATX001',
  'ATX002',
  'ATX003',
  'ATX004',
  'ATX010',
  'ATX011',
  'ATX012',
  'ATX013',
  'ATX014',
  'ATX015',
  'ATX016',
  'ATX017',
  'ATX018',
  'ATX019',
  'ATX020',
  'ATX021',
  'ATX022',
  'ATX023',
  'ATX024',
  'ATX025',
  'ATX026',
  'ATX099',
] as const;

export type EtimAttachmentType = (typeof ETIM_ATTACHMENT_TYPES)[number];

export function isEtimAttachmentType(value: unknown): value is EtimAttachmentType {
  return (ETIM_ATTACHMENT_TYPES as readonly unknown[]).includes(value);
}

/**
 * Τι γίνεται ένα συνημμένο: **μέσο** με ρόλο · **σύνδεσμος** (δεν είναι αρχείο, δεν κατεβαίνει) · **εκτός** (δεν έχουμε
 * ρόλο που να λέει την αλήθεια — δηλώνεται στην αναφορά, ποτέ σιωπηλά και ποτέ με μαντεμένο ρόλο).
 */
export type EtimAttachmentOutcome =
  | { readonly kind: 'asset'; readonly role: CatalogAssetRole }
  | { readonly kind: 'link' }
  | { readonly kind: 'unsupported' };

const asset = (role: CatalogAssetRole): EtimAttachmentOutcome => ({ kind: 'asset', role });
const LINK: EtimAttachmentOutcome = { kind: 'link' };
const UNSUPPORTED: EtimAttachmentOutcome = { kind: 'unsupported' };

/** Δεμένο στη ρίζα (`Record<EtimAttachmentType, …>`): νέος κωδικός χωρίς γραμμή σπάει τη μεταγλώττιση. */
export const ETIM_ATTACHMENT_OUTCOME: Readonly<Record<EtimAttachmentType, EtimAttachmentOutcome>> = {
  ATX001: asset('certificate'), // πιστοποιητικό (CE, KEYMARK, ISO …)
  ATX002: asset('bim'), // μοντέλο 3D / BIM
  ATX003: asset('datasheet'), // φύλλο τεχνικών δεδομένων
  ATX004: asset('declaration'), // DoP / DoC — κανονιστική δήλωση (CPR 2024/3110), όχι πιστοποιητικό
  ATX010: asset('drawing'), // διάγραμμα (συνδεσμολογία, καμπύλες)
  ATX011: asset('drawing'), // τεχνικό σχέδιο / διαστάσεις
  ATX012: asset('energyLabel'), // ενεργειακή σήμανση (Κανονισμός 2017/1369)
  ATX013: asset('epd'), // LCA / EPD
  ATX014: asset('logo'), // λογότυπο
  ATX015: asset('photo'), // κύρια φωτογραφία — η «κύρια» είναι χρήση, βλ. κεφαλίδα
  ATX016: asset('manual'), // εγχειρίδιο εγκατάστασης / χρήσης
  ATX017: UNSUPPORTED, // υλικό μάρκετινγκ: φυλλάδιο ή εικόνα χωρίς κοινό είδος — κανένας ρόλος δεν το λέει με ακρίβεια
  ATX018: asset('photo'), // φωτογραφία (επιπλέον)
  ATX019: asset('safetyDataSheet'), // SDS (REACH άρθρο 31)
  ATX020: asset('video'), // βίντεο
  ATX021: UNSUPPORTED, // εγγύηση: όροι, όχι μέσο προϊόντος
  ATX022: UNSUPPORTED, // λογισμικό / firmware: εκτελέσιμο, δεν το φιλοξενούμε
  ATX023: UNSUPPORTED, // εικόνα 360°: σειρά καρέ ή player, δεν έχουμε θεατή
  ATX024: LINK, // deeplink στη σελίδα του προμηθευτή — διεύθυνση, όχι αρχείο
  ATX025: UNSUPPORTED, // κατάλογος ανταλλακτικών
  ATX026: UNSUPPORTED, // περιβαλλοντική σήμανση (π.χ. Ecolabel): δεν είναι EPD και δεν έχει δικό της ρόλο ακόμη
  ATX099: UNSUPPORTED, // «άλλο»: εξ ορισμού χωρίς σημασία
};

/** Η κρίση για οποιοδήποτε κείμενο: άγνωστος κωδικός (π.χ. ATX από νεότερο πρότυπο) ⇒ `unsupported`, ποτέ σφάλμα. */
export function attachmentOutcomeOf(code: string): EtimAttachmentOutcome {
  return isEtimAttachmentType(code) ? ETIM_ATTACHMENT_OUTCOME[code] : UNSUPPORTED;
}

/** Το MDX της μικρογραφίας: τις αποδόσεις τις φτιάχνουμε εμείς (ADR-923 §5.10), άρα δεν εισάγεται ως μέσο. */
export const ETIM_THUMBNAIL_SPECIFICATION = 'MDX048';
