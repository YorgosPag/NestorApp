'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import type { Contact, ContactType } from '@/types/contacts';
import { Loader2, User, Building, Shield } from 'lucide-react';

interface AddNewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactAdded: () => void;
}

interface ContactFormData {
  type: ContactType;
  // Άτομο
  firstName: string;
  lastName: string;
  // Εταιρεία
  companyName: string;
  vatNumber: string;
  // Υπηρεσία
  serviceName: string;
  serviceType: 'ministry' | 'tax_office' | 'municipality' | 'public_organization' | 'other';
  // Κοινά
  email: string;
  phone: string;
  notes: string;
}

const initialFormData: ContactFormData = {
  type: 'individual',
  firstName: '',
  lastName: '',
  companyName: '',
  vatNumber: '',
  serviceName: '',
  serviceType: 'other',
  email: '',
  phone: '',
  notes: '',
};

export function AddNewContactDialog({ open, onOpenChange, onContactAdded }: AddNewContactDialogProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Έλεγχος υποχρεωτικών πεδίων
    if (formData.type === 'individual' && (!formData.firstName.trim() || !formData.lastName.trim())) {
      toast.error("Συμπληρώστε όνομα και επώνυμο.");
      return;
    }
    if (formData.type === 'company' && (!formData.companyName.trim() || !formData.vatNumber.trim())) {
      toast.error("Συμπληρώστε επωνυμία και ΑΦΜ εταιρείας.");
      return;
    }
    if (formData.type === 'service' && !formData.serviceName.trim()) {
      toast.error("Συμπληρώστε όνομα υπηρεσίας.");
      return;
    }

    setLoading(true);

    try {
      // Δημιουργία contact object ανάλογα με τον τύπο
      let contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

      if (formData.type === 'individual') {
        contactData = {
          type: 'individual',
          firstName: formData.firstName,
          lastName: formData.lastName,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'mobile', isPrimary: true }] : [],
          isFavorite: false,
          status: 'active',
          notes: formData.notes,
        } as any;
      } else if (formData.type === 'company') {
        contactData = {
          type: 'company',
          companyName: formData.companyName,
          vatNumber: formData.vatNumber,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'work', isPrimary: true }] : [],
          isFavorite: false,
          status: 'active',
          notes: formData.notes,
        } as any;
      } else {
        contactData = {
          type: 'service',
          serviceName: formData.serviceName,
          serviceType: formData.serviceType,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'work', isPrimary: true }] : [],
          isFavorite: false,
          status: 'active',
          notes: formData.notes,
        } as any;
      }

      await ContactsService.createContact(contactData);

      toast.success("Η νέα επαφή δημιουργήθηκε επιτυχώς.");

      onContactAdded();
      onOpenChange(false);
      setFormData(initialFormData);
    } catch (error) {
      console.error(error);
      toast.error("Δεν ήταν δυνατή η δημιουργία της επαφής.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const getTypeIcon = () => {
    switch (formData.type) {
      case 'individual': return <User className="h-4 w-4" />;
      case 'company': return <Building className="h-4 w-4" />;
      case 'service': return <Shield className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (formData.type) {
      case 'individual': return 'Φυσικό Πρόσωπο';
      case 'company': return 'Εταιρεία';
      case 'service': return 'Δημόσια Υπηρεσία';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon()}
            Προσθήκη Νέας Επαφής - {getTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Καταχωρήστε τα βασικά στοιχεία της νέας επαφής.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <FormGrid>
            {/* Τύπος Επαφής */}
            <FormField label="Τύπος" htmlFor="type" required>
              <FormInput>
                <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">👤 Φυσικό Πρόσωπο</SelectItem>
                    <SelectItem value="company">🏢 Εταιρεία</SelectItem>
                    <SelectItem value="service">🏛️ Δημόσια Υπηρεσία</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            {/* Πεδία για Φυσικό Πρόσωπο */}
            {formData.type === 'individual' && (
              <>
                <FormField label="Όνομα" htmlFor="firstName" required>
                  <FormInput>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Επώνυμο" htmlFor="lastName" required>
                  <FormInput>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>
              </>
            )}

            {/* Πεδία για Εταιρεία */}
            {formData.type === 'company' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="companyName" className="text-right">Επωνυμία *</Label>
                  <Input 
                    id="companyName" 
                    name="companyName" 
                    value={formData.companyName} 
                    onChange={handleChange} 
                    className="col-span-3" 
                    required 
                    disabled={loading} 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vatNumber" className="text-right">ΑΦΜ *</Label>
                  <Input 
                    id="vatNumber" 
                    name="vatNumber" 
                    value={formData.vatNumber} 
                    onChange={handleChange} 
                    className="col-span-3" 
                    required 
                    disabled={loading} 
                  />
                </div>
              </>
            )}

            {/* Πεδία για Δημόσια Υπηρεσία */}
            {formData.type === 'service' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="serviceName" className="text-right">Όνομα Υπηρεσίας *</Label>
                  <Input 
                    id="serviceName" 
                    name="serviceName" 
                    value={formData.serviceName} 
                    onChange={handleChange} 
                    className="col-span-3" 
                    required 
                    disabled={loading} 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="serviceType" className="text-right">Τύπος</Label>
                  <Select name="serviceType" value={formData.serviceType} onValueChange={(value) => handleSelectChange('serviceType', value)} disabled={loading}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ministry">Υπουργείο</SelectItem>
                      <SelectItem value="tax_office">ΔΟΥ</SelectItem>
                      <SelectItem value="municipality">Δήμος</SelectItem>
                      <SelectItem value="public_organization">Δημόσιος Οργανισμός</SelectItem>
                      <SelectItem value="other">Άλλο</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Κοινά πεδία */}
            <FormField label="Email" htmlFor="email">
              <FormInput>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                />
              </FormInput>
            </FormField>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Τηλέφωνο</Label>
              <Input 
                id="phone" 
                name="phone" 
                type="tel" 
                value={formData.phone} 
                onChange={handleChange} 
                className="col-span-3" 
                disabled={loading} 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Σημειώσεις</Label>
              <Textarea 
                id="notes" 
                name="notes" 
                value={formData.notes} 
                onChange={handleChange} 
                className="col-span-3" 
                rows={2} 
                disabled={loading} 
              />
            </div>
          </FormGrid>
          
          <DialogFooter>
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SaveButton loading={loading}>Αποθήκευση Επαφής</SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
