'use client';
import { Archive } from 'lucide-react';
import {
  getTypeIcon, getTypeColor, getStatusIcon, getStatusColor,
  getDirectionLabel, formatDate, getRelativeTime
} from './communications/utils/formatters';
import { useCommunicationsHistory } from './communications/hooks/useCommunicationsHistory';

export default function CommunicationsHistory({ contactId }) {
  const { communications, loading, error, fetchCommunications } = useCommunicationsHistory(contactId);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">Φόρτωση επικοινωνιών...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-red-600 text-sm">{error}</p>
      <button onClick={fetchCommunications} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
        Δοκιμή ξανά
      </button>
    </div>
  );

  if (communications.length === 0) return (
    <div className="text-center py-8">
      <Archive className="w-8 h-8 text-gray-400 mx-auto mb-3" />
      <h4 className="text-sm font-medium text-gray-900 mb-1">Δεν υπάρχουν επικοινωνίες</h4>
      <p className="text-xs text-gray-600">Το ιστορικό επικοινωνιών θα εμφανιστεί εδώ</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Ιστορικό Επικοινωνιών</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{communications.length} επικοινωνίες</span>
          <button onClick={fetchCommunications} className="text-sm text-blue-600 hover:text-blue-800">Ανανέωση</button>
        </div>
      </div>

      <div className="space-y-4">
        {communications.map((comm, index) => {
          const TypeIcon = getTypeIcon(comm.type);
          const StatusIcon = getStatusIcon(comm.status);
          return (
            <div key={comm.id} className="relative">
              {index < communications.length - 1 && (
                <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
              )}
              <div className="flex gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getTypeColor(comm.type)}`}>
                  <TypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-gray-900">
                          {comm.subject || `${comm.type.charAt(0).toUpperCase() + comm.type.slice(1)} επικοινωνία`}
                        </h5>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {getDirectionLabel(comm.direction)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{comm.from} → {comm.to}</span>
                        <span>{formatDate(comm.createdAt)}</span>
                        <span className="text-xs text-gray-500">{getRelativeTime(comm.createdAt)}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${getStatusColor(comm.status)}`}>
                      <StatusIcon className="w-4 h-4" />
                      <span className="text-xs capitalize">{comm.status}</span>
                    </div>
                  </div>

                  {comm.content && (
                    <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                      <p className="whitespace-pre-wrap">{comm.content}</p>
                    </div>
                  )}

                  {comm.attachments?.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-gray-600 mb-1">Συνημμένα:</p>
                      <div className="flex gap-2">
                        {comm.attachments.map((attachment, idx) => (
                          <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            📎 {attachment}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {comm.metadata && Object.keys(comm.metadata).length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <details className="text-xs">
                        <summary className="text-gray-600 cursor-pointer hover:text-gray-800">Λεπτομέρειες</summary>
                        <div className="mt-1 space-y-1 text-gray-500">
                          {Object.entries(comm.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}