/**
 * ============================================================================
 * CompanyConfigurationTab
 * ============================================================================
 *
 * Company configuration form for the admin interface.
 * Manages company name, legal info, contact details, address, and tax fields.
 *
 * Extracted from admin-interface.tsx for SRP compliance (ADR N.7.1).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building,
  Save,
  AlertCircle,
  Globe,
  Mail
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CompanyConfiguration } from './enterprise-config-management';

// ============================================================================
// Types
// ============================================================================

export interface CompanyConfigurationTabProps {
  readonly company: CompanyConfiguration | null;
  readonly isDirty: boolean;
  readonly isLoading: boolean;
  readonly showSensitiveData: boolean;
  readonly onSave: (updates: Partial<CompanyConfiguration>) => void;
  readonly onDirtyChange: (isDirty: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export const CompanyConfigurationTab: React.FC<CompanyConfigurationTabProps> = ({
  company,
  isDirty,
  isLoading,
  showSensitiveData,
  onSave,
  onDirtyChange
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [editedCompany, setEditedCompany] = useState<CompanyConfiguration | null>(company);

  useEffect(() => {
    setEditedCompany(company);
  }, [company]);

  const handleCompanyChange = (field: keyof CompanyConfiguration, value: string) => {
    if (!editedCompany) return;
    setEditedCompany(prev => prev ? { ...prev, [field]: value } : null);
    onDirtyChange(true);
  };

  const handleAddressChange = (field: keyof CompanyConfiguration['address'], value: string) => {
    if (!editedCompany) return;
    setEditedCompany(prev => prev ? {
      ...prev,
      address: { ...prev.address, [field]: value }
    } : null);
    onDirtyChange(true);
  };

  const handleTaxChange = (field: keyof CompanyConfiguration['tax'], value: string) => {
    if (!editedCompany) return;
    setEditedCompany(prev => prev ? {
      ...prev,
      tax: { ...prev.tax, [field]: value }
    } : null);
    onDirtyChange(true);
  };

  const handleSave = () => {
    if (editedCompany) {
      onSave(editedCompany);
    }
  };

  if (!editedCompany) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className={`mx-auto ${iconSizes.xl3} ${colors.text.muted} mb-4`} />
          <p className="text-lg font-medium">Company configuration not available</p>
          <p className={cn("text-sm", colors.text.muted)}>Please check your database connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <header>
          <h2 className="text-2xl font-bold tracking-tight">Company Configuration</h2>
          <p className={colors.text.muted}>
            Manage your company information and branding
          </p>
        </header>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isLoading}
            className="flex items-center gap-2"
          >
            <Save className={iconSizes.sm} />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className={iconSizes.md} />
              Basic Information
            </CardTitle>
            <CardDescription>
              Core company details and legal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={editedCompany.name}
                onChange={(e) => handleCompanyChange('name', e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="legal-name">Legal Name</Label>
              <Input
                id="legal-name"
                value={editedCompany.legalName}
                onChange={(e) => handleCompanyChange('legalName', e.target.value)}
                placeholder="Enter legal company name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vat-number">VAT Number</Label>
              <Input
                id="vat-number"
                value={editedCompany.tax.vatNumber}
                onChange={(e) => handleTaxChange('vatNumber', e.target.value)}
                placeholder="Enter VAT number"
                type={showSensitiveData ? 'text' : 'password'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className={iconSizes.md} />
              Contact Information
            </CardTitle>
            <CardDescription>
              Email, phone, and website details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={editedCompany.email}
                onChange={(e) => handleCompanyChange('email', e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={editedCompany.phone}
                onChange={(e) => handleCompanyChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={editedCompany.website}
                onChange={(e) => handleCompanyChange('website', e.target.value)}
                placeholder="Enter website URL"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className={iconSizes.md} />
              Address Information
            </CardTitle>
            <CardDescription>
              Physical address and location details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  value={editedCompany.address.street}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  placeholder="Enter street name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="number">Number</Label>
                <Input
                  id="number"
                  value={editedCompany.address.number}
                  onChange={(e) => handleAddressChange('number', e.target.value)}
                  placeholder="Enter street number"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={editedCompany.address.city}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  placeholder="Enter city name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="postal-code">Postal Code</Label>
                <Input
                  id="postal-code"
                  value={editedCompany.address.postalCode}
                  onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                  placeholder="Enter postal code"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
