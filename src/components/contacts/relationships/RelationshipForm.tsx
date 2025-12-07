// ============================================================================
// RELATIONSHIP FORM COMPONENT
// ============================================================================
//
// 📝 Form component for adding and editing relationships
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and utilities
import type { RelationshipType } from '@/types/contacts/relationships';
import { EmployeeSelector, type ContactSummary } from './EmployeeSelector';
import {
  getRelationshipTypeConfig,
  getAvailableRelationshipTypes
} from './utils/relationship-types';
import type { RelationshipFormProps } from './types/relationship-manager.types';

/**
 * 📝 RelationshipForm Component
 *
 * Enterprise form component for creating and editing contact relationships
 *
 * Features:
 * - Dynamic relationship type filtering based on contact type
 * - Professional contact information fields
 * - Form validation and error handling
 * - Loading states and user feedback
 */
export const RelationshipForm: React.FC<RelationshipFormProps> = ({
  formData,
  setFormData,
  contactType,
  currentContactId,
  loading,
  error,
  editingId,
  onSubmit,
  onCancel
}) => {
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * 📋 Get available relationship types for current contact type
   */
  const availableRelationshipTypes = getAvailableRelationshipTypes(contactType);

  /**
   * 🎯 Handle form field changes with type safety
   */
  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * 📞 Handle contact info field changes
   */
  const handleContactInfoChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value }
    }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>{editingId ? 'Επεξεργασία Σχέσης' : 'Προσθήκη Νέας Σχέσης'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Target Contact Selection */}
            <div className="md:col-span-2">
              <EmployeeSelector
                value={formData.targetContactId}
                onContactSelect={(contact: ContactSummary | null) => {
                  setFormData(prev => ({
                    ...prev,
                    targetContactId: contact?.id || ''
                  }));
                }}
                label="Επαφή*"
                placeholder="Αναζήτηση επαφής..."
                allowedContactTypes={['individual', 'company', 'service']}
                excludeContactIds={[currentContactId]} // 🚫 Exclude current contact από το dropdown
                required
                error={!formData.targetContactId ? 'Η επιλογή επαφής είναι υποχρεωτική' : undefined}
              />
            </div>

            {/* Relationship Type Selection */}
            <div>
              <Label htmlFor="relationshipType">Τύπος Σχέσης*</Label>
              <Select
                value={formData.relationshipType}
                onValueChange={(value: RelationshipType) =>
                  handleFieldChange('relationshipType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε τύπο σχέσης" />
                </SelectTrigger>
                <SelectContent>
                  {availableRelationshipTypes.map((type) => {
                    const config = getRelationshipTypeConfig(type);
                    if (!config) return null;

                    const Icon = config.icon;

                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Position Field */}
            <div>
              <Label htmlFor="position">Θέση</Label>
              <Input
                id="position"
                value={formData.position || ''}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                placeholder="π.χ. Διευθυντής Πωλήσεων"
              />
            </div>

            {/* Department Field */}
            <div>
              <Label htmlFor="department">Τμήμα</Label>
              <Input
                id="department"
                value={formData.department || ''}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                placeholder="π.χ. Οικονομικό Τμήμα"
              />
            </div>

            {/* Start Date Field */}
            <div>
              <Label htmlFor="startDate">Ημερομηνία Έναρξης</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
              />
            </div>

            {/* Professional Contact Information Section */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">Επαγγελματικά Στοιχεία Επικοινωνίας</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <Input
                  placeholder="Επαγγελματικό τηλέφωνο"
                  value={formData.contactInfo?.businessPhone || ''}
                  onChange={(e) => handleContactInfoChange('businessPhone', e.target.value)}
                />
                <Input
                  placeholder="Επαγγελματικό email"
                  type="email"
                  value={formData.contactInfo?.businessEmail || ''}
                  onChange={(e) => handleContactInfoChange('businessEmail', e.target.value)}
                />
                <Input
                  placeholder="Εσωτερικό τηλέφωνο"
                  value={formData.contactInfo?.extensionNumber || ''}
                  onChange={(e) => handleContactInfoChange('extensionNumber', e.target.value)}
                />
                <Input
                  placeholder="Διεύθυνση εργασίας"
                  value={formData.contactInfo?.businessAddress || ''}
                  onChange={(e) => handleContactInfoChange('businessAddress', e.target.value)}
                />
              </div>
            </div>

            {/* Notes Field */}
            <div className="md:col-span-2">
              <Label htmlFor="notes">Σημειώσεις</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Πρόσθετες πληροφορίες..."
                rows={3}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Ακύρωση
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={onSubmit}
            >
              {loading ? 'Αποθήκευση...' : (editingId ? 'Ενημέρωση' : 'Προσθήκη')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RelationshipForm;