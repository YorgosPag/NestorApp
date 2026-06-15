/**
 * FloorsTabContent — IFC-Compliant Floor Management Tab
 *
 * Displays, creates, edits and deletes building floors (IfcBuildingStorey).
 *
 * @module components/building-management/tabs/FloorsTabContent
 * @see ADR-180 (IFC Floor Management System)
 */

'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Map, AlertTriangle, Footprints, Building2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FloorFloorplanInline } from './FloorFloorplanInline';
import type { Building } from '@/types/building/contracts';
import type { StairDoc } from '@/subapps/dxf-viewer/bim/types/stair-types';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getStatusColor } from '@/lib/design-system';
import { countBuildingStoreys, isBuildingStorey } from '@/utils/floor-naming';

// 🏢 ENTERPRISE: Extracted state hook
import { useFloorsTabState } from './useFloorsTabState';
import { FloorInlineCreateForm } from './FloorInlineCreateForm';
import { BuildingVerticalSetupForm } from './BuildingVerticalSetupForm';

// Re-export for backward compatibility
export type { FloorRecord } from './useFloorsTabState';

// ============================================================================
// FLOOR STAIRS LIST (ADR-358 Phase 9C-3)
// ============================================================================

interface FloorStairsListProps {
  stairs: StairDoc[];
  loading: boolean;
}

function FloorStairsList({ stairs, loading }: FloorStairsListProps) {
  const { t } = useTranslation(['building-tabs']);

  // Hide entirely when no data to show
  if (!loading && stairs.length === 0) return null;

  if (loading) {
    return (
      <section className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner size="small" />
      </section>
    );
  }

  return (
    <section className="mt-2 pt-2 border-t border-border/30">
      <header className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        <Footprints className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('tabs.floors.stairs')}
      </header>
      {stairs.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-5">{t('tabs.floors.stairsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-0.5 pl-1">
          {stairs.map((stair) => {
            const isLinked = stair.params.multiStoryConfig?.linkedToFloor === true;
            const isCustom =
              stair.params.multiStoryConfig !== undefined && !isLinked;
            return (
              <li key={stair.id} className="flex items-center gap-2 text-xs py-0.5 px-1 rounded hover:bg-muted/20">
                <Footprints className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t(`tabs.floors.stairKind.${stair.kind}`)}</span>
                {isLinked && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--bg-info)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-info))]">
                    🔗 {t('tabs.floors.stairLinked')}
                  </span>
                )}
                {isCustom && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--bg-warning)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-warning))]">
                    ⚠️ {t('tabs.floors.stairCustom')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface FloorsTabContentProps {
  building: Building;
  /** BUG #5 deep-link — floor id to scroll into view and highlight on open. */
  focusFloorId?: string | null;
}

const COLUMN_COUNT = 7;

export function FloorsTabContent({ building, focusFloorId }: FloorsTabContentProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const {
    floors, loading, error, expandedFloorId, toggleFloorExpand,
    registerFloorRowRef, highlightedFloorId,
    showCreateForm, setShowCreateForm,
    editingId, editNumber, handleEditNumberChange, editName, handleEditNameChange,
    editElevation, handleEditElevationChange, editHeight, handleEditHeightChange, saving,
    editNameMismatch,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    continuityWarnings, heightDerivedFloorIds,
    expandedFloorStairs, loadingStairs,
    dialogProps, BlockedDialog,
  } = useFloorsTabState(building.id, building.projectId, focusFloorId);

  const existingFloorNumbers = useMemo(
    () => new Set(floors.map((f) => f.number)) as ReadonlySet<number>,
    [floors]
  );

  // ADR-461 — the manual create form reasons over COUNTED storeys only: a basement
  // may take −1 even when a foundation special occupies −1, and the elevation
  // suggestion must not anchor on a special level. The server satellite reconcile
  // then keeps the foundation always below / the penthouse always above.
  const countedFloors = useMemo(
    () => floors.filter((f) => f.kind === undefined || isBuildingStorey(f.kind)),
    [floors]
  );
  const countedFloorNumbers = useMemo(
    () => new Set(countedFloors.map((f) => f.number)) as ReadonlySet<number>,
    [countedFloors]
  );

  // ADR-451 — Quick Setup (Revit-grade building vertical setup) toggle.
  const [showQuickSetup, setShowQuickSetup] = useState(false);

  if (loading) {
    return (
      <section className="flex items-center justify-center py-2">
        <Spinner size="large" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center gap-2 py-2">
        <p className="text-sm text-destructive">{error}</p>
        {/* eslint-disable-next-line custom/no-hardcoded-strings */}
        <Button variant="outline" size="sm" onClick={fetchFloors}>Retry</Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 p-2">
      <ConfirmDialog {...dialogProps} />
      {BlockedDialog}

      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-primary" />
          {t('tabs.floors.title')}
        </h2>
        <nav className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setShowQuickSetup((v) => !v)} disabled={showCreateForm}>
            <Building2 className="mr-1 h-4 w-4" />{t('tabs.floors.quickSetup.cta')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)} disabled={showCreateForm || showQuickSetup}>
            <Plus className="mr-1 h-4 w-4" />{t('tabs.floors.addFloor')}
          </Button>
        </nav>
      </header>

      {showQuickSetup && (
        <BuildingVerticalSetupForm
          buildingId={building.id}
          projectId={building.projectId}
          existingFloorNumbers={existingFloorNumbers}
          onComplete={() => {
            setShowQuickSetup(false);
            void fetchFloors();
          }}
          onCancel={() => setShowQuickSetup(false)}
        />
      )}

      {showCreateForm && (
        <FloorInlineCreateForm
          buildingId={building.id}
          projectId={building.projectId}
          existingFloorNumbers={countedFloorNumbers}
          existingFloors={countedFloors}
          onCreated={() => {
            setShowCreateForm(false);
            void fetchFloors();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {floors.length === 0 && !showCreateForm ? (
        <section className="text-center py-2 border-2 border-dashed rounded-lg">
          <AlertTriangle className={`${iconSizes.xl} mx-auto mb-2 text-[hsl(var(--text-warning))]`} />
          <h3 className="text-lg font-semibold mb-2">{t('tabs.floors.empty')}</h3>
          <p className={cn('text-sm mb-3', colors.text.muted)}>{t('tabs.floors.emptyHint')}</p>
          <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('tabs.floors.addFloor')}
          </Button>
        </section>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b border-border text-left text-xs font-medium uppercase", colors.text.muted)}>
                <th className="w-10 px-2 py-2" />
                <th className="w-20 px-2 py-2">{t('tabs.floors.number')}</th>
                <th className="px-2 py-2">{t('tabs.floors.name')}</th>
                <th className="w-32 px-2 py-2">{t('tabs.floors.elevation')}</th>
                <th className="w-24 px-2 py-2">{t('tabs.floors.height')}</th>
                <th className="w-20 px-2 py-2 text-center">{t('tabs.floors.units')}</th>
                <th className="w-32 px-2 py-2 text-right">{t('tabs.floors.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((floor, index) => {
                const isExpanded = expandedFloorId === floor.id;
                const isEditing = editingId === floor.id;
                const isHighlighted = highlightedFloorId === floor.id;
                // ADR-451 / ADR-461 — elevation is the SSoT; height is DERIVED
                // (read-only, = gap to the floor above) for every intermediate
                // counted storey. The top counted storey AND special levels
                // (foundation depth / penthouse height) keep an EXPLICIT, editable
                // height, so the table never shows a stale or wrong-source height.
                const isHeightDerived = heightDerivedFloorIds.has(floor.id);
                const nextFloor = floors[index + 1];
                const derivedHeight =
                  nextFloor && floor.elevation != null && nextFloor.elevation != null
                    ? nextFloor.elevation - floor.elevation
                    : floor.height ?? null;
                const displayHeight = isHeightDerived ? derivedHeight : (floor.height ?? null);

                return (
                  <Fragment key={floor.id}>
                    <tr
                      ref={(el) => registerFloorRowRef(floor.id, el)}
                      className={cn(
                        'border-b border-border/50 transition-colors duration-700',
                        isHighlighted
                          ? 'bg-[hsl(var(--bg-info)/0.18)]'
                          : isExpanded
                            ? 'bg-muted/10'
                            : 'hover:bg-muted/20',
                      )}
                    >
                      <td className="px-2 py-2">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFloorExpand(floor.id)}>
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-primary" />
                                  : <ChevronRight className="h-4 w-4 text-primary/70" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {isExpanded ? t('tabs.floors.collapseFloor') : t('tabs.floors.expandFloor')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-2 py-2"><Input type="number" value={editNumber} onChange={(e) => handleEditNumberChange(e.target.value)} className="h-8 w-16" disabled={saving} /></td>
                          <td className="px-2 py-2">
                            <Input value={editName} onChange={(e) => handleEditNameChange(e.target.value)} className={cn("h-8", editNameMismatch && getStatusColor('warning', 'border'))} disabled={saving} />
                            {editNameMismatch && (
                              <p className={cn("mt-0.5 flex items-center gap-1 text-[10px]", getStatusColor('warning', 'text'))}>
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {t('tabs.floors.mismatchWarning')}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2"><Input type="number" step="0.01" value={editElevation} onChange={(e) => handleEditElevationChange(e.target.value)} placeholder="—" className="h-8 w-24" disabled={saving} /></td>
                          <td className="px-2 py-2">
                            {!isHeightDerived ? (
                              <Input type="number" step="0.01" min="0.1" value={editHeight} onChange={(e) => handleEditHeightChange(e.target.value)} placeholder="3.00" className="h-8 w-20" disabled={saving} />
                            ) : (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Input type="number" step="0.01" value={derivedHeight != null ? derivedHeight.toFixed(2) : ''} readOnly tabIndex={-1} aria-label={t('tabs.floors.derivedHeightHint')} className={cn("h-8 w-20 cursor-help bg-muted/30", colors.text.muted)} />
                                  </TooltipTrigger>
                                  <TooltipContent>{t('tabs.floors.derivedHeightHint')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </td>
                          <td className={cn("px-2 py-2 text-center", colors.text.muted)}>{floor.units ?? 0}</td>
                          <td className="px-2 py-2">
                            <nav className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                                {saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-[hsl(var(--text-success))]" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
                            </nav>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2 font-mono text-sm font-medium">{floor.number}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleFloorExpand(floor.id)}
                                className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                              >
                                {floor.name}
                              </button>
                              {floor.kind !== undefined && !isBuildingStorey(floor.kind) && (
                                <Badge variant="info" className="px-1.5 py-0.5 text-[10px] font-medium">
                                  {t('tabs.floors.specialLevel')}
                                </Badge>
                              )}
                              {!floor.hasFloorplan && (
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help" aria-label={t('tabs.floors.noFloorplan')}>
                                        <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--text-warning))] shrink-0" aria-hidden="true" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('tabs.floors.noFloorplan')}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </td>
                          <td className={cn("px-2 py-2 font-mono text-xs", colors.text.muted)}>{formatElevation(floor.elevation)}</td>
                          <td className={cn("px-2 py-2 font-mono text-xs", colors.text.muted)}>{displayHeight != null ? `${displayHeight.toFixed(2)} m` : '—'}</td>
                          <td className={cn("px-2 py-2 text-center", colors.text.muted)}>{floor.units ?? 0}</td>
                          <td className="px-2 py-2">
                            <nav className="flex justify-end gap-1">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={isExpanded ? "default" : "ghost"}
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => toggleFloorExpand(floor.id)}
                                    >
                                      <Map className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isExpanded ? t('tabs.floors.collapseFloor') : t('tabs.floors.uploadFloorplan')}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(floor)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('tabs.floors.editFloor')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(floor)} disabled={deletingId === floor.id}>
                                      {deletingId === floor.id ? <Spinner size="small" color="inherit" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('tabs.floors.deleteFloor')}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </nav>
                          </td>
                        </>
                      )}
                    </tr>

                    {isExpanded && (
                      <tr className="bg-muted/5">
                        <td colSpan={COLUMN_COUNT} className="px-2 py-2">
                          <FloorFloorplanInline floorId={floor.id} floorName={floor.name} projectId={building.projectId} buildingCompanyId={building.companyId} />
                          <FloorStairsList
                            stairs={expandedFloorStairs}
                            loading={loadingStairs}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {continuityWarnings.length > 0 && (
            <ul className="flex flex-col gap-1">
              {continuityWarnings.map((warning) => (
                <li key={warning} className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs", getStatusColor('warning', 'border'), getStatusColor('warning', 'text'))}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <footer className={cn("text-xs", colors.text.muted)}>{t('tabs.floors.total', { count: countBuildingStoreys(floors) })}</footer>
        </>
      )}
    </section>
  );
}
