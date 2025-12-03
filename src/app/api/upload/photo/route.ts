import { NextRequest, NextResponse } from 'next/server';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 SERVER: Starting server-side upload...');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string || 'contacts/photos';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📁 SERVER: File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const fileName = `${timestamp}_${randomString}.${extension}`;

    const storagePath = `${folderPath}/${fileName}`;
    console.log('📍 SERVER: Upload path:', storagePath);

    // Upload to Firebase Storage (server-side)
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    console.log('✅ SERVER: Upload completed:', snapshot.metadata.fullPath);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('🔗 SERVER: Download URL obtained:', downloadURL);

    return NextResponse.json({
      success: true,
      url: downloadURL,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: storagePath
    });

  } catch (error) {
    console.error('❌ SERVER: Upload failed:', error);
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}