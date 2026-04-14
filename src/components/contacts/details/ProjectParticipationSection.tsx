'use client';

/**
 * Project Participation Section — Read-only, derived from contact_links (ADR-282)
 *
 * Shows which projects this contact is linked to and with what role.
 * Data is computed live from contact_links — not stored on the contact.
 */

import { FolderKanban, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useContactEntityLinks } from '@/hooks/useEntityAssociations';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/design-system';
import type { ContactEntityLink } from '@/types/entity-associations';

interface ProjectParticipationSectionProps {
  contactId: string | undefined;
}

export function ProjectParticipationSection({ contactId }: ProjectParticipationSectionProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { t: tContacts } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();

  if (!contactId) {
    return (
      <div className={cn('p-6 text-center text-sm', colors.text.muted)}>
        {tContacts('individual.sections.projectParticipation.saveFirst')}
      </div>
    );
  }

  return <ProjectLinks contactId={contactId} t={t} tContacts={tContacts} colors={colors} />;
}

// ── Inner component (avoids hook call when contactId is undefined) ──

function ProjectLinks({
  contactId,
  t,
  tContacts,
  colors,
}: {
  contactId: string;
  t: (key: string, opts?: string | Record<string, unknown>) => string;
  tContacts: (key: string, opts?: string | Record<string, unknown>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}) {
  const { grouped, isLoading } = useContactEntityLinks(contactId);
  const projects = grouped.projects;

  if (isLoading) {
    return (
      <div className={cn('p-4 text-center text-sm animate-pulse', colors.text.muted)}>
        {t('associations.loading')}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState tContacts={tContacts} colors={colors} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {projects.map((link) => (
          <ProjectLinkRow key={link.linkId} link={link} t={t} colors={colors} />
        ))}
      </ul>
      <InfoFooter tContacts={tContacts} colors={colors} />
    </div>
  );
}

// ── Project Link Row ────────────────────────────────────────────

function ProjectLinkRow({
  link,
  t,
  colors,
}: {
  link: ContactEntityLink;
  t: (key: string, opts?: string | Record<string, unknown>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}) {
  const roleLabel = t(`associations.roles.${link.role}`, link.role);

  return (
    <li className={cn('flex items-center gap-3 p-2 rounded-md border', colors.border.default)}>
      <FolderKanban className={cn('h-4 w-4 shrink-0', colors.text.muted)} />
      <span className={cn('text-sm font-medium flex-1', colors.text.default)}>
        {link.entityName}
      </span>
      <Badge variant="secondary" className="text-xs">
        {roleLabel}
      </Badge>
    </li>
  );
}

// ── Empty + Info ────────────────────────────────────────────────

function EmptyState({
  tContacts,
  colors,
}: {
  tContacts: (key: string, opts?: string | Record<string, unknown>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}) {
  return (
    <p className={cn('text-sm italic', colors.text.muted)}>
      {tContacts('individual.sections.projectParticipation.empty')}
    </p>
  );
}

function InfoFooter({
  tContacts,
  colors,
}: {
  tContacts: (key: string, opts?: string | Record<string, unknown>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}) {
  return (
    <p className={cn('flex items-center gap-1.5 text-xs', colors.text.muted)}>
      <Info className="h-3.5 w-3.5 shrink-0" />
      {tContacts('individual.sections.projectParticipation.info')}
    </p>
  );
}
