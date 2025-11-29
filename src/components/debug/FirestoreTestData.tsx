'use client';

import { useEffect, useState } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const TEST_PROPERTIES = [
  {
    id: 'test-1',
    name: 'Υπέροχο Διαμέρισμα με Θέα',
    type: 'Διαμέρισμα',
    status: 'for-sale',
    price: 185000,
    area: 95,
    floor: 2,
    floorId: 'floor-2',
    building: 'Κτίριο Α',
    buildingId: 'building-a',
    project: 'Residential Complex',
    projectId: 'project-1',
    bedrooms: 3,
    bathrooms: 2,
    description: 'Διαμέρισμα με υπέροχη θέα και σύγχρονες ανέσεις'
  },
  {
    id: 'test-2',
    name: 'Στούντιο στο Κέντρο',
    type: 'Στούντιο',
    status: 'for-rent',
    price: 650,
    area: 35,
    floor: 1,
    floorId: 'floor-1',
    building: 'Κτίριο Β',
    buildingId: 'building-b',
    project: 'Urban Living',
    projectId: 'project-2',
    bedrooms: 0,
    bathrooms: 1,
    description: 'Σύγχρονο στούντιο σε κεντρική τοποθεσία'
  },
  {
    id: 'test-3',
    name: 'Μεγάλη Μεζονέτα με Κήπο και Πισίνα',
    type: 'Μεζονέτα',
    status: 'for-sale',
    price: 450000,
    area: 180,
    floor: 3,
    floorId: 'floor-3',
    building: 'Κτίριο Γ',
    buildingId: 'building-c',
    project: 'Luxury Residences Premium Complex',
    projectId: 'project-3',
    bedrooms: 4,
    bathrooms: 3,
    description: 'Πολυτελής μεζονέτα με ιδιωτικό κήπο και πισίνα'
  },
  {
    id: 'test-4',
    name: 'Γκαρσονιέρα Φοιτητών',
    type: 'Γκαρσονιέρα',
    status: 'for-rent',
    price: 450,
    area: 28,
    floor: 1,
    floorId: 'floor-1',
    building: 'Κτίριο Δ',
    buildingId: 'building-d',
    project: 'Student Housing',
    projectId: 'project-4',
    bedrooms: 1,
    bathrooms: 1,
    description: 'Ιδανική για φοιτητές'
  }
];

export default function FirestoreTestData() {
  const [status, setStatus] = useState<'checking' | 'creating' | 'done'>('checking');

  useEffect(() => {
    const setupTestData = async () => {
      try {
        // Check if data exists
        const unitsCollection = collection(db, 'units');
        const snapshot = await getDocs(unitsCollection);

        console.log('📋 Current Firestore units count:', snapshot.size);

        if (snapshot.size === 0) {
          console.log('➕ Creating test properties for mobile overflow debugging...');
          setStatus('creating');

          // Add test properties
          for (const property of TEST_PROPERTIES) {
            const { id, ...propertyData } = property;
            await setDoc(doc(db, 'units', id), propertyData);
            console.log('✅ Created:', property.name);
          }

          console.log('🎉 Test data created successfully!');
        }

        setStatus('done');
      } catch (error) {
        console.error('❌ Error setting up test data:', error);
        setStatus('done');
      }
    };

    setupTestData();
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed top-4 right-4 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm">
        🔍 Checking Firestore data...
      </div>
    );
  }

  if (status === 'creating') {
    return (
      <div className="fixed top-4 right-4 bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm">
        ➕ Creating test properties...
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm opacity-75">
      ✅ Data ready
    </div>
  );
}