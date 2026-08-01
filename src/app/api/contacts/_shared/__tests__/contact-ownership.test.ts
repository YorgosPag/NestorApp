/**
 * ⚓ ADR-742 §7octies — ο φύλακας ιδιοκτησίας του πόρου `contact`
 *
 * Δοκιμάζεται με **σκέτα αντικείμενα**, χωρίς πλαστό HTTP ή Firestore: αυτό
 * είναι ολόκληρος ο λόγος που το `contact-ownership.ts` είναι **καθαρό module**
 * (μηδέν `next/server`, μηδέν Firebase). Η προηγούμενη γραφή του εισήγαγε
 * `NextResponse` και **έσπασε τη σουίτα** με `ReferenceError: Request is not
 * defined` — δηλαδή η απόφαση ασφαλείας θα έμενε αδοκίμαστη.
 *
 * @module app/api/contacts/_shared/__tests__/contact-ownership
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import {
  CONTACT_NOT_FOUND_MESSAGE,
  checkContactAccess,
  contactNotFound,
  requireContactAccess,
  type ContactAccessCaller,
} from '../contact-ownership';

const OWNER: ContactAccessCaller = {
  companyId: 'comp_1',
  globalRole: 'company_admin',
  uid: 'user_1',
  email: 'user@example.com',
};

const BYPASS: ContactAccessCaller = {
  companyId: 'comp_1',
  globalRole: 'super_admin',
  uid: 'root_1',
  email: 'root@example.com',
};

const spec = (contactData: unknown, caller: ContactAccessCaller) => ({
  contactData: contactData as { companyId?: string | null } | null | undefined,
  caller,
  contactId: 'contact_1',
  action: 'test',
});

describe('⚓ checkContactAccess — η απόφαση (PDP)', () => {
  it('δική μου επαφή ⇒ owned', () => {
    expect(checkContactAccess(spec({ companyId: 'comp_1' }, OWNER))).toBe('owned');
  });

  it('ξένη επαφή ⇒ denied', () => {
    expect(checkContactAccess(spec({ companyId: 'other' }, OWNER))).toBe('denied');
  });

  it('🔴 υπεργραφέας σε ξένη επαφή ⇒ cross-tenant-bypass (ΟΝΟΜΑΣΜΕΝΗ κατάσταση, όχι σιωπή)', () => {
    // Η μεσαία κατάσταση **δεν** είναι διακοσμητική: είναι το σημείο όπου θα
    // μπει το JIT elevation (ADR-742 §7ter.3). Αν συγχωνευόταν με το `owned`,
    // η μελλοντική μετάβαση θα έψαχνε ξανά 47 σημεία.
    expect(checkContactAccess(spec({ companyId: 'other' }, BYPASS))).toBe('cross-tenant-bypass');
  });

  it('υπεργραφέας σε δική του επαφή ⇒ owned (όχι bypass)', () => {
    expect(checkContactAccess(spec({ companyId: 'comp_1' }, BYPASS))).toBe('owned');
  });

  describe('🔴 η παγίδα του κενού (§4) — «ο τύπος υπόσχεται, η βάση δεν εγγυάται»', () => {
    it('επαφή ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν', () => {
      expect(checkContactAccess(spec({}, OWNER))).toBe('denied');
    });

    it('επαφή με companyId: null δεν ανήκει σε κανέναν (ADR-232)', () => {
      expect(checkContactAccess(spec({ companyId: null }, OWNER))).toBe('denied');
    });

    it('επαφή με κενό companyId δεν ανήκει σε κανέναν', () => {
      expect(checkContactAccess(spec({ companyId: '' }, OWNER))).toBe('denied');
    });

    it('🔴 ΧΑΛΑΣΜΕΝΟ TOKEN: καλών με κενό companyId δεν παίρνει επαφή με κενό companyId', () => {
      // Αυτό ακριβώς περνούσε με σκέτο `!==`: '' === '' ⇒ «δικό σου».
      const brokenToken: ContactAccessCaller = { companyId: '', globalRole: 'company_admin' };
      expect(checkContactAccess(spec({ companyId: '' }, brokenToken))).toBe('denied');
    });

    it('φορτίο null/undefined ⇒ denied', () => {
      expect(checkContactAccess(spec(null, OWNER))).toBe('denied');
      expect(checkContactAccess(spec(undefined, OWNER))).toBe('denied');
    });
  });
});

describe('⚓ requireContactAccess — η επιβολή (PEP)', () => {
  it('περνά σιωπηλά όταν ανήκει', () => {
    expect(() => requireContactAccess(spec({ companyId: 'comp_1' }, OWNER))).not.toThrow();
  });

  it('περνά σιωπηλά για τον υπεργραφέα', () => {
    expect(() => requireContactAccess(spec({ companyId: 'other' }, BYPASS))).not.toThrow();
  });

  it('🔴 ρίχνει 404 «Contact not found» — ΟΧΙ 403, ΟΧΙ «Access denied»', () => {
    let thrown: unknown;
    try {
      requireContactAccess(spec({ companyId: 'other' }, OWNER));
    } catch (e) {
      thrown = e;
    }

    const err = thrown as { statusCode: number; message: string };
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Contact not found');
    expect(err.message).not.toMatch(/Access denied/);
  });

  it('🔴 η άρνηση είναι ΠΑΝΟΜΟΙΟΤΥΠΗ με το γνήσιο «δεν βρέθηκε»', () => {
    // Ο πυρήνας του δόγματος (§7.1): ίδιο εργοστάσιο, μηδέν ορίσματα, άρα
    // καμία τιμή δεν μπορεί να αποκλίνει ανάμεσα στους δύο κλάδους.
    let disguised: { statusCode: number; message: string } | undefined;
    try {
      requireContactAccess(spec({ companyId: 'other' }, OWNER));
    } catch (e) {
      disguised = e as { statusCode: number; message: string };
    }

    const genuine = contactNotFound();

    expect(disguised!.statusCode).toBe(genuine.statusCode);
    expect(disguised!.message).toBe(genuine.message);
  });
});

describe('⚓ το κείμενο είναι SSoT', () => {
  it('το εργοστάσιο χρησιμοποιεί ΤΟ κείμενο, όχι αντίγραφό του', () => {
    expect(contactNotFound().message).toBe(CONTACT_NOT_FOUND_MESSAGE);
  });

  it('🔴 το κείμενο δεν φέρει πρόθεμα άρνησης', () => {
    // Η μισογραμμένη μεταμφίεση ήταν ακριβώς αυτό: `'Access denied - Contact not found'`.
    expect(CONTACT_NOT_FOUND_MESSAGE).toBe('Contact not found');
  });
});
