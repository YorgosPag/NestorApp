import { isCatalogCode } from '../catalog-limits';
import { suggestCatalogCode } from '../suggest-catalog-code';

describe('suggestCatalogCode — ετικέτα → έγκυρος, αμετάβλητος κωδικός', () => {
  it.each([
    ['Ψυκτική ισχύς H', 'psyktiki_ischys_h'],
    ['Fan coil', 'fan_coil'],
    ['Παροχή αέρα (m³/h)', 'parochi_aera_m_h'],
    ['  --Βάρος--  ', 'varos'],
  ])('«%s» → %s', (label, expected) => {
    const code = suggestCatalogCode(label);
    expect(isCatalogCode(code)).toBe(true);
    expect(code).toBe(expected);
  });

  it('αρχίζει με ψηφίο ⇒ πρόθεμα γράμματος', () => {
    expect(suggestCatalogCode('2 βαθμίδες')).toBe('x_2_vathmides');
  });

  it('καθόλου γράμματα ⇒ καμία πρόταση', () => {
    expect(suggestCatalogCode('—·—')).toBe('');
  });

  it('κόβεται στα 64 χωρίς να τελειώνει σε κάτω παύλα', () => {
    const code = suggestCatalogCode('α '.repeat(80));
    expect(code.length).toBeLessThanOrEqual(64);
    expect(isCatalogCode(code)).toBe(true);
    expect(code.endsWith('_')).toBe(false);
  });
});
