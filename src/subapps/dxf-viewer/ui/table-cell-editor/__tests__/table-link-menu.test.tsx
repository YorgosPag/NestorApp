/**
 * 🔴 ADR-751 Φ8.β — **το δεξί κλικ πάνω σε σύνδεσμο κελιού.**
 *
 * Δύο εγγυήσεις κλειδώνονται εδώ, και καμία δεν είναι «ανοίγει μενού»:
 *
 *  1. **Η θύρα ΠΑΡΑΙΤΕΙΤΑΙ όταν δεν υπάρχει σύνδεσμος** (`false`), ώστε το δεξί κλικ να πέσει
 *     στο μενού περιγραμμάτων (1.45) και μετά στο μενού οντότητας (2). Ένα `true` εδώ θα
 *     κατάπινε σιωπηλά **κάθε** δεξί κλικ στον καμβά — παλινδρόμηση που καμία άλλη δοκιμασία
 *     δεν θα έβλεπε, γιατί το μενού απλώς δεν θα φαινόταν.
 *  2. **Ο στόχος έρχεται από το hover store**, δηλαδή είναι *ο ίδιος* σύνδεσμος που βάφει το
 *     χεράκι και δείχνει το tooltip. Αν κάποιος αύριο βάλει δεύτερο επιλυτή εδώ «για
 *     ακρίβεια», το μενού θα μπορεί να ανοίξει άλλη διεύθυνση από αυτή που υποσχέθηκε ο
 *     δείκτης — το ακριβώς ίδιο σχήμα λάθους που απαγορεύει το §8 του ADR.
 *
 * @see ui/table-cell-editor/use-table-link-menu.ts
 */

import { renderHook } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const notify = { success: jest.fn(), error: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => notify,
}));

const openCellLink = jest.fn();
const copyCellLinkAddress = jest.fn<Promise<boolean>, [string, string]>();
jest.mock('../../../bim/table/table-link-interaction-2d', () => ({
  openCellLink: (href: string) => openCellLink(href),
  copyCellLinkAddress: (kind: string, href: string) => copyCellLinkAddress(kind, href),
}));

import { useTableLinkMenu } from '../use-table-link-menu';
import {
  __resetTableLinkMenuPortForTests,
  getTableLinkMenuPort,
} from '../table-link-menu-port';
import { setHoveredCellLink } from '../../../state/table-cell-link-hover-store';
import type { TableTextLinkSpan } from '../../../bim/table/table-layout-types';

const SPAN: TableTextLinkSpan = {
  text: 'georgios.pagonis@gmail.com',
  kind: 'email',
  href: 'mailto:georgios.pagonis@gmail.com',
  offsetMm: 0,
  advanceMm: 40,
};

function hover(span: TableTextLinkSpan = SPAN) {
  setHoveredCellLink({
    entityId: 'ent_1',
    hit: { rowId: 'r1', colId: 'c1', span },
    clientX: 100,
    clientY: 200,
  });
}

beforeEach(() => {
  __resetTableLinkMenuPortForTests();
  setHoveredCellLink(null);
  jest.clearAllMocks();
  copyCellLinkAddress.mockResolvedValue(true);
});

describe('η θύρα', () => {
  it('δηλώνεται όσο το hook είναι μονταρισμένο', () => {
    const { unmount } = renderHook(() => useTableLinkMenu());
    expect(getTableLinkMenuPort()).not.toBeNull();
    unmount();
    expect(getTableLinkMenuPort()).toBeNull();
  });

  it('🔴 ΠΑΡΑΙΤΕΙΤΑΙ χωρίς σύνδεσμο — αλλιώς καταπίνει κάθε δεξί κλικ του καμβά', () => {
    renderHook(() => useTableLinkMenu());
    expect(getTableLinkMenuPort()?.open(10, 10)).toBe(false);
  });

  it('καταναλώνει το κλικ όταν υπάρχει σύνδεσμος κάτω από τον δείκτη', () => {
    const { result } = renderHook(() => useTableLinkMenu());
    const open = jest.fn();
    result.current.ref.current = { open, close: jest.fn() };

    hover();
    expect(getTableLinkMenuPort()?.open(10, 20)).toBe(true);
    expect(open).toHaveBeenCalledWith(10, 20, {
      kind: 'email',
      href: 'mailto:georgios.pagonis@gmail.com',
      text: 'georgios.pagonis@gmail.com',
    });
  });

  it('🔴 ο στόχος είναι ο ΙΔΙΟΣ σύνδεσμος του store — όχι δεύτερος επιλυτής', () => {
    const { result } = renderHook(() => useTableLinkMenu());
    const open = jest.fn();
    result.current.ref.current = { open, close: jest.fn() };

    hover({ ...SPAN, kind: 'phone', href: 'tel:2310788493', text: '2310-788493' });
    getTableLinkMenuPort()?.open(0, 0);

    expect(open.mock.calls[0]?.[2]).toMatchObject({ kind: 'phone', href: 'tel:2310788493' });
  });
});

describe('οι ενέργειες', () => {
  const TARGET = { kind: 'email', href: 'mailto:a@b.gr', text: 'a@b.gr' } as const;

  it('το άνοιγμα περνά από τον ΕΝΑ δρόμο ανοίγματος', () => {
    const { result } = renderHook(() => useTableLinkMenu());
    result.current.props.onOpen(TARGET);
    expect(openCellLink).toHaveBeenCalledWith('mailto:a@b.gr');
  });

  it('η αντιγραφή παραδίδει είδος ΚΑΙ προορισμό — το είδος καθορίζει τι αντιγράφεται', () => {
    const { result } = renderHook(() => useTableLinkMenu());
    result.current.props.onCopy(TARGET);
    expect(copyCellLinkAddress).toHaveBeenCalledWith('email', 'mailto:a@b.gr');
  });

  it('επιτυχία ⇒ το λέει', async () => {
    const { result } = renderHook(() => useTableLinkMenu());
    result.current.props.onCopy(TARGET);
    await Promise.resolve();
    expect(notify.success).toHaveBeenCalledWith('tableCellLink.copied');
  });

  it('🔴 αποτυχία ⇒ το λέει ΚΙΟΛΑΣ — σιωπή θα σήμαινε «επικόλλησε κάτι παλιό»', async () => {
    copyCellLinkAddress.mockResolvedValue(false);
    const { result } = renderHook(() => useTableLinkMenu());
    result.current.props.onCopy(TARGET);
    await Promise.resolve();
    expect(notify.error).toHaveBeenCalledWith('tableCellLink.copyFailed');
    expect(notify.success).not.toHaveBeenCalled();
  });
});
