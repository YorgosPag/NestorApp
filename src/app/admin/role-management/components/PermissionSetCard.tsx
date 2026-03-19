'use client';

/**
 * ADR-244: Permission Set Card
 *
 * Read-only card showing a permission set's name, description,
 * permissions list, and MFA badge.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import type { PermissionSetDefinition } from '@/lib/auth/permission-sets';
import { requiresMfaEnrollment } from '@/lib/auth/permission-sets';

// =============================================================================
// TYPES
// =============================================================================

interface PermissionSetCardProps {
  setId: string;
  definition: PermissionSetDefinition;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PermissionSetCard({ setId, definition }: PermissionSetCardProps) {
  const { t } = useTranslation('admin');

  const needsMfa = requiresMfaEnrollment(setId);

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-sm">{definition.name}</h4>
        {needsMfa && (
          <Badge variant="warning" className="text-[10px]">
            {t('roleManagement.mfaRequired', 'MFA Required')}
          </Badge>
        )}
      </header>

      <p className="text-xs text-muted-foreground mb-3">
        {definition.description}
      </p>

      <section>
        <h5 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {t('roleManagement.includedPermissions', 'Included Permissions')} ({definition.permissions.length})
        </h5>
        <ul className="space-y-0.5">
          {definition.permissions.map((perm) => (
            <li key={perm} className="text-[10px] text-muted-foreground font-mono">
              {perm}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-3 pt-2 border-t">
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {setId}
        </span>
      </footer>
    </Card>
  );
}
