/**
 * FloorsTabContent — IFC-Compliant Floor Management Tab
 *
 * Displays, creates, edits and deletes building floors (IfcBuildingStorey).
 *
 * @module components/building-management/tabs/FloorsTabContent
 * @see ADR-180 (IFC Floor Management System)
 */

'use client';

import { Fragment, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Map, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FloorFloorplanInline } from './FloorFloorplanInline';
import type { Building } from '@/types/building/contracts';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getStatusColor } from '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted state hook
import { useFloorsTabState } from './useFloorsTabState';
import { FloorInlineCreateForm } from './FloorInlineCreateForm';

// Re-export for backward compatibility
export type { FloorRecord } from './useFloorsTabState';

interface FloorsTabContentProps {
  building: Building;
}

const COLUMN_COUNT = 7;

export function FloorsTabContent({ building }: FloorsTabContentProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const colors = useSemanticColors();

  const {
    floors, loading, error, expandedFloorId, toggleFloorExpand,
    showCreateForm, setShowCreateForm,
    editingId, editNumber, handleEditNumberChange, editName, handleEditNameChange,
    editElevation, handleEditElevationChange, editHeight, handleEditHeightChange, saving,
    editNameMismatch,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    floorGaps,
    dialogProps, BlockedDialog,
  } = useFloorsTabState(building.id, building.projectId);

  const existingFloorNumbers = useMemo(
    () => new Set(floors.map((f) => f.number)) as ReadonlySet<number>,
    [floors]
  );

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
        <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)} disabled={showCreateForm}>
          <Plus className="mr-1 h-4 w-4" />{t('tabs.floors.addFloor')}
        </Button>
      </header>

      {showCreateForm && (
        <FloorInlineCreateForm
          buildingId={building.id}
          projectId={building.projectId}
          existingFloorNumbers={existingFloorNumbers}
          existingFloors={floors}
          onCreated={() => {
            setShowCreateForm(false);
            void fetchFloors();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {floors.length === 0 ? (
        <p className={cn("py-2 text-center text-sm", colors.text.muted)}>{t('tabs.floors.empty')}</p>
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
              {floors.map((floor) => {
                const isExpanded = expandedFloorId === floor.id;
                const isEditing = editingId === floor.id;

                return (
                  <Fragment key={floor.id}>
                    <tr className={`border-b border-border/50 hover:bg-muted/20 ${isExpanded ? 'bg-muted/10' : ''}`}>
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
                          <td className="px-2 py-2"><Input type="number" step="0.01" min="0.1" value={editHeight} onChange={(e) => handleEditHeightChange(e.target.value)} placeholder="3.00" className="h-8 w-20" disabled={saving} /></td>
                          <td className={cn("px-2 py-2 text-center", colors.text.muted)}>{floor.units ?? 0}</td>
                          <td className="px-2 py-2">
                            <nav className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                                {saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />} {/* eslint-disable-line design-system/enforce-semantic-colors */}
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
                              {!floor.hasFloorplan && (
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help" aria-label={t('tabs.floors.noFloorplan')}>
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" /> {/* eslint-disable-line design-system/enforce-semantic-colors */}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{t('tabs.floors.noFloorplan')}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </td>
                          <td className={cn("px-2 py-2 font-mono text-xs", colors.text.muted)}>{formatElevation(floor.elevation)}</td>
                          <td className={cn("px-2 py-2 font-mono text-xs", colors.text.muted)}>{floor.height != null ? `${floor.height.toFixed(2)} m` : '—'}</td>
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
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(floor)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(floor)} disabled={deletingId === floor.id}>
                                {deletingId === floor.id ? <Spinner size="small" color="inherit" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </nav>
                          </td>
                        </>
                      )}
                    </tr>

                    {isExpanded && (
                      <tr className="bg-muted/5">
                        <td colSpan={COLUMN_COUNT} className="px-2 py-2">
                          <FloorFloorplanInline floorId={floor.id} floorName={floor.name} projectId={building.projectId} buildingCompanyId={building.companyId} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {floorGaps.length > 0 && (
            <p className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs", getStatusColor('warning', 'border'), getStatusColor('warning', 'text'))}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t('tabs.floors.gapWarning', { levels: floorGaps.join(', ') })}
            </p>
          )}
          <footer className={cn("text-xs", colors.text.muted)}>{t('tabs.floors.total', { count: floors.length })}</footer>
        </>
      )}
    </section>
  );
}
