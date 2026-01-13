'use client';
import { Archive } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  getTypeIcon, getTypeColor, getStatusIcon, getStatusColor,
  getDirectionLabel, getRelativeTime
} from './communications/utils/formatters';
import { formatDateTime as formatDate } from '@/lib/intl-utils';
import { useCommunicationsHistory } from './communications/hooks/useCommunicationsHistory';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

// ============================================================================
// 🏢 ENTERPRISE: Type-safe component props
// ============================================================================
interface CommunicationsHistoryProps {
  contactId: string;
}

/** Firestore-ish timestamp type (may have toDate method) */
interface FirestoreishTimestamp {
  toDate?: () => Date;
}

/**
 * Convert Firestore timestamp or other date types to Date
 * @enterprise ADR-compliant type-safe timestamp conversion
 */
function toDate(value: unknown): Date {
  if (!value) return new Date();

  // Firestore timestamp
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const ts = value as FirestoreishTimestamp;
    if (typeof ts.toDate === 'function') {
      return ts.toDate();
    }
  }

  // Already a Date
  if (value instanceof Date) return value;

  // String or number
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return new Date();
}

export default function CommunicationsHistory({ contactId }: CommunicationsHistoryProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { communications, loading, error, fetchCommunications } = useCommunicationsHistory(contactId);

  if (loading) return (
    <section className="flex items-center justify-center py-8" aria-label="Loading communications">
      <div className="text-center">
        <AnimatedSpinner size="medium" className="mx-auto mb-2" />
        <p className={`text-sm ${colors.text.muted}`}>Φόρτωση επικοινωνιών...</p>
      </div>
    </section>
  );

  if (error) return (
    <section className={`${colors.bg.error} ${getStatusBorder('error')} p-4`} role="alert" aria-label="Error loading communications">
      <p className={`${colors.text.error} text-sm`}>{error}</p>
      <button onClick={fetchCommunications} className={`mt-2 px-3 py-1 ${colors.bg.error} text-white rounded text-sm ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}>
        Δοκιμή ξανά
      </button>
    </section>
  );

  if (communications.length === 0) return (
    <section className="text-center py-8" aria-label="No communications found">
      <Archive className={`${iconSizes.xl} ${colors.text.muted} mx-auto mb-3`} />
      <h4 className={`text-sm font-medium ${colors.text.foreground} mb-1`}>Δεν υπάρχουν επικοινωνίες</h4>
      <p className={`text-xs ${colors.text.muted}`}>Το ιστορικό επικοινωνιών θα εμφανιστεί εδώ</p>
    </section>
  );

  return (
    <section className="space-y-4" aria-labelledby="communications-heading">
      <header className="flex items-center justify-between">
        <h4 id="communications-heading" className={`text-lg font-semibold ${colors.text.foreground}`}>Ιστορικό Επικοινωνιών</h4>
        <nav className="flex items-center gap-2" aria-label="Communications controls">
          <span className={`text-sm ${colors.text.muted}`}>{communications.length} επικοινωνίες</span>
          <button onClick={fetchCommunications} className={`text-sm ${colors.text.info} ${INTERACTIVE_PATTERNS.LINK_PRIMARY}`}>Ανανέωση</button>
        </nav>
      </header>

      <ul className="space-y-4 list-none" role="feed" aria-label="Communications timeline">
        {communications.map((comm, index) => {
          const TypeIcon = getTypeIcon(comm.type);
          const StatusIcon = getStatusIcon(comm.status);
          return (
            <li key={comm.id} className="relative">
              {index < communications.length - 1 && (
                <div className={`absolute left-6 top-12 bottom-0 w-0.5 ${colors.border.muted}`}></div>
              )}
              <article className="flex gap-4">
                <div className={`flex-shrink-0 ${iconSizes.xl2} rounded-full flex items-center justify-center ${getTypeColor(comm.type)}`}>
                  <TypeIcon className={iconSizes.md} />
                </div>
                <div className={`flex-1 ${colors.bg.primary} ${quick.card} p-4 shadow-sm`}>
                  <header className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className={`font-medium ${colors.text.foreground}`}>
                          {comm.subject || `${comm.type.charAt(0).toUpperCase() + comm.type.slice(1)} επικοινωνία`}
                        </h5>
                        <span className={`text-xs px-2 py-1 ${colors.bg.secondary} ${colors.text.muted} rounded`}>
                          {getDirectionLabel(comm.direction)}
                        </span>
                      </div>
                      <dl className={`flex items-center gap-4 text-sm ${colors.text.muted} m-0`}>
                        <dt className="sr-only">Participants:</dt>
                        <dd>{comm.from} → {comm.to}</dd>
                        <dt className="sr-only">Date:</dt>
                        <dd>{formatDate(toDate(comm.createdAt))}</dd>
                        <dt className="sr-only">Relative time:</dt>
                        <dd className={`text-xs ${colors.text.muted}`}>{getRelativeTime(comm.createdAt)}</dd>
                      </dl>
                    </div>
                    <div className={`flex items-center gap-1 ${getStatusColor(comm.status)}`}>
                      <StatusIcon className={iconSizes.sm} />
                      <span className="text-xs capitalize">{comm.status}</span>
                    </div>
                  </header>

                  {comm.content && (
                    <section className={`${colors.bg.secondary} rounded p-3 text-sm ${colors.text.foreground}`} aria-label="Communication content">
                      <p className="whitespace-pre-wrap">{comm.content}</p>
                    </section>
                  )}

                  {Array.isArray(comm.attachments) && comm.attachments.length > 0 && (
                    <aside className="mt-2 pt-2 border-t" aria-label="Attachments">
                      <p className={`text-xs ${colors.text.muted} mb-1`}>Συνημμένα:</p>
                      <ul className="flex gap-2 list-none">
                        {comm.attachments.map((attachment, idx) => (
                          <li key={idx} className={`text-xs ${colors.bg.info} ${colors.text.info} px-2 py-1 rounded`}>
                            📎 {attachment}
                          </li>
                        ))}
                      </ul>
                    </aside>
                  )}

                  {comm.metadata && Object.keys(comm.metadata).length > 0 && (
                    <footer className="mt-2 pt-2 border-t">
                      <details className="text-xs">
                        <summary className={`${colors.text.muted} cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}>Λεπτομέρειες</summary>
                        <dl className={`mt-1 space-y-1 ${colors.text.muted}`}>
                          {Object.entries(comm.metadata).map(([key, value]) => (
                            <div key={key}>
                              <dt className="font-medium inline">{key}:</dt>
                              <dd className="inline ml-1">{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </footer>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}