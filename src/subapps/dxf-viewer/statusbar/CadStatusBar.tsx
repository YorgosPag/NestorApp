'use client';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { matchesShortcut, getShortcutDisplayLabel } from '../config/keyboard-shortcuts';
import { useCadToggles } from '../hooks/common/useCadToggles';
import type { CadToggle } from '../hooks/common/useCadToggles';
import { cadToggleState } from '../systems/constraints/cad-toggle-state';
import { useSnapContext } from '../snapping/context/SnapContext';
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import { CurrentLayerPicker } from '../ui/components/layer-picker/CurrentLayerPicker';
import type { ExtendedSnapType } from '../snapping/extended-types';
import { useStairStatusKey } from './stair-status-store';
import { IsolateStatusIndicator } from './IsolateStatusIndicator';
import { polarTrackingStore } from '../systems/constraints/polar-tracking-store';
import { useDisplayUnit } from '../hooks/common/useDisplayUnit';
import {
  type DisplayUnit,
  DISPLAY_UNIT_OPTIONS,
  DISPLAY_UNIT_LABELS,
  isValidDisplayUnit,
} from '../config/units';
import { CommandLineInput } from '../ui/command-line/CommandLineInput';

export default function CadStatusBar() {
  const { osnap, grid, snap, ortho, polar, dynInput, snapStep, setSnapStep } = useCadToggles();
  const { t } = useTranslation('dxf-viewer-panels');
  const { t: tTools } = useTranslation('tool-hints');
  const { displayUnit, setDisplayUnit } = useDisplayUnit();
  const { enabledModes, toggleMode } = useSnapContext();
  // ADR-358 Phase 7b1 — Inline stair prompt left of the toggles.
  const stairStatusKey = useStairStatusKey();
  const stairStatusText = stairStatusKey ? tTools(stairStatusKey) : '';

  // SNAP-MODE (F9) single-writer mirror into the non-React SSoT. CadStatusBar is the
  // sole always-mounted toggle UI → no multi-instance clobber (see useCadToggles note).
  useEffect(() => {
    cadToggleState.setSnap(snap.on, snapStep);
  }, [snap.on, snapStep]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') return;
      if (matchesShortcut(e, 'gridDisplay'))   { e.preventDefault(); grid.toggle();     return; }
      if (matchesShortcut(e, 'orthoMode'))     { e.preventDefault(); ortho.toggle();    return; }
      if (matchesShortcut(e, 'gridSnap'))      { e.preventDefault(); snap.toggle();     return; }
      if (matchesShortcut(e, 'polarTracking')) { e.preventDefault(); polar.toggle();    return; }
      if (matchesShortcut(e, 'objectSnap'))    { e.preventDefault(); osnap.toggle();    return; }
      if (matchesShortcut(e, 'dynamicInput'))  { e.preventDefault(); dynInput.toggle(); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [osnap, grid, snap, ortho, polar, dynInput]);

  const toggleDefs = [
    { key: 'osnap',    toggle: osnap,    shortcut: 'objectSnap',    labelKey: 'cadDock.statusBar.osnap',    descKey: 'cadDock.statusBar.osnapDesc' },
    { key: 'grid',     toggle: grid,     shortcut: 'gridDisplay',   labelKey: 'cadDock.statusBar.grid',     descKey: 'cadDock.statusBar.gridDesc' },
    { key: 'snap',     toggle: snap,     shortcut: 'gridSnap',      labelKey: 'cadDock.statusBar.snap',     descKey: 'cadDock.statusBar.snapDesc' },
    { key: 'ortho',    toggle: ortho,    shortcut: 'orthoMode',     labelKey: 'cadDock.statusBar.ortho',    descKey: 'cadDock.statusBar.orthoDesc' },
    { key: 'dynInput', toggle: dynInput, shortcut: 'dynamicInput',  labelKey: 'cadDock.statusBar.dynInput', descKey: 'cadDock.statusBar.dynInputDesc' },
  ] as const;

  return (
    <TooltipProvider>
      <aside
        data-testid="cad-status-bar"
        className="w-full border-t border-border bg-background/95 backdrop-blur-sm shrink-0"
      >
        <div className="flex items-center gap-4 px-4 py-1.5 overflow-x-auto">
          {/* ADR-357 Phase 14-B: Command line input — leftmost, always visible */}
          <CommandLineInput />
          {stairStatusText && (
            <span
              className="shrink-0 text-xs font-semibold text-[hsl(var(--text-warning))]"
              role="status"
              aria-live="polite"
            >
              {stairStatusText}
            </span>
          )}
          {toggleDefs.map(({ key, toggle, shortcut, labelKey, descKey }) =>
            key === 'osnap' ? (
              <OsnapToggleWithPopover
                key={key}
                id="cad-toggle-osnap"
                label={t(labelKey)}
                fkey={getShortcutDisplayLabel(shortcut)}
                description={t(descKey)}
                toggle={toggle}
                enabledModes={enabledModes}
                onToggleMode={toggleMode}
              />
            ) : key === 'snap' ? (
              <SnapToggleWithStep
                key={key}
                id="cad-toggle-snap"
                label={t(labelKey)}
                fkey={getShortcutDisplayLabel(shortcut)}
                description={t(descKey)}
                toggle={toggle}
                step={snapStep}
                onStepChange={setSnapStep}
              />
            ) : (
              <CadToggleRow
                key={key}
                id={`cad-toggle-${key}`}
                label={t(labelKey)}
                fkey={getShortcutDisplayLabel(shortcut)}
                description={t(descKey)}
                toggle={toggle}
              />
            )
          )}
          {/* ADR-357 Phase 1: Polar toggle with angle settings popover */}
          <PolarToggleWithPopover
            id="cad-toggle-polar"
            label={t('cadDock.statusBar.polar')}
            fkey={getShortcutDisplayLabel('polarTracking')}
            description={t('cadDock.statusBar.polarDesc')}
            toggle={polar}
          />
          {/* ADR-357 Phase 2b: Display unit selector */}
          <DisplayUnitSelector displayUnit={displayUnit} onUnitChange={setDisplayUnit} t={t} />
          <CurrentLayerPicker variant="status-bar" className="ml-auto" />
          <IsolateStatusIndicator />
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('cadDock.statusBar.modeInfo')}
          </span>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function CadToggleRow({ id, label, fkey, description, toggle }: {
  id: string;
  label: string;
  fkey: string;
  description: string;
  toggle: CadToggle;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 shrink-0">
          <label
            htmlFor={id}
            className="flex items-center gap-1 cursor-pointer select-none"
          >
            <span className={`text-xs leading-none font-semibold ${toggle.on ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>{label}</span>
            {fkey && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border leading-none py-0.5">
                {fkey}
              </span>
            )}
          </label>
          <Switch
            id={id}
            checked={toggle.on}
            onCheckedChange={() => toggle.toggle()}
            className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        {`${description} (${fkey})`}
      </TooltipContent>
    </Tooltip>
  );
}

const POLAR_INCREMENT_OPTIONS = ['5', '10', '15', '18', '22.5', '30', '45', '90'] as const;

function PolarToggleWithPopover({ id, label, fkey, description, toggle }: {
  id: string;
  label: string;
  fkey: string;
  description: string;
  toggle: CadToggle;
}) {
  const { t } = useTranslation('dxf-viewer-panels');
  const snapshot = useSyncExternalStore(
    (fn) => polarTrackingStore.subscribe(fn),
    () => polarTrackingStore.getSnapshot(),
    () => polarTrackingStore.getSnapshot(),
  );
  const [customInput, setCustomInput] = useState('');

  const handleAddAngle = () => {
    const val = parseFloat(customInput);
    if (isNaN(val) || val <= 0 || val >= 360) return;
    const next = [...snapshot.additionalAngles, val];
    polarTrackingStore.setAdditionalAngles(next);
    setCustomInput('');
  };

  const handleRemoveAngle = (angle: number) => {
    polarTrackingStore.setAdditionalAngles(snapshot.additionalAngles.filter(a => a !== angle));
  };

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <label htmlFor={id} className="flex items-center gap-1 cursor-pointer select-none">
              <span className={`text-xs leading-none font-semibold ${toggle.on ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>{label}</span>
              {fkey && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border leading-none py-0.5">
                  {fkey}
                </span>
              )}
            </label>
            <Switch
              id={id}
              checked={toggle.on}
              onCheckedChange={() => toggle.toggle()}
              className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{`${description} (${fkey})`}</TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={t('cadDock.statusBar.polarSettingsTitle')}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="z-[1800] w-56 p-3 space-y-3">
          <p className="text-xs font-semibold">{t('cadDock.statusBar.polarSettingsTitle')}</p>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">{t('cadDock.statusBar.polarIncrement')}</p>
            <Select
              value={String(snapshot.incrementAngle)}
              onValueChange={(v) => polarTrackingStore.setIncrementAngle(parseFloat(v))}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLAR_INCREMENT_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}°</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">{t('cadDock.statusBar.polarAdditional')}</p>
            <div className="flex gap-1">
              <input
                type="number"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddAngle(); }}
                placeholder={t('cadDock.statusBar.polarCustomPlaceholder')}
                className="flex-1 h-7 text-xs px-2 rounded border border-border bg-background"
                min={0}
                max={360}
                step={0.5}
              />
              <button
                onClick={handleAddAngle}
                className="px-2 h-7 text-xs rounded bg-muted hover:bg-muted/80 border border-border"
              >
                {t('cadDock.statusBar.polarAddAngle')}
              </button>
            </div>
            {snapshot.additionalAngles.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {snapshot.additionalAngles.map(angle => (
                  <span key={angle} className="flex items-center gap-0.5 text-[10px] bg-muted rounded px-1.5 py-0.5">
                    {angle}°
                    <button onClick={() => handleRemoveAngle(angle)} aria-label="remove">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * SNAP-MODE (F9) toggle + inline live step field. OFF → no field, no quantization.
 * ON → a number input appears; whatever value (mm) you type applies immediately —
 * no presets, no popover, no Apply button (Giorgio 2026-06-12: «απλό toggle on/off»).
 */
function SnapToggleWithStep({ id, label, fkey, description, toggle, step, onStepChange }: {
  id: string;
  label: string;
  fkey: string;
  description: string;
  toggle: CadToggle;
  step: number;
  onStepChange: (value: number) => void;
}) {
  const { t } = useTranslation('dxf-viewer-panels');
  // Local text buffer so mid-typing (empty / partial) never snaps back to a default;
  // a valid non-negative number applies live on every keystroke.
  const [text, setText] = useState(String(step));
  useEffect(() => { setText(String(step)); }, [step]);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <label htmlFor={id} className="flex items-center gap-1 cursor-pointer select-none">
              <span className={`text-xs leading-none font-semibold ${toggle.on ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>{label}</span>
              {fkey && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border leading-none py-0.5">
                  {fkey}
                </span>
              )}
            </label>
            <Switch
              id={id}
              checked={toggle.on}
              onCheckedChange={() => toggle.toggle()}
              className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{`${description} (${fkey})`}</TooltipContent>
      </Tooltip>
      {toggle.on && (
        <div className="relative">
          <input
            type="number"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = parseFloat(e.target.value);
              if (!isNaN(n) && n >= 0) onStepChange(n);
            }}
            aria-label={t('cadDock.statusBar.snapStepTitle')}
            className="h-6 w-24 text-xs pl-2 pr-7 rounded border border-border bg-background"
            min={0}
            step={1}
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
        </div>
      )}
    </div>
  );
}

function DisplayUnitSelector({ displayUnit, onUnitChange, t }: {
  displayUnit: DisplayUnit;
  onUnitChange: (unit: DisplayUnit) => void;
  t: (key: string) => string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="shrink-0">
          <Select
            value={displayUnit}
            onValueChange={(v) => {
              if (isValidDisplayUnit(v)) onUnitChange(v);
            }}
          >
            <SelectTrigger
              className="h-6 min-w-0 w-auto text-xs font-semibold text-muted-foreground border-none bg-transparent px-1 gap-0.5 hover:bg-muted focus:ring-0 focus:ring-offset-0"
              aria-label={t('cadDock.statusBar.displayUnitDesc')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top" className="min-w-[4rem]">
              {DISPLAY_UNIT_OPTIONS.map(unit => (
                <SelectItem key={unit} value={unit} className="text-xs">
                  {DISPLAY_UNIT_LABELS[unit]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{t('cadDock.statusBar.displayUnitDesc')}</TooltipContent>
    </Tooltip>
  );
}

function OsnapToggleWithPopover({ id, label, fkey, description, toggle, enabledModes, onToggleMode }: {
  id: string;
  label: string;
  fkey: string;
  description: string;
  toggle: CadToggle;
  enabledModes: Set<ExtendedSnapType>;
  onToggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={id}
              className="flex items-center gap-1 cursor-pointer select-none"
            >
              <span className={`text-xs leading-none font-semibold ${toggle.on ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>{label}</span>
              {fkey && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border leading-none py-0.5">
                  {fkey}
                </span>
              )}
            </label>
            <Switch
              id={id}
              checked={toggle.on}
              onCheckedChange={() => toggle.toggle()}
              className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{`${description} (${fkey})`}</TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Snap types"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="z-[1800] w-auto p-2">
          <ProSnapToolbar
            enabledModes={enabledModes}
            onToggleMode={onToggleMode}
            compact
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
