'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Briefcase } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { getPrimaryEmail, getPrimaryPhone } from '@/types/contacts';
import { CompanyProjectsTable } from './CompanyProjectsTable';
import { CustomerStats } from './CustomerStats';
import { CustomerPropertiesTable } from './CustomerPropertiesTable';

interface ContactInfoProps {
  contact: Contact;
  onAddUnit: () => void;
  onRefresh: () => void;
}

export function ContactInfo({ contact, onAddUnit, onRefresh }: ContactInfoProps) {
    const { t } = useTranslation('contacts');
    const email = getPrimaryEmail(contact);
    const phone = getPrimaryPhone(contact);

    return (
      <div className="space-y-4">
        <div className="p-4 border rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">{t('details.contactInfo.title')}</h4>
            {email && (
                <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                        href={`mailto:${email}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title={`Αποστολή email στο ${email}`}
                    >
                        {email}
                    </a>
                </div>
            )}
            {phone && (
                <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                        href={`tel:${phone}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        title={`Κλήση στο ${phone}`}
                    >
                        {phone}
                    </a>
                </div>
            )}
            {!(email || phone) && <p className="text-sm text-muted-foreground">{t('details.contactInfo.noContactInfo')}</p>}
        </div>
         {(contact.type === 'company' || contact.type === 'individual') && (
            <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">{t('details.taxInfo.title')}</h4>
                <div className="text-sm">
                    <strong>{t('details.taxInfo.vatNumber')}</strong> {(contact as any).vatNumber || (contact as any).taxNumber || t('details.taxInfo.notSet')}
                </div>
            </div>
         )}
         {contact.type === 'company' && contact.id && (
            <CompanyProjectsTable companyId={contact.id} />
         )}
         {(contact.type === 'individual' || contact.type === 'company') && contact.id && (
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
