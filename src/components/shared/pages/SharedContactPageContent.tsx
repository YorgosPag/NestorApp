/**
 * =============================================================================
 * SHARED CONTACT PUBLIC PAGE (ADR-315)
 * =============================================================================
 *
 * Anonymous view for `entityType: 'contact'` shares. Renders a minimal,
 * read-only contact card with only the fields the sharer explicitly included
 * via `contactMeta.includedFields`. No auth, no edit actions.
 *
 * @module components/shared/pages/SharedContactPageContent
 * @see adrs/ADR-315-unified-sharing.md §3.4
 */

'use client';

import React from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  UserCircle2,
  Clock,
  Shield,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ContactShareResolvedData } from '@/services/sharing/resolvers/contact.resolver';

interface SharedContactPageContentProps {
  data: ContactShareResolvedData;
  expiresAt: string;
}

export function SharedContactPageContent({
  data,
  expiresAt,
}: SharedContactPageContentProps): React.ReactElement {
  const { t } = useTranslation(['common-shared']);
  const colors = useSemanticColors();

  const expiresLabel = new Date(expiresAt).toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <header className="text-center mb-6">
            <figure className="flex items-center justify-center mb-3">
              <UserCircle2 className="h-12 w-12 text-primary" />
            </figure>
            {data.name && (
              <h1 className="text-lg font-semibold">{data.name}</h1>
            )}
            {data.company && (
              <p className={cn('text-sm mt-1', colors.text.muted)}>
                {data.company}
              </p>
            )}
          </header>

          {data.note && (
            <p
              className={cn(
                'text-sm bg-muted/50 rounded-md p-3 mb-4 italic text-center',
                colors.text.muted,
              )}
            >
              {data.note}
            </p>
          )}

          <dl className="space-y-3">
            {data.emails?.map((email) => (
              <div key={`email-${email}`} className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <a
                  href={`mailto:${email}`}
                  className="text-sm break-all hover:underline"
                >
                  {email}
                </a>
              </div>
            ))}

            {data.phones?.map((phone) => (
              <div key={`phone-${phone}`} className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="text-sm hover:underline"
                >
                  {phone}
                </a>
              </div>
            ))}

            {data.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <span className="text-sm">{data.address}</span>
              </div>
            )}

            {data.company && !data.name && (
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <span className="text-sm">{data.company}</span>
              </div>
            )}
          </dl>

          <footer
            className={cn(
              'flex items-center justify-center gap-2 text-xs mt-6 pt-4 border-t',
              colors.text.muted,
            )}
          >
            <Clock className="h-3 w-3" />
            <span>
              {t('share.expires', { defaultValue: '' })} {expiresLabel}
            </span>
          </footer>
          <aside
            className={cn(
              'flex items-center justify-center gap-1 text-[10px] mt-2',
              colors.text.muted,
            )}
          >
            <Shield className="h-3 w-3" />
            <span>
              {t('share.publicReadOnlyNotice', { defaultValue: '' })}
            </span>
          </aside>
        </CardContent>
      </Card>
    </main>
  );
}
