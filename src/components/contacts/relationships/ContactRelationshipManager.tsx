'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
  Users,
  Crown,
  UserCheck,
  Briefcase
} from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized relationship types & services
import type {
  ContactRelationship,
  RelationshipType,
  ContactWithRelationship,
  ProfessionalContactInfo,
  OrganizationTree
} from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts';
import { ContactRelationshipService } from '@/services/contact-relationships.service';
import { EmployeeSelector, type ContactSummary } from './EmployeeSelector';

// ============================================================================
// 🏢 ENTERPRISE: TYPES & INTERFACES
// ============================================================================

interface ContactRelationshipManagerProps {
  /** Κύρια επαφή για την οποία διαχειριζόμαστε τις σχέσεις */
  contactId: string;
  /** Τύπος κύριας επαφής (individual, company, service) */
  contactType: ContactType;
  /** Read-only mode για προβολή μόνο */
  readonly?: boolean;
  /** Custom styling className */
  className?: string;
  /** Callback όταν αλλάζουν οι σχέσεις */
  onRelationshipsChange?: (relationships: ContactRelationship[]) => void;
}

interface RelationshipFormData {
  targetContactId: string;
  relationshipType: RelationshipType;
  position?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  contactInfo?: Partial<ProfessionalContactInfo>;
}

// ============================================================================
// 🏢 ENTERPRISE: RELATIONSHIP TYPE CONFIGURATIONS
// ============================================================================

const RELATIONSHIP_TYPES_CONFIG = {
  employee: {
    icon: User,
    label: 'Εργαζόμενος',
    color: 'bg-blue-100 text-blue-800',
    allowedFor: ['company', 'service'] as ContactType[]
  },
  manager: {
    icon: Crown,
    label: 'Διευθυντής',
    color: 'bg-purple-100 text-purple-800',
    allowedFor: ['company', 'service'] as ContactType[]
  },
  shareholder: {
    icon: Briefcase,
    label: 'Μέτοχος',
    color: 'bg-green-100 text-green-800',
    allowedFor: ['company'] as ContactType[]
  },
  board_member: {
    icon: Users,
    label: 'Μέλος Διοικητικού Συμβουλίου',
    color: 'bg-orange-100 text-orange-800',
    allowedFor: ['company'] as ContactType[]
  },
  civil_servant: {
    icon: UserCheck,
    label: 'Δημόσιος Υπάλληλος',
    color: 'bg-indigo-100 text-indigo-800',
    allowedFor: ['service'] as ContactType[]
  },
  department_head: {
    icon: Crown,
    label: 'Προϊστάμενος Τμήματος',
    color: 'bg-red-100 text-red-800',
    allowedFor: ['service'] as ContactType[]
  },
  consultant: {
    icon: User,
    label: 'Σύμβουλος',
    color: 'bg-teal-100 text-teal-800',
    allowedFor: ['company', 'service'] as ContactType[]
  }
} as const;

// ============================================================================
// 🏢 ENTERPRISE: MAIN COMPONENT
// ============================================================================

export const ContactRelationshipManager: React.FC<ContactRelationshipManagerProps> = ({
  contactId,
  contactType,
  readonly = false,
  className = '',
  onRelationshipsChange
}) => {
  // ============================================================================
  // 🏢 ENTERPRISE: STATE MANAGEMENT
  // ============================================================================

  const [relationships, setRelationships] = useState<ContactRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRelationships, setExpandedRelationships] = useState<Set<string>>(new Set());
  const [organizationTree, setOrganizationTree] = useState<OrganizationTree | null>(null);

  // Form state for add/edit
  const [formData, setFormData] = useState<RelationshipFormData>({
    targetContactId: '',
    relationshipType: 'employee' as RelationshipType,
    position: '',
    department: '',
    startDate: '',
    endDate: '',
    notes: '',
    contactInfo: {
      businessPhone: '',
      businessEmail: '',
      businessAddress: '',
      extensionNumber: ''
    }
  });

  // ============================================================================
  // 🏢 ENTERPRISE: DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadRelationships();
    if (contactType === 'company' || contactType === 'service') {
      loadOrganizationTree();
    }
  }, [contactId]);

  const loadRelationships = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ContactRelationshipService.getContactRelationships(contactId);
      setRelationships(data);
      onRelationshipsChange?.(data);
    } catch (err) {
      setError('Σφάλμα φόρτωσης σχέσεων επαφής');
      console.error('Error loading relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationTree = async () => {
    try {
      const tree = await ContactRelationshipService.buildOrganizationHierarchy(contactId);
      setOrganizationTree(tree);
    } catch (err) {
      console.error('Error loading organization tree:', err);
    }
  };

  // ============================================================================
  // 🏢 ENTERPRISE: FORM HANDLERS
  // ============================================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const relationshipData: Partial<ContactRelationship> = {
        sourceContactId: contactId,
        targetContactId: formData.targetContactId,
        relationshipType: formData.relationshipType,
        position: formData.position || undefined,
        department: formData.department || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined,
        contactInfo: formData.contactInfo?.businessPhone || formData.contactInfo?.businessEmail
          ? formData.contactInfo as ProfessionalContactInfo
          : undefined
      };

      if (editingId) {
        await ContactRelationshipService.updateRelationship(editingId, relationshipData);
      } else {
        await ContactRelationshipService.createRelationship(relationshipData);
      }

      // Reset form and reload data
      resetForm();
      await loadRelationships();
      if (contactType === 'company' || contactType === 'service') {
        await loadOrganizationTree();
      }

    } catch (err) {
      setError(editingId ? 'Σφάλμα ενημέρωσης σχέσης' : 'Σφάλμα δημιουργίας σχέσης');
      console.error('Error saving relationship:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (relationship: ContactRelationship) => {
    setEditingId(relationship.id);
    setFormData({
      targetContactId: relationship.targetContactId,
      relationshipType: relationship.relationshipType,
      position: relationship.position || '',
      department: relationship.department || '',
      startDate: relationship.startDate || '',
      endDate: relationship.endDate || '',
      notes: relationship.notes || '',
      contactInfo: relationship.contactInfo || {
        businessPhone: '',
        businessEmail: '',
        businessAddress: '',
        extensionNumber: ''
      }
    });
    setShowAddForm(true);
  };

  const handleDelete = async (relationshipId: string) => {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη σχέση;')) {
      return;
    }

    try {
      setLoading(true);
      await ContactRelationshipService.deleteRelationship(relationshipId);
      await loadRelationships();
      if (contactType === 'company' || contactType === 'service') {
        await loadOrganizationTree();
      }
    } catch (err) {
      setError('Σφάλμα διαγραφής σχέσης');
      console.error('Error deleting relationship:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      targetContactId: '',
      relationshipType: 'employee' as RelationshipType,
      position: '',
      department: '',
      startDate: '',
      endDate: '',
      notes: '',
      contactInfo: {
        businessPhone: '',
        businessEmail: '',
        businessAddress: '',
        extensionNumber: ''
      }
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  // ============================================================================
  // 🏢 ENTERPRISE: UTILITY FUNCTIONS
  // ============================================================================

  const getAvailableRelationshipTypes = (): RelationshipType[] => {
    return Object.entries(RELATIONSHIP_TYPES_CONFIG)
      .filter(([_, config]) => config.allowedFor.includes(contactType))
      .map(([type]) => type as RelationshipType);
  };

  const toggleRelationshipExpansion = (relationshipId: string) => {
    const newExpanded = new Set(expandedRelationships);
    if (newExpanded.has(relationshipId)) {
      newExpanded.delete(relationshipId);
    } else {
      newExpanded.add(relationshipId);
    }
    setExpandedRelationships(newExpanded);
  };

  const getRelationshipTypeConfig = (type: RelationshipType) => {
    return RELATIONSHIP_TYPES_CONFIG[type] || {
      icon: User,
      label: type,
      color: 'bg-gray-100 text-gray-800',
      allowedFor: []
    };
  };

  // ============================================================================
  // 🏢 ENTERPRISE: RENDER FUNCTIONS
  // ============================================================================

  const renderRelationshipCard = (relationship: ContactRelationship) => {
    const config = getRelationshipTypeConfig(relationship.relationshipType);
    const Icon = config.icon;
    const isExpanded = expandedRelationships.has(relationship.id);

    return (
      <Card key={relationship.id} className="mb-4 border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleRelationshipExpansion(relationship.id)}
                className="p-1"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>

              <Icon className="h-5 w-5 text-gray-600" />

              <div>
                <Badge className={config.color}>
                  {config.label}
                </Badge>
                {relationship.position && (
                  <p className="text-sm text-gray-600 mt-1">{relationship.position}</p>
                )}
              </div>
            </div>

            {!readonly && (
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(relationship)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(relationship.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relationship.department && (
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{relationship.department}</span>
                </div>
              )}

              {relationship.startDate && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Από: {new Date(relationship.startDate).toLocaleDateString('el-GR')}</span>
                </div>
              )}

              {relationship.contactInfo?.businessPhone && (
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{relationship.contactInfo.businessPhone}</span>
                  {relationship.contactInfo.extensionNumber && (
                    <span className="text-xs text-gray-400">ext. {relationship.contactInfo.extensionNumber}</span>
                  )}
                </div>
              )}

              {relationship.contactInfo?.businessEmail && (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{relationship.contactInfo.businessEmail}</span>
                </div>
              )}

              {relationship.contactInfo?.businessAddress && (
                <div className="flex items-start space-x-2 md:col-span-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span className="text-sm">{relationship.contactInfo.businessAddress}</span>
                </div>
              )}

              {relationship.notes && (
                <div className="md:col-span-2">
                  <Label className="text-xs font-medium text-gray-500">Σημειώσεις</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{relationship.notes}</p>
                </div>
              )}
            </div>

            {/* Relationship metadata */}
            <Separator className="my-4" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Δημιουργήθηκε: {new Date(relationship.createdAt).toLocaleDateString('el-GR')}</span>
              {relationship.updatedAt && relationship.updatedAt !== relationship.createdAt && (
                <span>Ενημερώθηκε: {new Date(relationship.updatedAt).toLocaleDateString('el-GR')}</span>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  const renderAddEditForm = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>{editingId ? 'Επεξεργασία Σχέσης' : 'Προσθήκη Νέας Σχέσης'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Contact - Enterprise EmployeeSelector */}
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
                excludeContactIds={[contactId]} // Exclude current contact
                required
                error={!formData.targetContactId ? 'Η επιλογή επαφής είναι υποχρεωτική' : undefined}
              />
            </div>

            <div>
              <Label htmlFor="relationshipType">Τύπος Σχέσης*</Label>
              <Select
                value={formData.relationshipType}
                onValueChange={(value: RelationshipType) =>
                  setFormData(prev => ({ ...prev, relationshipType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Επιλέξτε τύπο σχέσης" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRelationshipTypes().map((type) => {
                    const config = getRelationshipTypeConfig(type);
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center space-x-2">
                          <config.icon className="h-4 w-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="position">Θέση</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="π.χ. Διευθυντής Πωλήσεων"
              />
            </div>

            <div>
              <Label htmlFor="department">Τμήμα</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="π.χ. Οικονομικό Τμήμα"
              />
            </div>

            <div>
              <Label htmlFor="startDate">Ημερομηνία Έναρξης</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            {/* Professional Contact Info */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">Επαγγελματικά Στοιχεία Επικοινωνίας</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <Input
                  placeholder="Επαγγελματικό τηλέφωνο"
                  value={formData.contactInfo?.businessPhone || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, businessPhone: e.target.value }
                  }))}
                />
                <Input
                  placeholder="Επαγγελματικό email"
                  type="email"
                  value={formData.contactInfo?.businessEmail || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, businessEmail: e.target.value }
                  }))}
                />
                <Input
                  placeholder="Εσωτερικό τηλέφωνο"
                  value={formData.contactInfo?.extensionNumber || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, extensionNumber: e.target.value }
                  }))}
                />
                <Input
                  placeholder="Διεύθυνση εργασίας"
                  value={formData.contactInfo?.businessAddress || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    contactInfo: { ...prev.contactInfo, businessAddress: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Σημειώσεις</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Πρόσθετες πληροφορίες..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={resetForm}>
              Ακύρωση
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Αποθήκευση...' : (editingId ? 'Ενημέρωση' : 'Προσθήκη')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  // ============================================================================
  // 🏢 ENTERPRISE: MAIN RENDER
  // ============================================================================

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Σχέσεις Επαφής</h2>
          {relationships.length > 0 && (
            <Badge variant="secondary">{relationships.length}</Badge>
          )}
        </div>

        {!readonly && (
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Προσθήκη Σχέσης</span>
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit form */}
      {showAddForm && renderAddEditForm()}

      {/* Relationships list */}
      {loading && relationships.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">Φόρτωση σχέσεων...</p>
          </CardContent>
        </Card>
      ) : relationships.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Δεν υπάρχουν καταχωρημένες σχέσεις</p>
              {!readonly && (
                <p className="text-sm">Κάντε κλικ στο κουμπί "Προσθήκη Σχέσης" για να προσθέσετε την πρώτη σχέση.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {relationships.map(renderRelationshipCard)}
          </div>
        </ScrollArea>
      )}

      {/* Organization Tree Preview (for companies/services) */}
      {organizationTree && (contactType === 'company' || contactType === 'service') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Οργανωτικό Διάγραμμα</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              <p><strong>Συνολικοί εργαζόμενοι:</strong> {organizationTree.totalEmployees}</p>
              <p><strong>Τμήματα:</strong> {organizationTree.departments.join(', ') || 'Κανένα'}</p>
              <p><strong>Ενεργά άτομα:</strong> {organizationTree.children?.length || 0}</p>
            </div>
            {organizationTree.children && organizationTree.children.length > 0 && (
              <div className="mt-4">
                <Label className="text-xs font-medium text-gray-500">Πρόσφατες προσθήκες:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {organizationTree.children.slice(0, 5).map((child, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {child.position || 'Εργαζόμενος'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContactRelationshipManager;