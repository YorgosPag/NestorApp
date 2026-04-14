'use client';

/**
 * =============================================================================
 * CONTACT EMAIL PICKER — CRM Contact or Manual Email Input
 * =============================================================================
 *
 * Toggle between manual email entry and CRM contact selection.
 * When a CRM contact is selected, auto-fills recipients from their emails.
 *
 * @module components/ui/email-sharing/ContactEmailPicker
 * @enterprise Phase 1 — Contact Email Sharing
 */

import React, { useState, useCallback, useRef } from 'react';
import { Plus, X, Search, User, Building2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { isValidEmail } from '@/lib/validation/email-validation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactEmailPicker');

// ============================================================================
// TYPES
// ============================================================================

interface ShareableEmail {
  email: string;
  type: string;
  isPrimary: boolean;
}

interface ShareableContact {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'service';
  emails: ShareableEmail[];
}

interface ContactSearchResponse {
  contacts: ShareableContact[];
  count: number;
}

export interface SelectedContact {
  id: string;
  name: string;
}

export interface ContactEmailPickerProps {
  recipients: string[];
  onRecipientsChange: (emails: string[]) => void;
  maxRecipients: number;
  loading: boolean;
  onContactSelected?: (contact: SelectedContact | null) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

type RecipientMode = 'manual' | 'contact';

const CONTACT_TYPE_ICONS = {
  individual: User,
  company: Building2,
  service: Wrench,
} as const;

const DEBOUNCE_MS = 300;

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactEmailPicker({
  recipients,
  onRecipientsChange,
  maxRecipients,
  loading,
  onContactSelected,
}: ContactEmailPickerProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();

  // Mode state
  const [mode, setMode] = useState<RecipientMode>('manual');

  // Manual mode state
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Contact mode state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareableContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ShareableContact | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mode switch ──

  const handleModeChange = useCallback((newMode: RecipientMode) => {
    setMode(newMode);
    setError(null);
    if (newMode === 'manual') {
      setSelectedContact(null);
      setSearchQuery('');
      setSearchResults([]);
      onContactSelected?.(null);
    } else {
      setEmailInput('');
    }
    onRecipientsChange([]);
  }, [onRecipientsChange, onContactSelected]);

  // ── Manual mode handlers ──

  const addRecipient = useCallback(() => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setError(t('emailShare.invalidEmail'));
      return;
    }
    if (recipients.length >= maxRecipients) {
      setError(t('emailShare.maxRecipients', { max: maxRecipients }));
      return;
    }
    if (recipients.includes(trimmed)) {
      setError(t('emailShare.invalidEmail'));
      return;
    }
    onRecipientsChange([...recipients, trimmed]);
    setEmailInput('');
    setError(null);
  }, [emailInput, recipients, maxRecipients, onRecipientsChange, t]);

  const removeRecipient = useCallback((index: number) => {
    onRecipientsChange(recipients.filter((_, i) => i !== index));
  }, [recipients, onRecipientsChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  }, [addRecipient]);

  // ── Contact search ──

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedContact(null);
    onContactSelected?.(null);
    onRecipientsChange([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get<ContactSearchResponse>(
          `${API_ROUTES.CONTACTS.SEARCH_FOR_SHARE}?q=${encodeURIComponent(query.trim())}`
        );
        setSearchResults(data.contacts);
      } catch (err) {
        logger.warn('Contact search failed', { error: err });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, [onContactSelected, onRecipientsChange]);

  // ── Contact selection ──

  const handleContactSelect = useCallback((contact: ShareableContact) => {
    setSelectedContact(contact);
    setSearchQuery('');
    setSearchResults([]);
    setError(null);

    const emails = contact.emails.map(e => e.email);
    if (emails.length === 0) {
      setError(t('emailShare.noEmailsForContact'));
      onRecipientsChange([]);
    } else {
      onRecipientsChange(emails.slice(0, maxRecipients));
    }

    onContactSelected?.({ id: contact.id, name: contact.name });
    logger.info('Contact selected for share', { contactId: contact.id, emailCount: emails.length });
  }, [maxRecipients, onRecipientsChange, onContactSelected, t]);

  const clearContact = useCallback(() => {
    setSelectedContact(null);
    setSearchQuery('');
    onRecipientsChange([]);
    onContactSelected?.(null);
  }, [onRecipientsChange, onContactSelected]);

  // ── Render ──

  return (
    <fieldset className="space-y-3">
      {/* Mode toggle */}
      <nav className="flex rounded-lg border p-0.5 gap-0.5" role="tablist">
        {(['manual', 'contact'] as const).map(m => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => handleModeChange(m)}
            disabled={loading}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === m
                ? 'bg-primary text-primary-foreground'
                : `${colors.text.muted} hover:bg-muted`
            )}
          >
            {t(`emailShare.recipientMode.${m}`)}
          </button>
        ))}
      </nav>

      {/* Manual mode */}
      {mode === 'manual' && (
        <>
          <label className="text-sm font-medium mb-1.5 block">
            {t('emailShare.recipientLabel')}
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              placeholder={t('emailShare.recipientPlaceholder')}
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRecipient}
              disabled={loading || !emailInput.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('emailShare.addRecipient')}
            </Button>
          </div>
        </>
      )}

      {/* Contact mode */}
      {mode === 'contact' && !selectedContact && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder={t('emailShare.selectContact')}
            disabled={loading}
            className="pl-9"
          />

          {/* Search results dropdown */}
          {(searchResults.length > 0 || isSearching) && (
            <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-auto">
              {isSearching && (
                <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Spinner size="small" />
                  {t('emailShare.searchingContacts')}
                </li>
              )}
              {searchResults.map(contact => {
                const Icon = CONTACT_TYPE_ICONS[contact.type];
                return (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => handleContactSelect(contact)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium truncate">{contact.name}</span>
                      {contact.emails.length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground truncate">
                          {contact.emails[0].email}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Selected contact badge */}
      {mode === 'contact' && selectedContact && (
        <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
          {React.createElement(CONTACT_TYPE_ICONS[selectedContact.type], {
            className: 'w-4 h-4 text-primary shrink-0',
          })}
          <span className="text-sm font-medium truncate">{selectedContact.name}</span>
          <button
            type="button"
            onClick={clearContact}
            disabled={loading}
            className="ml-auto hover:text-destructive transition-colors"
            aria-label={t('emailShare.removeRecipient')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recipient chips (both modes) */}
      {recipients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {recipients.map((email, i) => (
            <li
              key={email}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-sm"
            >
              {email}
              <button
                type="button"
                onClick={() => removeRecipient(i)}
                className="hover:text-destructive transition-colors"
                aria-label={t('emailShare.removeRecipient')}
                disabled={loading}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
