'use client';

/**
 * useSpaceBuildingLink — ο σύνδεσμος «κτίριο» μιας φόρμας χώρου (θέση · αποθήκη) — ADR-898 §21.6 Ε6.
 *
 * Οι δύο καρτέλες έγραφαν το ίδιο μπλοκ (`getBuildingsList` + `useEntityLink` με ίδιες ρυθμίσεις) και φόρτωναν **κάθε**
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
import { getProjectsList } from '@/components/building-management/building-services';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { useEntityLink, type UseEntityLinkReturn } from '@/hooks/useEntityLink';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  buildingOptionsForSpace,
  resolveSpaceProjectId,
  type ScopedBuilding,
  type SpaceBuildingAnchor,
} from '@/lib/spaces/space-building-scope';
import { getBuildingsList } from '@/services/properties.service';
import { buildBuildingLinkLabels } from './building-link-labels';

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

/** Ονόματα έργων μόνο όταν χρειάζονται: ο χώρος με έργο δεν ομαδοποιεί, άρα δεν πληρώνει δεύτερη ανάγνωση. */
async function projectNamesFor(space: SpaceBuildingAnchor, buildings: readonly ScopedBuilding[]): Promise<Map<string, string>> {
  if (resolveSpaceProjectId(space, buildings) !== null) return new Map();
  return new Map((await getProjectsList()).map((project) => [project.id, project.name]));
}

export function useSpaceBuildingLink(input: UseSpaceBuildingLinkInput): UseEntityLinkReturn {
  const { relation, space, t, isEditing, onFloorReset, cardId } = input;
  const { currentLanguage } = useTranslation();
  const buildingId = space.buildingId ?? null;
  const projectId = space.projectId ?? null;
  const noProjectGroup = t('entityLinks.building.noProjectGroup');

  const loadOptions = useCallback(async (): Promise<EntityLinkOption[]> => {
    const anchor = { buildingId, projectId };
    const buildings = await getBuildingsList();
    return buildingOptionsForSpace({
      space: anchor,
      buildings,
      projectNames: await projectNamesFor(anchor, buildings),
      noProjectGroup,
      locale: currentLanguage,
    });
  }, [buildingId, projectId, noProjectGroup, currentLanguage]);

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
