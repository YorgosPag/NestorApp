
"use client";

import { useObligationsList } from './hooks/useObligationsList';
import { PageLayout } from "@/components/app/page-layout";
import { ObligationsHeader } from './components/ObligationsHeader';
import { ObligationsStats } from './components/ObligationsStats';
import { ObligationListItem } from './components/ObligationListItem';
import { FileText } from 'lucide-react';

export default function ObligationsPage() {
  const {
    loading,
    error,
    stats,
    filteredObligations,
    filters,
    handleFilterChange,
    handleSearch,
    deleteObligation,
    duplicateObligation,
  } = useObligationsList();

  return (
    <PageLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <ObligationsHeader
          filters={filters}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
        />
        
        {stats && <ObligationsStats stats={stats} />}

        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Φόρτωση...</p>
             </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
                <p>{error}</p>
            </div>
          ) : filteredObligations.map((obligation) => (
            <ObligationListItem
              key={obligation.id}
              obligation={obligation}
              onDelete={deleteObligation}
              onDuplicate={duplicateObligation}
            />
          ))}
          
          {filteredObligations.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Δεν βρέθηκαν συγγραφές υποχρεώσεων</h3>
              <p className="text-sm">Δοκιμάστε να αλλάξετε τα κριτήρια αναζήτησης.</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

    