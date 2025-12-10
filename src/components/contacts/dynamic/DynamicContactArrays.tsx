'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Star, Phone, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { PhoneInfo, EmailInfo, WebsiteInfo } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface DynamicContactArraysProps {
  phones?: PhoneInfo[];
  emails?: EmailInfo[];
  websites?: WebsiteInfo[];
  disabled?: boolean;
  onPhonesChange?: (phones: PhoneInfo[]) => void;
  onEmailsChange?: (emails: EmailInfo[]) => void;
  onWebsitesChange?: (websites: WebsiteInfo[]) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PHONE_TYPES = [
  { value: 'mobile', label: 'Κινητό' },
  { value: 'home', label: 'Σπίτι' },
  { value: 'work', label: 'Εργασία' },
  { value: 'fax', label: 'Φαξ' },
  { value: 'other', label: 'Άλλο' }
];

const EMAIL_TYPES = [
  { value: 'personal', label: 'Προσωπικό' },
  { value: 'work', label: 'Εργασία' },
  { value: 'other', label: 'Άλλο' }
];

const WEBSITE_TYPES = [
  { value: 'personal', label: 'Προσωπική' },
  { value: 'company', label: 'Εταιρική' },
  { value: 'portfolio', label: 'Χαρτοφυλάκιο' },
  { value: 'blog', label: 'Blog' },
  { value: 'other', label: 'Άλλη' }
];

// ============================================================================
// PHONE MANAGER
// ============================================================================

interface PhoneManagerProps {
  phones: PhoneInfo[];
  disabled?: boolean;
  onChange: (phones: PhoneInfo[]) => void;
}

function PhoneManager({ phones, disabled = false, onChange }: PhoneManagerProps) {
  const addPhone = useCallback(() => {
    const newPhone: PhoneInfo = {
      number: '',
      type: 'mobile',
      isPrimary: phones.length === 0, // First phone is primary
      label: '',
      countryCode: '+30'
    };
    onChange([...phones, newPhone]);
  }, [phones, onChange]);

  const updatePhone = useCallback((index: number, field: keyof PhoneInfo, value: any) => {
    const updated = phones.map((phone, i) =>
      i === index ? { ...phone, [field]: value } : phone
    );
    onChange(updated);
  }, [phones, onChange]);

  const removePhone = useCallback((index: number) => {
    const updated = phones.filter((_, i) => i !== index);

    // If removed phone was primary and others exist, make first one primary
    if (phones[index].isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }

    onChange(updated);
  }, [phones, onChange]);

  const setPrimary = useCallback((index: number) => {
    const updated = phones.map((phone, i) => ({
      ...phone,
      isPrimary: i === index
    }));
    onChange(updated);
  }, [phones, onChange]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Phone className="h-4 w-4" />
        Τηλέφωνα
      </div>
        {phones.map((phone, index) => (
          <div key={index} className="w-full max-w-none min-w-full p-4 border rounded-lg">
            <div className="w-full max-w-none min-w-full space-y-4">
              <div className="w-full max-w-none min-w-full">
                <Label>Αριθμός</Label>
                <Input
                  value={phone.number}
                  onChange={(e) => updatePhone(index, 'number', e.target.value)}
                  placeholder="π.χ. 6971234567"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Τύπος</Label>
                <Select
                  value={phone.type}
                  onValueChange={(value) => updatePhone(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Ετικέτα</Label>
                <Input
                  value={phone.label || ''}
                  onChange={(e) => updatePhone(index, 'label', e.target.value)}
                  placeholder="π.χ. Κινητό εργασίας"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                {phone.isPrimary && (
                  <Badge variant="default" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Κύριο
                  </Badge>
                )}
                {!phone.isPrimary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrimary(index)}
                    disabled={disabled}
                    className="text-xs"
                  >
                    Ορισμός ως κύριο
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removePhone(index)}
                disabled={disabled || phones.length === 1}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Διαγραφή
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addPhone}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη Τηλεφώνου
        </Button>
    </div>
  );
}

// ============================================================================
// EMAIL MANAGER
// ============================================================================

interface EmailManagerProps {
  emails: EmailInfo[];
  disabled?: boolean;
  onChange: (emails: EmailInfo[]) => void;
}

function EmailManager({ emails, disabled = false, onChange }: EmailManagerProps) {
  const addEmail = useCallback(() => {
    const newEmail: EmailInfo = {
      email: '',
      type: 'personal',
      isPrimary: emails.length === 0,
      label: ''
    };
    onChange([...emails, newEmail]);
  }, [emails, onChange]);

  const updateEmail = useCallback((index: number, field: keyof EmailInfo, value: any) => {
    const updated = emails.map((email, i) =>
      i === index ? { ...email, [field]: value } : email
    );
    onChange(updated);
  }, [emails, onChange]);

  const removeEmail = useCallback((index: number) => {
    const updated = emails.filter((_, i) => i !== index);

    if (emails[index].isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }

    onChange(updated);
  }, [emails, onChange]);

  const setPrimary = useCallback((index: number) => {
    const updated = emails.map((email, i) => ({
      ...email,
      isPrimary: i === index
    }));
    onChange(updated);
  }, [emails, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Mail className="h-4 w-4" />
        E-mails
      </div>
        {emails.map((email, index) => (
          <div key={index} className="w-full max-w-none min-w-full p-4 border rounded-lg">
            <div className="w-full max-w-none min-w-full space-y-4">
              <div className="w-full max-w-none min-w-full">
                <Label>Διεύθυνση E-mail</Label>
                <Input
                  type="email"
                  value={email.email}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                  placeholder="π.χ. john@example.com"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Τύπος</Label>
                <Select
                  value={email.type}
                  onValueChange={(value) => updateEmail(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Ετικέτα</Label>
                <Input
                  value={email.label || ''}
                  onChange={(e) => updateEmail(index, 'label', e.target.value)}
                  placeholder="π.χ. E-mail εργασίας"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                {email.isPrimary && (
                  <Badge variant="default" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Κύριο
                  </Badge>
                )}
                {!email.isPrimary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrimary(index)}
                    disabled={disabled}
                    className="text-xs"
                  >
                    Ορισμός ως κύριο
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeEmail(index)}
                disabled={disabled || emails.length === 1}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Διαγραφή
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addEmail}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη E-mail
        </Button>
    </div>
  );
}

// ============================================================================
// WEBSITE MANAGER
// ============================================================================

interface WebsiteManagerProps {
  websites: WebsiteInfo[];
  disabled?: boolean;
  onChange: (websites: WebsiteInfo[]) => void;
}

function WebsiteManager({ websites, disabled = false, onChange }: WebsiteManagerProps) {
  const addWebsite = useCallback(() => {
    const newWebsite: WebsiteInfo = {
      url: '',
      type: 'personal',
      label: ''
    };
    onChange([...websites, newWebsite]);
  }, [websites, onChange]);

  const updateWebsite = useCallback((index: number, field: keyof WebsiteInfo, value: any) => {
    const updated = websites.map((website, i) =>
      i === index ? { ...website, [field]: value } : website
    );
    onChange(updated);
  }, [websites, onChange]);

  const removeWebsite = useCallback((index: number) => {
    const updated = websites.filter((_, i) => i !== index);
    onChange(updated);
  }, [websites, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Globe className="h-4 w-4" />
        Ιστοσελίδες
      </div>
        {websites.map((website, index) => (
          <div key={index} className="w-full max-w-none min-w-full p-4 border rounded-lg">
            <div className="w-full max-w-none min-w-full space-y-4">
              <div className="w-full max-w-none min-w-full">
                <Label>URL</Label>
                <Input
                  type="url"
                  value={website.url}
                  onChange={(e) => updateWebsite(index, 'url', e.target.value)}
                  placeholder="π.χ. https://example.com"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Τύπος</Label>
                <Select
                  value={website.type}
                  onValueChange={(value) => updateWebsite(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBSITE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full max-w-none min-w-full">
                <Label>Ετικέτα</Label>
                <Input
                  value={website.label || ''}
                  onChange={(e) => updateWebsite(index, 'label', e.target.value)}
                  placeholder="π.χ. Προσωπική σελίδα"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex justify-end mt-4 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeWebsite(index)}
                disabled={disabled}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Διαγραφή
              </Button>
            </div>
          </div>
        ))}

        {websites.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Δεν έχουν οριστεί ιστοσελίδες
          </div>
        )}

        <Button
          variant="outline"
          onClick={addWebsite}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη Ιστοσελίδας
        </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DynamicContactArrays({
  phones = [],
  emails = [],
  websites = [],
  disabled = false,
  onPhonesChange,
  onEmailsChange,
  onWebsitesChange
}: DynamicContactArraysProps) {

  // Ensure we always have at least one entry for essential fields
  const normalizedPhones = phones.length === 0 ? [{
    number: '',
    type: 'mobile' as const,
    isPrimary: true,
    label: ''
  }] : phones;

  const normalizedEmails = emails.length === 0 ? [{
    email: '',
    type: 'personal' as const,
    isPrimary: true,
    label: ''
  }] : emails;

  return (
    <div
      className="w-full max-w-none min-w-full space-y-8"
      style={{ width: '100%', maxWidth: 'none', minWidth: '100%' }}
    >
      <PhoneManager
        phones={normalizedPhones}
        disabled={disabled}
        onChange={onPhonesChange || (() => {})}
      />

      <EmailManager
        emails={normalizedEmails}
        disabled={disabled}
        onChange={onEmailsChange || (() => {})}
      />

      <WebsiteManager
        websites={websites}
        disabled={disabled}
        onChange={onWebsitesChange || (() => {})}
      />
    </div>
  );
}

export default DynamicContactArrays;