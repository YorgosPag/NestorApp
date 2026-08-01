/**
 * ⚓ ADR-742 §7decies — οι φύλακες ιδιοκτησίας των πόρων `message` και `conversation`
 *
 * Δοκιμάζονται με **σκέτα αντικείμενα**, χωρίς πλαστό HTTP ή Firestore: γι' αυτό
 * και τα δύο `*-ownership.ts` είναι **καθαρά modules** (μηδέν `next/server`,
 * μηδέν Firebase). Το `import { NextResponse }` είχε **μετρημένα** σπάσει
 * σουίτα της Ομάδας 4 με `ReferenceError: Request is not defined` — δηλαδή θα
 * άφηνε την απόφαση ασφαλείας **αδοκίμαστη** (§7octies.4).
 *
 * 🔴 Οι δύο πόροι ελέγχονται **μαζί** επίτηδες: είναι αδελφικοί (κάθε μήνυμα
 * ζει μέσα σε συνομιλία) και η §7septies έδειξε ότι το μαντείο είναι ιδιότητα
 * **πόρου** — αν οι δύο απαντούσαν με διαφορετικό δόγμα, η μία διαδρομή θα
 * ακύρωνε την άλλη.
 *
 * @module app/api/messages/_shared/__tests__/message-conversation-ownership
 * @see ADR-742 §3.3 · §7.1 · §7ter.5 · §7decies
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import { ApiError } from '@/lib/api/api-error-types';
import {
  MESSAGE_NOT_FOUND_MESSAGE,
  checkMessageAccess,
  messageNotFound,
  requireMessageAccess,
  type MessageAccessCaller,
} from '../message-ownership';
import {
  checkConversationAccess,
  conversationNotFound,
  conversationNotFoundMessage,
  requireConversationAccess,
} from '../../../conversations/_shared/conversation-ownership';

const OWNER: MessageAccessCaller = {
  companyId: 'comp_1',
  globalRole: 'company_admin',
  uid: 'user_1',
  email: 'user@example.com',
};

const BYPASS: MessageAccessCaller = {
  companyId: 'comp_1',
  globalRole: 'super_admin',
  uid: 'root_1',
  email: 'root@example.com',
};

type Payload = { companyId?: string | null } | null | undefined;

const msg = (messageData: Payload, caller: MessageAccessCaller) => ({
  messageData,
  caller,
  messageId: 'msg_1',
  action: 'test',
});

const conv = (conversationData: Payload, caller: MessageAccessCaller) => ({
  conversationData,
  caller,
  conversationId: 'conv_1',
  action: 'test',
});

// ============================================================================
// Η ΑΠΟΦΑΣΗ (PDP)
// ============================================================================

describe('⚓ checkMessageAccess — η απόφαση', () => {
  it('δικό μου μήνυμα ⇒ owned', () => {
    expect(checkMessageAccess(msg({ companyId: 'comp_1' }, OWNER))).toBe('owned');
  });

  it('ξένο μήνυμα ⇒ denied', () => {
    expect(checkMessageAccess(msg({ companyId: 'other' }, OWNER))).toBe('denied');
  });

  /**
   * 🔴 Η μεσαία κατάσταση **δεν** είναι διακοσμητική: είναι το σημείο όπου θα
   * μπει το JIT elevation (§7ter.3). Αν συγχωνευόταν με το `owned`, η μελλοντική
   * μετάβαση θα έψαχνε ξανά 47 σκόρπια σημεία.
   */
  it('🔴 υπεργραφέας σε ξένο μήνυμα ⇒ cross-tenant-bypass (ΟΝΟΜΑΣΜΕΝΗ κατάσταση)', () => {
    expect(checkMessageAccess(msg({ companyId: 'other' }, BYPASS))).toBe('cross-tenant-bypass');
  });

  /**
   * 🔴🔴 Η παγίδα του κενού (§4): «το κενό δεν είναι tenant, είναι **απουσία**
   * tenant». Ο τύπος υπόσχεται `companyId: string`, η βάση δεν το εγγυάται —
   * καλών με χαλασμένο token περνούσε σε **κάθε** έγγραφο χωρίς `companyId`.
   */
  it('🔴🔴 έγγραφο ΧΩΡΙΣ companyId ⇒ denied, ακόμη κι όταν ο καλών έχει κενό tenant', () => {
    expect(checkMessageAccess(msg({}, OWNER))).toBe('denied');
    expect(checkMessageAccess(msg({ companyId: '' }, { ...OWNER, companyId: '' }))).toBe('denied');
    expect(checkMessageAccess(msg(null, OWNER))).toBe('denied');
    expect(checkMessageAccess(msg(undefined, OWNER))).toBe('denied');
  });
});

describe('⚓ checkConversationAccess — η απόφαση', () => {
  it('δική μου συνομιλία ⇒ owned', () => {
    expect(checkConversationAccess(conv({ companyId: 'comp_1' }, OWNER))).toBe('owned');
  });

  it('ξένη συνομιλία ⇒ denied', () => {
    expect(checkConversationAccess(conv({ companyId: 'other' }, OWNER))).toBe('denied');
  });

  it('🔴 υπεργραφέας ⇒ cross-tenant-bypass', () => {
    expect(checkConversationAccess(conv({ companyId: 'other' }, BYPASS))).toBe('cross-tenant-bypass');
  });

  it('🔴🔴 συνομιλία ΧΩΡΙΣ companyId ⇒ denied', () => {
    expect(checkConversationAccess(conv({}, OWNER))).toBe('denied');
    expect(checkConversationAccess(conv({ companyId: '' }, { ...OWNER, companyId: '' }))).toBe('denied');
  });

  /**
   * 🔴 **Τα δύο αδελφικά δόγματα πρέπει να συμπίπτουν** (§7septies): αν ο ένας
   * πόρος έδινε bypass και ο άλλος όχι, η μία διαδρομή θα μαρτυρούσε ό,τι κρύβει
   * η άλλη — κάθε μήνυμα ζει μέσα σε συνομιλία.
   */
  it('🔴 μήνυμα και συνομιλία απαντούν με το ΙΔΙΟ δόγμα σε κάθε είσοδο', () => {
    const cases: Array<[Payload, MessageAccessCaller]> = [
      [{ companyId: 'comp_1' }, OWNER],
      [{ companyId: 'other' }, OWNER],
      [{ companyId: 'other' }, BYPASS],
      [{}, OWNER],
      [null, OWNER],
    ];

    for (const [data, caller] of cases) {
      expect(checkConversationAccess(conv(data, caller))).toBe(checkMessageAccess(msg(data, caller)));
    }
  });
});

// ============================================================================
// Η ΕΠΙΒΟΛΗ (PEP) ΚΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΣΥΡΜΑΤΟΣ
// ============================================================================

describe('⚓ η μεταμφίεση είναι ΠΑΝΟΜΟΙΟΤΥΠΗ με το γνήσιο', () => {
  /**
   * 🔴 Η παγίδα που ακυρώνει τα πάντα: κωδικός **ΚΑΙ** σώμα **ΚΑΙ** μήνυμα.
   * Η Ομάδα 3 βρήκε μεταμφίεση με σωστό κείμενο και **λάθος κωδικό** — που δεν
   * κρύβει τίποτα (§7sexies.1). Γι' αυτό συγκρίνεται το **ζεύγος**, όχι «μοιάζει».
   */
  it('🔴 message: το μεταμφιεσμένο και το γνήσιο 404 είναι ΙΣΑ σε κωδικό και μήνυμα', () => {
    const genuine = messageNotFound();

    let disguised: unknown;
    try {
      requireMessageAccess(msg({ companyId: 'other' }, OWNER));
    } catch (err) {
      disguised = err;
    }

    expect(disguised).toBeInstanceOf(ApiError);
    const thrown = disguised as ApiError;
    expect([thrown.statusCode, thrown.message]).toEqual([genuine.statusCode, genuine.message]);
    expect(thrown.statusCode).toBe(404);
    expect(thrown.message).toBe(MESSAGE_NOT_FOUND_MESSAGE);
  });

  /**
   * 🔴 Το id είναι **μέσα** στο μήνυμα του γνήσιου κλάδου
   * (`Conversation {id} not found`). Μεταμφίεση με σκέτο «not found» θα
   * ξεχώριζε **στο ίδιο το κείμενο**.
   */
  it('🔴 conversation: η μεταμφίεση κρατά το ΙΔΙΟ id μέσα στο μήνυμα', () => {
    const genuine = conversationNotFound('conv_1');

    let disguised: unknown;
    try {
      requireConversationAccess(conv({ companyId: 'other' }, OWNER));
    } catch (err) {
      disguised = err;
    }

    const thrown = disguised as ApiError;
    expect([thrown.statusCode, thrown.message]).toEqual([genuine.statusCode, genuine.message]);
    expect(thrown.message).toBe(conversationNotFoundMessage('conv_1'));
    expect(thrown.message).toContain('conv_1');
  });

  it('ο υπεργραφέας ΔΕΝ βλέπει άρνηση σε κανέναν από τους δύο πόρους', () => {
    expect(() => requireMessageAccess(msg({ companyId: 'other' }, BYPASS))).not.toThrow();
    expect(() => requireConversationAccess(conv({ companyId: 'other' }, BYPASS))).not.toThrow();
  });

  it('δικό μου ⇒ καμία ρίψη', () => {
    expect(() => requireMessageAccess(msg({ companyId: 'comp_1' }, OWNER))).not.toThrow();
    expect(() => requireConversationAccess(conv({ companyId: 'comp_1' }, OWNER))).not.toThrow();
  });

  /**
   * Το μαζικό `delete` **δεν** ρίχνει: η άρνησή του είναι στοιχείο πίνακα μέσα
   * σε απάντηση 200 (§7ter.5). Χρησιμοποιεί το **ίδιο** κείμενο, ώστε το ξένο
   * μήνυμα να μη διακρίνεται από το ανύπαρκτο **μέσα στο σχήμα της διαδρομής**.
   */
  it('🔴 το κείμενο είναι ΕΝΑ — και το μαζικό delete το μοιράζεται χωρίς να ρίξει', () => {
    expect(MESSAGE_NOT_FOUND_MESSAGE).toBe('Message not found');
    expect(messageNotFound().message).toBe(MESSAGE_NOT_FOUND_MESSAGE);
    // Η ετυμηγορία είναι **ολική**: επιστρέφει, δεν ρίχνει.
    expect(() => checkMessageAccess(msg({ companyId: 'other' }, OWNER))).not.toThrow();
    expect(checkMessageAccess(msg({ companyId: 'other' }, OWNER))).toBe('denied');
  });
});
