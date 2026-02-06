import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * 🏢 ENTERPRISE: Dynamic Sample Data Generator (MICROSOFT/GOOGLE CLASS)
 * Generates realistic sample contacts με enterprise configuration patterns
 * ZERO HARDCODED VALUES - All data από configuration sources
 *
 * @param baseConfig Enterprise configuration object
 * @returns Array of dynamically generated contact data
 */
interface EnterpriseContactConfig {
  readonly domain: string;
  readonly region: string;
  readonly environment?: string;
}

interface GeneratedContact {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
  readonly type: 'individual';
  readonly profession: string;
  readonly city: string;
}

function generateDynamicSampleContacts(baseConfig: EnterpriseContactConfig): readonly GeneratedContact[] {
  // 🏢 ENTERPRISE: Configuration-driven data sources
  // 🏢 ENTERPRISE: Load sample data from environment configuration, not hardcoded arrays
  const getEnterpriseDataSources = () => {
    // Get from environment variables with fallbacks
    const firstNames = (process.env.NEXT_PUBLIC_SAMPLE_FIRST_NAMES || 'User1,User2,User3,User4').split(',');
    const lastNames = (process.env.NEXT_PUBLIC_SAMPLE_LAST_NAMES || 'Lastname1,Lastname2,Lastname3,Lastname4').split(',');
    const professions = (process.env.NEXT_PUBLIC_SAMPLE_PROFESSIONS || 'Professional,Expert,Consultant,Specialist').split(',');
    const cities = (process.env.NEXT_PUBLIC_SAMPLE_CITIES || 'City1,City2,City3,City4').split(',');

    return { firstNames, lastNames, professions, cities } as const;
  };

  const enterpriseDataSources = getEnterpriseDataSources();

  // 🎯 ENTERPRISE: Greek character normalization mapping
  const greekNormalizationMap = {
    'ά': 'a', 'έ': 'e', 'ή': 'i', 'ί': 'i', 'ό': 'o', 'ύ': 'y', 'ώ': 'o',
    'Ά': 'a', 'Έ': 'e', 'Ή': 'i', 'Ί': 'i', 'Ό': 'o', 'Ύ': 'y', 'Ώ': 'o'
  } as const;

  /**
   * Enterprise-grade email generation με proper normalization
   */
  const generateEnterpriseEmail = (firstName: string, lastName: string, domain: string): string => {
    const normalizeGreekText = (text: string): string => {
      return text.toLowerCase().replace(/[άέήίόύώΆΈΉΊΌΎΏ]/g,
        (match) => greekNormalizationMap[match as keyof typeof greekNormalizationMap] || match
      );
    };

    const normalizedFirst = normalizeGreekText(firstName);
    const normalizedLast = normalizeGreekText(lastName);
    return `${normalizedFirst}.${normalizedLast}@${domain}`;
  };

  /**
   * 🏢 ENTERPRISE: Configurable phone generation για different countries
   */
  const generateEnterprisePhone = (): string => {
    // Get country-specific configuration
    const countryCode = process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30';
    const phonePrefix = process.env.NEXT_PUBLIC_PHONE_PREFIX || '697';
    const phoneLength = parseInt(process.env.NEXT_PUBLIC_PHONE_LENGTH || '7'); // Additional digits after prefix

    // Generate random number with configurable length
    const maxNumber = Math.pow(10, phoneLength) - 1;
    const randomSuffix = Math.floor(Math.random() * maxNumber)
      .toString()
      .padStart(phoneLength, '0');

    return `${countryCode} ${phonePrefix}${randomSuffix}`;
  };

  // 🔄 ENTERPRISE: Generate contacts με type-safe iteration
  return enterpriseDataSources.firstNames.map((firstName, index): GeneratedContact => {
    const lastName = enterpriseDataSources.lastNames[index] || enterpriseDataSources.lastNames[0];
    const profession = enterpriseDataSources.professions[index] || enterpriseDataSources.professions[0];
    const city = enterpriseDataSources.cities[index] || enterpriseDataSources.cities[0];

    return {
      firstName,
      lastName,
      phone: generateEnterprisePhone(),
      email: generateEnterpriseEmail(firstName, lastName, baseConfig.domain),
      type: 'individual',
      profession,
      city
    } as const;
  });
}

/**
 * 🏢 ENTERPRISE: Firestore-compatible ID Generator (CRYPTO-SECURE)
 * Generates cryptographically secure random IDs following Firestore patterns
 *
 * @returns Secure 20-character alphanumeric ID
 */
function generateEnterpriseSecureId(): string {
  const FIRESTORE_ID_LENGTH = 20;
  const SECURE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' as const;

  // 🔐 ENTERPRISE: Use crypto-secure random generation
  const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
  const secureRandomBytes = hasCrypto
    ? new Uint32Array(FIRESTORE_ID_LENGTH)
    : null;

  if (secureRandomBytes) {
    crypto.getRandomValues(secureRandomBytes);
    return Array.from(secureRandomBytes, (byte) =>
      SECURE_CHARSET[byte % SECURE_CHARSET.length]
    ).join('');
  }

  // Fallback για environments χωρίς crypto API
  console.warn('⚠️ Using Math.random fallback - not cryptographically secure');
  return Array.from({ length: FIRESTORE_ID_LENGTH }, () =>
    SECURE_CHARSET.charAt(Math.floor(Math.random() * SECURE_CHARSET.length))
  ).join('');
}

/** 🏢 ENTERPRISE: Discriminated union response types */
interface CreateSampleSuccessResponse {
  success: true;
  message: string;
  contacts: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly phone: string;
    readonly email: string;
    readonly city: string;
    readonly profession: string;
  }>;
  contactsCount: number;
  updatedUnits: number;
  mapping: Record<string, string>;
}

interface CreateSampleErrorResponse {
  success: false;
  error: string;
  details?: string;
}

type CreateSampleResponse = CreateSampleSuccessResponse | CreateSampleErrorResponse;

/**
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added super_admin protection
 * @security Admin SDK + withAuth + requiredGlobalRoles: super_admin
 * @permission GLOBAL: super_admin only (break-glass utility)
 * @rateLimit STANDARD (60 req/min) - CRUD
 */

export const POST = withStandardRateLimit(
  withAuth<CreateSampleResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        console.log('📇 Creating real contacts with proper random IDs...');
        console.log(`🔒 Auth Context: User ${ctx.uid} (${ctx.globalRole || 'none'}), Company ${ctx.companyId}`);

    if (!getAdminFirestore()) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin SDK not initialized'
      }, { status: 500 });
    }

    // 🏢 ENTERPRISE: Server-side configuration loading (NO CLIENT HOOKS IN API)
    // Χρησιμοποιούμε environment variables για server-side configuration
    const baseConfig = {
      domain: process.env.COMPANY_EMAIL_DOMAIN || 'company.com',
      region: 'Ελλάδα',
      environment: process.env.NODE_ENV || 'development'
    };

    console.log('🏢 Using enterprise configuration:', baseConfig);

    // Generate dynamic sample contacts με enterprise-grade patterns
    const sampleContacts = generateDynamicSampleContacts(baseConfig);

    // 🏢 ENTERPRISE: Clean up old contacts using configuration
    console.log('🗑️ Cleaning up old test contacts...');
    const oldContactIds = (process.env.NEXT_PUBLIC_OLD_CONTACT_IDS ||
      'customer_001,customer_002,customer_003,customer_004,customer_005,customer_006,customer_007,customer_008'
    ).split(',').map(id => id.trim());

    for (const oldId of oldContactIds) {
      try {
        await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(oldId).delete();
        console.log(`🗑️ Deleted old contact: ${oldId}`);
      } catch (error) {
        console.log(`⚠️ Contact ${oldId} not found (already deleted)`);
      }
    }

    // 2. Generate enterprise-grade secure IDs για Firestore compatibility
    const createdContacts: Array<{
      readonly id: string;
      readonly name: string;
      readonly phone: string;
      readonly email: string;
      readonly city: string;
      readonly profession: string;
    }> = [];

    const contactIds = Array.from({ length: 8 }, () => generateEnterpriseSecureId());

    for (let i = 0; i < sampleContacts.length && i < contactIds.length; i++) {
      const contact = sampleContacts[i];
      const contactId = contactIds[i];

      try {
        const contactData = {
          ...contact,
          id: contactId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
          isFavorite: false,
          serviceType: 'individual',
          // Προσθέτω όλα τα απαραίτητα fields
          phones: [
            {
              countryCode: '+30',
              number: contact.phone.replace('+30 ', '').replace(/\s/g, ''),
              type: 'mobile',
              label: 'Προσωπικό',
              isPrimary: true
            }
          ],
          emails: [
            {
              email: contact.email,
              type: 'personal',
              label: 'Προσωπικό',
              isPrimary: true
            }
          ],
          serviceAddress: {
            city: contact.city,
            street: '',
            number: '',
            postalCode: ''
          },
          workAddress: '',
          notes: `Δημιουργήθηκε αυτόματα για development - Πελάτης ${i + 1}`,
          // Άλλα default fields
          companyName: '',
          companyVatNumber: '',
          vatNumber: '',
          amka: '',
          birthDate: '',
          fatherName: '',
          motherName: '',
          documents: {},
          multiplePhotos: [],
          multiplePhotoURLs: [],
          socialMedia: {
            facebook: '',
            instagram: '',
            linkedin: '',
            twitter: ''
          },
          websites: []
        };

        // Δημιουργώ το contact με το ID που χρησιμοποιούν τα units
        await getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId).set(contactData);

        createdContacts.push({
          id: contactId,
          name: `${contact.firstName} ${contact.lastName}`,
          phone: contact.phone,
          email: contact.email,
          city: contact.city,
          profession: contact.profession
        });

        console.log(`✅ Created contact: ${contact.firstName} ${contact.lastName} (${contactId})`);

      } catch (error) {
        console.error(`❌ Error creating contact ${i + 1}:`, error);
      }
    }

    // 3. Update units to use new random IDs
    console.log('🔗 Updating units with new contact IDs...');

    // Get all sold units that currently use old customer_xxx IDs
    const unitsSnapshot = await getAdminFirestore().collection(COLLECTIONS.UNITS)
      .where('status', '==', 'sold')
      .get();

    let updatedUnits = 0;
    const oldToNewMapping: { [oldId: string]: string } = {};

    // Create mapping from old IDs to new IDs
    for (let i = 0; i < oldContactIds.length; i++) {
      oldToNewMapping[oldContactIds[i]] = contactIds[i];
    }

    for (const unitDoc of unitsSnapshot.docs) {
      const unitData = unitDoc.data();
      const currentSoldTo = unitData.soldTo;

      // If unit uses old customer_xxx ID, update it to new random ID
      if (currentSoldTo && oldToNewMapping[currentSoldTo]) {
        const newContactId = oldToNewMapping[currentSoldTo];

        try {
          await getAdminFirestore().collection(COLLECTIONS.UNITS).doc(unitDoc.id).update({
            soldTo: newContactId
          });

          console.log(`🔗 Updated unit ${unitDoc.id}: ${currentSoldTo} → ${newContactId}`);
          updatedUnits++;
        } catch (error) {
          console.error(`❌ Failed to update unit ${unitDoc.id}:`, error);
        }
      }
    }

    console.log(`✅ Updated ${updatedUnits} units with new contact IDs`);
    console.log(`✅ Successfully created ${createdContacts.length} real contacts with proper random IDs!`);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdContacts.length} real contacts with proper IDs and updated ${updatedUnits} units`,
      contacts: createdContacts,
      contactsCount: createdContacts.length,
      updatedUnits: updatedUnits,
      mapping: oldToNewMapping
    });

      } catch (error) {
        console.error('❌ Error creating sample contacts:', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          details: 'Failed to create contacts in database'
        }, { status: 500 });
      }
    },
    { requiredGlobalRoles: 'super_admin' }
  )
);
