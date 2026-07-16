'use client';

/**
 * @fileoverview Sales Space Sidebar — SSoT for auxiliary-space sales sidebars
 * @description List + Details sidebar shared by the parking and storage sales
 *              pages. Owns the layout, tab scaffold and mobile slide-in; each
 *              space supplies its own icon, cards, filters and detail panel.
 * @pattern Enterprise SSoT — presentation shell, space-agnostic
 * @enterprise ADR-199 - Storage & Parking as sale appurtenances
 * @enterprise ADR-584 - jscpd clone ratchet (de-duplication of sales sidebars)
 *
 * i18n: this shell resolves NO keys itself — callers pass already-translated
 * strings. That keeps every `t()` call a literal at the call site, so the i18n
 * key checks (3.8 / 3.13) can still see them.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock, DollarSign, ExternalLink } from 'lucide-react';
import { EntityListColumn, DetailsContainer } from '@/core/containers';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { EntityDetailsHeader } from '@/core/entity-headers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import { useIsMobile } from '@/hooks/useMobile';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// 🏢 TYPES
// =============================================================================

/**
 * i18n namespaces the auxiliary-space sales sidebars load. Shared so the parking
 * and storage sidebars restate ONE list instead of the same 10-namespace array
 * each (CHECK 3.28). Every `t()` call stays a literal at its call-site, so the
 * i18n key checks (3.8 / 3.13) still resolve them — only the namespace list moved.
 */
export const SALES_SPACE_SIDEBAR_NAMESPACES = [
  'common',
  'common-account',
  'common-actions',
  'common-empty-states',
  'common-navigation',
  'common-photos',
  'common-sales',
  'common-shared',
  'common-status',
  'common-validation',
] as const;

/** Sentinel id passed to `onSelectItem` to clear the selection. */
const CLEAR_SELECTION_ID = '__none__';

/** The always-present info tab renders the space's detail panel. */
const INFO_TAB_ID = 'info';
/** The always-present history tab renders the audit trail. */
const HISTORY_TAB_ID = 'history';

/**
 * A tab that does not render content inline but points the user at the full
 * space management page (documents, photos, videos, floor plans live there).
 */
export interface SalesSpaceRedirectTab {
  id: string;
  icon: LucideIcon;
  /** Already translated. */
  label: string;
  /** Already translated — explains where the content lives. */
  hint: string;
}

/** Every string this shell renders. All already translated by the caller. */
export interface SalesSpaceSidebarLabels {
  listLabel: string;
  listTitle: string;
  noResults: string;
  detailsTitle: string;
  openInSpaces: string;
  infoTab: string;
  historyTab: string;
}

export interface SalesSpaceSidebarProps<TItem extends { id: string }> {
  items: TItem[];
  selectedItem: TItem | null;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;

  /** Space icon — shown in the list header and the details header. */
  icon: LucideIcon;
  labels: SalesSpaceSidebarLabels;
  /** Tabs between "info" and "history", in display order. */
  redirectTabs: readonly SalesSpaceRedirectTab[];
  /** Entity type for the audit trail, e.g. 'parking' | 'storage'. */
  entityType: string;

  /** Destination of the "open in spaces" button for a given item. */
  spacesHref: (item: TItem) => string;
  getTitle: (item: TItem) => string;
  getSubtitle: (item: TItem) => string | undefined;
  renderDetailPanel: (item: TItem) => React.ReactNode;
  renderCard: (item: TItem, isSelected: boolean) => React.ReactNode;
  /** Space-specific quick filter controls, already wired by the caller. */
  quickFilters: React.ReactNode;
}

/** The details header exposes no per-item actions on the sales sidebars. */
const NO_ACTIONS: EntityHeaderAction[] = [];

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function SalesSpaceSidebar<TItem extends { id: string }>({
  items,
  selectedItem,
  selectedItemId,
  onSelectItem,
  icon: SpaceIcon,
  labels,
  redirectTabs,
  entityType,
  spacesHref,
  getTitle,
  getSubtitle,
  renderDetailPanel,
  renderCard,
  quickFilters,
}: SalesSpaceSidebarProps<TItem>) {
  const colors = useSemanticColors();
  const isMobile = useIsMobile();
  const iconSizes = useIconSizes();

  const detailsContent = selectedItem ? (
    <DetailsContainer
      selectedItem={selectedItem}
      header={
        <EntityDetailsHeader
          icon={SpaceIcon}
          title={getTitle(selectedItem)}
          subtitle={getSubtitle(selectedItem)}
          variant="detailed"
          actions={NO_ACTIONS}
        />
      }
      tabsRenderer={
        <Tabs defaultValue={INFO_TAB_ID} className="flex flex-col">
          <TabsList className="flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0">
            <TabsTrigger
              value={INFO_TAB_ID}
              className="flex items-center gap-1 text-xs font-medium"
            >
              <DollarSign className={iconSizes.sm} />
              <span className="hidden sm:inline">{labels.infoTab}</span>
            </TabsTrigger>

            {redirectTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1 text-xs font-medium"
              >
                <tab.icon className={iconSizes.sm} />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}

            <TabsTrigger
              value={HISTORY_TAB_ID}
              className="flex items-center gap-1 text-xs font-medium"
            >
              <Clock className={iconSizes.sm} />
              <span className="hidden sm:inline">{labels.historyTab}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={INFO_TAB_ID} className="flex-1">
            {renderDetailPanel(selectedItem)}
          </TabsContent>

          {redirectTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="flex-1">
              <section className="p-4">
                <p className={cn('text-sm text-center mb-3', colors.text.muted)}>
                  {tab.hint}
                </p>
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center gap-2 text-sm"
                    onClick={() => {
                      window.location.href = spacesHref(selectedItem);
                    }}
                  >
                    <ExternalLink className={iconSizes.sm} />
                    {labels.openInSpaces}
                  </Button>
                </div>
              </section>
            </TabsContent>
          ))}

          <TabsContent value={HISTORY_TAB_ID} className="flex-1">
            <ActivityTab entityType={entityType} entityId={selectedItem.id} />
          </TabsContent>
        </Tabs>
      }
    />
  ) : null;

  const listColumn = (
    <EntityListColumn aria-label={labels.listLabel}>
      <GenericListHeader
        icon={SpaceIcon}
        entityName={labels.listTitle}
        itemCount={items.length}
      />

      {quickFilters}

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-1 sm:p-2">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {renderCard(item, item.id === selectedItemId)}
            </React.Fragment>
          ))}

          {items.length === 0 && (
            <div className={cn('p-6 text-center text-sm', colors.text.muted)}>
              {labels.noResults}
            </div>
          )}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );

  return (
    <>
      {listColumn}
      {!isMobile && detailsContent}

      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedItem}
        onClose={() => onSelectItem(CLEAR_SELECTION_ID)}
        title={selectedItem ? getTitle(selectedItem) : labels.detailsTitle}
      >
        {isMobile && selectedItem && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
