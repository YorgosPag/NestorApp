'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Clock,
  User,
  Building,
  TrendingUp,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Circle,
  Activity
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StorageHistoryTabProps {
  storage: Storage;
}

// Τύποι γεγονότων στο ιστορικό
interface HistoryEvent {
  id: string;
  type: 'lease' | 'maintenance' | 'inspection' | 'status_change' | 'price_change' | 'tenant_change';
  title: string;
  description: string;
  date: Date;
  actor?: string; // Ποιος έκανε την αλλαγή
  status: 'completed' | 'in_progress' | 'pending' | 'cancelled';
  metadata?: {
    oldValue?: string | number;
    newValue?: string | number;
    amount?: number;
    tenant?: string;
  };
}

function getEventIcon(type: HistoryEvent['type']) {
  switch (type) {
    case 'lease': return Building;
    case 'maintenance': return AlertTriangle;
    case 'inspection': return CheckCircle;
    case 'status_change': return Circle;
    case 'price_change': return TrendingUp;
    case 'tenant_change': return User;
    default: return Activity;
  }
}

function getEventColor(type: HistoryEvent['type'], colors: ReturnType<typeof useSemanticColors>) {
  switch (type) {
    case 'lease': return `${colors.text.info} ${colors.bg.infoSubtle}`;
    case 'maintenance': return `${colors.text.warning} ${colors.bg.warningSubtle}`;
    case 'inspection': return `${colors.text.success} ${colors.bg.successSubtle}`;
    case 'status_change': return `${colors.text.accent} ${colors.bg.accentSubtle}`;
    case 'price_change': return `${colors.text.success} ${colors.bg.successSubtle}`;
    case 'tenant_change': return `${colors.text.info} ${colors.bg.infoSubtle}`;
    default: return `${colors.text.muted} ${colors.bg.muted}`;
  }
}

function getStatusIcon(status: HistoryEvent['status']) {
  switch (status) {
    case 'completed': return CheckCircle;
    case 'in_progress': return Clock;
    case 'pending': return Circle;
    case 'cancelled': return AlertTriangle;
    default: return Circle;
  }
}

export function StorageHistoryTab({ storage }: StorageHistoryTabProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('storage');

  // Helper to get translated status label
  const getStatusLabel = (status: string) => t(`general.statuses.${status}`) || t('general.unknown');

  // Generate history events based on storage data
  const baseEvents: HistoryEvent[] = [
    {
      id: '1',
      type: 'status_change',
      title: t('history.eventTypes.status_change.created'),
      description: t('history.eventTypes.status_change.createdDesc', { name: storage.name }),
      date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      actor: t('history.actors.buildingManagement'),
      status: 'completed',
      metadata: {
        newValue: 'created'
      }
    },
    ...(storage.status === 'occupied' ? [
      {
        id: '2',
        type: 'lease' as const,
        title: t('history.eventTypes.lease.title'),
        description: t('history.eventTypes.lease.description', { name: storage.name }),
        date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        actor: storage.owner || t('history.actors.tenant'),
        status: 'completed' as const,
        metadata: {
          amount: storage.price,
          tenant: storage.owner
        }
      },
      {
        id: '3',
        type: 'tenant_change' as const,
        title: t('history.eventTypes.tenant_change.title'),
        description: t('history.eventTypes.tenant_change.description', { tenant: storage.owner }),
        date: new Date(Date.now() - 118 * 24 * 60 * 60 * 1000),
        actor: t('history.actors.management'),
        status: 'completed' as const,
        metadata: {
          tenant: storage.owner
        }
      }
    ] : []),
    {
      id: '4',
      type: 'inspection',
      title: t('history.eventTypes.inspection.title'),
      description: t('history.eventTypes.inspection.description', { floor: storage.floor }),
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      actor: t('history.actors.technicalInspector'),
      status: 'completed',
    },
    ...(storage.price ? [{
      id: '5',
      type: 'price_change' as const,
      title: t('history.eventTypes.price_change.title'),
      description: t('history.eventTypes.price_change.description', { price: formatCurrency(storage.price) }),
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      actor: t('history.actors.management'),
      status: 'completed' as const,
      metadata: {
        newValue: storage.price,
        oldValue: storage.price * 0.9
      }
    }] : []),
    ...(storage.status === 'maintenance' ? [{
      id: '6',
      type: 'maintenance' as const,
      title: t('history.eventTypes.maintenance.title'),
      description: t('history.eventTypes.maintenance.description'),
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      actor: t('history.actors.maintenanceTeam'),
      status: 'in_progress' as const,
    }] : []),
    {
      id: '7',
      type: 'status_change',
      title: t('history.eventTypes.status_change.statusLabel', { status: getStatusLabel(storage.status || 'unknown') }),
      description: t('history.statusDescription', { status: storage.status }),
      date: storage.lastUpdated ? new Date(storage.lastUpdated) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actor: t('history.actors.system'),
      status: 'completed',
      metadata: {
        newValue: storage.status
      }
    }
  ];

  const historyEvents = [...baseEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const eventsByType = {
    total: historyEvents.length,
    lease: historyEvents.filter(e => e.type === 'lease').length,
    maintenance: historyEvents.filter(e => e.type === 'maintenance').length,
    inspection: historyEvents.filter(e => e.type === 'inspection').length,
    changes: historyEvents.filter(e => e.type === 'status_change' || e.type === 'price_change').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* History Statistics */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className={iconSizes.md} />
          {t('history.title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.muted}`}>{eventsByType.total}</div>
            <div className="text-sm text-muted-foreground">{t('history.metrics.totalEvents')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.info}`}>{eventsByType.lease}</div>
            <div className="text-sm text-muted-foreground">{t('history.metrics.leases')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.warning}`}>{eventsByType.maintenance}</div>
            <div className="text-sm text-muted-foreground">{t('history.metrics.maintenances')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.success}`}>{eventsByType.inspection}</div>
            <div className="text-sm text-muted-foreground">{t('history.metrics.inspections')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.accent}`}>{eventsByType.changes}</div>
            <div className="text-sm text-muted-foreground">{t('history.metrics.changes')}</div>
          </div>
        </div>
      </section>

      {/* Events Timeline */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className={iconSizes.md} />
          {t('history.timeline')}
        </h3>
        <div className="space-y-4">
          {historyEvents.map((event, index) => {
            const EventIcon = getEventIcon(event.type);
            const StatusIcon = getStatusIcon(event.status);
            const isLast = index === historyEvents.length - 1;

            return (
              <div key={event.id} className="relative">
                {/* Vertical Line */}
                {!isLast && (
                  <div className="absolute left-6 top-12 w-0.5 h-16 bg-border" />
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${iconSizes.xl2} rounded-full flex items-center justify-center ${getEventColor(event.type, colors)}`}>
                    <EventIcon className={iconSizes.md} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`bg-card ${quick.card} p-4`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{event.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
                          <StatusIcon className={iconSizes.xs} />
                          {t(`history.eventStatus.${event.status}`)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className={iconSizes.xs} />
                            {formatDate(event.date.toISOString())}
                          </span>
                          {event.actor && (
                            <span className="flex items-center gap-1">
                              <User className={iconSizes.xs} />
                              {event.actor}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        {event.metadata && (
                          <div className="flex gap-2">
                            {typeof event.metadata.amount === 'number' && (
                              <span className={`${colors.bg.successSubtle} ${colors.text.success} px-2 py-1 rounded`}>
                                {formatCurrency(event.metadata.amount)}
                              </span>
                            )}
                            {event.metadata.oldValue !== undefined && event.metadata.newValue !== undefined && (
                              <span className={`${colors.bg.infoSubtle} ${colors.text.info} px-2 py-1 rounded text-xs`}>
                                {typeof event.metadata.oldValue === 'number' && typeof event.metadata.newValue === 'number' ?
                                  `${formatCurrency(event.metadata.oldValue)} → ${formatCurrency(event.metadata.newValue)}`
                                  : `${event.metadata.oldValue} → ${event.metadata.newValue}`
                                }
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Current Status Summary */}
      <section>
        <h3 className="font-semibold mb-4">{t('history.currentStatus')}</h3>
        <div className={`bg-card ${quick.card} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="font-medium text-muted-foreground">{t('history.fields.storage')}</label>
              <span className="ml-2">{storage.name}</span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">{t('history.fields.status')}</label>
              <span className="ml-2">{getStatusLabel(storage.status || 'unknown')}</span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">{t('history.fields.lastUpdated')}</label>
              <span className="ml-2">
                {storage.lastUpdated ? formatDate(new Date(storage.lastUpdated).toISOString()) : t('history.notRecorded')}
              </span>
            </div>
            {storage.owner && (
              <div>
                <label className="font-medium text-muted-foreground">{t('history.fields.responsible')}</label>
                <span className="ml-2">{storage.owner}</span>
              </div>
            )}
            {storage.price && (
              <div>
                <label className="font-medium text-muted-foreground">{t('history.fields.currentValue')}</label>
                <span className="ml-2">{formatCurrency(storage.price)}</span>
              </div>
            )}
            <div>
              <label className="font-medium text-muted-foreground">{t('history.fields.area')}</label>
              <span className="ml-2">{storage.area} m²</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

