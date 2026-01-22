'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { CommonBadge } from '@/core/badges';
import { HOVER_SHADOWS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatDate as formatIntlDate } from '@/lib/intl-utils';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Crown,
  UserCheck,
  Edit,
  MessageSquare,
  UserX,
  Award,
  Clock
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Generic User interface for the UserCard - exported for type reuse
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: 'admin' | 'manager' | 'agent' | 'user' | 'viewer';
  department?: string;
  company?: string;
  location?: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  lastActive?: string | Date;
  joinedDate?: string | Date;
  bio?: string;
  specialties?: string[];
  achievements?: number; // Total achievements or points
  tasksCompleted?: number;
  projectsAssigned?: number;
}

interface UserCardProps {
  user: UserProfile;
  onEdit?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onView?: (userId: string) => void;
  onDeactivate?: (userId: string) => void;
  isSelected?: boolean;
  onSelectionChange?: () => void;
  showStats?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const getRoleIcon = (role: string) => {
  const roleIcons: Record<string, React.ElementType> = {
    'admin': Crown,
    'manager': Shield,
    'agent': UserCheck,
    'user': User,
    'viewer': User
  };
  return roleIcons[role] || User;
};

export function UserCard({
  user,
  onEdit,
  onMessage,
  onView,
  onDeactivate,
  isSelected = false,
  onSelectionChange,
  showStats = true,
  showActions = true,
  compact = false
}: UserCardProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [isFavorite, setIsFavorite] = useState(false);
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('users');

  // Localized helper functions
  const getRoleLabel = (role: string) => t(`roles.${role}`, role);
  const getStatusLabel = (status: string) => t(`status.${status}`, status);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return t('card.activity.notSet');
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatIntlDate(dateObj);
  };

  const formatLastActive = (lastActive: string | Date | undefined) => {
    if (!lastActive) return t('card.activity.never');

    const lastActiveDate = typeof lastActive === 'string' ? new Date(lastActive) : lastActive;
    const now = new Date();
    const diffMs = now.getTime() - lastActiveDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('card.activity.today');
    if (diffDays === 1) return t('card.activity.yesterday');
    if (diffDays < 7) return t('card.activity.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('card.activity.weeksAgo', { count: Math.floor(diffDays / 7) });
    return formatDate(lastActive);
  };

  const RoleIcon = getRoleIcon(user.role || 'user');

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={user.name}
      subtitle={user.bio || `${getRoleLabel(user.role || 'user')}${user.department ? ` • ${user.department}` : ''}`}
      
      // Header configuration με avatar
      headerConfig={{
        backgroundGradient: user.status === 'active' 
          ? "from-blue-100 via-indigo-50 to-purple-100 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-900"
          : user.status === 'suspended'
          ? "from-red-100 via-pink-50 to-red-100 dark:from-red-950 dark:via-pink-950 dark:to-red-900"
          : "from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900",
        logo: user.avatar ? (
          <img 
            src={user.avatar} 
            alt={user.name}
            className={`${iconSizes.xl3} rounded-full object-cover border ${quick.avatar}`}
          />
        ) : (
          <RoleIcon className={`${iconSizes.xl2} ${
            user.status === 'active' ? 'text-blue-600 dark:text-blue-400' :
            user.status === 'suspended' ? 'text-red-600 dark:text-red-400' :
            'text-gray-600 dark:text-gray-400'
          }`} />
        ),
        compact
      }}
      
      // Selection state
      isSelected={isSelected}
      onSelectionChange={onSelectionChange}
      
      // Favorites
      isFavorite={isFavorite}
      onFavoriteChange={setIsFavorite}
      
      // Status badges
      statusBadges={[
        <CommonBadge
          key="status"
          status="company"
          customLabel={getStatusLabel(user.status)}
          variant={
            user.status === 'active' ? 'default' :
            user.status === 'suspended' ? 'destructive' :
            user.status === 'pending' ? 'secondary' : 'outline'
          }
        />,
        <CommonBadge
          key="role"
          status="company"
          customLabel={getRoleLabel(user.role || 'user')}
          variant={
            user.role === 'admin' ? 'destructive' :
            user.role === 'manager' ? 'default' :
            user.role === 'agent' ? 'secondary' : 'outline'
          }
          className="text-sm"
        />
      ]}
      
      // Content sections
      contentSections={[
        // Contact information
        (user.email || user.phone) && {
          title: t('card.sections.contact'),
          content: (
            <div className="space-y-2">
              {user.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className={`${iconSizes.sm} text-muted-foreground`} />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className={`${iconSizes.sm} text-muted-foreground`} />
                  <span>{user.phone}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Company/Location information
        (user.company || user.location) && {
          title: t('card.sections.location'),
          content: (
            <div className="space-y-2">
              {user.company && (
                <div className="flex items-center gap-2 text-sm">
                  {/* 🏢 ENTERPRISE: Using centralized company icon/color */}
                  <NAVIGATION_ENTITIES.company.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.company.color)} />
                  <span>{user.company}</span>
                </div>
              )}
              {user.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className={`${iconSizes.sm} text-muted-foreground`} />
                  <span>{user.location}</span>
                </div>
              )}
            </div>
          )
        },
        
        // Activity information
        {
          title: t('card.sections.activity'),
          content: (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('card.activity.lastActive')}:</span>
                <span className="flex items-center gap-1">
                  <Clock className={iconSizes.xs} />
                  {formatLastActive(user.lastActive)}
                </span>
              </div>
              {user.joinedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('card.activity.joinedDate')}:</span>
                  <span className="flex items-center gap-1">
                    <Calendar className={iconSizes.xs} />
                    {formatDate(user.joinedDate)}
                  </span>
                </div>
              )}
            </div>
          )
        },
        
        // Statistics (if enabled)
        showStats && (user.tasksCompleted || user.projectsAssigned || user.achievements) && {
          title: t('card.sections.statistics'),
          content: (
            <div className="grid grid-cols-3 gap-4 text-center">
              {user.tasksCompleted !== undefined && (
                <div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {user.tasksCompleted}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('card.stats.tasks')}</div>
                </div>
              )}
              {user.projectsAssigned !== undefined && (
                <div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {user.projectsAssigned}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('card.stats.projects')}</div>
                </div>
              )}
              {user.achievements !== undefined && (
                <div>
                  <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                    {user.achievements}
                  </div>
                  <div className="text-xs text-muted-foreground">{t('card.stats.achievements')}</div>
                </div>
              )}
            </div>
          )
        },

        // Specialties/Skills
        user.specialties && user.specialties.length > 0 && {
          title: t('card.sections.specialties'),
          content: (
            <div className="flex flex-wrap gap-1">
              {user.specialties.slice(0, 3).map((specialty, index) => (
                <CommonBadge
                  key={index}
                  status="company"
                  customLabel={specialty}
                  variant="secondary"
                  className="text-xs"
                />
              ))}
              {user.specialties.length > 3 && (
                <CommonBadge
                  status="company"
                  customLabel={`+${user.specialties.length - 3}`}
                  variant="outline"
                  className="text-xs"
                />
              )}
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={showActions ? [
        onView && {
          label: t('card.actions.view'),
          icon: User,
          onClick: () => onView(user.id),
          variant: 'default' as const
        },
        onMessage && {
          label: t('card.actions.message'),
          icon: MessageSquare,
          onClick: () => onMessage(user.id),
          variant: 'outline' as const
        },
        onEdit && {
          label: t('card.actions.edit'),
          icon: Edit,
          onClick: () => onEdit(user.id),
          variant: 'ghost' as const
        },
        onDeactivate && user.status === 'active' && {
          label: t('card.actions.deactivate'),
          icon: UserX,
          onClick: () => onDeactivate(user.id),
          variant: 'ghost' as const
        }
      ].filter(Boolean) : []}
      
      // Style overrides
      className={`${TRANSITION_PRESETS.SMOOTH_ALL} ${HOVER_SHADOWS.ENHANCED} ${
        user.status === 'suspended' ? 'opacity-75' : ''
      } ${compact ? 'p-4' : ''}`}
    />
  );
}