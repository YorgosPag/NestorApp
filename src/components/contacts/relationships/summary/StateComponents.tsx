// ============================================================================
// STATE COMPONENTS - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Dedicated components για διαφορετικές καταστάσεις του summary
// Loading, Empty, New Contact states extracted για reusability
//
// ============================================================================

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { Users, Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-244: Project roles (landowner, buyer — derived view)
import { ProjectRolesSection } from './ProjectRolesSection';

// ============================================================================
// TYPES
// ============================================================================

interface StateComponentProps {
  /** Optional CSS className */
  className?: string;
}

interface EmptyStateProps extends StateComponentProps {
  /** Whether in read-only mode */
  readonly?: boolean;
  /** Callback when add button is clicked */
  onManageRelationships?: () => void;
  /** Contact ID — for showing project roles even when no contact relationships exist */
  contactId?: string;
}

// ============================================================================
// NEW CONTACT STATE
// ============================================================================

/**
 * 🆕 NewContactState Component
 *
 * Displayed when contact hasn't been saved yet
 */
export const NewContactState: React.FC<StateComponentProps> = ({ className }) => {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('contacts');

  return (
  <Card className={className}>
    <CardContent className="pt-6">
      <div className={`text-center ${colors.text.muted}`}>
        <Users className={"h-12 w-12 mx-auto mb-4 " + colors.text.muted} />
        <h3 className="font-medium text-lg mb-2">{t('relationships.summary.title')}</h3>
        <p className="text-sm mb-4">
          {t('relationships.summary.newContact.availableAfterSave')}
        </p>
        <div className={`${colors.bg.info} ${quick.card} p-3`}>
          <p className={`text-xs ${colors.text.info}`}>
            💡 <strong>{t('relationships.summary.newContact.tip')}</strong> {t('relationships.summary.newContact.tipText')}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
  );
};

// ============================================================================
// LOADING STATE
// ============================================================================

/**
 * ⏳ LoadingState Component
 *
 * Displayed while relationships are being fetched
 */
export const LoadingState: React.FC<StateComponentProps> = ({ className }) => {
  const iconSizes = useIconSizes();
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('contacts');

  return (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <Users className={iconSizes.md} />
        <span>{t('relationships.summary.title')}</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center py-8">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className={colors.text.muted}>{t('relationships.summary.loading')}</p>
      </div>
    </CardContent>
  </Card>
  );
};

// ============================================================================
// EMPTY STATE
// ============================================================================

/**
 * 📭 EmptyState Component
 *
 * Displayed when no relationships exist
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  className,
  readonly = false,
  onManageRelationships,
  contactId,
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('contacts');

  return (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className={iconSizes.md} />
          <span>{t('relationships.summary.title')}</span>
        </div>
        {!readonly && onManageRelationships && (
          <Button
            onClick={onManageRelationships}
            size="sm"
            className="ml-auto"
          >
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('relationships.summary.add')}
          </Button>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {/* ADR-244: Project roles appear even when no contact relationships exist */}
      {contactId && <ProjectRolesSection contactId={contactId} />}

      <div className="text-center py-8">
        <Users className={"h-12 w-12 mx-auto mb-4 " + colors.text.muted} />
        <h3 className="font-medium mb-2">{t('relationships.summary.empty.title')}</h3>
        <p className={`${colors.text.muted} text-sm mb-4`}>
          {t('relationships.summary.empty.description')}
        </p>
        {!readonly && onManageRelationships && (
          <Button
            onClick={onManageRelationships}
            variant="outline"
            size="sm"
          >
            {t('relationships.summary.startHere')}
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NewContactState,
  LoadingState,
  EmptyState
};