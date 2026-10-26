/**
 * Οι τύποι των επεξεργαστών τιμών ανά `AttributeType` (ADR-923 §5.10.4 Β3).
 *
 * @module components/catalog/values/value-editor-types
 */

import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { AttributeValue, AttributeValueOfType, CatalogReferenceTarget } from '@/subapps/catalog/types/product';
import type { ValueTextContext } from '@/subapps/catalog/values/value-text-codec';
import type { AttributeType } from '@/subapps/catalog/vocabulary/attribute-types';
import type { FileRecord } from '@/types/file-record';

export type AttributeOfType<K extends AttributeType> = Extract<CatalogAttributeDefinition, { readonly type: K }>;

/** Ό,τι χρειάζονται οι επεξεργαστές από τη σελίδα — **ένα** αντικείμενο, όχι δέκα props. */
export interface ValueEditorEnv {
  readonly codec: ValueTextContext;
  readonly assets: readonly AssetRecord[];
  readonly assetById: ReadonlyMap<string, AssetRecord>;
  readonly files: ReadonlyMap<string, FileRecord>;
  readonly text: (value: LocalizedText | undefined, fallback?: string) => string;
  /** Αναφορές: κωδικός → στόχος (το ίδιο άλμα με τη λίστα, σε όλο τον κατάλογο) · στόχος → όνομα για προβολή. */
  readonly references: {
    readonly resolve: (code: string) => Promise<CatalogReferenceTarget | null>;
    readonly describe: (target: CatalogReferenceTarget) => string;
  };
}

export interface ValueEditorProps<K extends AttributeType> {
  /** Το id του πεδίου — η ετικέτα δείχνει εδώ (`<Label htmlFor>`). */
  readonly id: string;
  readonly label: string;
  readonly attribute: AttributeOfType<K>;
  readonly value: AttributeValueOfType<K> | undefined;
  /** `null` ⇒ σβήσε την τιμή της θέσης. */
  readonly onChange: (value: AttributeValue | null) => void;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly describedBy: string | undefined;
  readonly env: ValueEditorEnv;
}
