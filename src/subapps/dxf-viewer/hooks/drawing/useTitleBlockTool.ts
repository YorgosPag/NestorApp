'use client';
/**
 * ADR-651 Φάσεις Β+Γ — «Πινακίδα»: single-click τοποθέτηση φύλλου/πινακίδας στη σκηνή.
 *
 * ADR-600: το invariant placement FSM ζει στο `createSingleClickPlacementTool` — εδώ μόνο
 * το thin config (μοτίβο `useBlockLibraryTool`/`useFurnitureTool`). Η πινακίδα παράγεται
 * event-time από το ΛΥΜΕΝΟ πρότυπο (`buildActiveTitleBlockDef`), οπότε πάντα φέρει τα
 * τρέχοντα στοιχεία έργου/κλίμακας/φύλλου — χωρίς React re-render (ADR-040).
 *
 * Τρία side-concerns που ανήκουν εδώ (ο πυρήνας του factory μένει καθαρός):
 *  - **prefetch scope**: μόλις οπλιστεί το εργαλείο, φορτώνεται ΜΙΑ φορά το Firestore scope
 *    ⇒ το κλικ λύνει σύγχρονα (μηδέν await στο commit path ⇒ μηδέν race).
 *  - **γλώσσα**: το ενεργό locale γίνεται param override ⇒ EL/EN preset (Απόφαση #8).
 *  - **έξυπνη πρόταση χαρτιού** (Φάση Γ, Απόφαση #2): στο όπλισμα, το bbox του σχεδίου ÷ την
 *    ενεργή κλίμακα προτείνει μέγεθος/προσανατολισμό — **μόνο** όσο ο χρήστης δεν έχει
 *    διαλέξει ο ίδιος (το store κρατά το `paperAutoSuggest`). Πρόταση, όχι κλείδωμα.
 *
 * Το `useExtension` δημοσιεύει το handle στο `titleBlockToolBridgeStore` ώστε το contextual
 * ribbon tab να ρυθμίζει rotation/scale της ΕΠΟΜΕΝΗΣ τοποθέτησης (tool → ribbon).
 *
 * @see ../../text-engine/title-block/active-title-block.ts — ποιο πρότυπο + ποιο φύλλο + ποια δεδομένα
 * @see ../../text-engine/title-block/suggest-paper.ts — η πρόταση χαρτιού (καθαρή συνάρτηση)
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlockEntity, Entity } from '../../types/entities';
import {
  buildBlockEntityFromDef,
  type BlockPlacementParams,
} from '../../bim/block-library/place-block-from-library';
import { computeBlockFootprint } from '../../bim/block-library/block-library-footprint';
import { useTitleBlockOptionsStore } from '../../state/title-block-options-store';
import { createBoundsFromEntities } from '../../systems/zoom/utils/bounds';
import { getActiveScaleFactor } from '../../systems/viewport/ViewportStore';
import {
  buildActiveTitleBlockDef,
  loadTitleBlockAssets,
} from '../../text-engine/title-block/active-title-block';
import {
  toTitleBlockLocale,
  type TitleBlockLocale,
} from '../../text-engine/title-block/title-block-presets';
import { suggestPaperSpec } from '../../text-engine/title-block/suggest-paper';
import { titleBlockToolBridgeStore } from '../../ui/ribbon/hooks/bridge/title-block-tool-bridge-store';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
  type CorePlacementState,
} from './create-single-click-placement-tool';

/** Η πινακίδα χτίζεται ήδη σε canonical mm — καμία mm→scene μετατροπή. */
type TitleBlockSceneUnits = 'mm';

/** Ρυθμίσεις τοποθέτησης (ribbon contextual tab) + η γλώσσα του preset. */
export interface TitleBlockParamOverrides {
  readonly scale?: number;
  readonly rotation?: number;
  readonly locale?: TitleBlockLocale;
}

interface TitleBlockToolParams extends BlockPlacementParams {
  readonly locale: TitleBlockLocale;
}

export interface UseTitleBlockToolOptions {
  readonly onTitleBlockCreated?: (entity: BlockEntity) => void;
  readonly currentLevelId?: string;
  /** Ενεργό έργο — τροφοδοτεί το zero-config auto-fill· `undefined` ⇒ κενά πεδία έργου. */
  readonly projectId?: string;
  /** Οι οντότητες του ενεργού σχεδίου — τροφοδοτούν την πρόταση χαρτιού (Φάση Γ). */
  readonly getDrawingEntities?: () => readonly Entity[];
}

export type UseTitleBlockToolResult = CorePlacementResult<
  CorePlacementState<TitleBlockParamOverrides>,
  TitleBlockParamOverrides
>;

const useTitleBlockPlacement = createSingleClickPlacementTool<
  BlockEntity,
  TitleBlockToolParams,
  TitleBlockParamOverrides,
  Record<string, never>,
  Record<string, never>,
  TitleBlockSceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (clickPoint, overrides): TitleBlockToolParams => ({
    position: { x: clickPoint.x, y: clickPoint.y },
    scale: overrides.scale != null ? { x: overrides.scale, y: overrides.scale } : undefined,
    rotation: overrides.rotation,
    layerId: '0',
    locale: overrides.locale ?? 'el',
  }),
  buildEntity: (params) => {
    const def = buildActiveTitleBlockDef(params.locale);
    // Κενό πρότυπο (π.χ. ο χρήστης το άδειασε) ⇒ δεν μπαίνει «αόρατο» block στη σκηνή.
    if (def.localMembers.length === 0) {
      return { ok: false, hardErrors: ['tools.titleBlock.errorNoTemplate'] };
    }
    return { ok: true, entity: buildBlockEntityFromDef(def, params) };
  },
  computeFootprint: (params) => computeBlockFootprint(buildActiveTitleBlockDef(params.locale), params),
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.titleBlock.statusPosition' : ''),
  // Φάση Γ — δημοσίευσε το handle στο ribbon (tool → contextual tab). Ο πυρήνας (ADR-600)
  // κατέχει ήδη τα `overrides` + τον setter, άρα ο bridge γράφει ΑΠΕΥΘΕΙΑΣ στον SSoT setter.
  useExtension: ({ state, isActive, setParamOverrides }) => {
    useEffect(() => {
      titleBlockToolBridgeStore.set({ isActive, overrides: state.overrides, setParamOverrides });
      return () => {
        if (titleBlockToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          titleBlockToolBridgeStore.set(null);
        }
      };
    }, [state.overrides, isActive, setParamOverrides]);
    return {};
  },
});

/**
 * Προτείνει φύλλο από το bbox του σχεδίου × την ενεργή κλίμακα, μία φορά ανά όπλισμα.
 * Το store αγνοεί την πρόταση αν ο χρήστης έχει ήδη διαλέξει χαρτί (idempotent, no-op).
 */
function useSuggestedPaper(
  isActive: boolean,
  getDrawingEntities: (() => readonly Entity[]) | undefined,
): void {
  // Ref: ο callback του καλούντος δεν είναι stable — δεν πρέπει να ξανατρέχει η πρόταση
  // σε κάθε render του parent (θα ξανάγραφε το store· stable-callback κανόνας).
  const getEntitiesRef = useRef(getDrawingEntities);
  getEntitiesRef.current = getDrawingEntities;

  useEffect(() => {
    if (!isActive) return;
    if (!useTitleBlockOptionsStore.getState().paperAutoSuggest) return;
    const entities = getEntitiesRef.current?.() ?? [];
    const bounds = createBoundsFromEntities(entities);
    if (!bounds) return;
    const spec = suggestPaperSpec(
      { widthMm: bounds.max.x - bounds.min.x, heightMm: bounds.max.y - bounds.min.y },
      getActiveScaleFactor(),
    );
    useTitleBlockOptionsStore.getState().applySuggestedPaper(spec);
  }, [isActive]);
}

export function useTitleBlockTool(
  options: UseTitleBlockToolOptions = {},
): UseTitleBlockToolResult {
  const tool = useTitleBlockPlacement({
    onCreated: options.onTitleBlockCreated,
    currentLevelId: options.currentLevelId,
  });

  const { i18n } = useTranslation();
  const locale = toTitleBlockLocale(i18n.language);
  const { setParamOverrides, isActive } = tool;

  useEffect(() => {
    setParamOverrides({ locale });
  }, [locale, setParamOverrides]);

  // Zero-config auto-fill: στοιχεία έργου **και** εικόνα σφραγίδας (ADR-651 Φάση Ε)
  // φορτώνονται μόλις οπλιστεί το εργαλείο (idempotent) ⇒ το κλικ/ghost λύνει σύγχρονα.
  const { projectId } = options;
  useEffect(() => {
    if (isActive) void loadTitleBlockAssets(projectId);
  }, [isActive, projectId]);

  useSuggestedPaper(isActive, options.getDrawingEntities);

  return tool;
}
