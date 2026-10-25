/**
 * =============================================================================
 * ΠΕΡΙΕΧΟΜΕΝΟ ≠ ΕΓΓΡΑΦΗ — το κοινό περίβλημα κάθε οντότητας σχήματος (ADR-923 §5.9)
 * =============================================================================
 *
 * Κάθε οντότητα του σχήματος (ιδιότητα · ομάδα · οικογένεια μέτρησης · κατηγορία ·
 * οικογένεια) χωρίζεται σε δύο:
 *
 *   - **ορισμός** (`…Definition`): ό,τι γράφει ο άνθρωπος — αυτό επικυρώνεται, αυτό
 *     συγκρίνεται, αυτό ταξιδεύει σε εισαγωγή/εξαγωγή. **Καμία** χρονοσφραγίδα.
 *   - **εγγραφή** (`CatalogRecord<Def, Instant>`): ο ορισμός + ταυτότητα, ενοικιαστής,
 *     ιστορικό, αναθεώρηση.
 *
 * 🔑 **Γιατί γενικό ως προς τη χρονοσφραγίδα**: η ίδια εγγραφή έχει τρεις νόμιμες μορφές
 * (client `Timestamp` · admin `Timestamp` · ISO `string` στο σύρμα — ADR-663 §4 μέρος 5).
 * Η λίστα πεδίων ζει **μία** φορά εδώ· οι τρεις μορφές παράγονται από αυτήν.
 *
 * 🔒 **`revision`**: αύξων αριθμός που γράφει **μόνο** ο γραφέας. Κάθε ενημέρωση στέλνει
 * την αναθεώρηση που **διάβασε**· αν άλλαξε στο μεταξύ, ο γραφέας απαντά 409 αντί να
 * σβήσει σιωπηλά τη δουλειά του άλλου (compare-and-swap — Google Docs/Figma: «κάποιος
 * άλλος άλλαξε αυτό, ξαναφόρτωσε»).
 *
 * @module subapps/catalog/types/catalog-record
 */

export interface CatalogRecordMeta<TInstant> {
  readonly id: string;
  readonly companyId: string;
  readonly revision: number;
  readonly isDeleted: boolean;
  readonly createdAt: TInstant;
  readonly createdBy: string;
  readonly updatedAt: TInstant;
  readonly updatedBy: string;
  readonly deletedAt: TInstant | null;
  readonly deletedBy: string | null;
}

/** Ορισμός + περίβλημα εγγραφής. */
export type CatalogRecord<TDefinition, TInstant> = TDefinition & CatalogRecordMeta<TInstant>;

/** Η μορφή του σύρματος (JSON): χρονοσφραγίδες ως ISO 8601 (Google AIP-142). */
export type CatalogWire<TDefinition> = CatalogRecord<TDefinition, string>;

/** Τα πεδία που ελέγχει **μόνο** ο γραφέας — ποτέ δεν έρχονται από το σώμα αιτήματος. */
export type CatalogWriterOwnedField = keyof CatalogRecordMeta<unknown>;
