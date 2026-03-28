'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

import { useEffect, useState } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('FirestoreTestData');

const TEST_PROPERTIES = [
  {
    id: process.env.NEXT_PUBLIC_TEST_UNIT_1_ID || 'test-1',
    name: process.env.NEXT_PUBLIC_TEST_UNIT_1_NAME || 'Υπέροχο Διαμέρισμα με Θέα',
    type: process.env.NEXT_PUBLIC_TEST_UNIT_1_TYPE || 'Διαμέρισμα',
    status: process.env.NEXT_PUBLIC_TEST_UNIT_1_STATUS || 'for-sale',
    price: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_1_PRICE || '185000'),
    area: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_1_AREA || '95'),
    floor: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_1_FLOOR || '2'),
    floorId: process.env.NEXT_PUBLIC_TEST_FLOOR_2_ID || 'floor-2',
    building: process.env.NEXT_PUBLIC_TEST_BUILDING_A_NAME || 'Κτίριο Α',
    buildingId: process.env.NEXT_PUBLIC_TEST_BUILDING_A_ID || 'building-a',
    project: process.env.NEXT_PUBLIC_TEST_PROJECT_1_NAME || 'Residential Complex',
    projectId: process.env.NEXT_PUBLIC_TEST_PROJECT_1_ID || 'project-1',
    bedrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_1_BEDROOMS || '3'),
    bathrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_1_BATHROOMS || '2'),
    description: process.env.NEXT_PUBLIC_TEST_UNIT_1_DESC || 'Διαμέρισμα με υπέροχη θέα και σύγχρονες ανέσεις'
  },
  {
    id: process.env.NEXT_PUBLIC_TEST_UNIT_2_ID || 'test-2',
    name: process.env.NEXT_PUBLIC_TEST_UNIT_2_NAME || 'Στούντιο στο Κέντρο',
    type: process.env.NEXT_PUBLIC_TEST_UNIT_2_TYPE || 'Στούντιο',
    status: process.env.NEXT_PUBLIC_TEST_UNIT_2_STATUS || 'for-rent',
    price: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_2_PRICE || '650'),
    area: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_2_AREA || '35'),
    floor: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_2_FLOOR || '1'),
    floorId: process.env.NEXT_PUBLIC_TEST_FLOOR_1_ID || 'floor-1',
    building: process.env.NEXT_PUBLIC_TEST_BUILDING_B_NAME || 'Κτίριο Β',
    buildingId: process.env.NEXT_PUBLIC_TEST_BUILDING_B_ID || 'building-b',
    project: process.env.NEXT_PUBLIC_TEST_PROJECT_2_NAME || 'Urban Living',
    projectId: process.env.NEXT_PUBLIC_TEST_PROJECT_2_ID || 'project-2',
    bedrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_2_BEDROOMS || '0'),
    bathrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_2_BATHROOMS || '1'),
    description: process.env.NEXT_PUBLIC_TEST_UNIT_2_DESC || 'Σύγχρονο στούντιο σε κεντρική τοποθεσία'
  },
  {
    id: process.env.NEXT_PUBLIC_TEST_UNIT_3_ID || 'test-3',
    name: process.env.NEXT_PUBLIC_TEST_UNIT_3_NAME || 'Μεγάλη Μεζονέτα με Κήπο και Πισίνα',
    type: process.env.NEXT_PUBLIC_TEST_UNIT_3_TYPE || 'Μεζονέτα',
    status: process.env.NEXT_PUBLIC_TEST_UNIT_3_STATUS || 'for-sale',
    price: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_3_PRICE || '450000'),
    area: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_3_AREA || '180'),
    floor: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_3_FLOOR || '3'),
    floorId: process.env.NEXT_PUBLIC_TEST_FLOOR_3_ID || 'floor-3',
    building: process.env.NEXT_PUBLIC_TEST_BUILDING_C_NAME || 'Κτίριο Γ',
    buildingId: process.env.NEXT_PUBLIC_TEST_BUILDING_C_ID || 'building-c',
    project: process.env.NEXT_PUBLIC_TEST_PROJECT_3_NAME || 'Luxury Residences Premium Complex',
    projectId: process.env.NEXT_PUBLIC_TEST_PROJECT_3_ID || 'project-3',
    bedrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_3_BEDROOMS || '4'),
    bathrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_3_BATHROOMS || '3'),
    description: process.env.NEXT_PUBLIC_TEST_UNIT_3_DESC || 'Πολυτελής μεζονέτα με ιδιωτικό κήπο και πισίνα'
  },
  {
    id: process.env.NEXT_PUBLIC_TEST_UNIT_4_ID || 'test-4',
    name: process.env.NEXT_PUBLIC_TEST_UNIT_4_NAME || 'Γκαρσονιέρα Φοιτητών',
    type: process.env.NEXT_PUBLIC_TEST_UNIT_4_TYPE || 'Γκαρσονιέρα',
    status: process.env.NEXT_PUBLIC_TEST_UNIT_4_STATUS || 'for-rent',
    price: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_4_PRICE || '450'),
    area: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_4_AREA || '28'),
    floor: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_4_FLOOR || '1'),
    floorId: process.env.NEXT_PUBLIC_TEST_FLOOR_1_ID || 'floor-1',
    building: process.env.NEXT_PUBLIC_TEST_BUILDING_D_NAME || 'Κτίριο Δ',
    buildingId: process.env.NEXT_PUBLIC_TEST_BUILDING_D_ID || 'building-d',
    project: process.env.NEXT_PUBLIC_TEST_PROJECT_4_NAME || 'Student Housing',
    projectId: process.env.NEXT_PUBLIC_TEST_PROJECT_4_ID || 'project-4',
    bedrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_4_BEDROOMS || '1'),
    bathrooms: parseInt(process.env.NEXT_PUBLIC_TEST_UNIT_4_BATHROOMS || '1'),
    description: process.env.NEXT_PUBLIC_TEST_UNIT_4_DESC || 'Ιδανική για φοιτητές'
  }
];

export default function FirestoreTestData() {
  const [status, setStatus] = useState<'checking' | 'creating' | 'done'>('checking');

  useEffect(() => {
    const setupTestData = async () => {
      try {
        // Check if data exists
        const unitsCollection = collection(db, COLLECTIONS.UNITS);
        const snapshot = await getDocs(unitsCollection);

        logger.info('Current Firestore units count', { count: snapshot.size });

        if (snapshot.size === 0) {
          logger.info('Creating test properties for mobile overflow debugging');
          setStatus('creating');

          // Add test properties
          for (const property of TEST_PROPERTIES) {
            const { id, ...propertyData } = property;
            await setDoc(doc(db, COLLECTIONS.UNITS, id), propertyData);
            logger.info('Created test property', { name: property.name });
          }

          logger.info('Test data created successfully');
        }

        setStatus('done');
      } catch (error) {
        logger.error('Error setting up test data', { error });
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