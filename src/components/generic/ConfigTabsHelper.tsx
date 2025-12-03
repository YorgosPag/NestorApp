'use client';

import React from 'react';
import { Info, FileText, Users, History, User, CreditCard, Briefcase, Phone, MapPin, Gavel, UserCheck, Megaphone, Activity, DollarSign, Calendar, Construction, Building, Car, Landmark, Map, Settings, Home, Camera, Video, Clock, TrendingUp, Package, Ruler, BarChart, Target, MessageCircle, Cake, Globe, Badge, Clipboard, Hash, Wrench, Factory, Smartphone, Shield, ClipboardList, Image, Mail, Lock, AlertTriangle, CheckCircle, XCircle, Star, Search, Edit, Save, Upload, Download, Building2 } from 'lucide-react';
import type { SectionConfig } from '@/config/company-gemi-config';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { ServiceSectionConfig } from '@/config/service-config';
import { GenericTabRenderer } from './GenericTabRenderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Maps emoji icons to Lucide components
 */
const ICON_MAPPING = {
  // Company GEMI icons - All using icon names now
  'info': Info,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  'calendar': Calendar,
  // Individual contact icons - Converted to Lucide names
  'user': User,
  'credit-card': CreditCard,
  'briefcase': Briefcase,
  'phone': Phone,
  // GEMI categories - Using kebab-case naming
  'map-pin': MapPin,
  'users': Users,
  'gavel': Gavel,
  'history': History,
  'user-check': UserCheck,
  'megaphone': Megaphone,
  'activity': Activity,
  // Project/Building icons
  'construction': Construction,
  'building': Building,
  'car': Car,
  'landmark': Landmark,
  'map': Map,
  'settings': Settings,
  'home': Home,
  'camera': Camera,
  'video': Video,
  'clock': Clock,
  'trending-up': TrendingUp,
  'package': Package,
  'ruler': Ruler,
  'bar-chart': BarChart,
  'handshake': UserCheck,
  'target': Target,
  'message-circle': MessageCircle,
  // Individual config icons
  'user-check': UserCheck,
  'cake': Cake,
  'globe': Globe,
  'badge': Badge,
  'clipboard': Clipboard,
  'hash': Hash,
  'wrench': Wrench,
  'factory': Factory,
  'smartphone': Smartphone,
  // Service config icons
  'shield': Shield,
  'clipboard-list': ClipboardList,
  'image': Image,
  // Common utility icons
  'mail': Mail,
  'lock': Lock,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'star': Star,
  'search': Search,
  'edit': Edit,
  'save': Save,
  'upload': Upload,
  'download': Download,
  // All emoji have been replaced with Lucide icon names
  // No backward compatibility needed since all configs use Lucide names now
} as const;

/**
 * Gets the appropriate Lucide icon component for an icon name or emoji
 */
export function getIconComponent(iconName: string) {
  const iconComponent = ICON_MAPPING[iconName as keyof typeof ICON_MAPPING];
  if (iconComponent) {
    return iconComponent;
  }

  // If not found, return Info as fallback
  return Info;
}

// ============================================================================
// COMPANY PHOTOS PREVIEW COMPONENT
// ============================================================================

interface CompanyPhotosPreviewProps {
  logoUrl?: string;
  photoUrl?: string;
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos: (string | null)[]) => void;
}

/**
 * Component για προεπισκόπηση φωτογραφιών εταιρείας στο Contact Details
 */
function CompanyPhotosPreview({ logoUrl, photoUrl, onPhotoClick }: CompanyPhotosPreviewProps) {
  const hasLogo = logoUrl && logoUrl.length > 0;
  const hasPhoto = photoUrl && photoUrl.length > 0;

  // Δημιουργούμε gallery array με λογότυπο και φωτογραφία εκπροσώπου
  const galleryPhotos: (string | null)[] = [
    hasLogo ? logoUrl! : null,    // Index 0: Λογότυπο
    hasPhoto ? photoUrl! : null   // Index 1: Φωτογραφία εκπροσώπου
  ];

  const handlePhotoClick = (photoUrl: string, photoIndex: number) => {
    if (onPhotoClick) {
      onPhotoClick(photoUrl, photoIndex, galleryPhotos);
    }
  };

  if (!hasLogo && !hasPhoto) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p>Δεν υπάρχουν αποθηκευμένες φωτογραφίες</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Λογότυπο Εταιρείας */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Λογότυπο Εταιρείας
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasLogo ? (
              <div
                className="w-full h-[220px] rounded overflow-hidden bg-gray-200 shadow-sm cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => handlePhotoClick(logoUrl!, 0)}
                title="Κλικ για προεπισκόπηση"
              >
                <img
                  src={logoUrl}
                  alt="Λογότυπο Εταιρείας"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                />
              </div>
            ) : (
              <div className="w-full h-[220px] rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Δεν υπάρχει λογότυπο</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Φωτογραφία Εκπροσώπου */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Φωτογραφία Εκπροσώπου
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPhoto ? (
              <div
                className="w-full h-[220px] rounded overflow-hidden bg-gray-200 shadow-sm cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => handlePhotoClick(photoUrl!, 1)}
                title="Κλικ για προεπισκόπηση"
              >
                <img
                  src={photoUrl}
                  alt="Φωτογραφία Εκπροσώπου"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                />
              </div>
            ) : (
              <div className="w-full h-[220px] rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                  <User className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Δεν υπάρχει φωτογραφία</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// INDIVIDUAL PHOTOS PREVIEW COMPONENT
// ============================================================================

interface IndividualPhotosPreviewProps {
  photoUrl?: string;
  multiplePhotoURLs?: string[];
  onPhotoClick?: (photoUrl: string, photoIndex: number) => void;
}

/**
 * Component για προεπισκόπηση φωτογραφιών φυσικού προσώπου στο Contact Details
 * Δείχνει 6 φωτογραφίες σε 3x2 grid όπως στο modal προσθήκης/επεξεργασίας
 */
function IndividualPhotosPreview({ photoUrl, multiplePhotoURLs, onPhotoClick }: IndividualPhotosPreviewProps) {
  // Δημιουργούμε array 6 φωτογραφιών (όπως στο modal)
  const allPhotos = React.useMemo(() => {
    const result = [];

    // Για φυσικά πρόσωπα, χρησιμοποιούμε μόνο τα multiplePhotoURLs
    // γιατί όλες οι φωτογραφίες αποθηκεύονται εκεί (δεν υπάρχει ξεχωριστό profile photo)
    if (multiplePhotoURLs && multiplePhotoURLs.length > 0) {
      result.push(...multiplePhotoURLs);
    } else if (photoUrl && !multiplePhotoURLs?.length) {
      // Fallback για backward compatibility αν υπάρχει μόνο photoUrl
      result.push(photoUrl);
    }

    // Συμπληρώνουμε με άδεια slots μέχρι τα 6
    while (result.length < 6) {
      result.push(null);
    }

    return result.slice(0, 6);
  }, [photoUrl, multiplePhotoURLs]);

  const totalPhotos = allPhotos.filter(photo => photo).length;

  return (
    <div className="mt-4">
      {/* Header όπως στο modal */}
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" />
          Φωτογραφίες ({totalPhotos}/6)
        </h4>
      </div>

      {/* Photo Grid - 3x2 Layout όπως στο modal */}
      <div className="grid grid-cols-3 gap-8 p-6">
        {allPhotos.map((photo, index) => (
          <div key={index} className="h-[300px] w-full">
            <Card className="h-full">
              <CardContent className="p-0 h-full">
                {photo ? (
                  <div
                    className="relative h-full w-full rounded overflow-hidden bg-gray-200 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => onPhotoClick?.(photo, index)}
                  >
                    <img
                      src={photo}
                      alt={`Φωτογραφία ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ) : (
                  <div className="h-full w-full rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                    <div className="text-center text-gray-400">
                      <Camera className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">Κενή φωτογραφία</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SERVICE LOGO PREVIEW COMPONENT
// ============================================================================

interface ServiceLogoPreviewProps {
  logoUrl?: string;
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos: (string | null)[]) => void;
}

/**
 * Component για προεπισκόπηση λογότυπου δημόσιας υπηρεσίας στο Contact Details
 * Δείχνει το λογότυπο όπως στο modal προσθήκης/επεξεργασίας
 */
function ServiceLogoPreview({ logoUrl, onPhotoClick }: ServiceLogoPreviewProps) {
  const hasLogo = logoUrl && logoUrl.length > 0;

  // Δημιουργούμε gallery array με λογότυπο μόνο για services
  const galleryPhotos: (string | null)[] = [
    hasLogo ? logoUrl! : null    // Index 0: Λογότυπο υπηρεσίας
  ];

  const handlePhotoClick = () => {
    if (onPhotoClick && hasLogo) {
      onPhotoClick(logoUrl!, 0, galleryPhotos);
    }
  };

  return (
    <div className="mt-6">
      {/* Σταθερό πλάτος όπως στο modal */}
      <div className="w-[400px] h-[300px] mx-auto">
        <Card className="h-full">
          <CardContent className="p-0 h-full">
            {hasLogo ? (
              <div
                className="relative h-full w-full rounded overflow-hidden bg-gray-200 shadow-sm cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={handlePhotoClick}
                title="Κλικ για προεπισκόπηση"
              >
                <img
                  src={logoUrl}
                  alt="Λογότυπο Δημόσιας Υπηρεσίας"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                />
              </div>
            ) : (
              <div className="h-full w-full rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-400">
                  <Building2 className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm">Δεν υπάρχει λογότυπο</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<any> | React.FC<any>;
  content: React.ReactNode;
}

/**
 * Creates tab configuration objects from GEMI config sections
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi-config';
 * import { createTabsFromConfig } from '@/components/generic/ConfigTabsHelper';
 *
 * function ContactDetails({ contact }) {
 *   const sections = getSortedSections();
 *   const tabs = contact.type === 'company'
 *     ? createTabsFromConfig(sections, contact)
 *     : [...individualTabs];
 *
 *   return <TabsComponent tabs={tabs} />;
 * }
 * ```
 */
export function createTabsFromConfig(
  sections: SectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void
): TabConfig[] {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: section.id === 'companyPhotos' ? (
      // Special rendering για Company Photos tab - εμφάνιση αποθηκευμένων φωτογραφιών
      <CompanyPhotosPreview
        logoUrl={data.logoPreview || data.logoURL}
        photoUrl={data.photoPreview || data.photoURL || data.representativePhotoURL}
        onPhotoClick={onPhotoClick}
      />
    ) : (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  }));
}

/**
 * Creates tab configuration objects from Individual config sections
 */
export function createIndividualTabsFromConfig(
  sections: IndividualSectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number) => void
): TabConfig[] {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: section.id === 'photo' ? (
      // Special rendering για Individual Photos tab - εμφάνιση αποθηκευμένων φωτογραφιών
      <IndividualPhotosPreview
        photoUrl={data.photoPreview || data.photoURL}
        multiplePhotoURLs={data.multiplePhotoURLs || []}
        onPhotoClick={onPhotoClick}
      />
    ) : (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  }));
}

/**
 * Creates tab configuration objects from Service config sections
 */
export function createServiceTabsFromConfig(
  sections: ServiceSectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void
): TabConfig[] {
  // 🔧 FIX: Service Field Mapping Adapter
  // Το service-config χρησιμοποιεί 'name' ενώ η βάση δεδομένων αποθηκεύει 'serviceName'
  // Επίσης κάνουμε mapping των emails/phones arrays στα βασικά fields για το GenericTabRenderer
  const mappedData = {
    ...data,
    name: data.serviceName || data.name, // Map serviceName → name για service-config compatibility
    email: data.emails?.[0]?.email || '', // 🔧 FIX: Map emails array → βασικό email field
    phone: data.phones?.[0]?.number || '', // 🔧 FIX: Map phones array → βασικό phone field
    logoPreview: data.logoPreview || data.logoURL || '', // 🔧 FIX: Pending upload takes priority over stored logoURL
    logoURL: data.logoURL || '', // 🔧 FIX: Ensure logoURL is copied for fallback preview
    photoPreview: data.photoPreview || data.photoURL || '', // 🔧 FIX: Pending upload takes priority over stored photoURL
    photoURL: data.photoURL || '', // 🔧 FIX: Ensure photoURL is copied for fallback preview
  };

  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: section.id === 'logo' ? (
      // Special rendering για Service Logo tab - εμφάνιση αποθηκευμένου λογότυπου
      <ServiceLogoPreview
        logoUrl={mappedData.logoPreview || mappedData.logoURL}
        onPhotoClick={onPhotoClick}
      />
    ) : (
      <GenericTabRenderer
        section={section}
        data={mappedData} // 🔧 FIX: Χρησιμοποιούμε τα mapped data
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  }));
}

/**
 * Creates a single tab from a section config
 */
export function createTabFromSection(
  section: SectionConfig,
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>
): TabConfig {
  return {
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createTabsFromConfig,
  createTabFromSection,
  getIconComponent,
};