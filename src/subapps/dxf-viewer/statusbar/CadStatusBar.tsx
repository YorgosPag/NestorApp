'use client';
import React, { useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { matchesShortcut, getShortcutDisplayLabel } from '../config/keyboard-shortcuts';
import { useCadToggles } from '../hooks/common/useCadToggles';
import type { CadToggle } from '../hooks/common/useCadToggles';

export default function CadStatusBar() {
  const { osnap, grid, snap, ortho, polar, dynInput } = useCadToggles();
  const { t } = useTranslation('dxf-viewer-panels');

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
    { key: 'polar',    toggle: polar,    shortcut: 'polarTracking', labelKey: 'cadDock.statusBar.polar',    descKey: 'cadDock.statusBar.polarDesc' },
    { key: 'dynInput', toggle: dynInput, shortcut: 'dynamicInput',  labelKey: 'cadDock.statusBar.dynInput', descKey: 'cadDock.statusBar.dynInputDesc' },
  ] as const;

  return (
    <TooltipProvider>
      <aside
        data-testid="cad-status-bar"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4 px-4 py-1.5 overflow-x-auto">
          {toggleDefs.map(({ key, toggle, shortcut, labelKey, descKey }) => (
            <CadToggleRow
              key={key}
              id={`cad-toggle-${key}`}
              label={t(labelKey)}
              fkey={getShortcutDisplayLabel(shortcut)}
              description={t(descKey)}
              toggle={toggle}
            />
          ))}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
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
            <span className="text-xs font-medium text-foreground leading-none">{label}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border leading-none py-0.5">
              {fkey}
            </span>
          </label>
          <Switch
            id={id}
            checked={toggle.on}
            onCheckedChange={() => toggle.toggle()}
            className="scale-75 origin-left"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        {`${description} (${fkey})`}
      </TooltipContent>
    </Tooltip>
  );
}
