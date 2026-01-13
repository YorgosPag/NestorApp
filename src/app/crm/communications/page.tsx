'use client';

/**
 * =============================================================================
 * CRM COMMUNICATIONS PAGE - EPIC Δ
 * =============================================================================
 *
 * Tab-based layout for staff communications management.
 * - Tab 1: Unified Inbox (conversations + thread + composer)
 * - Tab 2: Contact History (per-contact communication timeline)
 *
 * @module app/crm/communications/page
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageSquare, User, Inbox, History } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Lazy imports for performance
import dynamic from 'next/dynamic';

const UnifiedInbox = dynamic(
  () => import('@/components/crm/UnifiedInbox').then(mod => ({ default: mod.UnifiedInbox })),
  { ssr: false }
);

const CommunicationsHistory = dynamic(
  () => import('@/components/CommunicationsHistory'),
  { ssr: false }
);

const ContactSearchManager = dynamic(
  () => import('@/components/contacts/relationships/ContactSearchManager').then(mod => ({ default: mod.ContactSearchManager })),
  { ssr: false }
);

import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';

// ============================================================================
// COMPONENT
// ============================================================================

export default function CrmCommunicationsPage() {
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // State for Contact History tab
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);

  // 🏢 ENTERPRISE: Handle contact selection
  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setSelectedContact(contact);
  }, []);

  return (
    <main className="flex flex-col h-full p-6">
      <Tabs defaultValue="inbox" className="flex flex-col flex-1 min-h-0 w-full">
        {/* Tab Navigation - w-auto prevents truncation */}
        <TabsList className="mb-6 w-auto flex-shrink-0">
          <TabsTrigger value="inbox" className="flex items-center gap-2 whitespace-nowrap">
            <Inbox className={iconSizes.sm} />
            <span>{t('inbox.tabs.conversations')}</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 whitespace-nowrap">
            <History className={iconSizes.sm} />
            <span>{t('inbox.tabs.contactHistory')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Unified Inbox */}
        <TabsContent value="inbox" className="flex-1 min-h-0">
          <UnifiedInbox
            showFilters
            enablePolling
          />
        </TabsContent>

        {/* Tab 2: Contact History */}
        <TabsContent value="history">
          <section className="space-y-6" aria-label={t('inbox.tabs.contactHistory')}>
            {/* Contact Selector Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className={iconSizes.lg} />
                  {t('inbox.selectContactTitle')}
                </CardTitle>
                <CardDescription>
                  {selectedContact
                    ? t('inbox.message.from') + ': ' + selectedContact.name
                    : t('inbox.thread.selectConversation')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactSearchManager
                  selectedContactId={selectedContact?.id ?? ''}
                  onContactSelect={handleContactSelect}
                  label={t('inbox.search')}
                  placeholder={t('inbox.search')}
                  allowedContactTypes={['individual', 'company', 'service']}
                />
                {selectedContact && (
                  <article className={`mt-4 p-3 rounded-lg ${colors.bg.infoSubtle} flex items-center gap-3`}>
                    <figure className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full ${colors.bg.accent} flex items-center justify-center`}>
                        <User className={`${iconSizes.md} ${colors.text.accent}`} />
                      </div>
                    </figure>
                    <div>
                      <p className="font-medium">{selectedContact.name}</p>
                      <p className={`text-sm ${colors.text.muted}`}>
                        {selectedContact.email || selectedContact.phone || selectedContact.type}
                      </p>
                    </div>
                  </article>
                )}
              </CardContent>
            </Card>

            {/* Communications History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className={iconSizes.lg} />
                  {t('inbox.historyTitle')}
                </CardTitle>
                <CardDescription>
                  {selectedContact
                    ? `${t('inbox.messagesCount', { count: 0 })} - ${selectedContact.name}`
                    : t('inbox.thread.selectConversation')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedContact ? (
                  <CommunicationsHistory contactId={selectedContact.id} />
                ) : (
                  <figure className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className={`${iconSizes.xl2} ${colors.text.muted} mb-4 opacity-30`} />
                    <figcaption className="text-center">
                      <p className={`text-lg font-medium ${colors.text.foreground}`}>
                        {t('inbox.noConversations')}
                      </p>
                      <p className={`text-sm ${colors.text.muted}`}>
                        {t('inbox.thread.selectConversation')}
                      </p>
                    </figcaption>
                  </figure>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
