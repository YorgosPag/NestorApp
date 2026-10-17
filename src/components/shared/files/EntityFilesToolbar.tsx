/**
 * =============================================================================
 * EntityFilesToolbar — Toolbar for file management (tabs, search, views, actions)
 * =============================================================================
 *
 * Presentational component for the EntityFilesManager toolbar.
 * Contains: Files/Archive/Trash tabs, search, view mode, AddCaptureMenu, refresh, fullscreen.
 *
 * 🔑 **ΔΥΟ γραμμές στο κινητό** (ADR-912 §12.14 — στιγμιότυπο Giorgio 2026-10-17: 11 χειριστήρια σε 4 γραμμές, ~230px
 *   πριν από το πρώτο αρχείο). Drive / Dropbox mobile: [Αρχεία | Αρχειοθήκη | Κάδος] · [αναζήτηση ⊞].
 *   - Ο τίτλος «Αρχεία (n)» φεύγει: η καρτέλα της σελίδας και η υπο-καρτέλα λένε ήδη «Αρχεία», και ο χώρος φαίνεται
 *     στο κέλυφος. Το πλήθος μένει, μέσα στην υπο-καρτέλα.
 *   - Η πλήρης οθόνη φεύγει (ADR-241: στο κινητό η επιφάνεια είναι ήδη πλήρης). Η ανανέωση φεύγει **μόνο** όταν η λίστα
 *     είναι ζωντανή — αλλιώς είναι ο μόνος τρόπος να δεις νέο αρχείο.
 *   - Το «+ Προσθήκη Αρχείων» πάει στην κάτω μπάρα της σελίδας εγγραφής (`RecordActionLead`), όπου υπάρχει.
 *   Σε υπολογιστή ΟΛΑ μένουν. Η ορατότητα είναι CSS (`md:` = `MOBILE_BREAKPOINT`), σωστή από το πρώτο καρέ.
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/EntityFilesToolbar
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { FileText, RefreshCw, Maximize2, Minimize2, Trash2, Archive } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { NESTED_IN_DETAILS_FLUSH_SECTION } from '@/core/containers/DetailsContainer';
import { RecordActionLead } from '@/core/layouts/record-action-bar';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRetiredKind } from '@/lib/firestore/retired-record-context';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FileCategory } from '@/config/domain-constants';
import type { CaptureMetadata } from '@/config/upload-entry-points';
import { AddCaptureMenu } from './AddCaptureMenu';
import { FilesViewModeControl, type FilesTreeViewMode, type FilesViewMode } from './FilesViewModeControl';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityFilesToolbarProps {
  activeTab: 'files' | 'archived' | 'trash';
  onTabChange: (tab: 'files' | 'archived' | 'trash') => void;
  viewMode: FilesViewMode;
  onViewModeChange: (mode: FilesViewMode) => void;
  treeViewMode: FilesTreeViewMode;
  onTreeViewModeChange: (mode: FilesTreeViewMode) => void;
  displayStyle: 'standard' | 'media-gallery' | 'floorplan-gallery';
  category: FileCategory;
  /**
   * «Ανέβασμα αρχείου» **ανοίγει** τη ζώνη — ποτέ εναλλαγή (ADR-866 §2.10.8 Π4): ήταν `!showUploadZone`, οπότε η ίδια
   * εντολή μενού έκλεινε σιωπηλά μια ήδη ανοιχτή ζώνη. Το κλείσιμο ανήκει στο ✕ της ζώνης.
   */
  onOpenUploadZone: () => void;
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  uploading: boolean;
  loading: boolean;
  onRefresh: () => void;
  fullscreen: { isFullscreen: boolean; toggle: () => void };
  fileCount: number;
  /** Η λίστα ενημερώνεται μόνη της (`fileListIsLive`) ⇒ στο κινητό η ανανέωση δεν χρειάζεται. */
  liveList: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  /**
   * Δείξε «Ανήκει σε: <χώρος>» — **μόνο** για εταιρική θεματοφυλακή (ADR-866 Φ1.2, §2.9.3 Κ2).
   * ⚠️ Σημαία και όχι έτοιμο όνομα: το όνομα το διαβάζει το {@link ActiveWorkspaceLabel}, ώστε το `useWorkspace`
   * (που **πετά** έξω από `WorkspaceProvider`, δηλαδή σε κάθε κόσμο πλην του `(app)`) να **μην** καλείται ποτέ
   * για προσωπικά αρχεία.
   */
  showWorkspace: boolean;
}

/**
 * «Ανήκει σε: <χώρος>» — ο **μόνος** αναγνώστης του `WorkspaceContext` στο δέντρο αρχείων.
 *
 * 🔴 Ζούσε ως `useWorkspace()` στο σώμα του `EntityFilesManager` ⇒ ο διαχειριστής αρχείων **έπεφτε** σε κάθε
 * σελίδα χωρίς `WorkspaceProvider` — δηλαδή σε **όλο** τον προσωπικό χώρο `(me)`. Απομονωμένος εδώ, καλείται
 * μόνο όταν η θεματοφυλακή είναι εταιρική (που ζει πάντα μέσα στο `(app)`).
 */
function ActiveWorkspaceLabel(): React.ReactElement | null {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const { activeWorkspace } = useWorkspace();
  if (!activeWorkspace?.displayName) return null;
  return (
    <div className={cn("flex items-center gap-2 text-xs", colors.text.muted)}>
      <span>{t('manager.belongsTo')}:</span>
      <span className="font-medium text-foreground">{activeWorkspace.displayName}</span>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

type FilesTab = EntityFilesToolbarProps['activeTab'];

/** Αρχεία | Αρχειοθήκη | Κάδος — ΜΙΑ γραμμή, ίσες στήλες (Procore/BIM360 · ADR-912 §12.13). */
function FilesTabSwitcher({ activeTab, onTabChange, fileCount }: Pick<EntityFilesToolbarProps, 'activeTab' | 'onTabChange' | 'fileCount'>) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const fileTabs: ReadonlyArray<{ id: FilesTab; icon: typeof FileText; label: string }> = [
    { id: 'files', icon: FileText, label: t('manager.filesTitle') },
    { id: 'archived', icon: Archive, label: t('archived.title') },
    { id: 'trash', icon: Trash2, label: t('trash.tabLabel') },
  ];
  return (
    // Στο κινητό πιάνει όλο το πλάτος· από `sm` γυρίζει στο φυσικό του. `flex-auto`, ΟΧΙ τρεις ίσες στήλες: το ίσο
    // μοίρασμα έκοβε «Αρχεία 48» και «Αρχειοθήκη» ενώ στο «Κάδος» περίσσευε χώρος (στιγμιότυπο 2026-10-17, 390px).
    <div className="flex w-full gap-1 rounded-md border p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label={t('manager.filesTitle')}>
      {fileTabs.map(({ id, icon: Icon, label }) => (
        <ToggleButton
          key={id}
          pressed={activeTab === id}
          variant="ghost"
          semantics="selected"
          size="sm"
          onClick={() => onTabChange(id)}
          role="tab"
          aria-controls={`${id}-panel`}
          className="min-w-0 flex-auto justify-center px-2"
        >
          {/* Στο κινητό η ετικέτα λέει ήδη τα πάντα· το εικονίδιο θα της έπαιρνε τον χώρο (Drive: κείμενο μόνο). */}
          <Icon className={`${iconSizes.sm} mr-1 shrink-0 max-md:hidden`} aria-hidden="true" />
          <span className="truncate">{label}</span>
          {/* Το πλήθος του τίτλου που στο κινητό κρύβεται — εδώ, στη θέση που μένει. */}
          {id === 'files' && fileCount > 0 && (
            <span className={cn('ml-1 shrink-0 text-xs md:hidden', colors.text.muted)}>{fileCount}</span>
          )}
        </ToggleButton>
      ))}
    </div>
  );
}

/** Εικονίδιο-κουμπί με tooltip — ανανέωση, πλήρης οθόνη. */
function ToolbarIconButton({ label, tooltip, className, children, ...button }: React.ComponentProps<typeof Button> & {
  readonly label: string;
  readonly tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label} className={cn('shrink-0', className)} {...button}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Γραμμή 2: αναζήτηση σε όλο το διαθέσιμο πλάτος + τα εργαλεία της λίστας. */
function FilesToolRow(props: EntityFilesToolbarProps) {
  const { fullscreen } = props;
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['files', 'files-media']);
  // Αποσυρμένη μητρική εγγραφή (ADR-329 §3.9): ούτε ανέβασμα ούτε λήψη από κάμερα — το μενού δεν ζωγραφίζεται.
  const canAdd = useRetiredKind() === null;
  const onFiles = props.activeTab === 'files';
  return (
    <div className="flex items-center gap-2">
      {/* File Search (Google Drive/Dropbox/OneDrive pattern) */}
      {onFiles && props.fileCount > 0 && (
        <search className="min-w-0 flex-1 sm:max-w-md">
          <SearchInput
            value={props.searchTerm}
            onChange={props.onSearchTermChange}
            placeholder={t('search.placeholder')}
            debounceMs={300}
            showClearButton
          />
        </search>
      )}
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        {onFiles && (
          <FilesViewModeControl
            viewMode={props.viewMode}
            onViewModeChange={props.onViewModeChange}
            treeViewMode={props.treeViewMode}
            onTreeViewModeChange={props.onTreeViewModeChange}
            displayStyle={props.displayStyle}
          />
        )}
        {onFiles && canAdd && (
          <RecordActionLead>
            <AddCaptureMenu
              category={props.category}
              onUploadClick={props.onOpenUploadZone}
              onCapture={props.onCapture}
              disabled={props.uploading}
              loading={props.uploading}
            />
          </RecordActionLead>
        )}
        {onFiles && (
          <ToolbarIconButton
            label={t('manager.refresh')}
            tooltip={t('manager.refreshTooltip')}
            onClick={props.onRefresh}
            disabled={props.loading || props.uploading}
            className={cn(props.liveList && 'max-md:hidden')}
          >
            <RefreshCw className={cn(iconSizes.sm, props.loading && 'animate-spin')} aria-hidden="true" />
          </ToolbarIconButton>
        )}
        {/* Πλήρης οθόνη (ADR-241) — στο κινητό η επιφάνεια είναι ήδη πλήρης. */}
        <ToolbarIconButton
          label={fullscreen.isFullscreen ? t('manager.exitFullscreen') : t('manager.fullscreen')}
          tooltip={fullscreen.isFullscreen ? t('manager.exitFullscreenTooltip') : t('manager.fullscreenTooltip')}
          onClick={fullscreen.toggle}
          aria-pressed={fullscreen.isFullscreen}
          className="max-md:hidden"
        >
          {fullscreen.isFullscreen
            ? <Minimize2 className={iconSizes.sm} aria-hidden="true" />
            : <Maximize2 className={iconSizes.sm} aria-hidden="true" />}
        </ToolbarIconButton>
      </div>
    </div>
  );
}

export function EntityFilesToolbar(props: EntityFilesToolbarProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  return (
    <CardHeader className={NESTED_IN_DETAILS_FLUSH_SECTION}>
      <nav className="flex flex-col gap-2" role="toolbar" aria-label={t('manager.fileManagementTools')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1 max-md:hidden">
            <CardTitle className="flex items-center gap-2">
              <FileText className={iconSizes.md} aria-hidden="true" />
              {t('manager.filesTitle')}
              {props.fileCount > 0 && (
                <span className={cn("text-sm font-normal", colors.text.muted)}>
                  ({props.fileCount})
                </span>
              )}
            </CardTitle>

            {props.showWorkspace && <ActiveWorkspaceLabel />}
          </div>

          <FilesTabSwitcher activeTab={props.activeTab} onTabChange={props.onTabChange} fileCount={props.fileCount} />
        </div>

        <FilesToolRow {...props} />
      </nav>
    </CardHeader>
  );
}
