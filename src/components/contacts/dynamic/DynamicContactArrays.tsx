'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Star, Phone, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  { value: 'mobile', label: '📱 Κινητό' },
  { value: 'home', label: '🏠 Σπίτι' },
  { value: 'work', label: '💼 Εργασία' },
  { value: 'fax', label: '📠 Φαξ' },
  { value: 'other', label: '📞 Άλλο' }
];

const EMAIL_TYPES = [
  { value: 'personal', label: '👤 Προσωπικό' },
  { value: 'work', label: '💼 Εργασία' },
  { value: 'other', label: '📧 Άλλο' }
];

const WEBSITE_TYPES = [
  { value: 'personal', label: '👤 Προσωπική' },
  { value: 'company', label: '🏢 Εταιρική' },
  { value: 'portfolio', label: '💼 Χαρτοφυλάκιο' },
  { value: 'blog', label: '📝 Blog' },
  { value: 'other', label: '🌐 Άλλη' }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Τηλέφωνα
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phones.map((phone, index) => (
          <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label>Αριθμός</Label>
                <Input
                  value={phone.number}
                  onChange={(e) => updatePhone(index, 'number', e.target.value)}
                  placeholder="π.χ. 6971234567"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label>Τύπος</Label>
                <Select
                  value={phone.type}
                  onValueChange={(value) => updatePhone(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
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
              <div>
                <Label>Ετικέτα</Label>
                <Input
                  value={phone.label || ''}
                  onChange={(e) => updatePhone(index, 'label', e.target.value)}
                  placeholder="π.χ. Κινητό εργασίας"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePhone(index)}
                disabled={disabled || phones.length === 1}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          E-mails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.map((email, index) => (
          <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label>Διεύθυνση E-mail</Label>
                <Input
                  type="email"
                  value={email.email}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                  placeholder="π.χ. john@example.com"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label>Τύπος</Label>
                <Select
                  value={email.type}
                  onValueChange={(value) => updateEmail(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
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
              <div>
                <Label>Ετικέτα</Label>
                <Input
                  value={email.label || ''}
                  onChange={(e) => updateEmail(index, 'label', e.target.value)}
                  placeholder="π.χ. E-mail εργασίας"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEmail(index)}
                disabled={disabled || emails.length === 1}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
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
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Ιστοσελίδες
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {websites.map((website, index) => (
          <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label>URL</Label>
                <Input
                  type="url"
                  value={website.url}
                  onChange={(e) => updateWebsite(index, 'url', e.target.value)}
                  placeholder="π.χ. https://example.com"
                  disabled={disabled}
                />
              </div>
              <div>
                <Label>Τύπος</Label>
                <Select
                  value={website.type}
                  onValueChange={(value) => updateWebsite(index, 'type', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
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
              <div>
                <Label>Ετικέτα</Label>
                <Input
                  value={website.label || ''}
                  onChange={(e) => updateWebsite(index, 'label', e.target.value)}
                  placeholder="π.χ. Προσωπική σελίδα"
                  disabled={disabled}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeWebsite(index)}
              disabled={disabled}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
      </CardContent>
    </Card>
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
    <div className="space-y-6">
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