'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { PhotoUploadSection } from '@/components/PhotoUpload/PhotoUploadSection';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface IndividualContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  disabled?: boolean;
}

export function IndividualContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  handleDrop,
  handleDragOver,
  disabled = false
}: IndividualContactSectionProps) {
  return (
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Φύλο" htmlFor="gender">
        <FormInput>
          <Select name="gender" value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)} disabled={disabled}>
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
            disabled={disabled}
            maxLength={11}
          />
        </FormInput>
      </FormField>

      <PhotoUploadSection
        photoFile={formData.photoFile}
        photoPreview={formData.photoPreview}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        disabled={disabled}
      />

      {/* Ταυτότητα & ΑΦΜ */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">💳 Ταυτότητα & ΑΦΜ</h4>
      </div>

      <FormField label="Τύπος Εγγράφου" htmlFor="documentType">
        <FormInput>
          <Select name="documentType" value={formData.documentType} onValueChange={(value) => handleSelectChange('documentType', value)} disabled={disabled}>
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      {/* Επικοινωνία */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">📞 Στοιχεία Επικοινωνίας</h4>
      </div>

      <FormField label="Email" htmlFor="email">
        <FormInput>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Τηλέφωνο" htmlFor="phone">
        <FormInput>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>
    </>
  );
}