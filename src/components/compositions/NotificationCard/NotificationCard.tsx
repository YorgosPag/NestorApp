'use client';

import React, { useState } from 'react';
import { BaseCard } from '@/components/core/BaseCard/BaseCard';
import { CommonBadge } from '@/core/badges';
import { HOVER_SHADOWS, HOVER_BACKGROUND_EFFECTS, GROUP_HOVER_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { Bell, AlertCircle, Info, CheckCircle, XCircle, Calendar, User, Eye, X } from 'lucide-react';

interface NotificationData {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
  time: string;
  read: boolean;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionLabel?: string;
  sender?: string;
  category?: string;
}

interface NotificationCardProps {
  notification: NotificationData;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onAction?: (id: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'warning': return AlertCircle;
    case 'error': return XCircle;
    case 'success': return CheckCircle;
    case 'reminder': return Calendar;
    default: return Info;
  }
};

const getTypeLabel = (type: string) => {
  const typeLabels: Record<string, string> = {
    'info': 'Πληροφορία',
    'warning': 'Προειδοποίηση',
    'error': 'Σφάλμα',
    'success': 'Επιτυχία',
    'reminder': 'Υπενθύμιση'
  };
  return typeLabels[type] || type;
};

const getPriorityColor = (priority: string = 'medium') => {
  switch (priority) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'info';
  }
};

export function NotificationCard({ 
  notification, 
  onMarkAsRead, 
  onMarkAsUnread, 
  onAction, 
  onDismiss,
  compact = false 
}: NotificationCardProps) {
  const [isRead, setIsRead] = useState(notification.read);
  
  const TypeIcon = getTypeIcon(notification.type);

  const handleToggleRead = () => {
    const newReadState = !isRead;
    setIsRead(newReadState);
    
    if (newReadState && onMarkAsRead) {
      onMarkAsRead(notification.id);
    } else if (!newReadState && onMarkAsUnread) {
      onMarkAsUnread(notification.id);
    }
  };

  const handleAction = () => {
    if (onAction) {
      onAction(notification.id);
    }
    // Mark as read when action is taken
    if (!isRead && onMarkAsRead) {
      setIsRead(true);
      onMarkAsRead(notification.id);
    }
  };

  if (compact) {
    return (
      <div className={`
        p-3 rounded-lg flex items-start gap-3 transition-all duration-200 cursor-pointer
        ${isRead ? 'bg-muted/30 opacity-75' : `bg-card border shadow-sm ${HOVER_SHADOWS.ENHANCED}`}
      `}>
        <div className={`
          w-2 h-2 rounded-full mt-2 shrink-0
          ${isRead ? 'bg-muted-foreground' : 'bg-blue-500 animate-pulse'}
        `} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm font-medium truncate ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
              {notification.title}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {notification.time}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.description}
          </p>
        </div>
        
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            className={`p-1 rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} opacity-0 ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${TRANSITION_PRESETS.OPACITY}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <BaseCard
      // Βασικές ιδιότητες
      title={notification.title}
      subtitle={notification.description}
      
      // Header configuration
      headerConfig={{
        backgroundGradient: isRead 
          ? "from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
          : "from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-900",
        logo: <TypeIcon className={`w-6 h-6 ${isRead ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'}`} />,
        showImageOverlay: false,
        compact: true
      }}
      
      // Selection state (read/unread indicator)
      isSelected={!isRead}
      onSelectionChange={handleToggleRead}
      
      // Status badges
      statusBadges={[
        {
          label: getTypeLabel(notification.type),
          className: getStatusBadgeClass(notification.type)
        },
        notification.priority && notification.priority !== 'medium' && {
          label: `${notification.priority === 'high' ? 'Υψηλή' : 'Χαμηλή'} Προτεραιότητα`,
          className: badgeVariants({ 
            variant: getPriorityColor(notification.priority) as any,
            size: 'sm' 
          })
        },
        {
          label: isRead ? 'Αναγνώστηκε' : 'Νέα',
          className: badgeVariants({ 
            variant: isRead ? 'secondary' : 'info',
            size: 'sm' 
          })
        }
      ].filter(Boolean)}
      
      // Content sections
      contentSections={[
        // Sender info (if available)
        notification.sender && {
          title: 'Αποστολέας',
          content: (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{notification.sender}</span>
            </div>
          )
        },
        
        // Category (if available)
        notification.category && {
          title: 'Κατηγορία',
          content: (
            <span className={badgeVariants({ variant: 'outline', size: 'sm' })}>
              {notification.category}
            </span>
          )
        },
        
        // Time details
        {
          title: 'Χρόνος',
          content: (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{notification.time}</span>
            </div>
          )
        }
      ].filter(Boolean)}
      
      // Actions
      actions={[
        !isRead && {
          label: 'Επισήμανση ως αναγνωσμένο',
          icon: Eye,
          onClick: () => handleToggleRead(),
          variant: 'outline' as const
        },
        notification.actionUrl && {
          label: notification.actionLabel || 'Προβολή',
          onClick: handleAction,
          variant: 'default' as const
        },
        onDismiss && {
          label: 'Απόρριψη',
          icon: X,
          onClick: () => onDismiss(notification.id),
          variant: 'ghost' as const
        }
      ].filter(Boolean)}
      
      // Style overrides
      className={`
        transition-all duration-300 group
        ${isRead ? `opacity-75 ${TRANSITION_PRESETS.OPACITY}` : HOVER_SHADOWS.ENHANCED}
      `}
    />
  );
}