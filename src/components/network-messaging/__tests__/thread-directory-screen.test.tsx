/**
 * @tests ADR-867 Β9β — ο κατάλογος «τα μηνύματά μου», από τη γραμμή ως την οθόνη.
 *
 * ── ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΘΕ ΕΝΑ ──
 *
 * Ο κατάλογος γεννήθηκε επειδή μια ζωντανή επαλήθευση βρήκε νήμα **χωρίς οθόνη**: εντολή που
 * ανέθεσε **ιδιώτης** σε γραφείο ζει σε αγγελία με `authorCompanyId: null`, και ο κατάλογος
 * εντολών του γραφείου — σωστά — δεν τη δείχνει ποτέ. Οι άγκυρες εδώ φυλάνε τα τέσσερα σημεία
 * όπου η επόμενη αλλαγή θα έσπαγε **σιωπηλά**:
 *
 * • **Κ-1 δρομέας, όχι σελίδα**: ο κατάλογος ταξινομείται κατά δραστηριότητα, που αλλάζει ενώ
 *   διαβάζεις. Ένα `page=2` θα ξανάδινε γραμμή που μετακινήθηκε και θα έχανε την επόμενη.
 * • **Κ-3 η ιδιότητα**: χωρίς το `alsoHostRole`, οι δύο γραμμές του ίδιου ανθρώπου («ιδιοκτήτης»
 *   και «υπεύθυνος του γραφείου») είναι **ταυτόσημες** στην οθόνη.
 * • **Κ-4 αδιάβαστο από το ΔΙΚΟ μου `lastReadAt`** — ποτέ ανά μήνυμα (§8 #4).
 * • **Κ-5 καμία εμβέλεια χώρου**: το νήμα είναι `cross-space-thread`· ένα φίλτρο γραφείου θα
 *   εξαφάνιζε **αθόρυβα** κάθε νήμα σχέσης (Β8), που δεν έχει `hostCompanyId` καθόλου.
 *
 * ⚠️ **ΜΗΝ τα μετατρέψεις σε ελέγχους συμβολοσειράς** πάνω στην πηγή. Ο κατάλογος έχει **τρία**
 * στρώματα (γραφέας γραμμής · hook · οθόνη) και το ελάττωμα ζει στις **αρμούς** τους.
 */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { directoryItem, THREAD_DIRECTORY_INDEX } from '@/services/network-messaging/thread-directory';
import type { NetworkAudienceEntry, NetworkThread } from '@/types/network-thread';
import { NO_EARLIER_TENURES } from '@/types/network-thread';
import type { NetworkThreadListItem } from '@/types/network-wire';

import { NetworkThreadDirectoryContent } from '../NetworkThreadDirectoryContent';

// Το κλειδί τυπώνεται αυτούσιο ⇒ η άγκυρα κρίνει **ποιο** κλειδί ζητήθηκε, όχι τη μετάφραση.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { readonly href: string; readonly children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const list = jest.fn();
jest.mock('@/services/network-messaging/network-thread.client', () => ({
  networkThreadClient: { list: (...args: unknown[]) => list(...args) },
}));

// =============================================================================
// ΔΕΙΓΜΑΤΑ
// =============================================================================

const THREAD: NetworkThread = {
  id: 'nthr_1',
  topic: { kind: 'act', actKind: 'mandate', actSeed: 'ownp_1:comp_1', hostCompanyId: 'comp_1', counterpartUid: 'u_owner' },
  state: 'open',
  createdAt: '2026-09-01T10:00:00.000Z',
  lastMessageAt: '2026-09-19T10:00:00.000Z',
};

function entry(patch: Partial<NetworkAudienceEntry> = {}): NetworkAudienceEntry {
  return {
    uid: 'u_owner',
    side: 'counterpart',
    role: 'counterpart',
    reason: 'counterpart',
    addedBy: 'u_owner',
    since: '2026-09-01T10:00:00.000Z',
    until: null,
    lastReadAt: null,
    muted: false,
    following: false,
    alsoHostRole: null,
    threadActivityAt: '2026-09-19T10:00:00.000Z',
    tenureHistory: NO_EARLIER_TENURES,
    ...patch,
  } as NetworkAudienceEntry;
}

function row(patch: Partial<NetworkThreadListItem> = {}): NetworkThreadListItem {
  return { ...directoryItem('nthr_1', entry(), THREAD, '/messages/nthr_1'), ...patch };
}

beforeEach(() => list.mockReset());

// =============================================================================
// Κ-3 · Κ-4 — Ο ΓΡΑΦΕΑΣ ΤΗΣ ΓΡΑΜΜΗΣ
// =============================================================================

describe('Κ-3 — η δεύτερη ιδιότητα ταξιδεύει ως τη γραμμή', () => {
  it('περνά το `alsoHostRole` όταν υπάρχει', () => {
    const item = directoryItem('nthr_1', entry({ alsoHostRole: 'responsible' }), THREAD, '/messages/nthr_1');
    expect(item.alsoHostRole).toBe('responsible');
  });

  it('και το τυπώνει — αλλιώς οι δύο γραμμές του ίδιου ανθρώπου είναι ταυτόσημες', async () => {
    list.mockResolvedValue({ ok: true, value: { items: [row({ alsoHostRole: 'responsible' })], next: null } });
    render(<NetworkThreadDirectoryContent />);

    expect(await screen.findByText(/roster\.alsoHost\.responsible/)).toBeTruthy();
  });
});

describe('Κ-4 — αδιάβαστο από το ΔΙΚΟ μου `lastReadAt`', () => {
  it('διαβασμένο μετά το τελευταίο μήνυμα ⇒ όχι αδιάβαστο', () => {
    const item = directoryItem('nthr_1', entry({ lastReadAt: '2026-09-19T11:00:00.000Z' }), THREAD, '/messages/nthr_1');
    expect(item.unread).toBe(false);
  });

  it('διαβασμένο ΠΡΙΝ το τελευταίο μήνυμα ⇒ αδιάβαστο', () => {
    const item = directoryItem('nthr_1', entry({ lastReadAt: '2026-09-18T10:00:00.000Z' }), THREAD, '/messages/nthr_1');
    expect(item.unread).toBe(true);
  });

  it('νήμα χωρίς κανένα μήνυμα ΔΕΝ είναι αδιάβαστο', () => {
    const item = directoryItem('nthr_1', entry(), { ...THREAD, lastMessageAt: null }, '/messages/nthr_1');
    expect(item.unread).toBe(false);
  });
});

// =============================================================================
// Κ-5 — ΚΑΜΙΑ ΕΜΒΕΛΕΙΑ ΧΩΡΟΥ
// =============================================================================

describe('Κ-5 — ο κατάλογος ρωτά τον ΑΝΘΡΩΠΟ, ποτέ τον χώρο', () => {
  it('το ερώτημα έχει ΜΟΝΟ `uid` + `until` — ένα `hostCompanyId` θα έσβηνε κάθε νήμα σχέσης', () => {
    expect([...THREAD_DIRECTORY_INDEX.equality]).toEqual(['uid', 'until']);
  });
});

// =============================================================================
// Κ-1 — Ο ΔΡΟΜΕΑΣ
// =============================================================================

describe('Κ-1 — σελιδοποίηση με δρομέα', () => {
  it('η πρώτη σελίδα ζητιέται ΧΩΡΙΣ δρομέα', async () => {
    list.mockResolvedValue({ ok: true, value: { items: [row()], next: null } });
    render(<NetworkThreadDirectoryContent />);

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(list).toHaveBeenCalledWith(undefined);
  });

  it('η επόμενη ζητιέται με τον ΙΔΙΟ, αυτούσιο δρομέα — και οι γραμμές ΠΡΟΣΤΙΘΕΝΤΑΙ', async () => {
    list
      .mockResolvedValueOnce({ ok: true, value: { items: [row()], next: 'ΟΠΑΚΟ-ΔΡΟΜΕΑΣ' } })
      .mockResolvedValueOnce({ ok: true, value: { items: [row({ threadId: 'nthr_2' })], next: null } });

    render(<NetworkThreadDirectoryContent />);
    await userEvent.click(await screen.findByRole('button', { name: /directory\.loadMore/ }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(list).toHaveBeenLastCalledWith({ cursor: 'ΟΠΑΚΟ-ΔΡΟΜΕΑΣ' });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('χωρίς επόμενο δρομέα ΔΕΝ προσφέρεται «κι άλλα»', async () => {
    list.mockResolvedValue({ ok: true, value: { items: [row()], next: null } });
    render(<NetworkThreadDirectoryContent />);

    await screen.findByRole('listitem');
    expect(screen.queryByRole('button', { name: /directory\.loadMore/ })).toBeNull();
  });
});

// =============================================================================
// Η ΕΙΛΙΚΡΙΝΕΙΑ ΤΗΣ ΟΘΟΝΗΣ
// =============================================================================

// =============================================================================
// Η ΡΙΖΑ — ΤΟ ΛΑΘΟΣ ΠΟΥ ΔΥΟ ΠΡΑΣΙΝΕΣ ΠΥΛΕΣ ΑΦΗΣΑΝ ΝΑ ΠΕΡΑΣΕΙ
// =============================================================================

/**
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΟΜΑΔΑ — ΔΥΟ ΓΡΑΦΕΣ, ΔΥΟ ΣΠΑΣΙΜΑΤΑ, ΜΗΔΕΝ ΚΟΚΚΙΝΑ.**
 *
 * ① `mx-auto flex max-w-3xl flex-col gap-6 py-8` ⇒ η **CHECK 3.63** το έπιασε (καλώς).
 * ② Η «διόρθωση» έβαλε δικό της `<ShellSurface measure="wide">` — αλλά το `PrivateSpaceShell`
 *    τυλίγει **ήδη** κάθε σελίδα του `(me)` με ένα. **Grid μέσα σε grid**: το εξωτερικό έχει
 *    `flex-1`, το εσωτερικό τεντώθηκε, και το `align-content: normal` μοίρασε το πλεόνασμα στις
 *    σιωπηρές γραμμές ⇒ **~390px κενό** κάτω από την κεφαλίδα. **Η 3.63 έμεινε ΠΡΑΣΙΝΗ**: ρωτά
 *    «έγραψες γεωμετρία;», **όχι** «πόσα μέτρα δήλωσες;». Το βρήκε **μόνο** το ανθρώπινο μάτι.
 *
 * Το jsdom **δεν έχει διάταξη**, άρα «πόσο κενό;» είναι αναπάντητο εδώ. Το **δομικό αίτιο** όμως
 * είναι απολύτως ελέγξιμο: *«δηλώνει αυτή η ρίζα μέτρο ή διάδρομο που **δεν της ανήκει**;»*
 */
describe('η ρίζα δεν διεκδικεί γεωμετρία που ανήκει στο κέλυφος', () => {
  async function rootOf(): Promise<Element> {
    list.mockResolvedValue({ ok: true, value: { items: [row()], next: null } });
    const { container } = render(<NetworkThreadDirectoryContent />);
    await screen.findByRole('listitem');
    const root = container.firstElementChild;
    if (root === null) throw new Error('Η οθόνη δεν απέδωσε ρίζα.');
    return root;
  }

  it('ΔΕΥΤΕΡΟ `ShellSurface` — το `(me)` δίνει ήδη ένα· δύο σημαίνει grid μέσα σε grid', async () => {
    const root = await rootOf();
    expect(root.hasAttribute('data-shell-measure')).toBe(false);
    expect(root.hasAttribute('data-shell-surface')).toBe(false);
  });

  it('χειρόγραφο μέτρο, διάδρομος ή κεντράρισμα — τα κατέχει ο ΕΝΑΣ ιδιοκτήτης', async () => {
    const root = await rootOf();
    const owned = /(^|\s)(mx-auto|max-w-|p-\d|px-\d|py-\d)/;
    expect(root.className).not.toMatch(owned);
  });
});

describe('η οθόνη λέει την αλήθεια', () => {
  it('🔴 ΚΑΘΕ γραμμή είναι σύνδεσμος — και οδηγεί στη ΣΥΝΟΜΙΛΙΑ (Β9γ)', async () => {
    list.mockResolvedValue({ ok: true, value: { items: [row({ href: '/messages/nthr_1' })], next: null } });
    const { container } = render(<NetworkThreadDirectoryContent />);

    await screen.findByRole('listitem');
    // 🔴 **ΟΧΙ `queryByRole('link')`** — μετρήθηκε 2026-09-20 ότι είναι **πράσινο που δεν κοιτά**:
    //    ένα `<a>` **χωρίς** `href` δεν έχει ρόλο `link`, άρα η ερώτηση απαντούσε «κανένας» και στις
    //    δύο περιπτώσεις. Η μετάλλαξη «απόδωσε πάντα σύνδεσμο» **επέζησε**. Η ερώτηση που
    //    διακρίνει είναι η ύπαρξη του ίδιου του στοιχείου.
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/messages/nthr_1');
  });

  it('🔴 Η ΓΡΑΜΜΗ ΔΕΝ ΟΔΗΓΕΙ ΣΕ ΣΕΛΙΔΑ ΧΩΡΟΥ — εκεί ήταν το σπασμένο κλικ του γραφείου', async () => {
    // Μέχρι το Β9β η γραμμή του γραφείου έδειχνε στο `/o/<χώρος>/listings/mandates/<ownp>`, που για
    // αγγελία **ιδιώτη** απαντά «Αυτή η εντολή δεν βρέθηκε» (μετρημένο ζωντανά, 2026-09-21). Ο
    // διακομιστής δίνει πλέον **μία** διεύθυνση· η οθόνη την περνά **αυτούσια**, χωρίς να μαντεύει.
    list.mockResolvedValue({ ok: true, value: { items: [row({ href: '/messages/nthr_1' })], next: null } });
    render(<NetworkThreadDirectoryContent />);

    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('/messages/nthr_1');
    expect(link.getAttribute('href')).not.toContain('/o/');
  });

  it('αποτυχία ⇒ ο κωδικός μεταφράζεται και προσφέρεται δεύτερη προσπάθεια', async () => {
    list.mockResolvedValue({ ok: false, failure: 'unreachable', currentVersion: null });
    render(<NetworkThreadDirectoryContent />);

    expect(await screen.findByText(/failure\.unreachable/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /directory\.retry/ })).toBeTruthy();
  });

  it('κανένα νήμα ⇒ κενή κατάσταση, όχι σιωπή', async () => {
    list.mockResolvedValue({ ok: true, value: { items: [], next: null } });
    render(<NetworkThreadDirectoryContent />);

    expect(await screen.findByText(/directory\.empty$/)).toBeTruthy();
  });
});
