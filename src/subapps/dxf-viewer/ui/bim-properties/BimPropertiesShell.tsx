'use client';

/**
 * ADR-366 / ADR-363 — BimPropertiesShell.
 *
 * ΕΝΑ Properties palette (Revit-grade): το «Ιδιότητες» tab του αριστερού floating
 * panel δείχνει ΚΟΙΝΕΣ υπο-καρτέλες για όλα τα BIM types, αντικαθιστώντας το
 * καταργημένο δεξί `BimEntityCardPanel` του 3D viewport (μηδέν δεύτερο panel στον
 * καμβά — Revit model: μία επιλογή, ένα palette).
 *
 *  • Παράμετροι → BimPropertiesRouter (per-type: Wall/Column/Stair)   — ΥΠΑΡΧΟΝ
 *  • ΒΚΕ        → BimBoqTab        (reuse)
 *  • Σχόλια     → BimCommentsTab   (reuse)
 *  • Ιστορικό   → BimAuditTab      (reuse)
 *
 * Οι υπο-καρτέλες εμφανίζονται ΜΟΝΟ όταν είναι επιλεγμένο BIM entity· αλλιώς
 * γίνεται render του router (legacy/empty state) χωρίς sub-tabs.
 *
 * Pure derivation από το reactive `currentScene` (ADR-040 micro-leaf — καμία
 * επιπλέον subscription). bimType/bimId SSoT = `scene.entity`. companyId/projectId
 * με το ίδιο pattern που χρησιμοποιούσε το card (useAuth + ProjectHierarchy).
 * Per-type last-active-sub-tab persistence: reuse `last-active-tab-tracker`.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { isBimEntity } from '../../types/entities';
import { useResolvedSelectedEntity } from '../../hooks/selection/useResolvedSelectedEntity';
import { BimPropertiesRouter } from '../wall-advanced-panel/BimPropertiesRouter';
import { BimBoqTab } from '../../bim-3d/properties/tabs/BimBoqTab';
import { BimCommentsTab } from '../../bim-3d/properties/tabs/BimCommentsTab';
import { BimAuditTab } from '../../bim-3d/properties/tabs/BimAuditTab';
import {
  getLastActiveTab,
  setLastActiveTab,
} from '../../bim-3d/properties/tabs/last-active-tab-tracker';
import type { SceneModel } from '../../types/scene';

export interface BimPropertiesShellProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /**
   * ADR-363 — ενεργό εργαλείο σχεδίασης. Προωθείται στον `BimPropertiesRouter`
   * για το draft property panel του τοίχου (εργαλείο ενεργό, καμία επιλογή).
   */
  readonly activeTool?: string;
}

const SUB_TABS = ['parameters', 'boq', 'comments', 'audit'] as const;
type SubTab = (typeof SUB_TABS)[number];

function isSubTab(value: string): value is SubTab {
  return (SUB_TABS as readonly string[]).includes(value);
}

export function BimPropertiesShell(
  props: BimPropertiesShellProps,
): React.ReactElement {
  const { primarySelectedId, currentScene } = props;
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  const hierarchy = useProjectHierarchyOptional();
  const companyId = user?.companyId ?? '';
  const projectId = props.projectId ?? hierarchy?.selectedProject?.id ?? '';

  // ADR-484 — κοινός SSoT resolver (active scene + cross-level foundation fallback)
  // ώστε ένα cross-level πέδιλο να ανοίγει τις υπο-καρτέλες (Παράμετροι/ΒΚΕ/…).
  const selected = useResolvedSelectedEntity(primarySelectedId, currentScene);

  const bimType = selected && isBimEntity(selected) ? selected.type : null;

  const [activeTab, setActiveTab] = React.useState<SubTab>('parameters');

  React.useEffect(() => {
    if (!bimType) return;
    const stored = getLastActiveTab(bimType);
    setActiveTab(isSubTab(stored) ? stored : 'parameters');
  }, [bimType]);

  const handleTabChange = React.useCallback(
    (value: string) => {
      if (!isSubTab(value)) return;
      setActiveTab(value);
      if (bimType) setLastActiveTab(bimType, value);
    },
    [bimType],
  );

  // Χωρίς επιλεγμένο BIM entity → ο router χειρίζεται empty/legacy state.
  if (!selected || !bimType) {
    return <BimPropertiesRouter {...props} />;
  }

  return (
    <section aria-label={t('bimProperties.title')}>
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col"
      >
        <TabsList className="grid h-8 grid-cols-4">
          <TabsTrigger value="parameters" className="px-1 text-xs">
            {t('bimProperties.subtabs.parameters')}
          </TabsTrigger>
          <TabsTrigger value="boq" className="px-1 text-xs">
            {t('bimProperties.subtabs.boq')}
          </TabsTrigger>
          <TabsTrigger value="comments" className="px-1 text-xs">
            {t('bimProperties.subtabs.comments')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="px-1 text-xs">
            {t('bimProperties.subtabs.audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parameters">
          <BimPropertiesRouter {...props} />
        </TabsContent>

        <TabsContent value="boq">
          <BimBoqTab
            bimId={selected.id}
            companyId={companyId}
            projectId={projectId}
          />
        </TabsContent>

        <TabsContent value="comments">
          <BimCommentsTab bimId={selected.id} />
        </TabsContent>

        <TabsContent value="audit">
          <BimAuditTab bimId={selected.id} bimType={bimType} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
