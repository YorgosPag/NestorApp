'use client';

/**
 * Loading / error states shared by the building space tabs (Floors, Units, Parking).
 *
 * The three tabs rendered the same spinner section and the same "message + retry" section
 * inline (jscpd CHECK 3.28). One place now owns their layout; each tab keeps its own label.
 *
 * @module components/building-management/shared/BuildingSpaceTabStatus
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function BuildingSpaceTabLoading(): React.ReactElement {
  return (
    <section className="flex items-center justify-center py-2">
      <Spinner size="large" />
    </section>
  );
}

export interface BuildingSpaceTabErrorProps {
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

export function BuildingSpaceTabError({ message, retryLabel, onRetry }: BuildingSpaceTabErrorProps): React.ReactElement {
  return (
    <section className="flex flex-col items-center gap-2 py-2">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </section>
  );
}
