import { resolveIdentityDisplay } from '../identity-display-resolver';

const fakeT = (key: string): string => {
  const map: Record<string, string> = {
    'options.legalForms.ae': 'Ανώνυμη Εταιρεία',
    'options.gemiStatuses.active': 'Ενεργή',
  };
  return map[key] ?? key;
};

describe('resolveIdentityDisplay', () => {
  it('resolves known taxOffice code to official name', () => {
    expect(resolveIdentityDisplay('taxOffice', '1101', fakeT)).toBe("Α' Αθηνών");
    expect(resolveIdentityDisplay('taxOffice', '1104', fakeT)).toBe("Δ' Αθηνών");
  });

  it('returns raw taxOffice value when code is unknown (custom DOY)', () => {
    expect(resolveIdentityDisplay('taxOffice', 'CUSTOM-XYZ', fakeT)).toBe('CUSTOM-XYZ');
  });

  it('resolves legalForm code via translator (case-insensitive)', () => {
    expect(resolveIdentityDisplay('legalForm', 'ae', fakeT)).toBe('Ανώνυμη Εταιρεία');
    expect(resolveIdentityDisplay('legalForm', 'AE', fakeT)).toBe('Ανώνυμη Εταιρεία');
  });

  it('returns raw value when legalForm code has no SSoT match', () => {
    expect(resolveIdentityDisplay('legalForm', 'unknown-form', fakeT)).toBe('unknown-form');
  });

  it('returns raw value when translator has no translation for the mapped key', () => {
    const passthroughT = (key: string) => key;
    expect(resolveIdentityDisplay('legalForm', 'ae', passthroughT)).toBe('ae');
  });

  it('resolves gemiStatus code via translator', () => {
    expect(resolveIdentityDisplay('gemiStatus', 'active', fakeT)).toBe('Ενεργή');
  });

  it('passes through free-text fields unchanged', () => {
    expect(resolveIdentityDisplay('companyName', 'Acme A.E.', fakeT)).toBe('Acme A.E.');
    expect(resolveIdentityDisplay('vatNumber', '999888777', fakeT)).toBe('999888777');
    expect(resolveIdentityDisplay('gemiNumber', '123456789000', fakeT)).toBe('123456789000');
    expect(resolveIdentityDisplay('tradeName', 'Acme Shop', fakeT)).toBe('Acme Shop');
  });

  it('returns empty string for empty input on every field', () => {
    expect(resolveIdentityDisplay('taxOffice', '', fakeT)).toBe('');
    expect(resolveIdentityDisplay('legalForm', '', fakeT)).toBe('');
    expect(resolveIdentityDisplay('gemiStatus', '', fakeT)).toBe('');
  });
});
