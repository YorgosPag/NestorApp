'use client';

/**
 * ADR-376 Phase C.2 — Opening Tag Style dialog (per-project styling override).
 *
 * Pure UI — service injected by the surrounding `OpeningTagStyleHost`. The
 * dialog reads/writes via `getOpeningTagStyleService()` which owns the
 * debounced Firestore write (200 ms). Every control mutation fires the
 * service IMMEDIATELY for live preview, then the debounce schedules a single
 * persistence call per burst.
 *
 * Industry pattern: Figma / Photoshop / Revit "Type Properties" — live preview
 * with debounced persistence (Q4 industry default 3/3 convergence).
 *
 * Accessibility: every control labelled via `<Label>` + native color input
 * carries `aria-label`. Radix Dialog handles focus trap + ESC dismiss.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getOpeningTagStyleService,
  OPENING_TAG_STYLE_RANGES,
  type OpeningTagLeaderStyle,
} from '../../../bim/services/opening-tag-style-service';
// 🏢 Color-Conversion SSoT (ADR-573): shared <input type=color> hex normaliser.
import { toColorInputHex } from '../../color/utils';

export interface OpeningTagStyleDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
}

const LEADER_STYLE_VALUES: ReadonlyArray<OpeningTagLeaderStyle> = ['solid', 'dashed', 'dotted'];

export function OpeningTagStyleDialog(props: OpeningTagStyleDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const service = getOpeningTagStyleService();

  // Re-render whenever the service emits — keeps every control in sync with
  // the canonical state (including external resets / multi-tab updates).
  const [, forceRender] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => service.subscribe(() => forceRender()), [service]);

  const style = service.getCurrentStyle();

  const handleFontSize = (vals: number[]) => {
    const v = vals[0];
    if (typeof v === 'number') service.mutateStyle({ fontSizePx: v });
  };
  const handleBorderWidth = (vals: number[]) => {
    const v = vals[0];
    if (typeof v === 'number') service.mutateStyle({ borderWidthPx: v });
  };
  const handleLeaderStyle = (val: string) => {
    if (LEADER_STYLE_VALUES.includes(val as OpeningTagLeaderStyle)) {
      service.mutateStyle({ leaderStyle: val as OpeningTagLeaderStyle });
    }
  };
  const handlePillBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    service.mutateStyle({ pillBgColor: e.target.value });
  };
  const handleLeaderColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    service.mutateStyle({ leaderColor: e.target.value });
  };
  const handleLeaderVisible = (next: boolean) => {
    service.mutateStyle({ leaderVisible: next });
  };
  const handleReset = () => service.reset();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('ribbon.commands.openingEditor.tagStyle.dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('ribbon.commands.openingEditor.tagStyle.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-5 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="opening-tag-font-size">
                {t('ribbon.commands.openingEditor.tagStyle.fields.fontSize')}
              </Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {style.fontSizePx}px
              </span>
            </div>
            <Slider
              id="opening-tag-font-size"
              min={OPENING_TAG_STYLE_RANGES.fontSizePx.min}
              max={OPENING_TAG_STYLE_RANGES.fontSizePx.max}
              step={1}
              value={[style.fontSizePx]}
              onValueChange={handleFontSize}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="opening-tag-border-width">
                {t('ribbon.commands.openingEditor.tagStyle.fields.borderWidth')}
              </Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {style.borderWidthPx}px
              </span>
            </div>
            <Slider
              id="opening-tag-border-width"
              min={OPENING_TAG_STYLE_RANGES.borderWidthPx.min}
              max={OPENING_TAG_STYLE_RANGES.borderWidthPx.max}
              step={1}
              value={[style.borderWidthPx]}
              onValueChange={handleBorderWidth}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="opening-tag-leader-style">
              {t('ribbon.commands.openingEditor.tagStyle.fields.leaderStyle')}
            </Label>
            <Select value={style.leaderStyle} onValueChange={handleLeaderStyle}>
              <SelectTrigger id="opening-tag-leader-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEADER_STYLE_VALUES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`ribbon.commands.openingEditor.tagStyle.leaderStyleOptions.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening-tag-pill-bg">
                {t('ribbon.commands.openingEditor.tagStyle.fields.pillBgColor')}
              </Label>
              <input
                id="opening-tag-pill-bg"
                type="color"
                value={toColorInputHex(style.pillBgColor)}
                onChange={handlePillBg}
                aria-label={t('ribbon.commands.openingEditor.tagStyle.fields.pillBgColor')}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening-tag-leader-color">
                {t('ribbon.commands.openingEditor.tagStyle.fields.leaderColor')}
              </Label>
              <input
                id="opening-tag-leader-color"
                type="color"
                value={toColorInputHex(style.leaderColor)}
                onChange={handleLeaderColor}
                aria-label={t('ribbon.commands.openingEditor.tagStyle.fields.leaderColor')}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="opening-tag-leader-visible">
              {t('ribbon.commands.openingEditor.tagStyle.fields.leaderVisible')}
            </Label>
            <Switch
              id="opening-tag-leader-visible"
              checked={style.leaderVisible}
              onCheckedChange={handleLeaderVisible}
            />
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            {t('ribbon.commands.openingEditor.tagStyle.actions.reset')}
          </Button>
          <Button onClick={() => props.onOpenChange(false)}>
            {t('ribbon.commands.openingEditor.tagStyle.actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

