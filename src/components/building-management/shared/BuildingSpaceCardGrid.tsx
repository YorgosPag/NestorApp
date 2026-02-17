/**
 * BuildingSpaceCardGrid — Centralized card grid component
 *
 * Used by all building space tabs (Units, Parking, Storage).
 * Renders data as responsive cards using the canonical @/components/ui/card system
 * with centralized border tokens.
 *
 * @module components/building-management/shared/BuildingSpaceCardGrid
 */

'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { BuildingSpaceActions } from './BuildingSpaceActions';
import type { SpaceCardField, SpaceActions, SpaceActionState } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface BuildingSpaceCardGridProps<T> {
  /** Data items to display */
  items: T[];
  /** Extract unique key from each item */
  getKey: (item: T) => string;
  /** Extract display name for the card header */
  getName: (item: T) => string;
  /** Render the status badge for each item */
  renderStatus: (item: T) => ReactNode;
  /** Key-value field definitions for the card body */
  fields: SpaceCardField<T>[];
  /** Action handlers (view, edit, unlink, delete) */
  actions?: SpaceActions<T>;
  /** Loading state for action icons */
  actionState?: SpaceActionState;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BuildingSpaceCardGrid<T>({
  items,
  getKey,
  getName,
  renderStatus,
  fields,
  actions,
  actionState,
}: BuildingSpaceCardGridProps<T>) {
  const hasActions = actions && (actions.onView || actions.onEdit || actions.onUnlink || actions.onDelete);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => {
        const key = getKey(item);

        return (
          <Card key={key} className={`overflow-hidden ${INTERACTIVE_PATTERNS.CARD_STANDARD}`}>
            <CardContent className="p-4 space-y-3">
              <header className="flex items-center justify-between">
                <h3 className="font-medium text-sm truncate">{getName(item)}</h3>
                {renderStatus(item)}
              </header>

              <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {fields.map((field) => (
                  <span key={field.label} className="contents">
                    <dt>{field.label}</dt>
                    <dd className="text-foreground">{field.render(item)}</dd>
                  </span>
                ))}
              </dl>

              {hasActions && (
                <footer className="border-t border-border pt-2">
                  <BuildingSpaceActions
                    onView={actions.onView ? () => actions.onView?.(item) : undefined}
                    onEdit={actions.onEdit ? () => actions.onEdit?.(item) : undefined}
                    onUnlink={actions.onUnlink ? () => actions.onUnlink?.(item) : undefined}
                    onDelete={actions.onDelete ? () => actions.onDelete?.(item) : undefined}
                    isUnlinking={actionState?.unlinkingId === key}
                    isDeleting={actionState?.deletingId === key}
                  />
                </footer>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
