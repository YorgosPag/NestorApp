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
  // Βασικά Στοιχεία Φυσικού Προσώπου
  firstName: string;
  lastName: string;
  fatherName: string;
  motherName: string;
  birthDate: string;
  birthCountry: string;
  gender: 'male' | 'female' | 'other' | '';
  amka: string;
  // Ταυτότητα & ΑΦΜ
  documentType: string;
  documentIssuer: string;
  documentNumber: string;
  documentIssueDate: string;
  documentExpiryDate: string;
  vatNumber: string;
  taxOffice: string;
  // Επικοινωνία & Socials
  email: string;
  phone: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
  };
  websites: string;
  // Επαγγελματικά
  profession: string;
  specialty: string;
  employer: string;
  position: string;
  workAddress: string;
  workWebsite: string;
  // Εταιρεία
  companyName: string;
  companyVatNumber: string;
  // Υπηρεσία
  serviceName: string;
  serviceType: 'ministry' | 'tax_office' | 'municipality' | 'public_organization' | 'other';
  // Φωτογραφία
  photoFile: File | null;
  photoPreview: string;
  // Κοινά
  notes: string;
}

const initialFormData: ContactFormData = {
  type: 'individual',
  // Βασικά Στοιχεία
  firstName: '',
  lastName: '',
  fatherName: '',
  motherName: '',
  birthDate: '',
  birthCountry: '',
  gender: '',
  amka: '',
  // Ταυτότητα & ΑΦΜ
  documentType: '',
  documentIssuer: '',
  documentNumber: '',
  documentIssueDate: '',
  documentExpiryDate: '',
  vatNumber: '',
  taxOffice: '',
  // Επικοινωνία & Socials
  email: '',
  phone: '',
  socialMedia: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
  },
  websites: '',
  // Επαγγελματικά
  profession: '',
  specialty: '',
  employer: '',
  position: '',
  workAddress: '',
  workWebsite: '',
  // Εταιρεία
  companyName: '',
  companyVatNumber: '',
  // Υπηρεσία
  serviceName: '',
  serviceType: 'other',
  // Φωτογραφία
  photoFile: null,
  photoPreview: '',
  // Κοινά
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
    if (formData.type === 'company' && (!formData.companyName.trim() || !formData.companyVatNumber.trim())) {
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
          fatherName: formData.fatherName,
          motherName: formData.motherName,
          birthDate: formData.birthDate,
          birthCountry: formData.birthCountry,
          gender: formData.gender,
          amka: formData.amka,
          documentType: formData.documentType,
          documentIssuer: formData.documentIssuer,
          documentNumber: formData.documentNumber,
          documentIssueDate: formData.documentIssueDate,
          documentExpiryDate: formData.documentExpiryDate,
          vatNumber: formData.vatNumber,
          taxOffice: formData.taxOffice,
          profession: formData.profession,
          specialty: formData.specialty,
          employer: formData.employer,
          position: formData.position,
          workAddress: formData.workAddress,
          workWebsite: formData.workWebsite,
          socialMedia: formData.socialMedia,
          websites: formData.websites,
          photoURL: formData.photoPreview,
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
          vatNumber: formData.companyVatNumber,
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

      const cleanedData = cleanUndefinedValues(contactData);
      await ContactsService.createContact(cleanedData);

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

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setFormData({
        ...formData,
        photoFile: null,
        photoPreview: ''
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Επιλέξτε μόνο αρχεία εικόνας (JPG, PNG, κλπ.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Το αρχείο πρέπει να είναι μικρότερο από 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData({
        ...formData,
        photoFile: file,
        photoPreview: e.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const cleanUndefinedValues = (obj: any): any => {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) cleaned[key] = value;
        } else if (typeof value === 'object') {
          const cleanedNestedObj = cleanUndefinedValues(value);
          if (Object.keys(cleanedNestedObj).length > 0) {
            cleaned[key] = cleanedNestedObj;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });
    return cleaned;
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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
                {/* Βασικά Στοιχεία */}
                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-semibold mb-3 text-sm">👤 Βασικά Στοιχεία</h4>
                </div>

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

                <FormField label="Πατρώνυμο" htmlFor="fatherName">
                  <FormInput>
                    <Input
                      id="fatherName"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Μητρώνυμο" htmlFor="motherName">
                  <FormInput>
                    <Input
                      id="motherName"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Ημερομηνία Γέννησης" htmlFor="birthDate">
                  <FormInput>
                    <Input
                      id="birthDate"
                      name="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Χώρα Γέννησης" htmlFor="birthCountry">
                  <FormInput>
                    <Input
                      id="birthCountry"
                      name="birthCountry"
                      value={formData.birthCountry}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Φύλο" htmlFor="gender">
                  <FormInput>
                    <Select name="gender" value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε φύλο" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Άντρας</SelectItem>
                        <SelectItem value="female">Γυναίκα</SelectItem>
                        <SelectItem value="other">Άλλο</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                <FormField label="ΑΜΚΑ (προαιρετικό)" htmlFor="amka">
                  <FormInput>
                    <Input
                      id="amka"
                      name="amka"
                      value={formData.amka}
                      onChange={handleChange}
                      disabled={loading}
                      maxLength={11}
                    />
                  </FormInput>
                </FormField>

                {/* Φωτογραφία */}
                <div className="col-span-2 border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3 text-sm">📷 Φωτογραφία</h4>
                </div>

                <div className="col-span-2">
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[120px] flex flex-col items-center justify-center ${
                      formData.photoPreview
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        handleFileChange(file || null);
                      };
                      input.click();
                    }}
                  >
                    {formData.photoPreview ? (
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white shadow-sm">
                          <img
                            src={formData.photoPreview}
                            alt="Προεπισκόπηση φωτογραφίας"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-green-700">✅ Φωτογραφία φορτώθηκε</p>
                          <p className="text-xs text-green-600">{formData.photoFile?.name}</p>
                          <p className="text-xs text-gray-500 mt-1">Κάντε κλικ για αλλαγή</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-2">📷</div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Κάντε κλικ ή σύρετε φωτογραφία εδώ
                        </p>
                        <p className="text-xs text-gray-500">
                          Υποστηρίζονται JPG, PNG (μέγιστο 5MB)
                        </p>
                      </div>
                    )}

                    {formData.photoPreview && (
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(null);
                        }}
                        title="Αφαίρεση φωτογραφίας"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Ταυτότητα & ΑΦΜ */}
                <div className="col-span-2 border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3 text-sm">💳 Ταυτότητα & ΑΦΜ</h4>
                </div>

                <FormField label="Τύπος Εγγράφου" htmlFor="documentType">
                  <FormInput>
                    <Select name="documentType" value={formData.documentType} onValueChange={(value) => handleSelectChange('documentType', value)} disabled={loading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Επιλέξτε τύπο" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identity_card">Δελτίο Ταυτότητας</SelectItem>
                        <SelectItem value="passport">Διαβατήριο</SelectItem>
                        <SelectItem value="drivers_license">Άδεια Οδήγησης</SelectItem>
                        <SelectItem value="other">Άλλο</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormInput>
                </FormField>

                <FormField label="Εκδούσα Αρχή" htmlFor="documentIssuer">
                  <FormInput>
                    <Input
                      id="documentIssuer"
                      name="documentIssuer"
                      value={formData.documentIssuer}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Αριθμός Εγγράφου" htmlFor="documentNumber">
                  <FormInput>
                    <Input
                      id="documentNumber"
                      name="documentNumber"
                      value={formData.documentNumber}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Ημερομηνία Έκδοσης" htmlFor="documentIssueDate">
                  <FormInput>
                    <Input
                      id="documentIssueDate"
                      name="documentIssueDate"
                      type="date"
                      value={formData.documentIssueDate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Ημερομηνία Λήξης" htmlFor="documentExpiryDate">
                  <FormInput>
                    <Input
                      id="documentExpiryDate"
                      name="documentExpiryDate"
                      type="date"
                      value={formData.documentExpiryDate}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="ΑΦΜ" htmlFor="vatNumber">
                  <FormInput>
                    <Input
                      id="vatNumber"
                      name="vatNumber"
                      value={formData.vatNumber}
                      onChange={handleChange}
                      disabled={loading}
                      maxLength={9}
                    />
                  </FormInput>
                </FormField>

                <FormField label="ΔΟΥ" htmlFor="taxOffice">
                  <FormInput>
                    <Input
                      id="taxOffice"
                      name="taxOffice"
                      value={formData.taxOffice}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                {/* Επαγγελματικά Στοιχεία */}
                <div className="col-span-2 border-t pt-4 mt-4">
                  <h4 className="font-semibold mb-3 text-sm">💼 Επαγγελματικά Στοιχεία</h4>
                </div>

                <FormField label="Επάγγελμα" htmlFor="profession">
                  <FormInput>
                    <Input
                      id="profession"
                      name="profession"
                      value={formData.profession}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Ειδικότητα" htmlFor="specialty">
                  <FormInput>
                    <Input
                      id="specialty"
                      name="specialty"
                      value={formData.specialty}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Επιχείρηση/Εργοδότης" htmlFor="employer">
                  <FormInput>
                    <Input
                      id="employer"
                      name="employer"
                      value={formData.employer}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormInput>
                </FormField>

                <FormField label="Θέση/Ρόλος" htmlFor="position">
                  <FormInput>
                    <Input
                      id="position"
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
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
                  <Label htmlFor="companyVatNumber" className="text-right">ΑΦΜ *</Label>
                  <Input
                    id="companyVatNumber"
                    name="companyVatNumber"
                    value={formData.companyVatNumber}
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
