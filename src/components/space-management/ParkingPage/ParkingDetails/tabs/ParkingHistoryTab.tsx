/**
 * ParkingHistoryTab — History/Timeline tab for individual parking spot detail view
 *
 * Generates a timeline of events based on parking spot data.
 * Same pattern as StorageHistoryTab.
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/ParkingHistoryTab
 */

'use client';

import { formatDate, formatCurrency } from '@/lib/intl-utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Clock,
  User,
  Car,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Circle,
  Activity,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';

// ============================================================================
// TYPES
// ============================================================================

interface ParkingHistoryTabProps {
  parking: ParkingSpot;
}

type HistoryEventType = 'reservation' | 'maintenance' | 'inspection' | 'status_change' | 'price_change' | 'tenant_change';

interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  title: string;
  description: string;
  date: Date;
  actor?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'cancelled';
  metadata?: {
    oldValue?: string | number;
    newValue?: string | number;
    amount?: number;
    tenant?: string;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_LABELS: Record<string, string> = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  reserved: 'Δεσμευμένη',
  sold: 'Πωλημένη',
  maintenance: 'Συντήρηση',
};

function getEventIcon(type: HistoryEventType) {
  switch (type) {
    case 'reservation': return Car;
    case 'maintenance': return AlertTriangle;
    case 'inspection': return CheckCircle;
    case 'status_change': return Circle;
    case 'price_change': return TrendingUp;
    case 'tenant_change': return User;
    default: return Activity;
  }
}

function getEventColor(type: HistoryEventType, colors: ReturnType<typeof useSemanticColors>) {
  switch (type) {
    case 'reservation': return `${colors.text.info} ${colors.bg.infoSubtle}`;
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

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingHistoryTab({ parking }: ParkingHistoryTabProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const statusLabel = STATUS_LABELS[parking.status || 'available'] || parking.status || 'Άγνωστο';

  // Generate history events based on parking data
  const baseEvents: HistoryEvent[] = [
    {
      id: '1',
      type: 'status_change',
      title: 'Δημιουργία θέσης στάθμευσης',
      description: `Η θέση ${parking.number} δημιουργήθηκε στο σύστημα.`,
      date: parking.createdAt
        ? (typeof parking.createdAt === 'object' && 'toDate' in parking.createdAt
            ? parking.createdAt.toDate()
            : new Date(parking.createdAt))
        : new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      actor: 'Διαχείριση κτιρίου',
      status: 'completed',
      metadata: { newValue: 'created' },
    },
    ...(parking.status === 'occupied' || parking.status === 'reserved' ? [{
      id: '2',
      type: 'reservation' as const,
      title: parking.status === 'occupied' ? 'Ανάθεση θέσης' : 'Κράτηση θέσης',
      description: `Η θέση ${parking.number} ${parking.status === 'occupied' ? 'ανατέθηκε' : 'δεσμεύτηκε'}.`,
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      actor: 'Διαχείριση',
      status: 'completed' as const,
    }] : []),
    {
      id: '3',
      type: 'inspection',
      title: 'Τακτικός έλεγχος',
      description: `Τακτικός έλεγχος θέσης στάθμευσης${parking.floor ? `, Όροφος ${parking.floor}` : ''}.`,
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      actor: 'Τεχνικός επιθεωρητής',
      status: 'completed',
    },
    ...(parking.price ? [{
      id: '4',
      type: 'price_change' as const,
      title: 'Ενημέρωση τιμής',
      description: `Η τιμή της θέσης ορίστηκε σε ${formatCurrency(parking.price)}.`,
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      actor: 'Διαχείριση',
      status: 'completed' as const,
      metadata: { newValue: parking.price },
    }] : []),
    ...(parking.status === 'maintenance' ? [{
      id: '5',
      type: 'maintenance' as const,
      title: 'Εργασίες συντήρησης',
      description: 'Εκτελούνται εργασίες συντήρησης στη θέση στάθμευσης.',
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      actor: 'Συνεργείο συντήρησης',
      status: 'in_progress' as const,
    }] : []),
    {
      id: '6',
      type: 'status_change',
      title: `Κατάσταση: ${statusLabel}`,
      description: `Η τρέχουσα κατάσταση είναι "${statusLabel}".`,
      date: parking.updatedAt
        ? (typeof parking.updatedAt === 'object' && 'toDate' in parking.updatedAt
            ? parking.updatedAt.toDate()
            : new Date(parking.updatedAt))
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actor: 'Σύστημα',
      status: 'completed',
      metadata: { newValue: parking.status },
    },
  ];

  const historyEvents = [...baseEvents].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const eventsByType = {
    total: historyEvents.length,
    reservations: historyEvents.filter((e) => e.type === 'reservation').length,
    maintenance: historyEvents.filter((e) => e.type === 'maintenance').length,
    inspections: historyEvents.filter((e) => e.type === 'inspection').length,
    changes: historyEvents.filter((e) => e.type === 'status_change' || e.type === 'price_change').length,
  };

  return (
    <section className="space-y-6 p-2">
      {/* Statistics */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Activity className={iconSizes.md} />
          Ιστορικό Θέσης Στάθμευσης
        </h3>
        <article className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <article className={`bg-card ${quick.card} p-4 text-center`}>
            <p className={`text-2xl font-bold ${colors.text.muted}`}>{eventsByType.total}</p>
            <p className="text-sm text-muted-foreground">Συνολικά</p>
          </article>
          <article className={`bg-card ${quick.card} p-4 text-center`}>
            <p className={`text-2xl font-bold ${colors.text.info}`}>{eventsByType.reservations}</p>
            <p className="text-sm text-muted-foreground">Κρατήσεις</p>
          </article>
          <article className={`bg-card ${quick.card} p-4 text-center`}>
            <p className={`text-2xl font-bold ${colors.text.warning}`}>{eventsByType.maintenance}</p>
            <p className="text-sm text-muted-foreground">Συντηρήσεις</p>
          </article>
          <article className={`bg-card ${quick.card} p-4 text-center`}>
            <p className={`text-2xl font-bold ${colors.text.success}`}>{eventsByType.inspections}</p>
            <p className="text-sm text-muted-foreground">Έλεγχοι</p>
          </article>
          <article className={`bg-card ${quick.card} p-4 text-center`}>
            <p className={`text-2xl font-bold ${colors.text.accent}`}>{eventsByType.changes}</p>
            <p className="text-sm text-muted-foreground">Αλλαγές</p>
          </article>
        </article>
      </section>

      {/* Events Timeline */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Clock className={iconSizes.md} />
          Χρονολόγιο
        </h3>
        <ul className="space-y-4">
          {historyEvents.map((event, index) => {
            const EventIcon = getEventIcon(event.type);
            const StatusIcon = getStatusIcon(event.status);
            const isLast = index === historyEvents.length - 1;

            return (
              <li key={event.id} className="relative">
                {!isLast && (
                  <span className="absolute left-6 top-12 h-16 w-0.5 bg-border" aria-hidden="true" />
                )}

                <article className="flex gap-4">
                  <span className={`flex shrink-0 items-center justify-center rounded-full ${iconSizes.xl2} ${getEventColor(event.type, colors)}`}>
                    <EventIcon className={iconSizes.md} />
                  </span>

                  <section className={`min-w-0 flex-1 bg-card ${quick.card} p-4`}>
                    <header className="mb-2 flex items-start justify-between">
                      <hgroup className="flex-1">
                        <h4 className="text-sm font-medium">{event.title}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                      </hgroup>
                      <span className="ml-4 flex items-center gap-1 text-xs text-muted-foreground">
                        <StatusIcon className={iconSizes.xs} />
                        {event.status === 'completed' ? 'Ολοκληρώθηκε' :
                          event.status === 'in_progress' ? 'Σε εξέλιξη' :
                          event.status === 'pending' ? 'Εκκρεμεί' : 'Ακυρώθηκε'}
                      </span>
                    </header>

                    <footer className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-4">
                        <time className="flex items-center gap-1">
                          <Calendar className={iconSizes.xs} />
                          {formatDate(event.date.toISOString())}
                        </time>
                        {event.actor && (
                          <span className="flex items-center gap-1">
                            <User className={iconSizes.xs} />
                            {event.actor}
                          </span>
                        )}
                      </span>

                      {event.metadata && (
                        <span className="flex gap-2">
                          {typeof event.metadata.amount === 'number' && (
                            <span className={`rounded px-2 py-1 ${colors.bg.successSubtle} ${colors.text.success}`}>
                              {formatCurrency(event.metadata.amount)}
                            </span>
                          )}
                          {event.metadata.oldValue !== undefined && event.metadata.newValue !== undefined && (
                            <span className={`rounded px-2 py-1 text-xs ${colors.bg.infoSubtle} ${colors.text.info}`}>
                              {typeof event.metadata.oldValue === 'number' && typeof event.metadata.newValue === 'number'
                                ? `${formatCurrency(event.metadata.oldValue)} → ${formatCurrency(event.metadata.newValue)}`
                                : `${event.metadata.oldValue} → ${event.metadata.newValue}`}
                            </span>
                          )}
                        </span>
                      )}
                    </footer>
                  </section>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Current Status Summary */}
      <section>
        <h3 className="mb-4 font-semibold">Τρέχουσα Κατάσταση</h3>
        <article className={`bg-card ${quick.card} p-4`}>
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <span className="contents">
              <dt className="font-medium text-muted-foreground">Θέση</dt>
              <dd className="md:col-span-2">{parking.number}</dd>
            </span>
            <span className="contents">
              <dt className="font-medium text-muted-foreground">Κατάσταση</dt>
              <dd className="md:col-span-2">{statusLabel}</dd>
            </span>
            {parking.floor && (
              <span className="contents">
                <dt className="font-medium text-muted-foreground">Όροφος</dt>
                <dd className="md:col-span-2">{parking.floor}</dd>
              </span>
            )}
            {parking.price && (
              <span className="contents">
                <dt className="font-medium text-muted-foreground">Τιμή</dt>
                <dd className="md:col-span-2">{formatCurrency(parking.price)}</dd>
              </span>
            )}
            {parking.area && (
              <span className="contents">
                <dt className="font-medium text-muted-foreground">Εμβαδόν</dt>
                <dd className="md:col-span-2">{parking.area} m²</dd>
              </span>
            )}
          </dl>
        </article>
      </section>
    </section>
  );
}

export default ParkingHistoryTab;
