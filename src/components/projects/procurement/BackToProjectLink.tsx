'use client';

/**
 * @module components/projects/procurement/BackToProjectLink
 * @enterprise ADR-330 §5.1 S2 — Back link from procurement section to project tabs
 *
 * The procurement section ejects the user from `/projects?projectId=X` (state-based
 * tabs) into `/projects/[id]/procurement/*` (URL-based RouteTabs). This link
 * provides the canonical return path back to the project tab strip.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface BackToProjectLinkProps {
  projectId: string;
  className?: string;
}

export function BackToProjectLink({ projectId, className }: BackToProjectLinkProps) {
  const { t } = useTranslation('projects');
  return (
    <Link
      href={`/projects?projectId=${projectId}`}
      className={
        className ??
        'inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors'
      }
    >
      <ArrowLeft className="h-4 w-4" />
      {t('tabs.subtabs.procurement.backToProject')}
    </Link>
  );
}
