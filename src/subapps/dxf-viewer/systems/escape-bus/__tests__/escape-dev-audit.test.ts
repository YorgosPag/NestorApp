/**
 * ADR-364 §10.6 Φ2 Μηχανισμός 1 — dev-time ESC audit.
 *
 * Το κρίσιμο δεν είναι ότι ο έλεγχος βρίσκει παραβάσεις — είναι ότι τις βρίσκει
 * **ανεξάρτητα από τη σειρά mount**, εκεί που ο σκέτος έλεγχος `defaultPrevented`
 * μέσα στον bus (η αρχική πρόταση του §10.6) είναι τυφλός.
 *
 * Το τελευταίο group καρφώνει το **τυφλό σημείο** ως αναμενόμενη συμπεριφορά:
 * ένας ανταγωνιστής που ενεργεί σιωπηλά βγάζει `ok`. Χωρίς αυτό το test, το «ok»
 * θα διαβαζόταν ως «καθαρό» — η ίδια παθολογία με τα «0» των N.11/N.12.
 */

import { escapeBus } from '../EscapeCommandBus';
import { ESC_PRIORITY } from '../escape-priority';
import {
  __judgeForTests,
  __resetAuditForTests,
  installEscapeAuditSentinel,
  noteLocalEscapeOwner,
} from '../escape-dev-audit';
import type { EscapeHandler } from '../types';

type Phase = { capture: boolean };
const CAPTURE: Phase = { capture: true };

const listeners: Array<(e: KeyboardEvent) => void> = [];

/** Προσθέτει ανταγωνιστή window-capture ΤΩΡΑ — η σειρά κλήσης ορίζει τη σειρά εκτέλεσης. */
function addCompetitor(act: (e: KeyboardEvent) => void): void {
  const fn = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') act(e);
  };
  listeners.push(fn);
  window.addEventListener('keydown', fn, CAPTURE);
}

function registerBusHandler(consumes: boolean): void {
  const handler: EscapeHandler = {
    id: 'audit-test/handler',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => consumes,
    handle: () => consumes,
  };
  escapeBus.register(handler);
}

function fireEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  escapeBus.__resetForTests();
  __resetAuditForTests();
  // Η σεντινέλα πρώτη — ό,τι προστεθεί μετά τρέχει μετά, όπως στην παραγωγή.
  installEscapeAuditSentinel();
});

afterEach(() => {
  listeners.splice(0).forEach((fn) => window.removeEventListener('keydown', fn, CAPTURE));
  escapeBus.__resetForTests();
  __resetAuditForTests();
});

describe('ΟΚ — ο bus είναι ο μόνος ιδιοκτήτης', () => {
  it('handler του bus καταναλώνει → καμία παράβαση', () => {
    registerBusHandler(true);
    const e = fireEscape();
    const finding = __judgeForTests(e);
    expect(finding?.verdict).toBe('ok');
    expect(finding?.record.consumedBy).toBe('audit-test/handler');
  });

  it('κανείς δεν διεκδικεί το ESC → καμία παράβαση (νόμιμο no-op)', () => {
    registerBusHandler(false);
    const e = fireEscape();
    expect(__judgeForTests(e)?.verdict).toBe('ok');
  });
});

describe('STARVED — ανταγωνιστής λιμοκτονεί τον bus', () => {
  it('stopImmediatePropagation ΠΡΙΝ τον bus ⇒ ο bus δεν καλείται καθόλου', () => {
    addCompetitor((e) => e.stopImmediatePropagation());
    registerBusHandler(true); // ο listener του bus μπαίνει ΜΕΤΑ τον ανταγωνιστή
    const e = fireEscape();
    const finding = __judgeForTests(e);
    expect(finding?.verdict).toBe('starved');
    expect(finding?.record.busDispatched).toBe(false);
  });

  it('αυτό ακριβώς είναι το σενάριο useCanvasKeyboardShortcuts:145 — ο πίνακας ESC_PRIORITY μένει ανενεργός', () => {
    let busHandlerRan = false;
    addCompetitor((e) => e.stopImmediatePropagation());
    escapeBus.register({
      id: 'audit-test/starved',
      priority: ESC_PRIORITY.MODAL_DIALOG,
      canHandle: () => true,
      handle: () => {
        busHandlerRan = true;
        return true;
      },
    });
    fireEscape();
    expect(busHandlerRan).toBe(false);
  });
});

describe('PREEMPTED — ανταγωνιστής προλαβαίνει τον bus', () => {
  it('preventDefault ΠΡΙΝ τον bus ⇒ η απόφαση του bus είναι ΔΕΥΤΕΡΗ ενέργεια', () => {
    addCompetitor((e) => e.preventDefault());
    registerBusHandler(true);
    const e = fireEscape();
    const finding = __judgeForTests(e);
    expect(finding?.verdict).toBe('preempted');
    expect(finding?.record.busDispatched).toBe(true);
  });
});

describe('SHADOW-OWNER — ιδιοκτήτης ESC εκτός του SSoT', () => {
  it('ανταγωνιστής ΜΕΤΑ τον bus καταναλώνει ενώ ο bus δεν διεκδίκησε', () => {
    registerBusHandler(false); // ο listener του bus μπαίνει ΠΡΩΤΟΣ
    addCompetitor((e) => e.preventDefault());
    const e = fireEscape();
    const finding = __judgeForTests(e);
    expect(finding?.verdict).toBe('shadow-owner');
  });

  it('ΤΟ ΚΕΡΔΟΣ ΕΝΑΝΤΙ ΤΟΥ §10.6: σκέτος έλεγχος στην είσοδο του bus θα το έχανε', () => {
    registerBusHandler(false);
    addCompetitor((e) => e.preventDefault());
    const e = fireEscape();
    // Στην είσοδο του bus το συμβάν ήταν ακόμα καθαρό — η παράβαση συνέβη μετά.
    expect(__judgeForTests(e)?.record.preemptedAtEntry).toBe(false);
    expect(__judgeForTests(e)?.verdict).toBe('shadow-owner');
  });
});

describe('ΤΥΦΛΟ ΣΗΜΕΙΟ — καρφωμένο ρητά, ώστε το «ok» να μη διαβάζεται ως «καθαρό»', () => {
  it('σιωπηλός ανταγωνιστής (ούτε preventDefault ούτε stop*) βγάζει ok — ΨΕΥΔΩΣ ΑΡΝΗΤΙΚΟ by design', () => {
    let sideEffect = 0;
    registerBusHandler(false);
    addCompetitor(() => {
      sideEffect += 1; // π.χ. eyedropper.ts:132 — ακυρώνει και δεν αφήνει ίχνος στο DOM
    });
    const e = fireEscape();
    expect(sideEffect).toBe(1);
    expect(__judgeForTests(e)?.verdict).toBe('ok');
    // ⇒ Αυτούς τους πιάνει ΜΟΝΟ ο στατικός ratchet (Μηχανισμός 3).
  });
});

describe('ADR-364 §10.15 — δηλωμένος τοπικός ιδιοκτήτης (Κ3)', () => {
  it('δηλωμένος Κ3 ⇒ ok, ΟΧΙ shadow-owner', () => {
    registerBusHandler(false); // ο bus δεν διεκδικεί όσο το textarea έχει focus
    addCompetitor((e) => {
      // Ακριβώς ό,τι κάνει το CommentReplyInput όταν κλείνει τη λίστα @-mention.
      noteLocalEscapeOwner(e, 'comment-reply/mention-list');
      e.preventDefault();
    });
    const e = fireEscape();
    const finding = __judgeForTests(e);
    expect(finding?.verdict).toBe('ok');
    expect(finding?.record.localOwner).toBe('comment-reply/mention-list');
  });

  it('ΘΕΤΙΚΟ CONTROL: αδήλωτος ωμός ιδιοκτήτης ΕΞΑΚΟΛΟΥΘΕΙ να βγαίνει shadow-owner', () => {
    registerBusHandler(false);
    addCompetitor((e) => e.preventDefault()); // καμία δήλωση
    const e = fireEscape();
    expect(__judgeForTests(e)?.verdict).toBe('shadow-owner');
  });

  it('η δήλωση ΔΕΝ κρύβει starved — ο λιμοκτονημένος bus παραμένει εύρημα', () => {
    addCompetitor((e) => {
      noteLocalEscapeOwner(e, 'test/liar');
      e.stopImmediatePropagation();
    });
    registerBusHandler(true);
    const e = fireEscape();
    expect(__judgeForTests(e)?.verdict).toBe('starved');
  });
});
