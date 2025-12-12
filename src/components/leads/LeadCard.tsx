"use client";
import { User, Mail, Phone, Calendar, ExternalLink, Send, Edit3, Trash2 } from "lucide-react";
import type { Opportunity } from '@/types/crm';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';


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
    <article className={`bg-white border rounded-lg p-4 ${INTERACTIVE_PATTERNS.CARD_STANDARD}`} itemScope itemType="https://schema.org/Person">
      <header className="flex items-start justify-between">
        <section className="flex-1" aria-label="Lead Information">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-500" />
            <button
              onClick={() => onView(lead.id!)}
              className={`font-medium text-gray-900 flex items-center gap-1 group ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
            >
              <span itemProp="name">{lead.fullName}</span>
              <ExternalLink className={`w-3 h-3 opacity-0 group-hover:opacity-100 ${INTERACTIVE_PATTERNS.FADE_IN_OUT}`} />
            </button>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
          </div>

          <address className="space-y-1 text-sm text-gray-600 not-italic">
            {lead.email && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span itemProp="email">{lead.email}</span>
              </p>
            )}
            {lead.phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span itemProp="telephone">{lead.phone}</span>
              </p>
            )}
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Δημιουργήθηκε: {formatDate(lead.createdAt)}</span>
            </p>
          </address>

          {lead.notes && (
            <aside className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700" role="note" aria-label="Σημειώσεις Lead">
              <strong>Σημειώσεις:</strong> {lead.notes}
            </aside>
          )}
        </section>

        <nav className="flex flex-col gap-2 ml-4" aria-label="Ενέργειες για lead">
          <section className="flex gap-2" aria-label="Πρωτεύουσες Ενέργειες">
            <button
              onClick={() => onEmail(lead)}
              disabled={!lead.email}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                lead.email ? `text-green-600 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}` : "text-gray-400 cursor-not-allowed"
              }`}
              title={lead.email ? "Αποστολή Email" : "Δεν υπάρχει email"}
            >
              <Send className="w-4 h-4" />
              Email
            </button>

            <button
              onClick={() => onEdit(lead)}
              className={`flex items-center gap-1 px-3 py-1.5 text-blue-600 rounded text-sm ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
            >
              <Edit3 className="w-4 h-4" />
              Επεξεργασία
            </button>
          </section>

          <section className="flex gap-2" aria-label="Δευτερεύουσες Ενέργειες">
            <button
              onClick={() => onView(lead.id!)}
              className={`flex items-center gap-1 px-3 py-1.5 text-gray-600 rounded text-sm ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            >
              <ExternalLink className="w-4 h-4" />
              Προφίλ
            </button>

            <button
              onClick={() => onDelete(lead.id!, lead.fullName!)}
              className={`flex items-center gap-1 px-3 py-1.5 text-red-600 rounded text-sm ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
            >
              <Trash2 className="w-4 h-4" />
              Διαγραφή
            </button>
          </section>
        </nav>
      </header>
    </article>
  );
}
