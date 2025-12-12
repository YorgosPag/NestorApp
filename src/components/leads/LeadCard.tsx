"use client";
import { User, Mail, Phone, Calendar, ExternalLink, Send, Edit3, Trash2 } from "lucide-react";
import type { Opportunity } from '@/types/crm';


export function LeadCard({
  lead,
  onEmail,
  onEdit,
  onView,
  onDelete,
  formatDate,
  getStatusColor,
}: {
  lead: Opportunity;
  onEmail: (lead: Opportunity) => void;
  onEdit: (lead: Opportunity) => void;
  onView: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  formatDate: (ts: any) => string;
  getStatusColor: (status: string) => string;
}) {
  return (
    <article className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow" itemScope itemType="https://schema.org/Person">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-500" />
            <button
              onClick={() => onView(lead.id!)}
              className="font-medium text-gray-900 hover:text-blue-600 hover:underline flex items-center gap-1 group"
            >
              <span itemProp="name">{lead.fullName}</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
          </div>

          <address className="space-y-1 text-sm text-gray-600 not-italic">
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span itemProp="email">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span itemProp="telephone">{lead.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Δημιουργήθηκε: {formatDate(lead.createdAt)}</span>
            </div>
          </address>

          {lead.notes && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
              <strong>Σημειώσεις:</strong> {lead.notes}
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-2 ml-4" aria-label="Ενέργειες για lead">
          <div className="flex gap-2">
            <button
              onClick={() => onEmail(lead)}
              disabled={!lead.email}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                lead.email ? "text-green-600 hover:text-green-800 hover:bg-green-50" : "text-gray-400 cursor-not-allowed"
              }`}
              title={lead.email ? "Αποστολή Email" : "Δεν υπάρχει email"}
            >
              <Send className="w-4 h-4" />
              Email
            </button>

            <button
              onClick={() => onEdit(lead)}
              className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-sm transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Επεξεργασία
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onView(lead.id!)}
              className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Προφίλ
            </button>

            <button
              onClick={() => onDelete(lead.id!, lead.fullName!)}
              className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Διαγραφή
            </button>
          </div>
        </nav>
      </div>
    </article>
  );
}
