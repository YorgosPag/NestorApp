'use client';
import { useSyncExternalStore } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ambientAlignmentConfigStore } from '../systems/tracking/ambient-alignment-config-store';

/**
 * ADR-357 ambient extension — Revit-style auto-alignment toggle. Reads the
 * standalone `ambientAlignmentConfigStore` (localStorage micro-leaf, NOT the
 * Firestore CAD-toggles slice). Status-bar toggle only (AutoCAD-web pattern,
 * like Dynamic Input) — no F-key binding.
 *
 * Extracted from CadStatusBar (N.7.1 500-line budget).
 */
export function AutoAlignToggle({ id, label, description }: {
  id: string;
  label: string;
  description: string;
}) {
  const snapshot = useSyncExternalStore(
    ambientAlignmentConfigStore.subscribe,
    () => ambientAlignmentConfigStore.getSnapshot(),
    () => ambientAlignmentConfigStore.getSnapshot(),
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor={id} className="flex items-center gap-1 cursor-pointer select-none">
            <span className={`text-xs leading-none font-semibold ${snapshot.enabled ? 'text-[hsl(var(--text-success))]' : 'text-muted-foreground'}`}>{label}</span>
          </label>
          <Switch
            id={id}
            checked={snapshot.enabled}
            onCheckedChange={() => ambientAlignmentConfigStore.toggle()}
            className="scale-75 origin-left data-[state=checked]:bg-[hsl(var(--text-success))]"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{description}</TooltipContent>
    </Tooltip>
  );
}
