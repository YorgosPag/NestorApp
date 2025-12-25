'use client';

import React from 'react';
import { UserType } from '@/contexts/OptimizedUserRoleContext';
import { Users, Briefcase, HardHat } from 'lucide-react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { HOVER_BORDER_EFFECTS, HOVER_SHADOWS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface UserTypeSelectorProps {
  currentType?: UserType;
  onSelect: (type: UserType) => void;
  disabled?: boolean;
}

/**
 * 🏢 GEO-ALERT Phase 2.2: User Type Selector
 *
 * Component για επιλογή τύπου χρήστη (Citizen/Professional/Technical)
 * Κάθε τύπος έχει διαφορετικές δυνατότητες στο σύστημα:
 *
 * - Citizen: Απλή επιλογή με point/polygon
 * - Professional: Upload εικόνας/PDF με auto-detection
 * - Technical: Full DXF/DWG support με CAD precision
 */
export function UserTypeSelector({ currentType, onSelect, disabled }: UserTypeSelectorProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const { t, isLoading } = useTranslationLazy('geo-canvas');

  // ✅ ENTERPRISE: Return loading state while translations load
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm ${quick.card} p-6`}>
        <div className="animate-pulse">
          <div className={`${iconSizes.lg} bg-gray-200 rounded mb-4`}></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${iconSizes.xl8} bg-gray-200 rounded-lg`}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const userTypes: Array<{
    type: UserType;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      type: 'citizen',
      label: t('userTypeSelector.types.citizen.title'),
      description: t('userTypeSelector.types.citizen.description'),
      icon: <Users className={iconSizes.lg} />,
      color: 'bg-blue-500'
    },
    {
      type: 'professional',
      label: t('userTypeSelector.types.professional.title'),
      description: t('userTypeSelector.types.professional.description'),
      icon: <Briefcase className={iconSizes.lg} />,
      color: 'bg-green-500'
    },
    {
      type: 'technical',
      label: t('userTypeSelector.types.technical.title'),
      description: t('userTypeSelector.types.technical.description'),
      icon: <HardHat className={iconSizes.lg} />,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className={`bg-white rounded-lg shadow-sm ${quick.card} p-6`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('userTypeSelector.title')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {userTypes.map((userType) => (
          <button
            key={userType.type}
            onClick={() => onSelect(userType.type)}
            disabled={disabled}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200
              ${currentType === userType.type
                ? `border-${userType.color.replace('bg-', '')} bg-${userType.color.replace('bg-', '')}/10`
                : `border-border ${HOVER_BORDER_EFFECTS.PURPLE}`
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${HOVER_SHADOWS.SUBTLE}`}
            `}
          >
            {/* Icon */}
            <div className={`
              ${iconSizes.xl3} rounded-full flex items-center justify-center mb-3
              ${userType.color} text-white
            `}>
              {userType.icon}
            </div>

            {/* Label */}
            <h4 className="font-semibold text-gray-900 mb-1">
              {userType.label}
            </h4>

            {/* Description */}
            <p className="text-sm text-gray-600">
              {userType.description}
            </p>

            {/* Selected indicator */}
            {currentType === userType.type && (
              <div className="absolute top-2 right-2">
                <div className={`${iconSizes.xs} rounded-full ${userType.color}`} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Info message */}
      {currentType && (
        <div className={`mt-4 p-3 bg-blue-50 ${quick.card}`}>
          <p className="text-sm text-blue-700">
            <span className="font-medium">{t('userTypeSelector.currentType')}</span>{' '}
            {userTypes.find(ut => ut.type === currentType)?.label}
          </p>
        </div>
      )}
    </div>
  );
}