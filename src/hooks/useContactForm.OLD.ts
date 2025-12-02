import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Contact } from '@/types/contacts';
import type { ContactFormData, AddNewContactDialogProps } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

interface UseContactFormProps {
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  editContact?: Contact | null; // For edit mode
}

export function useContactForm({ onContactAdded, onOpenChange, editContact }: UseContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [loading, setLoading] = useState(false);

  // Load contact data when editing
  useEffect(() => {
    if (editContact) {
      const editFormData: ContactFormData = {
        type: editContact.type,
        // Βασικά Στοιχεία Φυσικού Προσώπου
        firstName: editContact.type === 'individual' ? editContact.firstName || '' : '',
        lastName: editContact.type === 'individual' ? editContact.lastName || '' : '',
        fatherName: editContact.type === 'individual' ? (editContact as any).fatherName || '' : '',
        motherName: editContact.type === 'individual' ? (editContact as any).motherName || '' : '',
        birthDate: editContact.type === 'individual' ? (editContact as any).birthDate || '' : '',
        birthCountry: editContact.type === 'individual' ? (editContact as any).birthCountry || '' : '',
        gender: editContact.type === 'individual' ? (editContact as any).gender || '' : '',
        amka: editContact.type === 'individual' ? (editContact as any).amka || '' : '',
        // Ταυτότητα & ΑΦΜ
        documentType: editContact.type === 'individual' ? (editContact as any).documentType || '' : '',
        documentIssuer: editContact.type === 'individual' ? (editContact as any).documentIssuer || '' : '',
        documentNumber: editContact.type === 'individual' ? (editContact as any).documentNumber || '' : '',
        documentIssueDate: editContact.type === 'individual' ? (editContact as any).documentIssueDate || '' : '',
        documentExpiryDate: editContact.type === 'individual' ? (editContact as any).documentExpiryDate || '' : '',
        vatNumber: editContact.type === 'individual' ? (editContact as any).vatNumber || '' : '',
        taxOffice: editContact.type === 'individual' ? (editContact as any).taxOffice || '' : '',
        // Επικοινωνία & Socials
        email: editContact.emails?.[0]?.email || '',
        phone: editContact.phones?.[0]?.number || '',
        socialMedia: {
          facebook: (editContact as any).socialMedia?.facebook || '',
          instagram: (editContact as any).socialMedia?.instagram || '',
          linkedin: (editContact as any).socialMedia?.linkedin || '',
          twitter: (editContact as any).socialMedia?.twitter || '',
        },
        websites: (editContact as any).websites || '',
        // Επαγγελματικά
        profession: editContact.type === 'individual' ? (editContact as any).profession || '' : '',
        specialty: editContact.type === 'individual' ? (editContact as any).specialty || '' : '',
        employer: editContact.type === 'individual' ? (editContact as any).employer || '' : '',
        position: editContact.type === 'individual' ? (editContact as any).position || '' : '',
        workAddress: editContact.type === 'individual' ? (editContact as any).workAddress || '' : '',
        workWebsite: editContact.type === 'individual' ? (editContact as any).workWebsite || '' : '',
        // Εταιρεία
        companyName: editContact.type === 'company' ? (editContact as any).companyName || '' : '',
        companyVatNumber: editContact.type === 'company' ? (editContact as any).vatNumber || (editContact as any).companyVatNumber || '' : '',
        // Υπηρεσία - Στοιχεία από ΓΕΜΗ
        serviceName: editContact.type === 'service' ? (editContact as any).serviceName || '' : '',
        serviceType: editContact.type === 'service' ? (editContact as any).serviceType || 'other' : 'other',
        // Γενικά Στοιχεία ΓΕΜΗ (basicInfo)
        gemiNumber: editContact.type === 'service' ? (editContact as any).gemiNumber || '' : '',
        serviceVatNumber: editContact.type === 'service' ? (editContact as any).serviceVatNumber || '' : '',
        serviceTaxOffice: editContact.type === 'service' ? (editContact as any).serviceTaxOffice || '' : '',
        serviceTitle: editContact.type === 'service' ? (editContact as any).serviceTitle || '' : '',
        tradeName: editContact.type === 'service' ? (editContact as any).tradeName || '' : '',
        legalForm: editContact.type === 'service' ? (editContact as any).legalForm || '' : '',
        gemiStatus: editContact.type === 'service' ? (editContact as any).gemiStatus || '' : '',
        gemiStatusDate: editContact.type === 'service' ? (editContact as any).gemiStatusDate || '' : '',
        chamber: editContact.type === 'service' ? (editContact as any).chamber || '' : '',
        isBranch: editContact.type === 'service' ? (editContact as any).isBranch || false : false,
        registrationMethod: editContact.type === 'service' ? (editContact as any).registrationMethod || '' : '',
        // Πρόσθετα από ΓΕΜΗ API
        registrationDate: editContact.type === 'service' ? (editContact as any).registrationDate || '' : '',
        lastUpdateDate: editContact.type === 'service' ? (editContact as any).lastUpdateDate || '' : '',
        gemiDepartment: editContact.type === 'service' ? (editContact as any).gemiDepartment || '' : '',
        prefecture: editContact.type === 'service' ? (editContact as any).prefecture || '' : '',
        municipality: editContact.type === 'service' ? (editContact as any).municipality || '' : '',
        activityCodeKAD: editContact.type === 'service' ? (editContact as any).activityCodeKAD || '' : '',
        activityDescription: editContact.type === 'service' ? (editContact as any).activityDescription || '' : '',
        activityType: editContact.type === 'service' ? (editContact as any).activityType || 'main' : 'main',
        activityValidFrom: editContact.type === 'service' ? (editContact as any).activityValidFrom || '' : '',
        activityValidTo: editContact.type === 'service' ? (editContact as any).activityValidTo || '' : '',
        // Κεφάλαιο (capital)
        capitalAmount: editContact.type === 'service' ? (editContact as any).capitalAmount || '' : '',
        currency: editContact.type === 'service' ? (editContact as any).currency || '' : '',
        extraordinaryCapital: editContact.type === 'service' ? (editContact as any).extraordinaryCapital || '' : '',
        // Στοιχεία Φορέα
        serviceCode: editContact.type === 'service' ? (editContact as any).serviceCode || '' : '',
        parentMinistry: editContact.type === 'service' ? (editContact as any).parentMinistry || '' : '',
        serviceCategory: editContact.type === 'service' ? (editContact as any).serviceCategory || '' : '',
        officialWebsite: editContact.type === 'service' ? (editContact as any).officialWebsite || '' : '',
        // Διεύθυνση Έδρας
        serviceAddress: editContact.type === 'service' ? (editContact as any).serviceAddress || {
          street: '',
          number: '',
          postalCode: '',
          city: '',
        } : {
          street: '',
          number: '',
          postalCode: '',
          city: '',
        },
        // Εκπρόσωποι/Υπεύθυνοι (representatives)
        representatives: editContact.type === 'service' ? (editContact as any).representatives || [] : [],
        // Μετοχική σύνθεση (shareholders)
        shareholders: editContact.type === 'service' ? (editContact as any).shareholders || [] : [],
        // Υποκαταστήματα (branches)
        branches: editContact.type === 'service' ? (editContact as any).branches || [] : [],
        // Έγγραφα ΓΕΜΗ (documents)
        documents: editContact.type === 'service' ? (editContact as any).documents || {
          announcementDocs: [],
          registrationDocs: []
        } : {
          announcementDocs: [],
          registrationDocs: []
        },
        // Αποφάσεις Οργάνων (decisions)
        decisions: editContact.type === 'service' ? (editContact as any).decisions || [] : [],
        // Ανακοινώσεις (announcements)
        announcements: editContact.type === 'service' ? (editContact as any).announcements || [] : [],
        // Λογότυπο
        logoFile: null,
        logoPreview: editContact.type === 'service' ? (editContact as any).logoPreview || '' : '',
        // Φωτογραφία
        photoFile: null,
        photoPreview: editContact.type === 'individual' ? (editContact as any).photoURL || '' : '',
        // Πολλαπλές Φωτογραφίες - Convert URLs to PhotoSlots
        multiplePhotos: (editContact as any).multiplePhotoURLs
          ? (editContact as any).multiplePhotoURLs.map((url: string) => {
              console.log('🔄 Loading saved photo URL:', url);
              return {
                uploadUrl: url,
                preview: url
              };
            })
          : (() => {
              console.log('❌ No multiplePhotoURLs found in editContact:', editContact);
              return [];
            })(),
        // Κοινά
        notes: (editContact as any).notes || '',
      };
      setFormData(editFormData);
    } else {
      setFormData(initialFormData);
    }
  }, [editContact]);

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
      // Handle photo upload with fast simulated upload (based on Projects system)
      let photoURL = '';
      let logoURL = '';

      // 🏢 COMPANY LOGO: Upload ήδη έγινε από EnterprisePhotoUpload component
      if (formData.logoPreview && formData.type === 'company') {
        // Use existing uploaded URL (από το EnterprisePhotoUpload)
        logoURL = formData.logoPreview;
        console.log('✅🏢 Using existing company logo URL:', logoURL);
      }

      // 🏛️ SERVICE LOGO: Upload ήδη έγινε από EnterprisePhotoUpload component
      if (formData.logoPreview && formData.type === 'service') {
        // Use existing uploaded URL (από το EnterprisePhotoUpload)
        logoURL = formData.logoPreview;
        console.log('✅🏛️ Using existing service logo URL:', logoURL);
      }

      // 🏛️ SERVICE PHOTO: Upload ήδη έγινε από EnterprisePhotoUpload component
      if (formData.photoPreview && formData.type === 'service') {
        // Use existing uploaded URL (από το EnterprisePhotoUpload)
        photoURL = formData.photoPreview;
        console.log('✅🏛️ Using existing service representative photo URL:', photoURL);
      }

      // 👤 INDIVIDUAL CONTACTS: Enterprise upload ήδη έγινε από EnterprisePhotoUpload component
      if (formData.photoPreview && formData.type === 'individual') {
        // Use existing uploaded URL (από το EnterprisePhotoUpload)
        photoURL = formData.photoPreview;
        console.log('✅👤 Using existing individual photo URL:', photoURL);
      }

      // 📸 MULTIPLE PHOTOS: Collect all uploaded URLs
      const multiplePhotoURLs: string[] = [];
      console.log('🔍 FormData multiplePhotos:', formData.multiplePhotos);
      formData.multiplePhotos.forEach((photoSlot, index) => {
        if (photoSlot.uploadUrl) {
          multiplePhotoURLs.push(photoSlot.uploadUrl);
          console.log(`✅📸 Multiple photo ${index + 1} URL:`, photoSlot.uploadUrl);
        }
      });

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
          photoURL: photoURL,
          multiplePhotoURLs: (() => {
            console.log('💾 Saving multiplePhotoURLs:', multiplePhotoURLs);
            return multiplePhotoURLs;
          })(), // 📸 Multiple photos array
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
          logoURL: logoURL || '', // 🏢 Enterprise logo URL
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
          logoURL: logoURL || '', // 🏛️ Enterprise service logo URL
          photoURL: photoURL || '', // 🏛️ Enterprise service representative photo URL
        } as any;
      }

      const cleanedData = cleanUndefinedValues(contactData);

      if (editContact) {
        // Update existing contact
        await ContactsService.updateContact(editContact.id, cleanedData);
        toast.success("Η επαφή ενημερώθηκε επιτυχώς.");
      } else {
        // Create new contact
        await ContactsService.createContact(cleanedData);
        toast.success("Η νέα επαφή δημιουργήθηκε επιτυχώς.");
      }

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
    if (name === 'isBranch') {
      setFormData({ ...formData, [name]: value === 'true' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (file: File | null) => {
    console.log('🔥 handleFileChange called με:', file?.name);

    if (!file) {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(formData.photoPreview);
      }
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

    // 🧹 CLEANUP: Revoke old blob URL if exists before creating new one
    if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.photoPreview);
    }

    // 🚨 ENTERPRISE FIX: Μόνο File object, ΌΧΙ data URL!
    // Το EnterprisePhotoUpload θα κάνει το upload με το enterprise handler
    setFormData({
      ...formData,
      photoFile: file,
      photoPreview: URL.createObjectURL(file) // Temporary URL for preview only
    });

    console.log('✅ handleFileChange: File αποθηκεύτηκε στο state χωρίς data URL');
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

  // Handler για nested object changes (π.χ. serviceAddress.street)
  const handleNestedChange = (path: string, value: any) => {
    const keys = path.split('.');
    const newFormData = { ...formData };

    let current: any = newFormData;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setFormData(newFormData);
  };

  // Handler για logo upload
  const handleLogoChange = (file: File | null) => {
    console.log('🔥 handleLogoChange called με:', file?.name);

    if (!file) {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (formData.logoPreview && formData.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(formData.logoPreview);
      }
      setFormData({
        ...formData,
        logoFile: null,
        logoPreview: ''
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

    // 🧹 CLEANUP: Revoke old blob URL if exists before creating new one
    if (formData.logoPreview && formData.logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.logoPreview);
    }

    // 🚨 ENTERPRISE FIX: Μόνο File object, ΌΧΙ data URL!
    // Το EnterprisePhotoUpload θα κάνει το upload με το enterprise handler
    setFormData({
      ...formData,
      logoFile: file,
      logoPreview: URL.createObjectURL(file) // Temporary URL for preview only
    });

    console.log('✅ handleLogoChange: File αποθηκεύτηκε στο state χωρίς data URL');
  };

  // Handler για ενημέρωση uploaded URLs (enterprise upload completion)
  const handleUploadedPhotoURL = (photoURL: string) => {
    console.log('🎯📸 UPLOAD COMPLETE: Updating photoPreview με uploaded URL:', photoURL);

    // 🧹 CLEANUP: Revoke old blob URL if exists
    if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.photoPreview);
    }

    setFormData({
      ...formData,
      photoFile: null, // Καθαρισμός του file μετά successful upload
      photoPreview: photoURL // Ενημέρωση με το uploaded URL
    });
  };

  const handleUploadedLogoURL = (logoURL: string) => {
    console.log('🎯🏢 UPLOAD COMPLETE: Updating logoPreview με uploaded URL:', logoURL);

    // 🧹 CLEANUP: Revoke old blob URL if exists
    if (formData.logoPreview && formData.logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.logoPreview);
    }

    setFormData({
      ...formData,
      logoFile: null, // Καθαρισμός του file μετά successful upload
      logoPreview: logoURL // Ενημέρωση με το uploaded URL
    });
  };

  // Handler για multiple photos changes
  const handleMultiplePhotosChange = (photos: PhotoSlot[]) => {
    console.log('🎯📸 MULTIPLE: Photos changed:', photos.length);
    setFormData({
      ...formData,
      multiplePhotos: photos
    });
  };

  // Handler για single multiple photo upload completion
  const handleMultiplePhotoUploadComplete = (index: number, result: FileUploadResult) => {
    console.log(`🎯📸 MULTIPLE: Photo ${index + 1} upload complete:`, result.url);

    const newPhotos = [...formData.multiplePhotos];
    if (newPhotos[index]) {
      newPhotos[index] = {
        ...newPhotos[index],
        uploadUrl: result.url
      };
      setFormData({
        ...formData,
        multiplePhotos: newPhotos
      });
    }
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

  return {
    formData,
    setFormData,
    loading,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleNestedChange,
    handleLogoChange,
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete
  };
}