/**
 * @fileoverview **ΠΟΙΟ ΚΑΝΑΛΙ ΜΙΛΑΕΙ ΟΤΑΝ Η ΔΙΑΓΡΑΦΗ ΑΠΟΤΥΧΕΙ** — διάλογος ή ειδοποίηση.
 * @related hooks/notifications/useFilesNotifications · config/notification-keys.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Η ΠΡΟΣΔΟΚΙΑ ΕΙΝΑΙ ΣΤΟ **ΚΛΕΙΔΙ**, ΚΑΙ ΟΧΙ ΣΤΟ ΑΓΓΛΙΚΟ ΚΕΙΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Καμία** από τις δύο άγκυρες δεν ρωτά *«τι λέει η πρόταση;»* — ρωτούν *«**ποιο
 * κανάλι** ειδοποιήθηκε;»*: μπλοκαρισμένος διάλογος για το legal hold, γενική
 * ειδοποίηση για οτιδήποτε άλλο. Το αγγλικό κείμενο ήταν **πληρεξούσιο** αυτής της
 * ερώτησης, ποτέ η ερώτηση.
 *
 * 🔴 **ΚΑΙ ΤΟ ΠΛΗΡΕΞΟΥΣΙΟ ΕΣΠΑΣΕ ΣΙΩΠΗΛΑ.** Το `useFileListActions` έπαψε να καλεί το
 * `useNotifications().error` απευθείας και πέρασε στο **μητρώο**
 * (`fileNotifications.list.deleteError()`), που στέλνει κλειδί **με πρόθεμα
 * namespace** (`files:list.deleteError`). Ο πίνακας μεταφράσεων αυτού του αρχείου είχε
 * τα κλειδιά **χωρίς** πρόθεμα, οπότε το `t` επέστρεφε το κλειδί αυτούσιο και η άγκυρα
 * κοκκίνιζε — για αλλαγή που **δεν είχε καμία σχέση** με αυτό που φυλάει.
 *
 * ⇒ Το `t` επιστρέφει πλέον **το κλειδί**, και η προσδοκία δένεται στο ίδιο το
 * {@link NOTIFICATION_KEYS} — όχι σε αντιγραμμένη συμβολοσειρά. Μετονομασία κλειδιού
 * μετακινεί **και τα δύο** μαζί· λάθος **κανάλι** εξακολουθεί να κοκκινίζει.
 *
 * ⚠️ Το *«υπάρχει η μετάφραση;»* **δεν** φυλάγεται εδώ, αλλά στο `Δ1` του
 * `hooks/notifications/__tests__/registry-exhaustiveness.test.ts` — μαζί με το μητρώο που
 * κατέχει τα κλειδιά. Δύο άγκυρες για την ίδια ερώτηση θα ήταν δύο αλήθειες.
 *
 * 🔴 **Και ΟΧΙ το CHECK 3.8, όσο κι αν φαίνεται ο φυσικός φύλακας** — μετρημένο
 * 2026-09-02: το ίδιο του το αρχείο γράφει *«SKIPS: Dynamic keys: `t(variable)`»*, και
 * **κάθε** κλήση του μητρώου είναι ακριβώς αυτό (`t(NOTIFICATION_KEYS…)`, σταθερά και όχι
 * κυριολεκτικό). Οι **80** συμβολοσειρές του μητρώου ήταν αφύλακτες μέχρι το `Δ1`.
 */

import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { useFileListActions } from '../useFileListActions';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';

const successMock = jest.fn();
const errorMock = jest.fn();

/** Το `t` επιστρέφει **το κλειδί**: εδώ κρίνεται *ποια πρόταση ζητήθηκε*, όχι πώς ακούγεται. */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: successMock,
    error: errorMock,
  }),
}));

describe('useFileListActions', () => {
  beforeEach(() => {
    successMock.mockReset();
    errorMock.mockReset();
  });

  it('opens blocked dialog when delete fails because the file has an active hold', async () => {
    const onDelete = jest.fn(async () => {
      throw new Error('Cannot trash file file_001: Active hold (legal) prevents deletion. Contact administrator.');
    });

    const { result } = renderHook(() => useFileListActions({
      onDelete,
      currentUserId: 'user_001',
    }));

    act(() => {
      result.current.handleDeleteClick('file_001', { stopPropagation: jest.fn() } as unknown as React.MouseEvent);
    });

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(onDelete).toHaveBeenCalledWith('file_001');
    expect(result.current.deleteBlockedOpen).toBe(true);
    // Το μήνυμα του legal hold ζητιέται από το ίδιο το hook (`t('trash.cannotTrashWithHold')`),
    // ΟΧΙ από το μητρώο — γι' αυτό εδώ το κλειδί είναι **χωρίς** πρόθεμα. Αυτό που
    // κρίνεται είναι ότι νίκησε **η ανθρώπινη πρόταση** και όχι το ωμό κείμενο του
    // σφάλματος («Cannot trash file file_001: Active hold …»).
    expect(result.current.deleteBlockedMessage).toBe('trash.cannotTrashWithHold');
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('keeps generic error notification for non-hold delete failures', async () => {
    const onDelete = jest.fn(async () => {
      throw new Error('Network failure');
    });

    const { result } = renderHook(() => useFileListActions({
      onDelete,
      currentUserId: 'user_001',
    }));

    act(() => {
      result.current.handleDeleteClick('file_002', { stopPropagation: jest.fn() } as unknown as React.MouseEvent);
    });

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(result.current.deleteBlockedOpen).toBe(false);
    // 🔑 Δεμένο στο **μητρώο**, όχι σε αντιγραμμένη συμβολοσειρά: η ερώτηση είναι
    // *«ήρθε η ΓΕΝΙΚΗ ειδοποίηση σφάλματος διαγραφής;»*, και το μητρώο είναι αυτός που
    // ξέρει το όνομά της.
    expect(errorMock).toHaveBeenCalledWith(NOTIFICATION_KEYS.files.list.deleteError);
  });
});
