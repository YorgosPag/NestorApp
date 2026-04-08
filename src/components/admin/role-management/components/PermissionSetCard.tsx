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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

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
  const colors = useSemanticColors();

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

      <p className={cn("text-xs mb-3", colors.text.muted)}>
        {definition.description}
      </p>

      <section>
        <h5 className={cn("text-[10px] font-medium uppercase tracking-wider mb-1", colors.text.muted)}>
          {t('roleManagement.includedPermissions', 'Included Permissions')} ({definition.permissions.length})
        </h5>
        <ul className="space-y-0.5">
          {definition.permissions.map((perm) => (
            <li key={perm} className={cn("text-[10px] font-mono", colors.text.muted)}>
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
