/**
 * =============================================================================
 * 🏢 ENTERPRISE: ShareSurfaceShell — Unified Share Modal Chrome
 * =============================================================================
 *
 * Presentational-only shell that provides the modal chrome, header (icon +
 * title + subtitle), status banner, body slot (for the PermissionPanel), and
 * optional footer slot. Namespace-agnostic — labels are pushed in via props
 * so each caller uses its own i18n namespace for feature-specific strings.
 *
 * Zero business logic. Zero state. Zero service coupling.
 *
 * @module components/ui/sharing/ShareSurfaceShell
 * @see ADR-147 Unified Share Surface
 */

'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ShareStatusBanner } from './ShareStatusBanner';
import type { ShareSurfaceShellProps } from '@/types/sharing';

export function ShareSurfaceShell({
  open,
  onOpenChange,
  entity,
  labels,
  status,
  error,
  children,
  headerIcon,
  footer,
}: ShareSurfaceShellProps): React.ReactElement {
  const icon = headerIcon ?? (
    <Share2 className="h-5 w-5 text-primary" aria-hidden="true" />
  );

  const subtitle = labels.subtitle ?? entity.subtitle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-md overflow-hidden p-0',
          'sm:max-w-lg',
        )}
        aria-describedby={subtitle ? 'share-surface-subtitle' : undefined}
      >
        <DialogHeader
          className="border-b border-border bg-muted/50 px-6 py-4"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--bg-info))]/20"
            >
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {labels.title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription
                  id="share-surface-subtitle"
                  className="mt-0.5 truncate text-sm text-muted-foreground"
                >
                  {subtitle}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <section
          className="flex flex-col gap-3 px-6 py-4"
          aria-label={labels.title}
        >
          <ShareStatusBanner
            status={status}
            error={error}
            errorPrefix={labels.errorPrefix}
          />
          {children}
        </section>

        {footer && (
          <footer
            className="border-t border-border bg-muted/50 px-6 py-3"
          >
            {footer}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
