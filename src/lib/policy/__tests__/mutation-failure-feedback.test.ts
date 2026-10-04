/**
 * ADR-898 §21.6 — **Ε3**: κάθε αποτυχημένη mutation φτάνει στον άνθρωπο, και μια άρνηση πολιτικής δεν καταγράφεται ως
 * σφάλμα. **Ε4**: το μήνυμα του 409 **διαβάζει** το όνομα της ενότητας από το κλειδί της ίδιας της ενότητας.
 */

import elBuilding from '@/i18n/locales/el/building.json';
import elProperties from '@/i18n/locales/el/properties.json';
import enBuilding from '@/i18n/locales/en/building.json';
import enProperties from '@/i18n/locales/en/properties.json';

import { reportMutationFailure, type MutationFailureSinks } from '../mutation-failure-feedback';
import { POLICY_ERROR_CODES } from '../policy-error-codes';
import { POLICY_ERROR_NAMESPACES, policyErrorMessageOf, type TranslatorFn } from '../policy-error-translator';

type Bundle = Record<string, unknown>;

function lookup(bundle: Bundle, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>(
    (node, part) => (typeof node === 'object' && node !== null ? (node as Bundle)[part] : undefined),
    bundle,
  );
  return typeof value === 'string' ? value : undefined;
}

/** Μεταφραστής πάνω στα ΠΡΑΓΜΑΤΙΚΑ locale JSON: `ns:key` ή (χωρίς πρόθεμα) το πρώτο namespace· ICU `{param}`. */
function translatorOf(bundles: Record<string, Bundle>): TranslatorFn {
  return (key, params) => {
    const [ns, path] = key.includes(':') ? key.split(':') : [POLICY_ERROR_NAMESPACES[0], key];
    const template = lookup(bundles[ns] ?? {}, path);
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => params?.[name] ?? whole);
  };
}

const LOCALES = {
  el: { building: elBuilding as Bundle, properties: elProperties as Bundle },
  en: { building: enBuilding as Bundle, properties: enProperties as Bundle },
};

const refusal = (errorCode: string) => Object.assign(new Error('conflict'), { errorCode });

function sinks(t: TranslatorFn = translatorOf(LOCALES.el)) {
  const notify = jest.fn();
  const logger = { info: jest.fn(), error: jest.fn() };
  const all: MutationFailureSinks = { t, notify, logger };
  return { all, notify, logger };
}

describe('reportMutationFailure (Ε3)', () => {
  it('άρνηση πολιτικής ⇒ info (ΟΧΙ error) + το μεταφρασμένο μήνυμα, όχι το γενικό', () => {
    const { all, notify, logger } = sinks();
    reportMutationFailure(refusal(POLICY_ERROR_CODES.DUPLICATE_CODE), 'create', 'γενικό', all);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.any(String), { action: 'create', errorCode: POLICY_ERROR_CODES.DUPLICATE_CODE });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(lookup(LOCALES.el.building, 'policyErrors.duplicateCode'));
  });

  it('άλλο σφάλμα ⇒ error + το γενικό μήνυμα — ποτέ σιωπή', () => {
    const { all, notify, logger } = sinks();
    reportMutationFailure(new Error('boom'), 'update', 'γενικό', all);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), { action: 'update', error: 'boom' });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('γενικό');
  });

  it('άγνωστος κωδικός ΔΕΝ είναι άρνηση πολιτικής ⇒ error + γενικό', () => {
    const { all, notify, logger } = sinks();
    reportMutationFailure(refusal('SOMETHING_ELSE'), 'delete', 'γενικό', all);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('γενικό');
  });
});

describe('το 409 της αποσύνδεσης ονομάζει την ενότητα από το κλειδί της (Ε4)', () => {
  it.each(['el', 'en'] as const)('%s: το όνομα έρχεται από `properties:linkedSpaces.title`, δεν είναι γραμμένο στο μήνυμα', (language) => {
    const bundles = LOCALES[language];
    const sectionTitle = lookup(bundles.properties, 'linkedSpaces.title');
    const template = lookup(bundles.building, 'policyErrors.spaceLinkedToUnit');
    expect(sectionTitle).toBeTruthy();
    expect(template).toContain('{section}');
    expect(template).not.toContain(sectionTitle);

    const message = policyErrorMessageOf(refusal(POLICY_ERROR_CODES.SPACE_LINKED_TO_UNIT), translatorOf(bundles));
    expect(message).toContain(sectionTitle);
    expect(message).not.toContain('{section}');
  });

  it('τα namespaces του μεταφραστή καλύπτουν ΚΑΙ την ετικέτα που αναφέρει το μήνυμα', () => {
    expect(POLICY_ERROR_NAMESPACES[0]).toBe('building');
    expect(POLICY_ERROR_NAMESPACES).toContain('properties');
  });
});
