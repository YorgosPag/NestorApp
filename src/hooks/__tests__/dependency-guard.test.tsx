/**
 * Characterization tests — dependency pre-check guards (ADR-226).
 *
 * Γράφτηκαν ΠΡΙΝ το de-duplication refactor (N.18 / ADR-584) σε ΑΤΕΣΤΩΤΑ hooks
 * και τρέχουν αναλλοίωτα ΠΡΙΝ και ΜΕΤΑ.
 *
 * Κλειδώνουν ό,τι ρισκάρει το merge των δύο guards σε μία μηχανή:
 *  1. το ΣΩΣΤΟ route ανά binding (deletion-guard/{type}/{id} vs link-removal-guard/{id})
 *  2. το fail-CLOSED συμβόλαιο: αν ο έλεγχος σκάσει → blocked, ΟΧΙ «προχώρα»
 *  3. τα ΔΙΑΦΟΡΕΤΙΚΑ μηνύματα «guard unavailable» (διαγραφή vs αποσύνδεση) = spec, όχι drift
 *  4. τις ΔΙΑΦΟΡΕΤΙΚΕΣ public επιφάνειες (ο link guard ΔΕΝ εκθέτει checkResult/resetCheck)
 */

import { renderHook, act } from '@testing-library/react';
import type { ReactElement } from 'react';

import { useDeletionGuard } from '../useDeletionGuard';
import { useLinkRemovalGuard } from '../useLinkRemovalGuard';
import { ApiClientError } from '@/lib/api/enterprise-api-client';
import type { DependencyCheckResult } from '@/config/deletion-registry';

// ============================================================================
// Mocks — lazy deref μέσα στα factories (jest.mock hoisting trap)
// ============================================================================

const mockApiGet = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => {
  // Πιστό στο συμβόλαιο που ΟΝΤΩΣ χρησιμοποιούν τα hooks:
  // `ApiClientError.isApiClientError(err)` + `err.statusCode` + `err.message`.
  class FakeApiClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = 'ApiClientError';
      this.statusCode = statusCode;
    }
    static isApiClientError(err: unknown): err is FakeApiClientError {
      return err instanceof FakeApiClientError;
    }
  }

  return {
    ApiClientError: FakeApiClientError,
    apiClient: { get: (...args: unknown[]) => mockApiGet(...args) },
  };
});

jest.mock('@/components/shared/DeletionBlockedDialog', () => ({
  DeletionBlockedDialog: () => null,
}));

// ============================================================================
// Fixtures
// ============================================================================

const ALLOWED: DependencyCheckResult = {
  allowed: true,
  dependencies: [],
  totalDependents: 0,
  message: '',
};

const BLOCKED: DependencyCheckResult = {
  allowed: false,
  dependencies: [{ label: 'Πωλήσεις', count: 3 }] as DependencyCheckResult['dependencies'],
  totalDependents: 3,
  message: 'Υπάρχουν εξαρτήσεις',
};

/** Τα ακριβή μηνύματα «ο guard δεν ολοκλήρωσε» — γραμμένα εδώ ΑΝΕΞΑΡΤΗΤΑ από τον κώδικα. */
const DELETION_UNAVAILABLE_MESSAGE =
  'Η διαγραφή μπλοκαρίστηκε γιατί ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά ή επικοινωνήστε με διαχειριστή.';
const LINK_REMOVAL_UNAVAILABLE_MESSAGE =
  'Η αποσύνδεση μπλοκαρίστηκε γιατί ο έλεγχος εξαρτήσεων δεν ολοκληρώθηκε αξιόπιστα. Δοκιμάστε ξανά ή επικοινωνήστε με διαχειριστή.';

const dialogPropsOf = (node: unknown) => (node as ReactElement).props as {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependencies: unknown[];
  message: string;
};

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

// ============================================================================
// 1. useDeletionGuard
// ============================================================================

describe('useDeletionGuard', () => {
  it('αρχική κατάσταση: τίποτα σε πτήση, τίποτα μπλοκαρισμένο', () => {
    const { result } = renderHook(() => useDeletionGuard('building'));

    expect(result.current.checking).toBe(false);
    expect(result.current.blocked).toBe(false);
    expect(result.current.checkResult).toBeNull();
  });

  it('εκθέτει ακριβώς το public API του (6 πεδία)', () => {
    const { result } = renderHook(() => useDeletionGuard('building'));

    expect(Object.keys(result.current).sort()).toEqual(
      ['BlockedDialog', 'blocked', 'checkBeforeDelete', 'checkResult', 'checking', 'resetCheck'].sort(),
    );
  });

  it.each([
    ['building', 'b1', '/api/deletion-guard/building/b1'],
    ['project', 'p9', '/api/deletion-guard/project/p9'],
    ['contact', 'c7', '/api/deletion-guard/contact/c7'],
    ['storage', 's3', '/api/deletion-guard/storage/s3'],
  ])('χτυπά το σωστό route για %s', async (entityType, id, route) => {
    mockApiGet.mockResolvedValue(ALLOWED);
    const { result } = renderHook(() => useDeletionGuard(entityType as 'building'));

    await act(async () => {
      await result.current.checkBeforeDelete(id);
    });

    expect(mockApiGet).toHaveBeenCalledWith(route);
  });

  it('όταν επιτρέπεται → true, χωρίς μπλοκάρισμα', async () => {
    mockApiGet.mockResolvedValue(ALLOWED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeDelete('b1');
    });

    expect(allowed).toBe(true);
    expect(result.current.blocked).toBe(false);
    expect(result.current.checking).toBe(false);
    expect(result.current.checkResult).toEqual(ALLOWED);
  });

  it('όταν ΔΕΝ επιτρέπεται → false + blocked + το αποτέλεσμα του server', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeDelete('b1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.checkResult).toEqual(BLOCKED);
  });

  it('FAIL-CLOSED σε ApiClientError: μπλοκάρει με το μήνυμα «διαγραφή», δεν προχωρά', async () => {
    mockApiGet.mockRejectedValue(new ApiClientError('boom', 500));
    const { result } = renderHook(() => useDeletionGuard('building'));

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeDelete('b1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.checkResult).toEqual({
      allowed: false,
      dependencies: [],
      totalDependents: 0,
      message: DELETION_UNAVAILABLE_MESSAGE,
    });
  });

  it('FAIL-CLOSED και σε σκέτο Error (όχι ApiClientError)', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useDeletionGuard('building'));

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeDelete('b1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);
    expect(result.current.checkResult?.message).toBe(DELETION_UNAVAILABLE_MESSAGE);
  });

  it('καταγράφει το statusCode όταν είναι ApiClientError', async () => {
    mockApiGet.mockRejectedValue(new ApiClientError('boom', 403));
    const { result } = renderHook(() => useDeletionGuard('building'));

    await act(async () => {
      await result.current.checkBeforeDelete('b1');
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('403'),
      expect.stringContaining('boom'),
    );
  });

  it('resetCheck καθαρίζει blocked + checkResult', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    await act(async () => {
      await result.current.checkBeforeDelete('b1');
    });
    expect(result.current.blocked).toBe(true);

    act(() => result.current.resetCheck());

    expect(result.current.blocked).toBe(false);
    expect(result.current.checkResult).toBeNull();
  });

  it('ένας νέος έλεγχος καθαρίζει το προηγούμενο blocked state', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    await act(async () => {
      await result.current.checkBeforeDelete('b1');
    });
    expect(result.current.blocked).toBe(true);

    mockApiGet.mockResolvedValue(ALLOWED);
    await act(async () => {
      await result.current.checkBeforeDelete('b2');
    });

    expect(result.current.blocked).toBe(false);
    expect(result.current.checkResult).toEqual(ALLOWED);
  });

  it('το BlockedDialog παίρνει open/dependencies/message από το check', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    expect(dialogPropsOf(result.current.BlockedDialog).open).toBe(false);

    await act(async () => {
      await result.current.checkBeforeDelete('b1');
    });

    const props = dialogPropsOf(result.current.BlockedDialog);
    expect(props.open).toBe(true);
    expect(props.dependencies).toEqual(BLOCKED.dependencies);
    expect(props.message).toBe(BLOCKED.message);
  });

  it('κλείσιμο του BlockedDialog κάνει reset', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useDeletionGuard('building'));

    await act(async () => {
      await result.current.checkBeforeDelete('b1');
    });

    act(() => dialogPropsOf(result.current.BlockedDialog).onOpenChange(false));

    expect(result.current.blocked).toBe(false);
  });
});

// ============================================================================
// 2. useLinkRemovalGuard
// ============================================================================

describe('useLinkRemovalGuard', () => {
  it('εκθέτει ΣΤΕΝΟΤΕΡΟ public API — ΧΩΡΙΣ checkResult/resetCheck', () => {
    const { result } = renderHook(() => useLinkRemovalGuard());

    expect(Object.keys(result.current).sort()).toEqual(
      ['BlockedDialog', 'blocked', 'checkBeforeRemove', 'checking'].sort(),
    );
  });

  it('χτυπά το route του link-removal guard (ένα όρισμα, όχι entityType)', async () => {
    mockApiGet.mockResolvedValue(ALLOWED);
    const { result } = renderHook(() => useLinkRemovalGuard());

    await act(async () => {
      await result.current.checkBeforeRemove('l1');
    });

    expect(mockApiGet).toHaveBeenCalledWith('/api/link-removal-guard/l1');
  });

  it('όταν επιτρέπεται → true, χωρίς μπλοκάρισμα', async () => {
    mockApiGet.mockResolvedValue(ALLOWED);
    const { result } = renderHook(() => useLinkRemovalGuard());

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeRemove('l1');
    });

    expect(allowed).toBe(true);
    expect(result.current.blocked).toBe(false);
    expect(result.current.checking).toBe(false);
  });

  it('όταν ΔΕΝ επιτρέπεται → false + blocked', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useLinkRemovalGuard());

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeRemove('l1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);
  });

  it('FAIL-CLOSED με το ΔΙΚΟ ΤΟΥ μήνυμα «αποσύνδεση» — ΟΧΙ «διαγραφή» (spec, όχι drift)', async () => {
    mockApiGet.mockRejectedValue(new ApiClientError('boom', 500));
    const { result } = renderHook(() => useLinkRemovalGuard());

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeRemove('l1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);

    const props = dialogPropsOf(result.current.BlockedDialog);
    expect(props.message).toBe(LINK_REMOVAL_UNAVAILABLE_MESSAGE);
    expect(props.message).not.toBe(DELETION_UNAVAILABLE_MESSAGE);
    expect(props.dependencies).toEqual([]);
  });

  it('FAIL-CLOSED και σε σκέτο Error', async () => {
    mockApiGet.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useLinkRemovalGuard());

    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await result.current.checkBeforeRemove('l1');
    });

    expect(allowed).toBe(false);
    expect(result.current.blocked).toBe(true);
  });

  it('το BlockedDialog παίρνει τα δεδομένα του check + κλείσιμο κάνει reset', async () => {
    mockApiGet.mockResolvedValue(BLOCKED);
    const { result } = renderHook(() => useLinkRemovalGuard());

    await act(async () => {
      await result.current.checkBeforeRemove('l1');
    });

    const props = dialogPropsOf(result.current.BlockedDialog);
    expect(props.open).toBe(true);
    expect(props.dependencies).toEqual(BLOCKED.dependencies);
    expect(props.message).toBe(BLOCKED.message);

    act(() => dialogPropsOf(result.current.BlockedDialog).onOpenChange(false));

    expect(result.current.blocked).toBe(false);
  });
});
