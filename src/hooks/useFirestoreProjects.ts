import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface FirestoreProject {
  id: string;
  name: string;
  title: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  company: string;
  companyId: string;
  address: string;
  city: string;
  progress: number;
  totalValue: number;
  startDate: string;
  completionDate: string;
  lastUpdate: string;
  totalArea: number;
}

export function useFirestoreProjects() {
  const [projects, setProjects] = useState<FirestoreProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        setError(null);

        // First, try to connect to Firestore
        const projectsQuery = query(collection(db, 'projects'));
        const snapshot = await getDocs(projectsQuery);

        if (snapshot.empty) {

          // If no projects exist, create the sample projects we need for testing
          const { addDoc } = await import('firebase/firestore');

          const sampleProjects = [
            {
              name: 'Παλαιολόγου 15',
              title: 'Οικοδομικό Συγκρότημα',
              status: 'in_progress',
              company: 'ΑΚΜΗ ΑΤΕ',
              companyId: 'akmi-ate',
              address: 'Παλαιολόγου 15',
              city: 'Εύοσμος, Θεσσαλονίκη',
              progress: 75,
              totalValue: 850000,
              startDate: '2024-03-15',
              completionDate: '2024-12-30',
              lastUpdate: '2024-11-29',
              totalArea: 450
            },
            {
              name: 'Αγίας Τριάδας 22',
              title: 'Διαμερίσματα Luxury',
              status: 'completed',
              company: 'ΒΕΤΑ ΚΑΤΑΣΚΕΥΕΣ',
              companyId: 'beta-constructions',
              address: 'Αγίας Τριάδας 22',
              city: 'Θεσσαλονίκη',
              progress: 100,
              totalValue: 1200000,
              startDate: '2024-01-10',
              completionDate: '2024-10-15',
              lastUpdate: '2024-11-29',
              totalArea: 600
            }
          ];

          for (const project of sampleProjects) {
            await addDoc(collection(db, 'projects'), project);
          }

          // Fetch again after creating data
          const newSnapshot = await getDocs(projectsQuery);
          const projectsData: FirestoreProject[] = newSnapshot.docs.map(doc => {
            const data = doc.data();

            let mappedStatus = data.status;
            if (data.status === 'construction' || data.status === 'active') {
              mappedStatus = 'in_progress';
            }

            return {
              id: doc.id,
              ...data,
              status: mappedStatus,
              startDate: data.startDate || '',
              completionDate: data.completionDate || ''
            } as FirestoreProject;
          });

          setProjects(projectsData);
        } else {
          // Projects already exist, use them
          const projectsData: FirestoreProject[] = snapshot.docs.map(doc => {
            const data = doc.data();

            let mappedStatus = data.status;
            if (data.status === 'construction' || data.status === 'active') {
              mappedStatus = 'in_progress';
            }

            return {
              id: doc.id,
              ...data,
              status: mappedStatus,
              startDate: data.startDate || '',
              completionDate: data.completionDate || ''
            } as FirestoreProject;
          });

          setProjects(projectsData);
        }
      } catch (err) {
        console.error('❌ ERROR in useFirestoreProjects:', err);
        console.error('❌ Full error details:', JSON.stringify(err, null, 2));
        console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack');

        // Check if the error is related to Firebase configuration
        if (err instanceof Error) {
          if (err.message.includes('API key not valid') || err.message.includes('projectId')) {
            setError('Firebase configuration error. Check .env.local file.');
          } else if (err.message.includes('network') || err.message.includes('permission')) {
            setError('Network or permission error. Check Firebase rules.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Unknown Firestore error');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return { projects, loading, error };
}