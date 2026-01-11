import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { FileNamingService } from '@/services/FileNamingService';
import { generateTempId } from '@/services/enterprise-id.service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 SERVER: Starting Firebase Admin server-side upload...');

    // 🏢 ENTERPRISE: Initialize Firebase Admin
    let adminApp;
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      console.log('🔧 FIREBASE ADMIN CONFIG:', { projectId, hasServiceKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY });

      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          adminApp = initializeApp({
            credential: cert(serviceAccount),
            storageBucket: `${projectId}.appspot.com`
          });
        } catch (parseError) {
          adminApp = initializeApp({
            projectId,
            storageBucket: `${projectId}.appspot.com`
          });
        }
      } else {
        adminApp = initializeApp({
          projectId,
          storageBucket: `${projectId}.appspot.com`
        });
      }
    } else {
      adminApp = getApps()[0];
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string || 'contacts/photos';

    // 🏢 ENTERPRISE: Get contact data for proper filename generation
    const contactDataJson = formData.get('contactData') as string;
    const purpose = formData.get('purpose') as string || 'photo';
    const photoIndex = formData.get('photoIndex') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📁 SERVER: File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
      hasContactData: !!contactDataJson,
      purpose,
      photoIndex
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🏢 ENTERPRISE FILENAME GENERATION: Use FileNamingService for professional names
    let fileName: string;

    if (contactDataJson) {
      try {
        const contactData = JSON.parse(contactDataJson);

        // Map purpose string to FileNamingService purpose type
        let servicePurpose: 'logo' | 'photo' | 'representative' = 'photo';
        if (purpose === 'logo') {
          servicePurpose = 'logo';
        } else if (purpose === 'representative' || purpose === 'avatar') {
          servicePurpose = 'representative';
        } else {
          servicePurpose = 'photo';
        }

        // Generate professional filename using FileNamingService
        const renamedFile = FileNamingService.generateProperFilename(
          file,
          contactData,
          servicePurpose,
          photoIndex ? parseInt(photoIndex) : undefined
        );

        fileName = renamedFile.name;

        console.log('🏷️ SERVER: FileNamingService applied:', {
          original: file.name,
          renamed: fileName,
          purpose: servicePurpose,
          contactType: contactData.type
        });

      } catch (error) {
        console.error('❌ SERVER: FileNamingService failed, using fallback:', error);

        // 🏢 ENTERPRISE: Fallback with crypto-secure ID generation
        const timestamp = Date.now();
        const uniqueId = generateTempId(); // Crypto-secure temp ID
        const extension = file.name.split('.').pop();
        fileName = `${timestamp}_${uniqueId}.${extension}`;
      }
    } else {
      // 🏢 ENTERPRISE: No contact data - use crypto-secure fallback naming
      const timestamp = Date.now();
      const uniqueId = generateTempId(); // Crypto-secure temp ID
      const extension = file.name.split('.').pop();
      fileName = `${timestamp}_${uniqueId}.${extension}`;

      console.log('⚠️ SERVER: No contact data provided, using fallback naming');
    }

    const storagePath = `${folderPath}/${fileName}`;
    console.log('📍 SERVER: Upload path:', storagePath);

    // 🏢 ENTERPRISE: Upload using Firebase Admin Storage
    const adminStorage = getStorage(adminApp);
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    console.log('🔧 ADMIN STORAGE: Uploading to bucket:', bucket.name);

    // Upload buffer to Firebase Admin Storage
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      }
    });

    console.log('✅ ADMIN STORAGE: Upload completed:', storagePath);

    // Make the file publicly readable and get download URL
    await fileRef.makePublic();
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log('🔗 ADMIN STORAGE: Download URL:', downloadURL);

    return NextResponse.json({
      success: true,
      url: downloadURL,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: storagePath
    });

  } catch (error) {
    console.error('❌ ADMIN STORAGE: Upload failed:', error);

    // 🔍 DETAILED ERROR LOGGING for Firebase Admin Storage debugging
    if (error && typeof error === 'object') {
      console.error('📋 ADMIN ERROR DETAILS:', {
        message: (error as any).message,
        code: (error as any).code,
        details: (error as any).details,
        stack: (error as any).stack?.substring(0, 200)
      });
    }

    return NextResponse.json({
      error: 'Firebase Admin Storage upload failed',
      details: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code
    }, { status: 500 });
  }
}