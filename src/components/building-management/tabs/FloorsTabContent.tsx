/**
 * FloorsTabContent — IFC-Compliant Floor Management Tab
 *
 * Displays, creates, edits and deletes building floors (IfcBuildingStorey).
 *
 * @module components/building-management/tabs/FloorsTabContent
 * @see ADR-180 (IFC Floor Management System)
 */

'use client';

import { Fragment } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layers, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Map } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FloorFloorplanInline } from './FloorFloorplanInline';
import type { Building } from '@/types/building/contracts';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted state hook
import { useFloorsTabState } from './useFloorsTabState';

// Re-export for backward compatibility
export type { FloorRecord } from './useFloorsTabState';

interface FloorsTabContentProps {
  building: Building;
}

const COLUMN_COUNT = 6;

export function FloorsTabContent({ building }: FloorsTabContentProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  const {
    floors, loading, error, expandedFloorId, toggleFloorExpand,
    showCreateForm, setShowCreateForm,
    createNumber, setCreateNumber, createName, setCreateName,
    createElevation, setCreateElevation, creating, handleCreate,
    editingId, editNumber, setEditNumber, editName, setEditName,
    editElevation, setEditElevation, saving,
    startEdit, cancelEdit, handleSaveEdit,
    deletingId, handleDelete, fetchFloors, formatElevation,
    dialogProps, BlockedDialog,
  } = useFloorsTabState(building.id, building.projectId);

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
        <form
          className="grid grid-cols-[80px_1fr_120px_auto] items-end gap-2 rounded-lg border border-border bg-muted/30 p-2"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          <fieldset className="flex flex-col gap-1">
            <label className={cn("text-xs font-medium", colors.text.muted)}>{t('tabs.floors.number')}</label>
            <Input type="number" value={createNumber} onChange={(e) => setCreateNumber(e.target.value)} placeholder={t('tabs.floors.numberPlaceholder')} className="h-9" disabled={creating} />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className={cn("text-xs font-medium", colors.text.muted)}>{t('tabs.floors.name')}</label>
            <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t('tabs.floors.namePlaceholder')} className="h-9" disabled={creating} autoFocus />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className={cn("text-xs font-medium", colors.text.muted)}>{t('tabs.floors.elevation')}</label>
            <Input type="number" step="0.01" value={createElevation} onChange={(e) => setCreateElevation(e.target.value)} placeholder={t('tabs.floors.elevationPlaceholder')} className="h-9" disabled={creating} />
          </fieldset>
          <nav className="flex gap-1">
            <Button type="submit" size="sm" disabled={!createName.trim() || creating} className="h-9">
              {creating ? <Spinner size="small" color="inherit" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)} disabled={creating} className="h-9">
              <X className="h-4 w-4" />
            </Button>
          </nav>
        </form>
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
                <th className="w-20 px-2 py-2 text-center">{t('tabs.floors.units')}</th>
                <th className="w-24 px-2 py-2 text-right">{t('tabs.floors.actions')}</th>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFloorExpand(floor.id)} title={isExpanded ? t('tabs.floors.collapseFloor') : t('tabs.floors.expandFloor')}>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className={`h-4 w-4 ${colors.text.muted}`} />}
                        </Button>
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-2 py-2"><Input type="number" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} className="h-8 w-16" disabled={saving} /></td>
                          <td className="px-2 py-2"><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" disabled={saving} /></td>
                          <td className="px-2 py-2"><Input type="number" step="0.01" value={editElevation} onChange={(e) => setEditElevation(e.target.value)} placeholder="—" className="h-8 w-24" disabled={saving} /></td>
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
                            <span className="flex items-center gap-2">{floor.name}<Map className={`h-3.5 w-3.5 ${colors.text.muted} opacity-50`} aria-hidden="true" /></span>
                          </td>
                          <td className={cn("px-2 py-2 font-mono text-xs", colors.text.muted)}>{formatElevation(floor.elevation)}</td>
                          <td className={cn("px-2 py-2 text-center", colors.text.muted)}>{floor.units ?? 0}</td>
                          <td className="px-2 py-2">
                            <nav className="flex justify-end gap-1">
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
          <footer className={cn("text-xs", colors.text.muted)}>{t('tabs.floors.total', { count: floors.length })}</footer>
        </>
      )}
    </section>
  );
}
