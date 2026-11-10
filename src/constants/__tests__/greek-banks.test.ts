/**
 * Κατάλογος ελληνικών τραπεζών — ακεραιότητα + άγκυρες από επίσημη πηγή (HEBIC Ένωσης Τραπεζών).
 *
 * Γιατί υπάρχει: μέχρι 2026-11-10 ο κατάλογος είχε επινοημένα BIC (`PIABORAA`, `EFABORAA`, BIC 7 χαρακτήρων)
 * και λάθος κωδικούς τράπεζας — και το λάθος BIC τυπωνόταν στο EPC QR των τιμολογίων. Κανείς δεν το έπιανε,
 * γιατί κανείς δεν ρωτούσε αν το BIC είναι καν έγκυρο ή αν οι δύο πίνακες συμφωνούν.
 */

import { GREEK_BANKS, GREEK_BANK_CODES, getBankByCode, getBankByIBAN, getSystemicBanks } from '../greek-banks';
import { isValidBIC } from '@/types/contacts/banking';

describe('GREEK_BANKS — ακεραιότητα', () => {
  it('κάθε BIC είναι έγκυρο κατά ISO 9362 και με χώρα GR', () => {
    for (const bank of GREEK_BANKS) {
      expect({ code: bank.code, valid: isValidBIC(bank.code) }).toEqual({ code: bank.code, valid: true });
      expect(bank.code.slice(4, 6)).toBe('GR');
    }
  });

  it('κανένα BIC δεν εμφανίζεται δύο φορές', () => {
    const codes = GREEK_BANKS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('κάθε κωδικός τράπεζας του IBAN είναι 3 ψηφία και λύνεται σε τράπεζα του καταλόγου', () => {
    for (const [bankCode, bic] of Object.entries(GREEK_BANK_CODES)) {
      expect(bankCode).toMatch(/^\d{3}$/);
      expect({ bankCode, found: getBankByCode(bic)?.code }).toEqual({ bankCode, found: bic });
    }
  });

  it('κάθε τράπεζα του καταλόγου είναι προσβάσιμη από ακριβώς έναν κωδικό IBAN', () => {
    const reachable = Object.values(GREEK_BANK_CODES);
    for (const bank of GREEK_BANKS) {
      expect({ bic: bank.code, count: reachable.filter((c) => c === bank.code).length }).toEqual({ bic: bank.code, count: 1 });
    }
  });
});

describe('Άγκυρες από HEBIC (κωδικός IBAN → BIC)', () => {
  // HEBIC 2026 (κωδικοί) + HEBIC 2022 «Classification as to bank code» (BIC).
  const OFFICIAL: ReadonlyArray<readonly [string, string]> = [
    ['010', 'BNGRGRAA'],
    ['011', 'ETHNGRAA'],
    ['014', 'CRBAGRAA'],
    ['016', 'ATTIGRAA'],
    ['017', 'PIRBGRAA'],
    ['026', 'ERBKGRAA'],
    ['034', 'IBOGGRAA'],
    ['069', 'STXAGRA1'],
  ];

  it.each(OFFICIAL)('κωδικός %s ⇒ %s', (bankCode, bic) => {
    expect(GREEK_BANK_CODES[bankCode]).toBe(bic);
  });

  it('IBAN Πειραιώς ⇒ PIRBGRAA (το λάθος που έφτανε στο QR)', () => {
    expect(getBankByIBAN('GR12 0170 4900 0000 1234 5678 901')?.code).toBe('PIRBGRAA');
  });

  it('οι συστημικές τράπεζες είναι και οι τέσσερις', () => {
    expect(getSystemicBanks().map((b) => b.code).sort()).toEqual(['CRBAGRAA', 'ERBKGRAA', 'ETHNGRAA', 'PIRBGRAA']);
  });
});
