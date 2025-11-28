'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { Building2, Users, MapPin, FileText, Plus, Trash2, Upload } from 'lucide-react';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface ServiceContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: any) => void;
  handleLogoChange: (file: File | null) => void;
  disabled?: boolean;
}

export function ServiceContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleNestedChange,
  handleLogoChange,
  disabled = false
}: ServiceContactSectionProps) {
  const [activeTab, setActiveTab] = useState("gemi");

  return (
    <>
      {/* Λογότυπο Header */}
      <div className="col-span-2 border-t pt-4 mt-4">
        <h4 className="font-semibold mb-3 text-sm">🏛️ Δημόσια Υπηρεσία / Φορέας</h4>
      </div>

      {/* Λογότυπο Upload Section */}
      <div className="col-span-2">
        <div
          className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors min-h-[100px] flex flex-col items-center justify-center ${
            formData.logoPreview
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={disabled ? undefined : () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              handleLogoChange(file || null);
            };
            input.click();
          }}
        >
          {formData.logoPreview ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded overflow-hidden bg-white shadow-sm">
                <img
                  src={formData.logoPreview}
                  alt="Λογότυπο φορέα"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-blue-700">✅ Λογότυπο φορτώθηκε</p>
                <p className="text-xs text-blue-600">{formData.logoFile?.name}</p>
                <p className="text-xs text-gray-500 mt-1">Κάντε κλικ για αλλαγή</p>
              </div>
            </div>
          ) : (
            <div>
              <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Λογότυπο Φορέα</p>
              <p className="text-xs text-gray-500">Κάντε κλικ για προσθήκη</p>
            </div>
          )}

          {formData.logoPreview && !disabled && (
            <button
              type="button"
              className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleLogoChange(null);
              }}
              title="Αφαίρεση λογότυπου"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs για στοιχεία */}
      <div className="col-span-2 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="gemi" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Στοιχεία από ΓΕΜΗ
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Στοιχεία από Χρήστη
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Στοιχεία από ΓΕΜΗ */}
          <TabsContent value="gemi" className="grid grid-cols-2 gap-4">
            {/* Γενικά Στοιχεία ΓΕΜΗ */}
            <div className="col-span-2 border-t pt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Γενικά Στοιχεία
              </h5>
            </div>

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

            <FormField label="ΑΦΜ" htmlFor="serviceVatNumber" required>
              <FormInput>
                <Input
                  id="serviceVatNumber"
                  name="serviceVatNumber"
                  value={formData.serviceVatNumber}
                  onChange={handleChange}
                  required
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="ΔΟΥ" htmlFor="serviceTaxOffice">
              <FormInput>
                <Input
                  id="serviceTaxOffice"
                  name="serviceTaxOffice"
                  value={formData.serviceTaxOffice}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Επωνυμία Φορέα" htmlFor="serviceName" required>
              <FormInput>
                <Input
                  id="serviceName"
                  name="serviceName"
                  value={formData.serviceName}
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

            <FormField label="Τίτλος/Περιγραφή" htmlFor="serviceTitle">
              <FormInput>
                <Input
                  id="serviceTitle"
                  name="serviceTitle"
                  value={formData.serviceTitle}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Νομική Μορφή" htmlFor="legalForm">
              <FormInput>
                <Input
                  id="legalForm"
                  name="legalForm"
                  value={formData.legalForm}
                  onChange={handleChange}
                  disabled={disabled}
                  placeholder="π.χ. Ν.Π.Δ.Δ."
                />
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
                    <SelectItem value="suspended">Αναστολή</SelectItem>
                    <SelectItem value="deleted">Διαγραφή</SelectItem>
                    <SelectItem value="blocked">Αποκλεισμός</SelectItem>
                  </SelectContent>
                </Select>
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

            <FormField label="Επιμελητήριο / Τ.Υ. ΓΕΜΗ" htmlFor="chamber">
              <FormInput>
                <Input
                  id="chamber"
                  name="chamber"
                  value={formData.chamber}
                  onChange={handleChange}
                  disabled={disabled}
                  placeholder="π.χ. ΕΕΑ, ΤΕΕ"
                />
              </FormInput>
            </FormField>

            <FormField label="Τρόπος Εγγραφής" htmlFor="registrationMethod">
              <FormInput>
                <Input
                  id="registrationMethod"
                  name="registrationMethod"
                  value={formData.registrationMethod}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Υποκατάστημα" htmlFor="isBranch">
              <FormInput>
                <Select name="isBranch" value={formData.isBranch ? "true" : "false"} onValueChange={(value) => handleSelectChange('isBranch', value === "true" ? "true" : "false")} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Όχι - Μητρική</SelectItem>
                    <SelectItem value="true">Ναι - Υποκατάστημα</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            {/* Πρόσθετα Στοιχεία από ΓΕΜΗ API */}
            <div className="col-span-2 border-t pt-3 mt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Πρόσθετα Στοιχεία ΓΕΜΗ
              </h5>
            </div>

            <FormField label="Ημερομηνία Καταχώρισης" htmlFor="registrationDate">
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

            <FormField label="Τελευταία Ενημέρωση" htmlFor="lastUpdateDate">
              <FormInput>
                <Input
                  id="lastUpdateDate"
                  name="lastUpdateDate"
                  type="date"
                  value={formData.lastUpdateDate}
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
                  placeholder="π.χ. ΓΕΜΗ Αθηνών"
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
                  placeholder="π.χ. Αττικής"
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
                  placeholder="π.χ. Αθηναίων"
                />
              </FormInput>
            </FormField>

            <FormField label="ΚΑΔ Κωδικός" htmlFor="activityCodeKAD">
              <FormInput>
                <Input
                  id="activityCodeKAD"
                  name="activityCodeKAD"
                  value={formData.activityCodeKAD}
                  onChange={handleChange}
                  disabled={disabled}
                  placeholder="π.χ. 84.11.00"
                />
              </FormInput>
            </FormField>

            <FormField label="Περιγραφή Δραστηριότητας" htmlFor="activityDescription">
              <FormInput>
                <Textarea
                  id="activityDescription"
                  name="activityDescription"
                  value={formData.activityDescription}
                  onChange={handleChange}
                  disabled={disabled}
                  rows={2}
                  placeholder="Περιγραφή κύριας δραστηριότητας φορέα"
                />
              </FormInput>
            </FormField>

            <FormField label="Τύπος Δραστηριότητας" htmlFor="activityType">
              <FormInput>
                <Select name="activityType" value={formData.activityType} onValueChange={(value) => handleSelectChange('activityType', value)} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε τύπο" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Κύρια</SelectItem>
                    <SelectItem value="secondary">Δευτερεύουσα</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            <FormField label="Έναρξη Ισχύος" htmlFor="activityValidFrom">
              <FormInput>
                <Input
                  id="activityValidFrom"
                  name="activityValidFrom"
                  type="date"
                  value={formData.activityValidFrom}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Λήξη Ισχύος" htmlFor="activityValidTo">
              <FormInput>
                <Input
                  id="activityValidTo"
                  name="activityValidTo"
                  type="date"
                  value={formData.activityValidTo}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            {/* Κεφάλαιο */}
            <div className="col-span-2 border-t pt-3 mt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Κεφάλαιο / Οικονομικά Στοιχεία
              </h5>
            </div>

            <FormField label="Ποσό Κεφαλαίου" htmlFor="capitalAmount">
              <FormInput>
                <Input
                  id="capitalAmount"
                  name="capitalAmount"
                  value={formData.capitalAmount}
                  onChange={handleChange}
                  disabled={disabled}
                  placeholder="π.χ. 100000"
                />
              </FormInput>
            </FormField>

            <FormField label="Νόμισμα" htmlFor="currency">
              <FormInput>
                <Select name="currency" value={formData.currency} onValueChange={(value) => handleSelectChange('currency', value)} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε νόμισμα" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GRD">GRD (Δραχμή)</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            <FormField label="Εξωλογιστικά / Εγγυητικά" htmlFor="extraordinaryCapital">
              <FormInput>
                <Input
                  id="extraordinaryCapital"
                  name="extraordinaryCapital"
                  value={formData.extraordinaryCapital}
                  onChange={handleChange}
                  disabled={disabled}
                  placeholder="Εξωλογιστικά κεφάλαια"
                />
              </FormInput>
            </FormField>

            {/* Στοιχεία Φορέα */}
            <div className="col-span-2 border-t pt-3 mt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Στοιχεία Φορέα
              </h5>
            </div>

            <FormField label="Κωδικός Φορέα" htmlFor="serviceCode">
              <FormInput>
                <Input
                  id="serviceCode"
                  name="serviceCode"
                  value={formData.serviceCode}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Υπουργείο/Οργανισμός" htmlFor="parentMinistry">
              <FormInput>
                <Input
                  id="parentMinistry"
                  name="parentMinistry"
                  value={formData.parentMinistry}
                  onChange={handleChange}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Κατηγορία Φορέα" htmlFor="serviceCategory">
              <FormInput>
                <Select name="serviceCategory" value={formData.serviceCategory} onValueChange={(value) => handleSelectChange('serviceCategory', value)} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Επιλέξτε κατηγορία" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ota">ΟΤΑ</SelectItem>
                    <SelectItem value="service">Υπηρεσία</SelectItem>
                    <SelectItem value="direction">Διεύθυνση</SelectItem>
                    <SelectItem value="ministry">Υπουργείο</SelectItem>
                    <SelectItem value="organization">Οργανισμός</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            <FormField label="Επίσημη Ιστοσελίδα" htmlFor="officialWebsite">
              <FormInput>
                <Input
                  id="officialWebsite"
                  name="officialWebsite"
                  value={formData.officialWebsite}
                  onChange={handleChange}
                  disabled={disabled}
                  type="url"
                  placeholder="https://"
                />
              </FormInput>
            </FormField>

            {/* Διεύθυνση Έδρας */}
            <div className="col-span-2 border-t pt-3 mt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Διεύθυνση Έδρας
              </h5>
            </div>

            <FormField label="Οδός" htmlFor="serviceAddress.street">
              <FormInput>
                <Input
                  id="serviceAddress.street"
                  value={formData.serviceAddress.street}
                  onChange={(e) => handleNestedChange('serviceAddress.street', e.target.value)}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Αριθμός" htmlFor="serviceAddress.number">
              <FormInput>
                <Input
                  id="serviceAddress.number"
                  value={formData.serviceAddress.number}
                  onChange={(e) => handleNestedChange('serviceAddress.number', e.target.value)}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Τ.Κ." htmlFor="serviceAddress.postalCode">
              <FormInput>
                <Input
                  id="serviceAddress.postalCode"
                  value={formData.serviceAddress.postalCode}
                  onChange={(e) => handleNestedChange('serviceAddress.postalCode', e.target.value)}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            <FormField label="Πόλη/Δήμος" htmlFor="serviceAddress.city">
              <FormInput>
                <Input
                  id="serviceAddress.city"
                  value={formData.serviceAddress.city}
                  onChange={(e) => handleNestedChange('serviceAddress.city', e.target.value)}
                  disabled={disabled}
                />
              </FormInput>
            </FormField>

            {/* Εκπρόσωποι/Υπεύθυνοι */}
            <div className="col-span-2 border-t pt-3 mt-3">
              <h5 className="font-medium mb-3 text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Εκπρόσωποι / Υπεύθυνοι
              </h5>
            </div>

            <div className="col-span-2">
              <div className="space-y-3">
                {formData.representatives.map((rep, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Εκπρόσωπος #{index + 1}</span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const newReps = formData.representatives.filter((_, i) => i !== index);
                          handleNestedChange('representatives', newReps);
                        }}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Ονοματεπώνυμο</Label>
                        <Input
                          value={rep.name}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].name = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          placeholder="Όνομα εκπροσώπου"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ιδιότητα</Label>
                        <Input
                          value={rep.role}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].role = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          placeholder="π.χ. Διευθυντής"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ΑΦΜ</Label>
                        <Input
                          value={rep.taxNumber}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].taxNumber = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          placeholder="123456789"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ΔΟΥ</Label>
                        <Input
                          value={rep.taxOffice}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].taxOffice = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          placeholder="π.χ. Α' Αθηνών"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input
                          value={rep.email}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].email = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          type="email"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Τηλέφωνο</Label>
                        <Input
                          value={rep.phone}
                          onChange={(e) => {
                            const newReps = [...formData.representatives];
                            newReps[index].phone = e.target.value;
                            handleNestedChange('representatives', newReps);
                          }}
                          disabled={disabled}
                          placeholder="210-1234567"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newRep = { name: '', role: '', email: '', phone: '', taxNumber: '', taxOffice: '' };
                    handleNestedChange('representatives', [...formData.representatives, newRep]);
                  }}
                  disabled={disabled}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Προσθήκη Εκπροσώπου
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Στοιχεία από Χρήστη */}
          <TabsContent value="custom" className="space-y-4">
            <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded">
              <strong>Σημείωση:</strong> Τα στοιχεία επικοινωνίας και διευθύνσεων προστίθενται στην κοινή ενότητα παρακάτω.
            </div>

            <div className="text-center py-8 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>Επιπλέον στοιχεία από τον χρήστη</p>
              <p className="text-xs">Θα προστεθούν σε μελλοντική έκδοση</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}