import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { readProjects, logQueryContext, AuthorizationError, QueryExecutionError } from '@/lib/auth/query-middleware';

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

        // 🔒 Enterprise authorization με comprehensive error handling
        const result = await readProjects(db);
        logQueryContext(result, 'useFirestoreProjects');

        if (result.isEmpty) {
          // 🏢 ENTERPRISE: No hardcoded sample data - empty projects state
          // Projects should be created via proper seed data system or admin interface
          console.log('📋 No projects found in database - returning empty state');
          setProjects([]);
        } else {
          // Projects already exist, use them από scoped query result
          const projectsData: FirestoreProject[] = result.documents.map((doc: any) => {
            const data = doc;

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

        // 🏢 Enterprise error handling με proper type guards
        if (err instanceof Error) {
          const errorName = err.constructor.name;

          // Handle enterprise authorization errors από AuthorizedQueryService
          if (err instanceof AuthorizationError) {
            setError(`🔒 Authorization failed: ${err.message}`);
          } else if (err instanceof QueryExecutionError) {
            setError(`⚠️ Query execution failed: ${err.message}`);
          } else if (err.message.includes('API key not valid') || err.message.includes('projectId')) {
            setError('Firebase configuration error. Check .env.local file.');
          } else if (err.message.includes('network') || err.message.includes('permission')) {
            setError('Network or permission error. Check Firebase rules.');
          } else {
            setError(`Enterprise query error: ${err.message}`);
          }
        } else {
          setError('Unknown enterprise authorization error');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  return { projects, loading, error };
}