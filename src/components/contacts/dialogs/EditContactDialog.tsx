'use client';

import React, { useState, useEffect } from 'react';
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
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import type { Contact, ContactType } from '@/types/contacts';
import { Loader2, User, Building, Shield } from 'lucide-react';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onContactUpdated: () => void;
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

export function EditContactDialog({ open, onOpenChange, contact, onContactUpdated }: EditContactDialogProps) {
  const [formData, setFormData] = useState<ContactFormData>({
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
  });
  const [loading, setLoading] = useState(false);

  // Populate form when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        type: contact.type,
        firstName: contact.type === 'individual' ? contact.firstName || '' : '',
        lastName: contact.type === 'individual' ? contact.lastName || '' : '',
        companyName: contact.type === 'company' ? (contact as any).companyName || '' : '',
        vatNumber: contact.type === 'company' ? (contact as any).vatNumber || '' : '',
        serviceName: contact.type === 'service' ? (contact as any).serviceName || '' : '',
        serviceType: contact.type === 'service' ? (contact as any).serviceType || 'other' : 'other',
        email: contact.emails?.[0]?.email || '',
        phone: contact.phones?.[0]?.number || '',
        notes: (contact as any).notes || '',
      });
    }
  }, [contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !contact) return;

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
      // Δημιουργία updated contact object
      let updatedContactData: any;

      if (formData.type === 'individual') {
        updatedContactData = {
          ...contact,
          firstName: formData.firstName,
          lastName: formData.lastName,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'mobile', isPrimary: true }] : [],
          notes: formData.notes,
        };
      } else if (formData.type === 'company') {
        updatedContactData = {
          ...contact,
          companyName: formData.companyName,
          vatNumber: formData.vatNumber,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'work', isPrimary: true }] : [],
          notes: formData.notes,
        };
      } else {
        updatedContactData = {
          ...contact,
          serviceName: formData.serviceName,
          serviceType: formData.serviceType,
          emails: formData.email ? [{ email: formData.email, type: 'work', isPrimary: true }] : [],
          phones: formData.phone ? [{ number: formData.phone, type: 'work', isPrimary: true }] : [],
          notes: formData.notes,
        };
      }

      await ContactsService.updateContact(contact.id, updatedContactData);

      toast.success("Η επαφή ενημερώθηκε επιτυχώς.");

      onContactUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Δεν ήταν δυνατή η ενημέρωση της επαφής.");
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
            Επεξεργασία Επαφής - {getTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Επεξεργαστείτε τα στοιχεία της επαφής.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Τύπος Επαφής - Read only για edit */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Τύπος</Label>
              <Select name="type" value={formData.type} disabled={true}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">👤 Φυσικό Πρόσωπο</SelectItem>
                  <SelectItem value="company">🏢 Εταιρεία</SelectItem>
                  <SelectItem value="service">🏛️ Δημόσια Υπηρεσία</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Πεδία για Φυσικό Πρόσωπο */}
            {formData.type === 'individual' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="firstName" className="text-right">Όνομα *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="col-span-3"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lastName" className="text-right">Επώνυμο *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="col-span-3"
                    required
                    disabled={loading}
                  />
                </div>
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="col-span-3"
                disabled={loading}
              />
            </div>
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
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Άκυρο
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Αποθήκευση...
                </>
              ) : 'Ενημέρωση Επαφής'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}