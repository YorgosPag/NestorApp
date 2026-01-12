"use client";
import { User, Mail, Phone, Calendar, ExternalLink, Send, Edit3, Trash2 } from "lucide-react";
import type { Opportunity } from '@/types/crm';
import { INTERACTIVE_PATTERNS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';


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
  formatDate: (ts: Date | string | number | { seconds: number; nanoseconds: number } | null | undefined) => string;
  getStatusColor: (status: string) => string;
}) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <article className={`${colors.bg.primary} border rounded-lg p-4 ${INTERACTIVE_PATTERNS.CARD_STANDARD}`} itemScope itemType="https://schema.org/Person">
      <header className="flex items-start justify-between">
        <section className="flex-1" aria-label="Lead Information">
          <div className="flex items-center gap-2 mb-2">
            <User className={`${iconSizes.sm} ${colors.text.muted}`} />
            <button
              onClick={() => onView(lead.id!)}
              className={`font-medium ${colors.text.foreground} flex items-center gap-1 group ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}
            >
              <span itemProp="name">{lead.fullName}</span>
              <ExternalLink className={`${iconSizes.xs} ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} ${INTERACTIVE_PATTERNS.FADE_IN_OUT}`} />
            </button>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.stage)}`}>
              {lead.stage}
            </span>
          </div>

          <address className={`space-y-1 text-sm ${colors.text.muted} not-italic`}>
            {lead.email && (
              <p className="flex items-center gap-2">
                <Mail className={iconSizes.sm} />
                <span itemProp="email">{lead.email}</span>
              </p>
            )}
            {lead.phone && (
              <p className="flex items-center gap-2">
                <Phone className={iconSizes.sm} />
                <span itemProp="telephone">{lead.phone}</span>
              </p>
            )}
            <p className="flex items-center gap-2">
              <Calendar className={iconSizes.sm} />
              <span>Δημιουργήθηκε: {formatDate(lead.createdAt)}</span>
            </p>
          </address>

          {lead.notes && (
            <aside className={`mt-2 p-2 ${colors.bg.secondary} rounded text-sm ${colors.text.muted}`} role="note" aria-label="Σημειώσεις Lead">
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
                lead.email ? `${colors.text.success} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}` : `${colors.text.muted} cursor-not-allowed`
              }`}
              title={lead.email ? "Αποστολή Email" : "Δεν υπάρχει email"}
            >
              <Send className={iconSizes.sm} />
              Email
            </button>

            <button
              onClick={() => onEdit(lead)}
              className={`flex items-center gap-1 px-3 py-1.5 ${colors.text.info} rounded text-sm ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
            >
              <Edit3 className={iconSizes.sm} />
              Επεξεργασία
            </button>
          </section>

          <section className="flex gap-2" aria-label="Δευτερεύουσες Ενέργειες">
            <button
              onClick={() => onView(lead.id!)}
              className={`flex items-center gap-1 px-3 py-1.5 ${colors.text.muted} rounded text-sm ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
            >
              <ExternalLink className={iconSizes.sm} />
              Προφίλ
            </button>

            <button
              onClick={() => onDelete(lead.id!, lead.fullName!)}
              className={`flex items-center gap-1 px-3 py-1.5 ${colors.text.error} rounded text-sm ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
            >
              <Trash2 className={iconSizes.sm} />
              Διαγραφή
            </button>
          </section>
        </nav>
      </header>
    </article>
  );
}
