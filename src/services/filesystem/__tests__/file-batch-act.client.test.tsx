/**
 * @jest-environment jsdom
 *
 * @fileoverview Άγκυρες της **ανακοίνωσης των μαζικών πράξεων κατάστασης** (ADR-907 §11.13).
 *
 * 🔴 Το ελάττωμα (μετρημένο ζωντανά 2026-10-12): εικόνα κάτοψης σημάνθηκε «Δημόσιο», η λίστα έδειξε το σήμα, και το
 * πάνελ της δήλωσης στην ίδια οθόνη συνέχισε να γράφει «όχι δημόσια» — η πράξη δεν έλεγε σε κανέναν ότι έγινε.
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | ΑΝ-1 | διαβάθμιση ⇒ ένα `FILE_UPDATED` ανά αρχείο, με τη **νέα** τιμή | καμία ανακοίνωση · ανακοίνωση χωρίς τιμή |
 * | ΑΝ-2 | αρχείο που ο διακομιστής **αρνήθηκε** δεν ανακοινώνεται | «άλλαξε» για φωτογραφία που έμεινε ιδιωτική |
 * | ΑΝ-3 | τίποτα δεν άλλαξε ⇒ κανένα σήμα | σήμα σε ολική άρνηση |
 * | ΑΝ-4 | αρχειοθέτηση ⇒ `archived` · επαναφορά ⇒ `active` | ανεστραμμένη κατεύθυνση · σήμα μόνο στη μία |
 * | ΑΝ-5 | βλάβη δικτύου ⇒ ρίψη, κανένα σήμα | ανακοίνωση πριν απαντήσει ο διακομιστής |
 * | ΑΝ-6 | η πύλη δίνει τις **ίδιες** συναρτήσεις | δεύτερο σώμα στην πύλη που δεν ανακοινώνει |
 * | ΑΝ-7 | ο αληθινός ακροατής (`useSettledFileChange`) **ξυπνά** από την πράξη | σήμα με όνομα που κανείς δεν ακούει |
 *
 * ⚠️ Ψεύτικα: το `apiClient` (το σύρμα) και το `RealtimeService` — το δεύτερο ως **αληθινός δίαυλος στη μνήμη**
 * (`dispatch` παραδίδει στους `subscribe`), ώστε η ΑΝ-7 να εκτελεί γραφέα και ακροατή μαζί. Ο πραγματικός δίαυλος
 * (`BroadcastChannel`) δεν εκτελείται εδώ.
 */
import { act, renderHook } from '@testing-library/react';

type Listener = (payload: unknown) => void;
const bus = new Map<string, Set<Listener>>();
const dispatched: Array<{ event: string; payload: { fileId: string; updates: Record<string, unknown>; timestamp: number } }> = [];

jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    subscribe: (event: string, listener: Listener) => {
      const set = bus.get(event) ?? new Set<Listener>();
      set.add(listener);
      bus.set(event, set);
      return () => { set.delete(listener); };
    },
    dispatch: (event: string, payload: { fileId: string; updates: Record<string, unknown>; timestamp: number }) => {
      dispatched.push({ event, payload });
      bus.get(event)?.forEach((listener) => listener(payload));
    },
  },
}));

jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: jest.fn(), request: jest.fn() } }));

// Η πύλη (ΑΝ-6) σέρνει υπηρεσίες που φορτώνουν firebase — ίδια στελέχη με το `file-mutation-gateway-propagate.test`.
jest.mock('@/services/file-folder.service', () => ({ FileFolderService: {} }));
jest.mock('@/services/document-template.service', () => ({ DocumentTemplateService: {} }));
jest.mock('@/services/file-comment.service', () => ({ FileCommentService: {} }));
jest.mock('@/services/file-approval.service', () => ({ FileApprovalService: {} }));
jest.mock('@/services/file-record.service', () => ({ FileRecordService: {} }));
jest.mock('firebase/auth', () => ({ onAuthStateChanged: jest.fn(), getAuth: jest.fn(() => ({ currentUser: null })) }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { API_ROUTES } from '@/config/domain-constants';
import { FILE_CHANGE_SETTLE_MS, useSettledFileChange } from '@/hooks/files/useSettledFileChange';
import { apiClient } from '@/lib/api/enterprise-api-client';

import {
  archiveFilesWithPolicy,
  setFilesClassificationWithPolicy,
  unarchiveFilesWithPolicy,
} from '../file-batch-act.client';
import * as gateway from '../file-mutation-gateway';

const postMock = apiClient.post as jest.Mock;

function answer(processedCount: number, errors: readonly string[] = []) {
  return { success: errors.length === 0, processedCount, errors, listings: [] };
}

beforeEach(() => {
  bus.clear();
  dispatched.length = 0;
  postMock.mockReset();
});

describe('ΑΝ-1 · η διαβάθμιση ανακοινώνεται ανά αρχείο, με τη νέα τιμή', () => {
  it('στέλνει τη δέσμη σε ένα αίτημα και ένα FILE_UPDATED ανά αρχείο', async () => {
    postMock.mockResolvedValue(answer(2));

    const response = await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'public');

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith(API_ROUTES.FILES.CLASSIFICATION, { fileIds: ['file_a', 'file_b'], classification: 'public' });
    expect(response.processedCount).toBe(2);
    expect(dispatched.map((entry) => entry.event)).toEqual(['FILE_UPDATED', 'FILE_UPDATED']);
    expect(dispatched.map((entry) => entry.payload.fileId)).toEqual(['file_a', 'file_b']);
    for (const { payload } of dispatched) expect(payload.updates).toEqual({ classification: 'public' });
  });

  it('όλη η δέσμη φέρει την ίδια στιγμή', async () => {
    postMock.mockResolvedValue(answer(2));

    await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'internal');

    expect(typeof dispatched[0].payload.timestamp).toBe('number');
    expect(dispatched[1].payload.timestamp).toBe(dispatched[0].payload.timestamp);
  });
});

describe('ΑΝ-2 · ό,τι αρνήθηκε ο διακομιστής δεν ανακοινώνεται', () => {
  it('μερική άρνηση ⇒ σήμα μόνο για όσα άλλαξαν', async () => {
    postMock.mockResolvedValue(answer(1, ['file_b: not-capable']));

    await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'public');

    expect(dispatched.map((entry) => entry.payload.fileId)).toEqual(['file_a']);
  });

  it('ο λόγος της άρνησης μπορεί να περιέχει «: » — το αρχείο είναι ό,τι προηγείται του πρώτου', async () => {
    postMock.mockResolvedValue(answer(1, ['file_b: refused: not found']));

    await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'public');

    expect(dispatched.map((entry) => entry.payload.fileId)).toEqual(['file_a']);
  });
});

describe('ΑΝ-3 · τίποτα δεν άλλαξε ⇒ κανένα σήμα', () => {
  it('ολική άρνηση', async () => {
    postMock.mockResolvedValue(answer(0, ['file_a: not-capable', 'file_b: not found']));

    await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'public');

    expect(dispatched).toEqual([]);
  });

  it('πράξη χωρίς έργο (όλα ήταν ήδη στη ζητούμενη κατάσταση)', async () => {
    postMock.mockResolvedValue(answer(0));

    await setFilesClassificationWithPolicy(['file_a'], 'public');

    expect(dispatched).toEqual([]);
  });
});

describe('ΑΝ-4 · η αρχειοθέτηση ανακοινώνει την κατεύθυνσή της', () => {
  it('αρχειοθέτηση ⇒ archived', async () => {
    postMock.mockResolvedValue(answer(1));

    await archiveFilesWithPolicy(['file_a']);

    expect(postMock).toHaveBeenCalledWith(API_ROUTES.FILES.ARCHIVE, { fileIds: ['file_a'], action: 'archive' });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].event).toBe('FILE_UPDATED');
    expect(dispatched[0].payload.updates).toEqual({ lifecycleState: 'archived' });
  });

  it('επαναφορά ⇒ active', async () => {
    postMock.mockResolvedValue(answer(1));

    await unarchiveFilesWithPolicy(['file_a']);

    expect(postMock).toHaveBeenCalledWith(API_ROUTES.FILES.ARCHIVE, { fileIds: ['file_a'], action: 'unarchive' });
    expect(dispatched[0].payload.updates).toEqual({ lifecycleState: 'active' });
  });
});

describe('ΑΝ-5 · βλάβη δικτύου', () => {
  it('ρίχνει και δεν ανακοινώνει τίποτα', async () => {
    postMock.mockRejectedValue(new Error('Network down'));

    await expect(setFilesClassificationWithPolicy(['file_a'], 'public')).rejects.toThrow('Network down');
    await expect(archiveFilesWithPolicy(['file_a'])).rejects.toThrow('Network down');
    expect(dispatched).toEqual([]);
  });
});

describe('ΑΝ-6 · η πύλη δεν έχει δεύτερο σώμα', () => {
  it('επανεξάγει τις ίδιες συναρτήσεις', () => {
    expect(gateway.setFilesClassificationWithPolicy).toBe(setFilesClassificationWithPolicy);
    expect(gateway.archiveFilesWithPolicy).toBe(archiveFilesWithPolicy);
    expect(gateway.unarchiveFilesWithPolicy).toBe(unarchiveFilesWithPolicy);
  });
});

describe('ΑΝ-7 · ο αληθινός ακροατής ξυπνά από την πράξη', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('διαβάθμιση δέσμης ⇒ ΕΝΑ κάλεσμα, αφού ησυχάσει', async () => {
    const onSettled = jest.fn();
    renderHook(() => useSettledFileChange('flr_1', onSettled));
    postMock.mockResolvedValue(answer(2));

    await act(async () => { await setFilesClassificationWithPolicy(['file_a', 'file_b'], 'public'); });
    expect(onSettled).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS); });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('ολική άρνηση ⇒ ο ακροατής δεν ξυπνά', async () => {
    const onSettled = jest.fn();
    renderHook(() => useSettledFileChange('flr_1', onSettled));
    postMock.mockResolvedValue(answer(0, ['file_a: not-capable']));

    await act(async () => { await setFilesClassificationWithPolicy(['file_a'], 'public'); });
    act(() => { jest.advanceTimersByTime(FILE_CHANGE_SETTLE_MS * 2); });

    expect(onSettled).not.toHaveBeenCalled();
  });
});
