'use client';

/**
 * IFC Property Set Editor (ADR-369 §9 Q8.2)
 *
 * Controlled component for editing an `IfcPropertySet` (sparse key-value map).
 * Renders a row per field: editable key + type-aware value input + remove button.
 * Template dropdown loads IFC4 standard Pset defaults.
 *
 * Props contract:
 *   - `psetName`  — display name of the Pset (e.g. "Pset_WallCommon")
 *   - `pset`      — current IfcPropertySet (undefined = empty)
 *   - `onChange`  — called with the updated IfcPropertySet on every change
 *
 * Caller (PsetEditorDialog) owns Save/Cancel.
 * No inline styles (N.3). No hardcoded Greek/English in JSX (N.11).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §Q8.2
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IfcPropertySet, IfcPropertySetValue } from '../../../bim/types/ifc-entity-mixin';
import { PSET_TEMPLATES } from './pset-templates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable ordering of fields for rendering — alphabetical except booleans last. */
function sortedEntries(pset: IfcPropertySet): [string, IfcPropertySetValue][] {
  return Object.entries(pset).sort(([a, va], [b, vb]) => {
    const aBool = typeof va === 'boolean';
    const bBool = typeof vb === 'boolean';
    if (aBool !== bBool) return aBool ? 1 : -1;
    return a.localeCompare(b);
  });
}

function detectType(value: IfcPropertySetValue): 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null';
  return typeof value as 'string' | 'number' | 'boolean';
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PsetEditorProps {
  readonly psetName: string;
  readonly pset: IfcPropertySet | undefined;
  readonly onChange: (next: IfcPropertySet) => void;
}

// ─── Row component ────────────────────────────────────────────────────────────

interface PsetRowProps {
  readonly fieldKey: string;
  readonly value: IfcPropertySetValue;
  readonly keyPlaceholder: string;
  readonly onValueChange: (key: string, next: IfcPropertySetValue) => void;
  readonly onRemove: (key: string) => void;
}

function PsetRow({ fieldKey, value, keyPlaceholder, onValueChange, onRemove }: PsetRowProps): React.ReactElement {
  const valueType = detectType(value);

  const handleStringChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    onValueChange(fieldKey, e.target.value);
  }, [fieldKey, onValueChange]);

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const n = parseFloat(e.target.value);
    onValueChange(fieldKey, Number.isNaN(n) ? 0 : n);
  }, [fieldKey, onValueChange]);

  const handleBoolChange = useCallback((checked: boolean | 'indeterminate'): void => {
    onValueChange(fieldKey, checked === true);
  }, [fieldKey, onValueChange]);

  const handleRemove = useCallback((): void => {
    onRemove(fieldKey);
  }, [fieldKey, onRemove]);

  return (
    <li className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="truncate font-mono text-sm text-muted-foreground">
            {fieldKey || <span className="italic text-destructive">{keyPlaceholder}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>{fieldKey}</TooltipContent>
      </Tooltip>

      {valueType === 'boolean' ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`pset-${fieldKey}`}
            checked={value === true}
            onCheckedChange={handleBoolChange}
          />
          <Label htmlFor={`pset-${fieldKey}`} className="text-sm">
            {value === true ? 'true' : 'false'}
          </Label>
        </div>
      ) : valueType === 'number' ? (
        <Input
          type="number"
          value={value as number}
          onChange={handleNumberChange}
          className="h-7 text-sm"
        />
      ) : (
        <Input
          type="text"
          value={value === null ? '' : (value as string)}
          onChange={handleStringChange}
          className="h-7 text-sm"
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleRemove}
        aria-label="remove"
      >
        <Trash2 size={14} />
      </Button>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PsetEditor({ psetName, pset, onChange }: PsetEditorProps): React.ReactElement {
  const { t } = useTranslation('bim3d');
  const [newKey, setNewKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  const entries = useMemo((): [string, IfcPropertySetValue][] => {
    if (!pset || Object.keys(pset).length === 0) return [];
    return sortedEntries(pset);
  }, [pset]);

  const currentKeys = useMemo((): ReadonlySet<string> => {
    return new Set(Object.keys(pset ?? {}));
  }, [pset]);

  const handleValueChange = useCallback(
    (key: string, next: IfcPropertySetValue): void => {
      onChange({ ...(pset ?? {}), [key]: next });
    },
    [pset, onChange],
  );

  const handleRemove = useCallback(
    (key: string): void => {
      const next = { ...(pset ?? {}) };
      delete next[key];
      onChange(next);
    },
    [pset, onChange],
  );

  const handleAddField = useCallback((): void => {
    const trimmed = newKey.trim();
    if (!trimmed) {
      setKeyError(t('pset.emptyKeyError'));
      return;
    }
    if (currentKeys.has(trimmed)) {
      setKeyError(t('pset.duplicateKeyError'));
      return;
    }
    setKeyError(null);
    setNewKey('');
    onChange({ ...(pset ?? {}), [trimmed]: '' });
  }, [newKey, currentKeys, pset, onChange, t]);

  const handleNewKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setNewKey(e.target.value);
    if (keyError) setKeyError(null);
  }, [keyError]);

  const handleNewKeyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleAddField();
  }, [handleAddField]);

  const handleLoadTemplate = useCallback((templateName: string): void => {
    const template = PSET_TEMPLATES[templateName];
    if (!template) return;
    onChange({ ...(pset ?? {}), ...template });
  }, [pset, onChange]);

  const templateNames = useMemo(() => Object.keys(PSET_TEMPLATES), []);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-sm font-semibold text-foreground">{psetName}</h3>
        <Select onValueChange={handleLoadTemplate}>
          <SelectTrigger className="h-7 w-[220px] text-xs">
            <SelectValue placeholder={t('pset.loadTemplate')} />
          </SelectTrigger>
          <SelectContent>
            {templateNames.map((name) => (
              <SelectItem key={name} value={name} className="font-mono text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          {t('pset.noFields')}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-border pb-1 text-xs font-medium text-muted-foreground">
            <span>{t('pset.keyLabel')}</span>
            <span>{t('pset.valueLabel')}</span>
            <span className="w-7" />
          </div>
          <ul className="divide-y divide-border">
            {entries.map(([key, val]) => (
              <PsetRow
                key={key}
                fieldKey={key}
                value={val}
                keyPlaceholder={t('pset.keyPlaceholder')}
                onValueChange={handleValueChange}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        </div>
      )}

      <footer className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          type="text"
          value={newKey}
          onChange={handleNewKeyChange}
          onKeyDown={handleNewKeyKeyDown}
          placeholder={t('pset.keyPlaceholder')}
          className={`h-7 flex-1 font-mono text-sm ${keyError ? 'border-destructive' : ''}`}
          aria-label={t('pset.keyLabel')}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 text-xs"
          onClick={handleAddField}
        >
          <Plus size={12} />
          {t('pset.addField')}
        </Button>
      </footer>
      {keyError && (
        <p className="text-xs text-destructive">{keyError}</p>
      )}
    </section>
  );
}
