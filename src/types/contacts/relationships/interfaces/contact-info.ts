// ============================================================================
// PROFESSIONAL CONTACT INFORMATION INTERFACES - ENTERPRISE MODULE
// ============================================================================
//
// 📞 Professional contact information structures
// Business-specific contact details within organizational context
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

/**
 * 📞 Professional Contact Information
 *
 * Business-specific contact details within organizational context
 * Separate from personal contact information
 */
export interface ProfessionalContactInfo {
  /** 📞 Business phone (direct line) */
  businessPhone?: string;

  /** 📱 Business mobile */
  businessMobile?: string;

  /** 📠 Fax number */
  fax?: string;

  /** 📧 Business email (official) */
  businessEmail?: string;

  /** 📧 Alternative business email */
  alternativeEmail?: string;

  /** 🏢 Internal extension */
  extension?: string;

  /** 🏢 Office/room number */
  officeNumber?: string;

  /** 🏢 Floor/building location */
  officeLocation?: string;

  /** 🏢 Building/campus name */
  buildingName?: string;

  /** 📍 Department address (if different from main) */
  departmentAddress?: string;

  /** 🌐 Internal employee portal URL */
  intranetProfile?: string;

  /** 💬 Internal messaging handle (Slack, Teams, etc.) */
  internalMessaging?: string;

  /** ⏰ Available hours */
  availableHours?: string;

  /** 📅 Preferred contact method */
  preferredContactMethod?: 'phone' | 'email' | 'in_person' | 'messaging';

  /** 📝 Contact notes */
  contactNotes?: string;
}