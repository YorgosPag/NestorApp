
import { useEffect, useState } from "react";
import type { ProjectCustomer } from "@/types/project";
import type { UseProjectCustomersState } from "../types";
// import { getProjectCustomers } from "@/services/projects.service"; // Server action - can't use from client

export function useProjectCustomers(projectId: number): UseProjectCustomersState {
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!projectId) {
        if(mounted) setLoading(false);
        return;
      };
      setLoading(true);
      setError(null);
      try {
        console.log(`🏢 ENTERPRISE: Fetching project customers via API for projectId: ${projectId}`);

        const response = await fetch(`/api/projects/${projectId}/customers`);
        console.log(`📡 ENTERPRISE API Response:`, {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('Content-Type'),
          ok: response.ok
        });

        if (!response.ok) {
          // 🎯 ENTERPRISE ERROR HANDLING: Handle both JSON and HTML error responses
          const contentType = response.headers.get('Content-Type') || '';

          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          } else {
            // HTML error page received (Next.js development error)
            const htmlText = await response.text();
            console.error('🚨 ENTERPRISE ERROR: Received HTML instead of JSON:', htmlText.substring(0, 200));
            throw new Error(`API Error: Server returned HTML error page (Status: ${response.status}). Check server logs for details.`);
          }
        }

        const result = await response.json();
        console.log(`✅ ENTERPRISE: Raw API result:`, result);

        // 🏢 ENTERPRISE DATA VALIDATION & PROCESSING
        if (result.success === false) {
          console.error('🚨 ENTERPRISE: API returned error response:', result);
          throw new Error(result.message || result.error || 'Enterprise API returned error status');
        }

        // 🎯 ENTERPRISE: Handle both old format (direct array) and new format (with customers property)
        const customersData = result.customers || result;
        console.log(`🏢 ENTERPRISE: Processing customers data:`, {
          hasCustomers: !!result.customers,
          customersCount: Array.isArray(customersData) ? customersData.length : 0,
          summary: result.summary,
          dataStructure: typeof customersData
        });

        console.log(`✅ ENTERPRISE: Project customers loaded successfully:`, result.summary || `${customersData.length} customers`);
        if (mounted) setCustomers(Array.isArray(customersData) ? customersData : []);

      } catch (err) {
        console.error("🚨 ENTERPRISE ERROR: Failed to fetch project customers:", {
          error: err,
          errorType: err instanceof Error ? err.constructor.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
          projectId,
          timestamp: new Date().toISOString()
        });

        const errorMessage = err instanceof Error ? err.message : "Κρίσιμο σφάλμα φόρτωσης πελατών.";
        if (mounted) setError(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [projectId]);

  return { customers, loading, error };
}
