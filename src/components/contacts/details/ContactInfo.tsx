'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Briefcase } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { getPrimaryEmail, getPrimaryPhone } from '@/types/contacts';
import { CompanyProjectsTable } from './CompanyProjectsTable';
import { CONTACT_TYPES } from '@/constants/contacts';
import { CustomerStats } from './CustomerStats';
import { CustomerPropertiesTable } from './CustomerPropertiesTable';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface ContactInfoProps {
  contact: Contact;
  onAddUnit: () => void;
  onRefresh: () => void;
}

export function ContactInfo({ contact, onAddUnit, onRefresh }: ContactInfoProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
    const { t } = useTranslation('contacts');
    const email = getPrimaryEmail(contact);
    const phone = getPrimaryPhone(contact);

    return (
      <div className="space-y-4">
        <div className={`p-4 ${quick.card} space-y-3`}>
            <h4 className="font-semibold text-sm">{t('details.contactInfo.title')}</h4>
            {email && (
                <div className="flex items-center gap-2 text-sm">
                    <Mail className={`${iconSizes.sm} text-muted-foreground`} />
                    <a
                        href={`https://mail.google.com/mail/?view=cm&to=${email}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={INTERACTIVE_PATTERNS.LINK_PRIMARY}
                        title={`Αποστολή email στο ${email} μέσω Gmail`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {email}
                    </a>
                </div>
            )}
            {phone && (
                <div className="flex items-center gap-2 text-sm">
                    <Phone className={`${iconSizes.sm} text-muted-foreground`} />
                    <a
                        href={`tel:${phone}`}
                        className={INTERACTIVE_PATTERNS.LINK_PRIMARY}
                        title={`Κλήση στο ${phone}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {phone}
                    </a>
                </div>
            )}
            {!(email || phone) && <p className="text-sm text-muted-foreground">{t('details.contactInfo.noContactInfo')}</p>}
        </div>
         {(contact.type === CONTACT_TYPES.COMPANY || contact.type === CONTACT_TYPES.INDIVIDUAL) && (
            <div className={`p-4 ${quick.card}`}>
                <h4 className="font-semibold mb-2 text-sm">{t('details.taxInfo.title')}</h4>
                <div className="text-sm">
                    <strong>{t('details.taxInfo.vatNumber')}</strong> {(contact as any).vatNumber || (contact as any).taxNumber || t('details.taxInfo.notSet')}
                </div>
            </div>
         )}
         {contact.type === CONTACT_TYPES.COMPANY && contact.id && (
            <CompanyProjectsTable companyId={contact.id} />
         )}
         {(contact.type === CONTACT_TYPES.INDIVIDUAL || contact.type === CONTACT_TYPES.COMPANY) && contact.id && (
            <>
                <CustomerStats contactId={contact.id} key={contact.id} />
                <CustomerPropertiesTable 
                    contactId={contact.id} 
                    onAddUnit={onAddUnit} 
                    key={`table-${contact.id}`} 
                />
            </>
         )}
      </div>
    )
}
