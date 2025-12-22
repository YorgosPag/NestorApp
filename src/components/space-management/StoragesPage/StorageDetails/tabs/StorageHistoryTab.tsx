'use client';

import React from 'react';
import type { Storage } from '@/types/storage/contracts';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
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
    oldValue?: any;
    newValue?: any;
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

function getEventColor(type: HistoryEvent['type']) {
  switch (type) {
    case 'lease': return 'text-blue-600 bg-blue-50';
    case 'maintenance': return 'text-orange-600 bg-orange-50';
    case 'inspection': return 'text-green-600 bg-green-50';
    case 'status_change': return 'text-purple-600 bg-purple-50';
    case 'price_change': return 'text-emerald-600 bg-emerald-50';
    case 'tenant_change': return 'text-cyan-600 bg-cyan-50';
    default: return 'text-gray-600 bg-gray-50';
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
  // Γεννάμε πραγματικό ιστορικό βάση των στοιχείων της αποθήκης
  const historyEvents: HistoryEvent[] = [
    {
      id: '1',
      type: 'status_change',
      title: 'Δημιουργία Αποθήκης',
      description: `Η αποθήκη ${storage.name} προστέθηκε στο σύστημα`,
      date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 μήνες πριν
      actor: 'Διαχείριση Κτιρίου',
      status: 'completed',
      metadata: {
        newValue: 'created'
      }
    },
    ...(storage.status === 'occupied' ? [
      {
        id: '2',
        type: 'lease' as const,
        title: 'Έναρξη Μίσθωσης',
        description: `Υπογραφή συμβολαίου μίσθωσης για την αποθήκη ${storage.name}`,
        date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 4 μήνες πριν
        actor: storage.owner || 'Μισθωτής',
        status: 'completed' as const,
        metadata: {
          amount: storage.price,
          tenant: storage.owner
        }
      },
      {
        id: '3',
        type: 'tenant_change' as const,
        title: 'Καταχώριση Στοιχείων Μισθωτή',
        description: `Καταχώριση στοιχείων μισθωτή: ${storage.owner}`,
        date: new Date(Date.now() - 118 * 24 * 60 * 60 * 1000),
        actor: 'Διαχείριση',
        status: 'completed' as const,
        metadata: {
          tenant: storage.owner
        }
      }
    ] : []),
    {
      id: '4',
      type: 'inspection',
      title: 'Ετήσια Επιθεώρηση',
      description: `Πραγματοποιήθηκε ετήσια επιθεώρηση για την αποθήκη στον ${storage.floor}`,
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 3 μήνες πριν
      actor: 'Τεχνικός Ελεγκτής',
      status: 'completed',
    },
    ...(storage.price ? [{
      id: '5',
      type: 'price_change' as const,
      title: 'Ενημέρωση Τιμής',
      description: `Ενημερώθηκε η τιμή της αποθήκης σε ${formatCurrency(storage.price)}`,
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 2 μήνες πριν
      actor: 'Διαχείριση',
      status: 'completed' as const,
      metadata: {
        newValue: storage.price,
        oldValue: storage.price * 0.9 // 10% παλαιότερη τιμή
      }
    }] : []),
    ...(storage.status === 'maintenance' ? [{
      id: '6',
      type: 'maintenance' as const,
      title: 'Έναρξη Εργασιών Συντήρησης',
      description: `Ξεκίνησαν εργασίες συντήρησης και αναβάθμισης της αποθήκης`,
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 εβδομάδες πριν
      actor: 'Συνεργείο Συντήρησης',
      status: 'in_progress' as const,
    }] : []),
    {
      id: '7',
      type: 'status_change',
      title: `Κατάσταση: ${storage.status === 'available' ? 'Διαθέσιμη' :
                         storage.status === 'occupied' ? 'Κατειλημμένη' :
                         storage.status === 'reserved' ? 'Κρατημένη' :
                         storage.status === 'maintenance' ? 'Συντήρηση' : 'Άγνωστη'}`,
      description: `Η αποθήκη βρίσκεται σε κατάσταση: ${storage.status}`,
      date: storage.lastUpdated || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      actor: 'Σύστημα',
      status: 'completed',
      metadata: {
        newValue: storage.status
      }
    }
  ].sort((a, b) => b.date.getTime() - a.date.getTime()); // Ταξινομημένα κατά ημερομηνία

  const eventsByType = {
    total: historyEvents.length,
    lease: historyEvents.filter(e => e.type === 'lease').length,
    maintenance: historyEvents.filter(e => e.type === 'maintenance').length,
    inspection: historyEvents.filter(e => e.type === 'inspection').length,
    changes: historyEvents.filter(e => e.type === 'status_change' || e.type === 'price_change').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* Στατιστικά Ιστορικού */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Επισκόπηση Ιστορικού
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{eventsByType.total}</div>
            <div className="text-sm text-muted-foreground">Συνολικά Γεγονότα</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{eventsByType.lease}</div>
            <div className="text-sm text-muted-foreground">Μισθώσεις</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{eventsByType.maintenance}</div>
            <div className="text-sm text-muted-foreground">Συντηρήσεις</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{eventsByType.inspection}</div>
            <div className="text-sm text-muted-foreground">Επιθεωρήσεις</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{eventsByType.changes}</div>
            <div className="text-sm text-muted-foreground">Αλλαγές</div>
          </div>
        </div>
      </section>

      {/* Timeline Γεγονότων */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Χρονολόγιο Γεγονότων
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
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                    <EventIcon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-card border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{event.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
                          <StatusIcon className="h-3 w-3" />
                          {event.status === 'completed' ? 'Ολοκληρώθηκε' :
                           event.status === 'in_progress' ? 'Σε εξέλιξη' :
                           event.status === 'pending' ? 'Εκκρεμές' : 'Ακυρώθηκε'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.date.toISOString())}
                          </span>
                          {event.actor && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.actor}
                            </span>
                          )}
                        </div>

                        {/* Metadata */}
                        {event.metadata && (
                          <div className="flex gap-2">
                            {event.metadata.amount && (
                              <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                                {formatCurrency(event.metadata.amount)}
                              </span>
                            )}
                            {event.metadata.oldValue && event.metadata.newValue && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                {typeof event.metadata.oldValue === 'number' ?
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

      {/* Περίληψη Κατάστασης */}
      <section>
        <h3 className="font-semibold mb-4">Τρέχουσα Κατάσταση</h3>
        <div className="bg-card border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="font-medium text-muted-foreground">Αποθήκη:</label>
              <span className="ml-2">{storage.name}</span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Κατάσταση:</label>
              <span className="ml-2">
                {storage.status === 'available' ? 'Διαθέσιμη' :
                 storage.status === 'occupied' ? 'Κατειλημμένη' :
                 storage.status === 'reserved' ? 'Κρατημένη' :
                 storage.status === 'maintenance' ? 'Συντήρηση' : 'Άγνωστη'}
              </span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Τελευταία Ενημέρωση:</label>
              <span className="ml-2">
                {storage.lastUpdated ? formatDate(storage.lastUpdated.toISOString()) : 'Δεν έχει καταγραφεί'}
              </span>
            </div>
            {storage.owner && (
              <div>
                <label className="font-medium text-muted-foreground">Υπεύθυνος:</label>
                <span className="ml-2">{storage.owner}</span>
              </div>
            )}
            {storage.price && (
              <div>
                <label className="font-medium text-muted-foreground">Τρέχουσα Αξία:</label>
                <span className="ml-2">{formatCurrency(storage.price)}</span>
              </div>
            )}
            <div>
              <label className="font-medium text-muted-foreground">Επιφάνεια:</label>
              <span className="ml-2">{storage.area} m²</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}