'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface CompanyContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  disabled = false
}: CompanyContactSectionProps) {
  return (
    <>
      {/* Βασικά Στοιχεία ΓΕΜΗ */}
      <div className="col-span-2 border-t pt-4">
        <h4 className="font-semibold mb-3 text-sm">🏢 Βασικά Στοιχεία ΓΕΜΗ</h4>
      </div>

      <FormField label="Επωνυμία Εταιρείας" htmlFor="companyName" required>
        <FormInput>
          <Input
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            required
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Διακριτικός Τίτλος" htmlFor="tradeName">
        <FormInput>
          <Input
            id="tradeName"
            name="tradeName"
            value={formData.tradeName}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="ΑΦΜ" htmlFor="companyVatNumber" required>
        <FormInput>
          <Input
            id="companyVatNumber"
            name="companyVatNumber"
            value={formData.companyVatNumber}
            onChange={handleChange}
            required
            disabled={disabled}
            maxLength={9}
          />
        </FormInput>
      </FormField>

      <FormField label="Αριθμός ΓΕΜΗ" htmlFor="gemiNumber">
        <FormInput>
          <Input
            id="gemiNumber"
            name="gemiNumber"
            value={formData.gemiNumber}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Νομική Μορφή" htmlFor="legalForm">
        <FormInput>
          <Select name="legalForm" value={formData.legalForm} onValueChange={(value) => handleSelectChange('legalForm', value)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Επιλέξτε νομική μορφή" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OE">Ο.Ε. (Ομόρρυθμη Εταιρεία)</SelectItem>
              <SelectItem value="EE">Ε.Ε. (Ετερόρρυθμη Εταιρεία)</SelectItem>
              <SelectItem value="EPE">Ε.Π.Ε. (Εταιρεία Περιορισμένης Ευθύνης)</SelectItem>
              <SelectItem value="AE">Α.Ε. (Ανώνυμη Εταιρεία)</SelectItem>
              <SelectItem value="IKE">Ι.Κ.Ε. (Ιδιωτική Κεφαλαιουχική Εταιρεία)</SelectItem>
              <SelectItem value="MONO">Μονοπρόσωπη Ι.Κ.Ε.</SelectItem>
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label="Κατάσταση ΓΕΜΗ" htmlFor="gemiStatus">
        <FormInput>
          <Select name="gemiStatus" value={formData.gemiStatus} onValueChange={(value) => handleSelectChange('gemiStatus', value)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Επιλέξτε κατάσταση" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ενεργή</SelectItem>
              <SelectItem value="inactive">Ανενεργή</SelectItem>
              <SelectItem value="dissolved">Λυθείσα</SelectItem>
              <SelectItem value="bankruptcy">Σε Πτώχευση</SelectItem>
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      {/* Δραστηριότητες & ΚΑΔ */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">📋 Δραστηριότητες & ΚΑΔ</h4>
      </div>

      <FormField label="Κωδικός ΚΑΔ" htmlFor="activityCodeKAD">
        <FormInput>
          <Input
            id="activityCodeKAD"
            name="activityCodeKAD"
            value={formData.activityCodeKAD}
            onChange={handleChange}
            disabled={disabled}
            placeholder="π.χ. 47.11.10"
          />
        </FormInput>
      </FormField>

      <FormField label="Περιγραφή Δραστηριότητας" htmlFor="activityDescription">
        <FormInput>
          <Input
            id="activityDescription"
            name="activityDescription"
            value={formData.activityDescription}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Τύπος Δραστηριότητας" htmlFor="activityType">
        <FormInput>
          <Select name="activityType" value={formData.activityType} onValueChange={(value) => handleSelectChange('activityType', value)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">Κύρια</SelectItem>
              <SelectItem value="secondary">Δευτερεύουσα</SelectItem>
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label="Επιμελητήριο" htmlFor="chamber">
        <FormInput>
          <Input
            id="chamber"
            name="chamber"
            value={formData.chamber}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      {/* Κεφάλαιο & Οικονομικά */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">💰 Κεφάλαιο & Οικονομικά</h4>
      </div>

      <FormField label="Κεφάλαιο" htmlFor="capitalAmount">
        <FormInput>
          <Input
            id="capitalAmount"
            name="capitalAmount"
            value={formData.capitalAmount}
            onChange={handleChange}
            disabled={disabled}
            type="number"
            placeholder="π.χ. 50000"
          />
        </FormInput>
      </FormField>

      <FormField label="Νόμισμα" htmlFor="currency">
        <FormInput>
          <Select name="currency" value={formData.currency} onValueChange={(value) => handleSelectChange('currency', value)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR (Ευρώ)</SelectItem>
              <SelectItem value="USD">USD (Δολάρια ΗΠΑ)</SelectItem>
              <SelectItem value="GBP">GBP (Λίρες Στερλίνες)</SelectItem>
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField label="Εξωλογιστικά Κεφάλαια" htmlFor="extraordinaryCapital">
        <FormInput>
          <Input
            id="extraordinaryCapital"
            name="extraordinaryCapital"
            value={formData.extraordinaryCapital}
            onChange={handleChange}
            disabled={disabled}
            type="number"
          />
        </FormInput>
      </FormField>

      {/* Ημερομηνίες & Γεωγραφικά */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">📅 Ημερομηνίες & Τοποθεσία</h4>
      </div>

      <FormField label="Ημερομηνία Εγγραφής" htmlFor="registrationDate">
        <FormInput>
          <Input
            id="registrationDate"
            name="registrationDate"
            type="date"
            value={formData.registrationDate}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Ημερομηνία Κατάστασης" htmlFor="gemiStatusDate">
        <FormInput>
          <Input
            id="gemiStatusDate"
            name="gemiStatusDate"
            type="date"
            value={formData.gemiStatusDate}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Νομός" htmlFor="prefecture">
        <FormInput>
          <Input
            id="prefecture"
            name="prefecture"
            value={formData.prefecture}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Δήμος" htmlFor="municipality">
        <FormInput>
          <Input
            id="municipality"
            name="municipality"
            value={formData.municipality}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>

      <FormField label="Τοπική Υπηρεσία ΓΕΜΗ" htmlFor="gemiDepartment">
        <FormInput>
          <Input
            id="gemiDepartment"
            name="gemiDepartment"
            value={formData.gemiDepartment}
            onChange={handleChange}
            disabled={disabled}
          />
        </FormInput>
      </FormField>
    </>
  );
}