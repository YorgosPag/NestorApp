'use client';

/**
 * useSpaceBuildingLink — ο σύνδεσμος «κτίριο» μιας φόρμας χώρου (θέση · αποθήκη) — ADR-898 §21.6 Ε6.
 *
 * Οι δύο καρτέλες έγραφαν το ίδιο μπλοκ (λίστα κτιρίων + `useEntityLink` με ίδιες ρυθμίσεις) και φόρτωναν **κάθε**
 * κτίριο του χώρου εργασίας: εννέα επιλογές, έξι από αυτές αδιάκριτα «Κτήριο Α». Γράφεται εδώ μία φορά, και οι επιλογές
 * περνούν από τον κανόνα του τομέα (`lib/spaces/space-building-scope`) — τον ΙΔΙΟ που επιβάλλει ο server:
 * - χώρος **με** έργο ⇒ μόνο τα κτίρια του έργου του·
 * - χώρος **χωρίς** έργο ⇒ όλα, ομαδοποιημένα ανά έργο.
 *
 * @module components/shared/space-info/useSpaceBuildingLink
 * @see ADR-200 — useEntityLink
 */

import { useCallback } from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { useEntityLink, type UseEntityLinkReturn } from '@/hooks/useEntityLink';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { buildBuildingLinkLabels } from './building-link-labels';
import { loadScopedBuildingOptions } from './scoped-building-options';

export interface SpaceBuildingLinkSpace {
  readonly id: string;
  readonly buildingId?: string | null;
  readonly projectId?: string | null;
}

export interface UseSpaceBuildingLinkInput {
  readonly relation: 'parking-building' | 'storage-building';
  readonly space: SpaceBuildingLinkSpace;
  /** Το `t` της καρτέλας (δεμένο στο δικό της namespace: `entityLinks.building.*`). */
  readonly t: (key: string) => string;
  readonly isEditing: boolean;
  /** Άλλο κτίριο ⇒ ο όροφος της φόρμας αδειάζει (ADR-903 §6). */
  readonly onFloorReset: () => void;
  readonly cardId: string;
}

export function useSpaceBuildingLink(input: UseSpaceBuildingLinkInput): UseEntityLinkReturn {
  const { relation, space, t, isEditing, onFloorReset, cardId } = input;
  const { currentLanguage } = useTranslation();
  const buildingId = space.buildingId ?? null;
  const projectId = space.projectId ?? null;
  const noProjectGroup = t('entityLinks.building.noProjectGroup');

  const loadOptions = useCallback(
    (): Promise<EntityLinkOption[]> => loadScopedBuildingOptions({ buildingId, projectId }, { noProjectGroup, locale: currentLanguage }),
    [buildingId, projectId, noProjectGroup, currentLanguage],
  );

  return useEntityLink({
    relation,
    entityId: space.id,
    initialParentId: buildingId,
    loadOptions,
    saveMode: 'form',
    cascadingResets: [{ resetField: 'floorId' }],
    onCascadingReset: onFloorReset,
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
    cardId,
    labels: buildBuildingLinkLabels(t),
  }, isEditing);
}
