'use client';

/**
 * ADR-652 M4 — Το ΣΩΜΑ των φορμών ταυτότητας ενός block: **όνομα + κατηγορία + άδεια**.
 *
 * Δύο φόρμες το χρειάζονται ΠΑΝΟΜΟΙΟΤΥΠΑ — «Αποθήκευση στη βιβλιοθήκη» (M2) και
 * «Επεξεργασία» (M4). Γράφεται ΜΙΑ φορά: κατάσταση ({@link BlockMetadataFormState}), πεδία
 * ({@link BlockMetadataFormFields}) και μετατροπή σε τιμές ({@link toBlockMetadataValues}).
 * Οι δύο διάλογοι κρατούν ΜΟΝΟ ό,τι τους διαφοροποιεί (τίτλος, ετικέτες, νομικός έλεγχος,
 * ενέργεια υποβολής).
 *
 * *(N.18 — το `jscpd` έπιασε το κοινό JSX σώμα ως πραγματικό clone στην πρώτη γραφή του M4·
 * είχε ήδη συμβεί δύο φορές σε αυτό το ADR: `BlockDialogFooter` και params object.)*
 *
 * Οι κατηγορίες έρχονται από τον SSoT κατάλογο `BLOCK_CATEGORIES` — καμία χειρόγραφη λίστα.
 *
 * ⚠️ **Μοναδικότητα ονόματος**: το όνομα ΕΙΝΑΙ το κλειδί ταυτότητας του ορισμού (registry +
 * hydration + dedup του palette). Το `nameTaken` δεν είναι καλλωπισμός: δύο κάρτες με ίδιο
 * όνομα σημαίνει τοποθέτηση ΛΑΘΟΣ γεωμετρίας. Ο κανόνας ζει pure στο `isBlockNameTaken` —
 * εδώ μόνο εμφανίζεται.
 *
 * Radix Select (ADR-001).
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import {
  BLOCK_CATEGORIES,
  type BlockCategory,
  type BlockLicense,
} from '../../../bim/block-library/block-library-types';
import {
  BlockLicenseFields,
  toBlockLicense,
  toBlockLicenseForm,
  type BlockLicenseFormState,
} from './BlockLicenseFields';

/** Η κατάσταση της φόρμας — ΚΟΙΝΗ και για τις δύο (αποθήκευση / επεξεργασία). */
export interface BlockMetadataFormState {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicenseFormState;
}

/** Οι τιμές που καταναλώνει ο service (όνομα κομμένο, άδεια σε domain μορφή). */
export interface BlockMetadataValues {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicense;
}

/** Αρχική κατάσταση φόρμας από τα υπάρχοντα στοιχεία ενός block (ή τα defaults του). */
export function initialBlockMetadataForm(
  name: string,
  category: BlockCategory,
  license: BlockLicense,
): BlockMetadataFormState {
  return { name, category, license: toBlockLicenseForm(license) };
}

/** Κατάσταση φόρμας → τιμές προς τον service. */
export function toBlockMetadataValues(form: BlockMetadataFormState): BlockMetadataValues {
  return {
    name: form.name.trim(),
    category: form.category,
    license: toBlockLicense(form.license),
  };
}

export interface BlockMetadataFormFieldsProps {
  readonly value: BlockMetadataFormState;
  readonly onChange: (next: BlockMetadataFormState) => void;
  /** `true` ⇒ το όνομα ανήκει ήδη σε άλλο block (η φόρμα δεν επιτρέπει υποβολή). */
  readonly nameTaken: boolean;
}

export const BlockMetadataFormFields: React.FC<BlockMetadataFormFieldsProps> = ({
  value,
  onChange,
  nameTaken,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t('blockLibrary.save.name')}
        </span>
        <input
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={value.name}
          aria-invalid={nameTaken}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        {nameTaken && (
          <span role="alert" className="text-[11px] text-destructive">
            {t('blockLibrary.errors.nameTaken')}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t('blockLibrary.save.category')}
        </span>
        <Select
          value={value.category}
          onValueChange={(v) => onChange({ ...value, category: v as BlockCategory })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`blockLibrary.categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <BlockLicenseFields
        value={value.license}
        onChange={(license) => onChange({ ...value, license })}
      />
    </>
  );
};
