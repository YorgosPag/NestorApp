/**
 * @fileoverview Η ετικέτα μονάδας **έξω** από το i18next — PDF/email παραγγελίας, server (ADR-923 §5.11 «3γ» Α10).
 * @module lib/uom/uom-label-bundle
 *
 * 🔑 Ίδια κλειδιά, ίδιος μορφοποιητής (`formatUom`) με την UI — μόνο ο μεταφραστής αλλάζει: `createBundleTranslate`
 * πάνω στα `uom.json`, **στη γλώσσα του εγγράφου** (το PDF του προμηθευτή μπορεί να είναι αγγλικό ενώ η UI ελληνική).
 */

import elUom from '@/i18n/locales/el/uom.json';
import enUom from '@/i18n/locales/en/uom.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import { formatUom, type UomLabelForm } from './uom-label';

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ uom: elUom }, 'uom', 'el'),
  en: createBundleTranslate({ uom: enUom }, 'uom', 'en'),
};

/** Η ετικέτα της μονάδας στη γλώσσα του εγγράφου. */
export function uomLabelIn(raw: string | null | undefined, language: HumanLanguage, form: UomLabelForm = 'symbol'): string {
  return formatUom(raw, (key) => TRANSLATORS[language](key), form);
}
