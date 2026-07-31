'use client';

/**
 * ADR-736 Φ4 — το ΕΝΑ hook που συνδέει τη σκηνή με τον resolver εξωτερικών αναφορών.
 *
 * Απαντά **και τις δύο** ερωτήσεις που έχει ένα μητρώο συνδέσμων:
 *   · «τι δηλώνει αυτό το σχέδιο και σε τι κατάσταση είναι;» → {@link references} / {@link summary}
 *   · «να τα ψάξεις σε αυτά τα αρχεία» → {@link resolve}
 *
 * ## Δύο δρόμοι, ένας μηχανισμός
 *
 * 1. **Αυτόματα, τη στιγμή της εισαγωγής.** Ο χρήστης έδωσε τα συνοδευτικά μαζί με το `.dxf`· τα
 *    αρχεία περιμένουν στο `ExternalReferenceCandidatesStore` και μόλις φανεί σκηνή με αναφορές
 *    η επίλυση τρέχει **χωρίς καμία ενέργεια** — 9 στα 10 υπόβαθρα βρίσκονται μόνα τους.
 *    🔴 Το πέρασμα αυτό **ΔΕΝ ζει εδώ**: ζει στον {@link ../ui/components/ExternalReferencesAutoResolveHost},
 *    που είναι **πάντα** mounted. Ζούσε μέσα σε αυτό το hook, και επειδή ο μόνος καλών του ήταν
 *    η παλέτα (που επιστρέφει `null` όσο είναι κλειστή), η «αυτόματη» επίλυση δεν έτρεχε ποτέ
 *    αυτόματα — ξεκινούσε τη στιγμή που ο χρήστης άνοιγε το μητρώο. Μετρημένο στον browser
 *    (ADR-736 §5): τα 9 υπόβαθρα έμεναν πλαίσια μέχρι το πρώτο άνοιγμα της παλέτας.
 * 2. **Χειροκίνητα, οποτεδήποτε.** Από την παλέτα, πάνω σε ήδη ανοιχτή σκηνή — ακόμη και σε μία
 *    που ήρθε από τη δεύτερη πόρτα (server wizard) και δεν πέρασε ποτέ από επίλυση.
 *
 * ## Η εγγραφή στη σκηνή γίνεται ΜΙΑ φορά, από ΕΝΑ σημείο
 *
 * Ενημερώνονται μαζί οι αναφορές **και** οι οντότητες, μέσα από την κοινή προβολή
 * `applyExternalReferencesToEntities` — την **ίδια** που χρησιμοποιεί ο `DxfSceneBuilder`. Δύο
 * ξεχωριστές εγγραφές θα άφηναν ένα ενδιάμεσο frame όπου η αναφορά λέει «βρέθηκε» και η εικόνα
 * ζωγραφίζει ακόμη πλαίσιο.
 *
 * `origin: 'local-edit'` σκοπίμως: η επίλυση είναι **πραγματική αλλαγή του εγγράφου** (τα URL
 * πρέπει να επιβιώσουν σε hard refresh), άρα οφείλει να προγραμματίσει auto-save.
 *
 * @see ../io/dxf-external-reference-resolver — η λογική (καθαρή, χωρίς React)
 * @see ../io/dxf-external-reference-deps — η καλωδίωση με Storage/ids
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLevels, useCurrentLevelScene } from '../systems/levels';
import { useCompanyId } from '@/hooks/useCompanyId';
import {
  summarizeExternalReferences,
  type DxfExternalReference,
  type DxfExternalReferenceSummary,
} from '../types/dxf-external-reference';
import { applyExternalReferencesToEntities } from '../utils/dxf-external-reference-apply';
import { resolveExternalReferences, type ResolveReferenceFailure } from '../io/dxf-external-reference-resolver';
import type { ReferenceAmbiguity } from '../io/dxf-external-reference-match';
import { buildDxfExternalReferenceDeps } from '../io/dxf-external-reference-deps';
import {
  clearExternalReferenceResolutionFlag,
  markExternalReferenceResolutionStarted,
  peekExternalReferenceResolutionOutcome,
  recordExternalReferenceResolutionOutcome,
  subscribeExternalReferenceResolutionOutcome,
} from '../stores/ExternalReferenceResolutionOutcomeStore';
import { dwarn } from '../debug';

const NO_REFERENCES: readonly DxfExternalReference[] = [];

export interface ExternalReferenceResolutionResult {
  readonly references: readonly DxfExternalReference[];
  readonly summary: DxfExternalReferenceSummary;
  readonly ambiguous: readonly ReferenceAmbiguity[];
  readonly failures: readonly ResolveReferenceFailure[];
  readonly isResolving: boolean;
  /** `false` όταν λείπει η εταιρεία — χωρίς αυτήν δεν υπάρχει company-scoped Storage path. */
  readonly canResolve: boolean;
  readonly resolve: (
    files: readonly File[],
    overrides?: ReadonlyMap<string, File>,
  ) => Promise<void>;
}

export function useExternalReferenceResolution(): ExternalReferenceResolutionResult {
  const { currentLevelId, setLevelScene } = useLevels();
  const scene = useCurrentLevelScene();
  const companyId = useCompanyId()?.companyId;

  /**
   * 🔴 Το αποτέλεσμα ζει σε **store**, όχι σε `useState`. Αυτό το hook το καλούν **δύο**
   * components (ο πάντα-mounted host και η παλέτα)· με τοπικό state το καθένα κρατούσε δικό
   * του αντίγραφο και ό,τι υπολόγιζε ο host δεν έφτανε ποτέ στην οθόνη — οι γνήσια
   * διφορούμενες αναφορές εμφανίζονταν ως «Λείπει». Βλ. το store για τη μέτρηση.
   */
  const { isResolving, ambiguous, failures } = useSyncExternalStore(
    subscribeExternalReferenceResolutionOutcome,
    peekExternalReferenceResolutionOutcome,
    peekExternalReferenceResolutionOutcome,
  );

  const references = scene?.externalReferences ?? NO_REFERENCES;
  const summary = useMemo(() => summarizeExternalReferences(references), [references]);
  const canResolve = !!companyId && !!currentLevelId && !!scene;

  /**
   * ⚠️ Η **τελευταία γνωστή σκηνή** σε ref, όχι στα deps του `resolve`.
   *
   * Η επίλυση διαρκεί (hash + ανέβασμα δεκάδων MB). Αν το `resolve` κρατούσε τη σκηνή από το
   * closure του render, θα έγραφε στο τέλος μια **παλιά** σκηνή και θα έσβηνε ό,τι σχεδίασε ο
   * χρήστης στο μεταξύ. Το ref διαβάζεται τη στιγμή της εγγραφής, όχι τη στιγμή της κλήσης.
   */
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const resolve = useCallback(
    async (files: readonly File[], overrides?: ReadonlyMap<string, File>): Promise<void> => {
      const current = sceneRef.current;
      if (!companyId || !currentLevelId || !current) return;
      const refs = current.externalReferences ?? NO_REFERENCES;
      if (refs.length === 0 || (files.length === 0 && !overrides?.size)) return;

      markExternalReferenceResolutionStarted();
      try {
        const result = await resolveExternalReferences(
          { references: refs, files, overrides },
          buildDxfExternalReferenceDeps(companyId),
        );
        recordExternalReferenceResolutionOutcome({
          ambiguous: result.ambiguous,
          failures: result.failures,
        });

        const latest = sceneRef.current;
        if (!latest) return;
        setLevelScene(
          currentLevelId,
          {
            ...latest,
            externalReferences: result.references,
            entities: applyExternalReferencesToEntities(latest.entities, result.references),
          },
          'local-edit',
        );
      } catch (error) {
        // Ο resolver απομονώνει ήδη τις αποτυχίες **ανά αναφορά**· εδώ φτάνει μόνο κάτι
        // καθολικό (π.χ. χαμένη σύνδεση). Δεν ρίχνει τον viewer — η σκηνή μένει ως έχει.
        dwarn('ExternalReferences', '⚠️ Η επίλυση συνημμένων απέτυχε καθολικά', error);
      } finally {
        // Δίχτυ: στην επιτυχία τη σημαία την έσβησε ήδη η καταγραφή του αποτελέσματος. Εδώ
        // πιάνεται μόνο ο δρόμος του `catch`, ώστε μια καθολική αποτυχία να μην αφήσει το UI
        // κλειδωμένο σε «Επίλυση…» για πάντα.
        clearExternalReferenceResolutionFlag();
      }
    },
    [companyId, currentLevelId, setLevelScene],
  );

  return { references, summary, ambiguous, failures, isResolving, canResolve, resolve };
}
