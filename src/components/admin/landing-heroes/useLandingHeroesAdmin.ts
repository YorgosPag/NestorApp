'use client';

/**
 * @fileoverview **Η κατάσταση του εργαλείου ηρώων** — φόρτωση · πρόχειρο · εστίαση · δημοσίευση (ADR-881 §5.1).
 * @related app/api/admin/landing-heroes/** · lib/landing/landing-hero-api · hero-upload-prepare
 * @module components/admin/landing-heroes/useLandingHeroesAdmin
 *
 * 🔑 **Αισιόδοξη δημοσίευση** (N.7): ο δείκτης αλλάζει **αμέσως** στην οθόνη· αν ο διακομιστής αρνηθεί,
 *    επιστρέφει στην προηγούμενη τιμή και το σφάλμα λέγεται. Η δημοσίευση είναι ιδεμποτική (ίδιος δείκτης)
 *    και ο `apiClient` στέλνει `Idempotency-Key` (ADR-872) — η επανάληψη δεν κάνει ζημιά.
 *
 * ⚠️ **Το πρόχειρο ΔΕΝ είναι αισιόδοξο, επίτηδες**: μια έκδοση χωρίς παράγωγα στο ράφι δεν υπάρχει. Η
 *    οθόνη δείχνει «επεξεργασία» μέχρι να απαντήσει ο διακομιστής — είναι τα δευτερόλεπτα του καθαρισμού.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { apiErrorBodyOf } from '@/lib/api/api-client-types';
import { nowISO } from '@/lib/date-local';
import {
  isLandingHeroApiError,
  type CreateLandingHeroRevisionBody,
  type LandingHeroApiError,
  type LandingHeroesStateResponse,
  type LandingHeroRevisionResponse,
} from '@/lib/landing/landing-hero-api';
import type { LandingHeroPointers, LandingHeroRevision } from '@/lib/landing/landing-hero-document';
import type { LandingHeroPage } from '@/lib/landing/landing-hero-vocabulary';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import { normaliseForUpload, uploadHeroOriginal } from './hero-upload-prepare';

/** Σφάλματα της οθόνης — κλειδιά i18n (`landing-heroes-admin:errors.*`), ποτέ κείμενο. */
export type HeroAdminError = LandingHeroApiError | 'upload-failed' | 'too-large' | 'no-identity' | 'network';

export interface HeroDraftInput {
  readonly page: LandingHeroPage;
  readonly day: File;
  readonly dusk: File | null;
  readonly focalPoint: PhotoFocalPoint | null;
}

export interface ReadyAdminState {
  readonly status: 'ready';
  readonly pointers: LandingHeroPointers;
  readonly revisions: readonly LandingHeroRevision[];
}

type AdminState = { readonly status: 'loading' } | { readonly status: 'error' } | ReadyAdminState;

export type HeroAdminBusy = 'saving' | 'publishing' | null;

function errorOf(cause: unknown): HeroAdminError {
  const code = apiErrorBodyOf(cause)?.error;
  return isLandingHeroApiError(code) ? code : 'network';
}

/** Αρχείο → (κανονικοποίηση) → ιδιωτικός κάδος. Το σφάλμα ονομάζεται, δεν πετιέται. */
async function uploadOne(file: File, variant: 'day' | 'dusk', companyId: string, uid: string) {
  const prepared = await normaliseForUpload(file);
  if (prepared === null) return { error: 'too-large' as const };
  try {
    return { path: await uploadHeroOriginal(prepared, variant, companyId, uid) };
  } catch {
    return { error: 'upload-failed' as const };
  }
}

async function saveDraftRequest(
  input: HeroDraftInput,
  companyId: string,
  uid: string,
): Promise<{ readonly revision: LandingHeroRevision } | { readonly error: HeroAdminError }> {
  const [day, dusk] = await Promise.all([
    uploadOne(input.day, 'day', companyId, uid),
    input.dusk === null ? Promise.resolve(null) : uploadOne(input.dusk, 'dusk', companyId, uid),
  ]);
  if ('error' in day) return { error: day.error };
  if (dusk !== null && 'error' in dusk) return { error: dusk.error };

  const body: CreateLandingHeroRevisionBody = {
    kind: 'upload',
    page: input.page,
    dayPath: day.path,
    duskPath: dusk === null ? null : dusk.path,
    focalPoint: input.focalPoint,
  };
  try {
    return await apiClient.post<LandingHeroRevisionResponse>(API_ROUTES.ADMIN.LANDING_HEROES, body);
  } catch (cause) {
    return { error: errorOf(cause) };
  }
}

/** Κατάσταση + φόρτωση + πρόσθεση έκδοσης στην κορυφή του ιστορικού. */
function useHeroesState() {
  const [state, setState] = useState<AdminState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get<LandingHeroesStateResponse>(API_ROUTES.ADMIN.LANDING_HEROES);
      setState({ status: 'ready', pointers: response.pointers, revisions: response.revisions });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRevision = useCallback((revision: LandingHeroRevision) => {
    setState((current) =>
      current.status === 'ready' ? { ...current, revisions: [revision, ...current.revisions] } : current,
    );
  }, []);

  return { state, setState, load, addRevision };
}

type Report = {
  readonly setBusy: (busy: HeroAdminBusy) => void;
  readonly setError: (error: HeroAdminError | null) => void;
};

/** Νέο πρόχειρο από αρχεία — **όχι** αισιόδοξο (δες σχόλιο αρχείου). */
function useSaveDraft(addRevision: (revision: LandingHeroRevision) => void, { setBusy, setError }: Report) {
  const { user } = useAuth();
  return useCallback(
    async (input: HeroDraftInput): Promise<LandingHeroRevision | null> => {
      const companyId = user?.companyId ?? null;
      const uid = user?.uid ?? null;
      if (companyId === null || uid === null) {
        setError('no-identity');
        return null;
      }
      setBusy('saving');
      setError(null);
      const result = await saveDraftRequest(input, companyId, uid);
      setBusy(null);
      if ('error' in result) {
        setError(result.error);
        return null;
      }
      addRevision(result.revision);
      return result.revision;
    },
    [user, addRevision, setBusy, setError],
  );
}

/** Ίδιες εικόνες, άλλο σημείο — νέα έκδοση χωρίς re-encode. */
function useRefocus(addRevision: (revision: LandingHeroRevision) => void, { setBusy, setError }: Report) {
  return useCallback(
    async (baseRevisionId: string, focalPoint: PhotoFocalPoint): Promise<LandingHeroRevision | null> => {
      setBusy('saving');
      setError(null);
      try {
        const body: CreateLandingHeroRevisionBody = { kind: 'refocus', baseRevisionId, focalPoint };
        const { revision } = await apiClient.post<LandingHeroRevisionResponse>(API_ROUTES.ADMIN.LANDING_HEROES, body);
        addRevision(revision);
        return revision;
      } catch (cause) {
        setError(errorOf(cause));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [addRevision, setBusy, setError],
  );
}

/** Αισιόδοξη μετακίνηση δείκτη με επαναφορά σε άρνηση. */
function usePublish(
  state: AdminState,
  setState: Dispatch<SetStateAction<AdminState>>,
  { setBusy, setError }: Report,
) {
  return useCallback(
    async (page: LandingHeroPage, revisionId: string | null): Promise<boolean> => {
      if (state.status !== 'ready') return false;
      const previous = state.pointers;
      const optimistic = { ...previous[page], publishedRevisionId: revisionId, publishedAt: nowISO() };
      setState({ ...state, pointers: { ...previous, [page]: optimistic } });
      setBusy('publishing');
      setError(null);
      try {
        await apiClient.post(API_ROUTES.ADMIN.LANDING_HEROES_PUBLISH, { page, revisionId });
        return true;
      } catch (cause) {
        setState((current) => (current.status === 'ready' ? { ...current, pointers: previous } : current));
        setError(errorOf(cause));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [state, setState, setBusy, setError],
  );
}

export function useLandingHeroesAdmin() {
  const { state, setState, load, addRevision } = useHeroesState();
  const [busy, setBusy] = useState<HeroAdminBusy>(null);
  const [error, setError] = useState<HeroAdminError | null>(null);
  const report: Report = { setBusy, setError };

  return {
    state,
    busy,
    error,
    clearError: () => setError(null),
    reload: load,
    saveDraft: useSaveDraft(addRevision, report),
    refocus: useRefocus(addRevision, report),
    publish: usePublish(state, setState, report),
  };
}

export type LandingHeroesAdmin = ReturnType<typeof useLandingHeroesAdmin>;
