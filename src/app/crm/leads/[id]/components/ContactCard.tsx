
'use client';

import React from 'react';
import { User, Mail, Phone, Tag, Calendar } from 'lucide-react';
import type { Opportunity } from '@/types/crm';
import { formatDate } from '../utils/dates';
import { getStatusColor } from '../utils/status';

interface ContactCardProps {
  lead: Opportunity;
}

export function ContactCard({ lead }: ContactCardProps) {
  return (
    <div className="bg-white dark:bg-card rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Στοιχεία Επαφής</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium">{lead.fullName}</p>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">Πλήρες όνομα</p>
          </div>
        </div>
        {lead.email && (
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-medium">{lead.email}</p>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">Email</p>
            </div>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="font-medium">{lead.phone}</p>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">Τηλέφωνο</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-gray-400" />
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
            <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">Κατάσταση</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-medium">{formatDate(lead.createdAt)}</p>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">Ημερομηνία δημιουργίας</p>
          </div>
        </div>
      </div>
    </div>
  );
}
