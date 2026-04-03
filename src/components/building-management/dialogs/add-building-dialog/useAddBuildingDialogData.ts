import { useEffect, useMemo, useState } from 'react';
import { getProjectsList, type ProjectListItem } from '../../building-services';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import type { CompanyContact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AddBuildingDialogData');

interface UseAddBuildingDialogDataProps {
  open: boolean;
}

export function useAddBuildingDialogData({ open }: UseAddBuildingDialogDataProps) {
  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setProjectsLoading(true);
    setCompaniesLoading(true);
    setSelectedCompanyFilter('');

    getProjectsList()
      .then(setAllProjects)
      .catch((error: unknown) => logger.error('Failed to load projects', { error }))
      .finally(() => setProjectsLoading(false));

    getAllCompaniesForSelect()
      .then(setCompanies)
      .catch((error: unknown) => logger.error('Failed to load companies', { error }))
      .finally(() => setCompaniesLoading(false));
  }, [open]);

  const filteredProjects = useMemo(() => {
    if (!selectedCompanyFilter) {
      return allProjects;
    }

    return allProjects.filter((project) => project.companyId === selectedCompanyFilter);
  }, [allProjects, selectedCompanyFilter]);

  return {
    allProjects,
    filteredProjects,
    projectsLoading,
    companies,
    companiesLoading,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
  };
}
