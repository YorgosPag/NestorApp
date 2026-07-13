'use client';

/**
 * ADR-652 M3 — Τα πεδία ΑΔΕΙΑΣ ενός block, σε ΕΝΑ σημείο.
 *
 * Η ΙΔΙΑ νομική ερώτηση μπαίνει σε δύο στιγμές: όταν σώζεις ένα ξένο block στη βιβλιοθήκη
 * («τι άδεια έχει;») και όταν το δημοσιεύεις στην εταιρεία («έχεις δικαίωμα να το
 * μοιραστείς;»). Δύο φόρμες, ΕΝΑ σύνολο πεδίων — αλλιώς η μία θα αποκλίνει από την άλλη
 * (N.18: κανένα sibling clone φόρμας).
 *
 * Ο διακόπτης «επιτρέπεται η αναδιανομή» είναι OFF by default και ΠΟΤΕ σιωπηρός: είναι το
 * GATE που ελέγχει ο `assertBlockScopeAllowed` πριν από κάθε εγγραφή σε κοινόχρηστο scope.
 *
 * @see ../../../bim/block-library/block-scope-guard.ts — ο έλεγχος που φυλά αυτά τα πεδία
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
  BLOCK_LICENSE_TYPES,
  type BlockLicense,
  type BlockLicenseType,
} from '../../../bim/block-library/block-library-types';

/** Η κατάσταση της φόρμας άδειας (flat — τα optional πεδία ως κενά strings). */
export interface BlockLicenseFormState {
  readonly licenseType: BlockLicenseType;
  readonly attribution: string;
  readonly termsUrl: string;
  readonly redistributable: boolean;
}

/** Φόρμα → domain άδεια (κενά πεδία ΔΕΝ μπαίνουν στο Firestore doc). */
export function toBlockLicense(form: BlockLicenseFormState): BlockLicense {
  return {
    type: form.licenseType,
    redistributable: form.redistributable,
    ...(form.attribution.trim() ? { attribution: form.attribution.trim() } : {}),
    ...(form.termsUrl.trim() ? { termsUrl: form.termsUrl.trim() } : {}),
  };
}

/** Domain άδεια → φόρμα (prefill στη δημοσίευση: δείχνει ό,τι δήλωσε ήδη ο χρήστης). */
export function toBlockLicenseForm(license: BlockLicense): BlockLicenseFormState {
  return {
    licenseType: license.type,
    attribution: license.attribution ?? '',
    termsUrl: license.termsUrl ?? '',
    redistributable: license.redistributable,
  };
}

const INPUT_CLASS =
  'w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring';
const LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

export interface BlockLicenseFieldsProps {
  readonly value: BlockLicenseFormState;
  readonly onChange: (next: BlockLicenseFormState) => void;
}

export const BlockLicenseFields: React.FC<BlockLicenseFieldsProps> = ({ value, onChange }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{t('blockLibrary.save.licenseType')}</span>
        <Select
          value={value.licenseType}
          onValueChange={(v) => onChange({ ...value, licenseType: v as BlockLicenseType })}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_LICENSE_TYPES.map((l) => (
              <SelectItem key={l} value={l}>
                {t(`blockLibrary.licenses.${l}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{t('blockLibrary.save.attribution')}</span>
        <input
          type="text"
          className={INPUT_CLASS}
          value={value.attribution}
          onChange={(e) => onChange({ ...value, attribution: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{t('blockLibrary.save.termsUrl')}</span>
        <input
          type="url"
          className={INPUT_CLASS}
          value={value.termsUrl}
          onChange={(e) => onChange({ ...value, termsUrl: e.target.value })}
        />
      </label>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.redistributable}
          onChange={(e) => onChange({ ...value, redistributable: e.target.checked })}
        />
        <span className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            {t('blockLibrary.save.redistributable')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t('blockLibrary.save.redistributableHint')}
          </span>
        </span>
      </label>
    </>
  );
};
