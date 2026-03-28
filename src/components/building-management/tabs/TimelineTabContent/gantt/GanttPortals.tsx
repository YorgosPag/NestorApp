/**
 * GanttPortals — Portal-rendered UI for GanttView (ADR-034)
 *
 * Extracted from GanttView.tsx for SRP compliance (Google file-size standards).
 * Contains the context menu portal, hover tooltip portal, color picker dialog,
 * and legend badges section — all rendered via createPortal or Dialog.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import React from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil,
  FolderPlus,
  Plus,
  Palette,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { zIndex } from '@/styles/design-tokens';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { UnifiedColorPicker } from '@/subapps/dxf-viewer/ui/color';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { GanttContextMenuState, HoverTooltipData } from './gantt-view-config';

// ─── Context Menu Labels ──────────────────────────────────────────────────

interface ContextMenuLabels {
  editPhase: string;
  editTask: string;
  newPhase: string;
  newTask: string;
  changeColor: string;
  colorPickerTitle: string;
  delete: string;
}

// ─── Tooltip Labels ───────────────────────────────────────────────────────

interface TooltipLabels {
  start: string;
  end: string;
  duration: string;
  progress: string;
  days: string;
}

// ─── Context Menu Portal ──────────────────────────────────────────────────

interface GanttContextMenuPortalProps {
  contextMenu: GanttContextMenuState;
  contextMenuRef: React.RefObject<HTMLElement | null>;
  labels: ContextMenuLabels;
  onEdit: () => void;
  onNewPhase: () => void;
  onNewTask: () => void;
  onChangeColor: () => void;
  onDelete: () => void;
}

export function GanttContextMenuPortal({
  contextMenu,
  contextMenuRef,
  labels,
  onEdit,
  onNewPhase,
  onNewTask,
  onChangeColor,
  onDelete,
}: GanttContextMenuPortalProps) {
  const iconSizes = useIconSizes();
  const spacingTokens = useSpacingTokens();

  return createPortal(
    <nav
      ref={contextMenuRef}
      className="min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        position: 'fixed',
        left: Math.min(contextMenu.x, window.innerWidth - 200),
        top: Math.min(contextMenu.y, window.innerHeight - 280),
        zIndex: zIndex.popover,
      }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onEdit}
      >
        <Pencil className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {contextMenu.isPhaseBar ? labels.editPhase : labels.editTask}
      </button>
      <div className="-mx-1 my-1 h-px bg-border" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onNewPhase}
      >
        <FolderPlus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {labels.newPhase}
      </button>
      <button
        type="button"
        role="menuitem"
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onNewTask}
      >
        <Plus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {labels.newTask}
      </button>
      <div className="-mx-1 my-1 h-px bg-border" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
        onClick={onChangeColor}
      >
        <Palette className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {labels.changeColor}
      </button>
      <div className="-mx-1 my-1 h-px bg-border" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive/10"
        onClick={onDelete}
      >
        <Trash2 className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
        {labels.delete}
      </button>
    </nav>,
    document.body
  );
}

// ─── Tooltip Portal ───────────────────────────────────────────────────────

interface GanttTooltipPortalProps {
  tooltipData: HoverTooltipData;
  tooltipElRef: React.RefObject<HTMLDivElement | null>;
  labels: TooltipLabels;
}

export function GanttTooltipPortal({
  tooltipData,
  tooltipElRef,
  labels,
}: GanttTooltipPortalProps) {
  const colors = useSemanticColors();

  return createPortal(
    <aside
      ref={tooltipElRef}
      className="min-w-48 rounded border bg-popover p-2 text-popover-foreground text-xs shadow-lg pointer-events-none"
      style={{
        position: 'fixed',
        left: tooltipData.x,
        top: tooltipData.y,
        zIndex: zIndex.tooltip,
      }}
    >
      <p className="font-bold mb-1">{tooltipData.name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className={cn("font-semibold", colors.text.muted)}>
          {labels.start}:
        </dt>
        <dd>{tooltipData.startDate}</dd>
        <dt className={cn("font-semibold", colors.text.muted)}>
          {labels.end}:
        </dt>
        <dd>{tooltipData.endDate}</dd>
        <dt className={cn("font-semibold", colors.text.muted)}>
          {labels.duration}:
        </dt>
        <dd>{tooltipData.duration} {labels.days}</dd>
        <dt className={cn("font-semibold", colors.text.muted)}>
          {labels.progress}:
        </dt>
        <dd>{tooltipData.progress}%</dd>
      </dl>
    </aside>,
    document.body
  );
}

// ─── Color Picker Dialog ──────────────────────────────────────────────────

interface GanttColorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingColor: string;
  onColorChange: (color: string) => void;
  onSave: () => void;
  title: string;
}

export function GanttColorPickerDialog({
  open,
  onOpenChange,
  pendingColor,
  onColorChange,
  onSave,
  title,
}: GanttColorPickerDialogProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <UnifiedColorPicker
          variant="full"
          value={pendingColor}
          onChange={onColorChange}
          showPalettes
          showRecent
        />
        <DialogFooter className={cn('flex justify-end', spacingTokens.gap.sm)}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('tabs.timeline.gantt.dialog.cancel')}
          </Button>
          <Button onClick={onSave}>
            {t('tabs.timeline.gantt.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Legend Badges ─────────────────────────────────────────────────────────

interface GanttLegendBadgesProps {
  className?: string;
}

export function GanttLegendBadges({ className }: GanttLegendBadgesProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();

  return (
    <Card className={className}>
      <CardContent className={cn('flex flex-wrap items-center', spacingTokens.gap.sm, spacingTokens.padding.sm)}>
        <Badge variant="default" className={getStatusColor('active', 'bg')}>
          {t('tabs.timeline.gantt.status.completed')}
        </Badge>
        <Badge variant="default" className={getStatusColor('pending', 'bg')}>
          {t('tabs.timeline.gantt.status.inProgress')}
        </Badge>
        <Badge variant="secondary">
          {t('tabs.timeline.gantt.status.notStarted')}
        </Badge>
        <Badge variant="destructive">
          {t('tabs.timeline.gantt.status.delayed')}
        </Badge>
        <Badge variant="outline" className={cn(getStatusColor('construction', 'border'), getStatusColor('construction', 'text'))}>
          {t('tabs.timeline.gantt.status.blocked')}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ─── Fullscreen Legend Footer ──────────────────────────────────────────────

interface GanttFullscreenLegendProps {
  className?: string;
}

export function GanttFullscreenLegend({ className }: GanttFullscreenLegendProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();

  return (
    <footer className={cn('flex-shrink-0 flex flex-wrap items-center', spacingTokens.gap.sm, 'px-2 py-2', 'border-t', className)}>
      <Badge variant="default" className={getStatusColor('active', 'bg')}>
        {t('tabs.timeline.gantt.status.completed')}
      </Badge>
      <Badge variant="default" className={getStatusColor('pending', 'bg')}>
        {t('tabs.timeline.gantt.status.inProgress')}
      </Badge>
      <Badge variant="secondary">
        {t('tabs.timeline.gantt.status.notStarted')}
      </Badge>
      <Badge variant="destructive">
        {t('tabs.timeline.gantt.status.delayed')}
      </Badge>
      <Badge variant="outline" className={cn(getStatusColor('construction', 'border'), getStatusColor('construction', 'text'))}>
        {t('tabs.timeline.gantt.status.blocked')}
      </Badge>
    </footer>
  );
}
