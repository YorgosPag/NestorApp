/**
 * COMMUNICATION LABELS
 *
 * Communication type labels (phone, email, website, social media) for all entity types:
 * Individual, Company, and Service (Public Service).
 *
 * @domain Communication Management
 * @consumers CommunicationConfigs.ts
 */

// ADR-327 §8.5.4 — οι πίνακες τύπου τηλεφώνου / email / ιστοσελίδας / social δένονται στις ρίζες τους (CHECK 3.73):
// τύπος που ο κάτοχος προσφέρει χωρίς ετικέτα = σφάλμα μεταγλώττισης, όχι κενή γραμμή στη φόρμα.
import type { PhoneTypeLabels } from '@/lib/contact/phone-type-vocabulary';
import type { EmailTypeLabels } from '@/lib/contact/email-type-vocabulary';
import type { WebsiteTypeLabels } from '@/lib/contact/website-type-vocabulary';
import type { SocialMediaTypeLabels, SocialPlatform } from '@/lib/contact/social-media-type-vocabulary';

/**
 * Το namespace όπου λύνονται **όλα** τα κλειδιά αυτού του αρχείου (`communication.*`). Ζει δίπλα στα κλειδιά επειδή
 * είναι ιδιότητά τους: ο αναγνώστης που δεν φορτώνει το namespace της φόρμας (το Ιστορικό, ADR-195 (ζ)) το ζητά από
 * εδώ, όχι από δεύτερη δήλωση. Η άγκυρα `audit-value-vocabularies.test.ts` Λ1 το επαληθεύει πάνω στα JSON.
 */
export const COMMUNICATION_LABELS_NS = 'contacts-relationships';

// ============================================================================
// INDIVIDUAL COMMUNICATION TYPES
// ============================================================================

export const PHONE_TYPE_LABELS = {
  mobile: 'communication.phoneTypes.mobile',
  home: 'communication.phoneTypes.home',
  work: 'communication.phoneTypes.work',
  fax: 'communication.phoneTypes.fax',
  internal: 'communication.phoneTypes.internal',
  other: 'communication.phoneTypes.other'
} as const satisfies PhoneTypeLabels<'individual'>;

export const EMAIL_TYPE_LABELS = {
  personal: 'communication.emailTypes.personal',
  work: 'communication.emailTypes.work',
  invoice: 'communication.emailTypes.invoice',
  notification: 'communication.emailTypes.notification',
  support: 'communication.emailTypes.support',
  other: 'communication.emailTypes.other'
} as const satisfies EmailTypeLabels<'individual'>;

export const WEBSITE_TYPE_LABELS = {
  personal: 'communication.websiteTypes.personal',
  company: 'communication.websiteTypes.company',
  portfolio: 'communication.websiteTypes.portfolio',
  blog: 'communication.websiteTypes.blog',
  other: 'communication.websiteTypes.other'
} as const satisfies WebsiteTypeLabels<'individual'>;

export const SOCIAL_MEDIA_TYPE_LABELS = {
  personal: 'communication.socialMediaTypes.personal',
  professional: 'communication.socialMediaTypes.professional',
  business: 'communication.socialMediaTypes.business',
  other: 'communication.socialMediaTypes.other'
} as const satisfies SocialMediaTypeLabels<'individual'>;

export const SOCIAL_PLATFORM_LABELS = {
  linkedin: 'communication.platforms.linkedin',
  facebook: 'communication.platforms.facebook',
  instagram: 'communication.platforms.instagram',
  twitter: 'communication.platforms.twitter',
  youtube: 'communication.platforms.youtube',
  github: 'communication.platforms.github',
  tiktok: 'communication.platforms.tiktok',
  whatsapp: 'communication.platforms.whatsapp',
  telegram: 'communication.platforms.telegram',
  other: 'communication.platforms.other'
} as const satisfies Readonly<Record<SocialPlatform, string>>;

// ============================================================================
// SERVICE (Public Service) COMMUNICATION TYPES
// ============================================================================

export const SERVICE_PHONE_TYPE_LABELS = {
  main: 'communication.servicePhoneTypes.main',
  department: 'communication.servicePhoneTypes.department',
  secretariat: 'communication.servicePhoneTypes.secretariat',
  helpdesk: 'communication.servicePhoneTypes.helpdesk',
  fax: 'communication.servicePhoneTypes.fax',
  other: 'communication.servicePhoneTypes.other'
} as const satisfies PhoneTypeLabels<'service'>;

export const SERVICE_EMAIL_TYPE_LABELS = {
  general: 'communication.serviceEmailTypes.general',
  department: 'communication.serviceEmailTypes.department',
  secretariat: 'communication.serviceEmailTypes.secretariat',
  info: 'communication.serviceEmailTypes.info',
  other: 'communication.serviceEmailTypes.other'
} as const satisfies EmailTypeLabels<'service'>;

export const SERVICE_WEBSITE_TYPE_LABELS = {
  official: 'communication.serviceWebsiteTypes.official',
  eServices: 'communication.serviceWebsiteTypes.eServices',
  portal: 'communication.serviceWebsiteTypes.portal',
  other: 'communication.serviceWebsiteTypes.other'
} as const satisfies WebsiteTypeLabels<'service'>;

export const SERVICE_SOCIAL_MEDIA_TYPE_LABELS = {
  official: 'communication.serviceSocialMediaTypes.official',
  informational: 'communication.serviceSocialMediaTypes.informational',
  other: 'communication.serviceSocialMediaTypes.other'
} as const satisfies SocialMediaTypeLabels<'service'>;

// ============================================================================
// COMPANY COMMUNICATION TYPES
// ============================================================================

export const COMPANY_PHONE_TYPE_LABELS = {
  main: 'communication.companyPhoneTypes.main',
  department: 'communication.companyPhoneTypes.department',
  secretariat: 'communication.companyPhoneTypes.secretariat',
  sales: 'communication.companyPhoneTypes.sales',
  support: 'communication.companyPhoneTypes.support',
  fax: 'communication.companyPhoneTypes.fax',
  other: 'communication.companyPhoneTypes.other'
} as const satisfies PhoneTypeLabels<'company'>;

export const COMPANY_EMAIL_TYPE_LABELS = {
  general: 'communication.companyEmailTypes.general',
  department: 'communication.companyEmailTypes.department',
  sales: 'communication.companyEmailTypes.sales',
  support: 'communication.companyEmailTypes.support',
  info: 'communication.companyEmailTypes.info',
  other: 'communication.companyEmailTypes.other'
} as const satisfies EmailTypeLabels<'company'>;

export const COMPANY_WEBSITE_TYPE_LABELS = {
  corporate: 'communication.companyWebsiteTypes.corporate',
  eshop: 'communication.companyWebsiteTypes.eshop',
  blog: 'communication.companyWebsiteTypes.blog',
  other: 'communication.companyWebsiteTypes.other'
} as const satisfies WebsiteTypeLabels<'company'>;

export const COMPANY_SOCIAL_MEDIA_TYPE_LABELS = {
  corporate: 'communication.companySocialMediaTypes.corporate',
  marketing: 'communication.companySocialMediaTypes.marketing',
  other: 'communication.companySocialMediaTypes.other'
} as const satisfies SocialMediaTypeLabels<'company'>;
