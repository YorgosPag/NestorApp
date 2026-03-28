/**
 * =============================================================================
 * ContactEntityLinksView — Reverse view (Contact → Entities)
 * =============================================================================
 *
 * Εμφανίζει τα Έργα / Κτίρια / Μονάδες στα οποία είναι συνδεδεμένη μια Επαφή,
 * ομαδοποιημένα ανά entity type.
 *
 * @module components/associations/ContactEntityLinksView
 * @enterprise ADR-032 - Linking Model (Associations)
 */

'use client';

import React from 'react';
import { Building2, FolderKanban, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useContactEntityLinks } from '@/hooks/useEntityAssociations';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { ContactEntityLink } from '@/types/entity-associations';
import '@/lib/design-system';

// ============================================================================
// PROPS
// ============================================================================

export interface ContactEntityLinksViewProps {
  contactId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactEntityLinksView({ contactId }: ContactEntityLinksViewProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const { grouped, isLoading } = useContactEntityLinks(contactId);

  const hasLinks =
    grouped.projects.length > 0 ||
    grouped.buildings.length > 0 ||
    grouped.units.length > 0;

  const getRoleLabel = (role: string): string => {
    const key = `associations.roles.${role}`;
    const translated = t(key);
    return translated === key ? role : translated;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('associations.entityLinks.title')}</CardTitle>
        <CardDescription>
          {t('associations.entityLinks.description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className={cn("text-sm", colors.text.muted)}>
            {t('associations.loading')}
          </p>
        ) : !hasLinks ? (
          <p className={cn("text-sm py-6 text-center", colors.text.muted)}>
            {t('associations.entityLinks.noLinks')}
          </p>
        ) : (
          <div className="space-y-6">
            {/* Projects */}
            {grouped.projects.length > 0 && (
              <EntityGroup
                icon={<FolderKanban className="h-4 w-4" />}
                title={t('associations.entityLinks.projects')}
                links={grouped.projects}
                getRoleLabel={getRoleLabel}
              />
            )}

            {/* Buildings */}
            {grouped.buildings.length > 0 && (
              <EntityGroup
                icon={<Building2 className="h-4 w-4" />}
                title={t('associations.entityLinks.buildings')}
                links={grouped.buildings}
                getRoleLabel={getRoleLabel}
              />
            )}

            {/* Units */}
            {grouped.units.length > 0 && (
              <EntityGroup
                icon={<Home className="h-4 w-4" />}
                title={t('associations.entityLinks.units')}
                links={grouped.units}
                getRoleLabel={getRoleLabel}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SUB-COMPONENT: Group of entity links
// ============================================================================

interface EntityGroupProps {
  icon: React.ReactNode;
  title: string;
  links: ContactEntityLink[];
  getRoleLabel: (role: string) => string;
}

function EntityGroup({ icon, title, links, getRoleLabel }: EntityGroupProps) {
  const colors = useSemanticColors();
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
        {icon}
        {title}
        <span className={cn("font-normal", colors.text.muted)}>({links.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {links.map((link) => (
          <li
            key={link.linkId}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <span className="text-sm">{link.entityName}</span>
            {link.role && (
              <Badge variant="outline">{getRoleLabel(link.role)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
