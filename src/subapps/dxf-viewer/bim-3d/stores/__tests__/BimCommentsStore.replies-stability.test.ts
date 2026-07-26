/**
 * ADR-366 Φ9/C.2 — referential stability του replies slice.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (μετρημένο 2026-07-26, ζωντανό στον browser):
 * το `BimCommentDetailsPanel` διάβαζε `useBimCommentsStore((s) => s.replies[id] ?? [])`.
 * Ό,τι επιστρέφει ένας selector μέσα στο hook γίνεται snapshot του `useSyncExternalStore`,
 * και το zustand τα συγκρίνει με `Object.is`. Το inline `[]` ήταν **νέο array σε κάθε
 * κλήση** ⇒ κάθε κλήση έμοιαζε με αλλαγή ⇒ `forceStoreRerender` σε βρόχο ⇒
 * `Maximum update depth exceeded` ⇒ ο error boundary έριχνε ΟΛΟΝ τον DxfViewer στο
 * **πρώτο κλικ σε οποιοδήποτε σχόλιο**. Γι' αυτό το master-detail — και μαζί του το
 * `CommentAttachmentLightbox` — δεν είχε πατηθεί ποτέ ζωντανά.
 *
 * Ένα unit test δεν μπορεί να «δει» άπειρο βρόχο του React· μπορεί όμως να καρφώσει την
 * **αιτία**: ο selector οφείλει να επιστρέφει την ΙΔΙΑ αναφορά όταν τίποτα δεν άλλαξε.
 * Αν κάποιος ξαναγράψει `?? []`, αυτό το test κοκκινίζει πριν φτάσει στον browser.
 */

// Το store εισάγει το `BimCommentsService` (Firebase) στο module scope· χωρίς αυτό το
// mock η φόρτωση σκάει με `ReferenceError: fetch is not defined` σε περιβάλλον node.
// Εδώ δοκιμάζεται καθαρή λογική selector — καμία κλήση δικτύου δεν συμμετέχει.
jest.mock('../../comments/bim-comments.service', () => ({
  BimCommentsService: {},
}));

import {
  selectRepliesFor,
  NO_REPLIES,
  useBimCommentsStore,
} from '../BimCommentsStore';
import type { BimCommentReply } from '../../comments/bim-comment-types';

const COMMENT_ID = 'cmt_bim_stability0001';

function makeReply(id: string): BimCommentReply {
  return {
    id,
    commentId: COMMENT_ID,
    authorId: 'u1',
    authorName: 'Tester',
    content: 'reply',
    mentionedUserIds: [],
    createdAt: '2026-07-26T00:00:00.000Z',
  } as BimCommentReply;
}

describe('BimCommentsStore — replies selector referential stability', () => {
  it('επιστρέφει την ΙΔΙΑ αναφορά για σχόλιο χωρίς απαντήσεις', () => {
    const empty: Record<string, BimCommentReply[]> = {};
    const a = selectRepliesFor(empty, COMMENT_ID);
    const b = selectRepliesFor(empty, COMMENT_ID);
    // Object.is — ακριβώς ο έλεγχος που κάνει το useSyncExternalStore.
    expect(Object.is(a, b)).toBe(true);
    expect(a).toBe(NO_REPLIES);
  });

  it('η κενή αναφορά είναι κοινή ανάμεσα σε διαφορετικά σχόλια και σε διαφορετικά states', () => {
    expect(selectRepliesFor({}, 'cmt_a')).toBe(selectRepliesFor({ other: [] }, 'cmt_b'));
  });

  it('το NO_REPLIES είναι παγωμένο — κανείς δεν μπορεί να μολύνει το κοινό snapshot', () => {
    expect(Object.isFrozen(NO_REPLIES)).toBe(true);
  });

  it('επιστρέφει το πραγματικό array όταν υπάρχουν απαντήσεις, χωρίς αντιγραφή', () => {
    const arr = [makeReply('r1')];
    const state: Record<string, BimCommentReply[]> = { [COMMENT_ID]: arr };
    expect(selectRepliesFor(state, COMMENT_ID)).toBe(arr);
  });

  it('πάνω στο ζωντανό store: δύο διαδοχικά διαβάσματα χωρίς αλλαγή δίνουν ίδια αναφορά', () => {
    const read = () => selectRepliesFor(useBimCommentsStore.getState().replies, COMMENT_ID);
    expect(read()).toBe(read());

    useBimCommentsStore.getState().setReplies(COMMENT_ID, [makeReply('r1')]);
    const withData = read();
    expect(withData).toHaveLength(1);
    // Χωρίς νέο setReplies, η αναφορά μένει σταθερή.
    expect(read()).toBe(withData);
  });
});
