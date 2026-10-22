'use client';

/**
 * @module components/projects/procurement/BackToProjectLink
 * @enterprise ADR-330 §5.1 S2 — Back link from procurement section to project tabs
 *
 * The procurement section ejects the user from `/projects?projectId=X` (state-based
 * tabs) into `/projects/[id]/procurement/*` (URL-based RouteTabs). This link
 * provides the canonical return path back to the project tab strip.
 *
 * ADR-242 Βήμα 4: εμφάνιση από το SSoT `BACK_LINK_CLASS` (GOV.UK Back link — υπογράμμιση πάντα, ≥24 px).
 */

import { getProjectUrl } from '@/lib/navigation/project-urls';
import { BACK_LINK_CLASS } from '@/lib/ui/link-style';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface BackToProjectLinkProps {
  projectId: string;
  className?: string;
}

export function BackToProjectLink({ projectId, className }: BackToProjectLinkProps) {
  const { t } = useTranslation('projects');
  return (
    <Link href={getProjectUrl(projectId)} className={cn(BACK_LINK_CLASS, className)}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t('tabs.subtabs.procurement.backToProject')}
    </Link>
  );
}
