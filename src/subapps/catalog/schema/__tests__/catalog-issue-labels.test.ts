/**
 * @jest-environment node
 *
 * @fileoverview **Κάθε κωδικός ευρήματος έχει ετικέτα σε κάθε γλώσσα** (ADR-923 §5.2 · N.11).
 *
 * Οι επικυρωτές επιστρέφουν **κωδικούς** και η οθόνη τους μεταφράζει από το `catalog:issues.<κωδικός>`. Το CHECK 3.8
 * βλέπει μόνο κλήσεις `t('…')` με **σταθερό** κλειδί — ένα κλειδί που χτίζεται από κωδικό είναι αόρατο σε αυτό. Χωρίς
 * αυτή την άγκυρα, νέος κωδικός χωρίς ετικέτα θα έφτανε στον άνθρωπο ως «catalog:issues.fileTooLarge».
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { CATALOG_ISSUE_CODES } from '../catalog-issues';

function issuesOf(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(process.cwd(), 'src', 'i18n', 'locales', locale, 'catalog.json'), 'utf8');
  return (JSON.parse(raw) as { issues: Record<string, unknown> }).issues;
}

describe.each(['el', 'en'])('catalog:issues — %s', (locale) => {
  const issues = issuesOf(locale);

  it('κάθε κωδικός έχει μη-κενή ετικέτα', () => {
    const missing = CATALOG_ISSUE_CODES.filter((code) => typeof issues[code] !== 'string' || (issues[code] as string).trim() === '');
    expect(missing).toEqual([]);
  });

  it('καμία ετικέτα χωρίς κωδικό (νεκρό κλειδί)', () => {
    const known = new Set<string>(CATALOG_ISSUE_CODES);
    expect(Object.keys(issues).filter((key) => !known.has(key))).toEqual([]);
  });
});
