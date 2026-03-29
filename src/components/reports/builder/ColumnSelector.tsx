/**
 * @module components/reports/builder/ColumnSelector
 * @enterprise ADR-268 — Column Selection with Drag-and-Drop Reorder
 *
 * Checkbox list with native HTML5 Drag & Drop for reordering.
 * Keyboard accessible: ArrowUp/ArrowDown + Enter.
 */

'use client';

import '@/lib/design-system';
import { useState, useCallback, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DomainDefinition } from '@/config/report-builder/report-builder-types';

interface ColumnSelectorProps {
  domainDefinition: DomainDefinition;
  columns: string[];
  onToggle: (fieldKey: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function ColumnSelector({
  domainDefinition,
  columns,
  onToggle,
  onReorder,
}: ColumnSelectorProps) {
  const { t } = useTranslation('report-builder-domains');
  const { t: tBuilder } = useTranslation('report-builder');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLLIElement>, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLLIElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropIndex(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLIElement>, toIdx: number) => {
      e.preventDefault();
      const fromIdx = Number(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIdx) && fromIdx !== toIdx) {
        onReorder(fromIdx, toIdx);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLLIElement>, currentIndex: number) => {
      if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        onReorder(currentIndex, currentIndex - 1);
      }
      if (e.key === 'ArrowDown' && currentIndex < columns.length - 1) {
        e.preventDefault();
        onReorder(currentIndex, currentIndex + 1);
      }
    },
    [columns.length, onReorder],
  );

  // Merge: selected columns first (in order), then unselected
  const allFields = domainDefinition.fields;
  const selectedFields = columns
    .map((key) => allFields.find((f) => f.key === key))
    .filter(Boolean);
  const unselectedFields = allFields.filter(
    (f) => !columns.includes(f.key),
  );

  return (
    <section className="rounded-lg border p-4" aria-label={tBuilder('columns.title')}>
      <h3 className="mb-3 text-sm font-semibold">{tBuilder('columns.title')}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{tBuilder('columns.dragHint')}</p>

      <ul role="listbox" className="space-y-1" aria-label={tBuilder('columns.title')}>
        {/* Selected columns — draggable */}
        {selectedFields.map((field, idx) => {
          if (!field) return null;
          const isSelected = true;
          return (
            <li
              key={field.key}
              role="option"
              aria-selected={isSelected}
              draggable
              tabIndex={0}
              className={cn(
                'flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                'hover:bg-accent',
                dragIndex === idx && 'opacity-50',
                dropIndex === idx && 'border-t-2 border-primary',
              )}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => onToggle(field.key)}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  isSelected && 'border-primary bg-primary text-primary-foreground',
                )}
                aria-label={`Toggle ${field.key}`}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </button>
              <span className="truncate">{t(field.labelKey)}</span>
            </li>
          );
        })}

        {/* Unselected columns — not draggable */}
        {unselectedFields.map((field) => (
          <li
            key={field.key}
            role="option"
            aria-selected={false}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            <span className="h-3.5 w-3.5 shrink-0" /> {/* spacer for alignment */}
            <button
              type="button"
              onClick={() => onToggle(field.key)}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
              aria-label={`Toggle ${field.key}`}
            />
            <span className="truncate">{t(field.labelKey)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
