import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface FirestoreProject {
  id: number;
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
        console.log('🔥 Fetching projects from Firestore...');
        setLoading(true);
        setError(null);

        const projectsQuery = query(collection(db, 'projects'));
        const snapshot = await getDocs(projectsQuery);
        
        const projectsData: FirestoreProject[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Map status values to match Project type
          let mappedStatus = data.status;
          if (data.status === 'construction' || data.status === 'active') {
            mappedStatus = 'in_progress';
          }
          
          return {
            id: parseInt(doc.id),
            ...data,
            status: mappedStatus,
            // Ensure required fields have default values
            startDate: data.startDate || '',
            completionDate: data.completionDate || ''
          } as FirestoreProject;
        });

        console.log(`🔥 Loaded ${projectsData.length} projects from Firestore:`);
        console.log('🔥 Project details:', projectsData);
        projectsData.forEach(p => {
          console.log(`  - ${p.id}: ${p.name} (${p.status}) - ${p.progress}%`);
        });
        setProjects(projectsData);
      } catch (err) {
        console.error('❌ Error fetching projects from Firestore:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return { projects, loading, error };
}