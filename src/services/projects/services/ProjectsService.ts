import type { IProjectsService, IProjectsRepository, ProjectStructure } from '../contracts';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import { db } from '@/lib/firebase-admin';

const getFirebaseAdmin = async () => {
  const admin = await import('firebase-admin/firestore');
  return admin;
};

export class ProjectsService implements IProjectsService {
  private firestoreRepo: IProjectsRepository;
  private sampleRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>;

  constructor(
    firestoreRepo: IProjectsRepository,
    sampleRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>
  ) {
    this.firestoreRepo = firestoreRepo;
    this.sampleRepo = sampleRepo;
  }

  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    const result = await this.firestoreRepo.getProjectsByCompanyId(companyId);
    return result;
  }

  async getProjectStructure(projectId: string): Promise<ProjectStructure | null> {
    const project = await this.firestoreRepo.getProjectById(projectId);
    if (!project) {
        return null;
    }

    const buildingsData = await this.firestoreRepo.getBuildingsByProjectId(projectId);

    const structureBuildings = [];
    const allUnitOwnerIds = new Set<string>();

    for (const building of buildingsData) {
        const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);

        units.forEach(u => {
            if (u.soldTo) allUnitOwnerIds.add(u.soldTo);
        });

        structureBuildings.push({ ...building, units });
    }

    const contactsMap = new Map<string, string>();
    if (allUnitOwnerIds.size > 0) {
        const contacts = await this.firestoreRepo.getContactsByIds(Array.from(allUnitOwnerIds));
        contacts.forEach(contact => {
            contactsMap.set(contact.id!, getContactDisplayName(contact));
        });
    }

    for (const building of structureBuildings) {
        for (const unit of building.units) {
            if (unit.soldTo) {
                unit.customerName = contactsMap.get(unit.soldTo);
            }
        }
    }

    return { project, buildings: structureBuildings };
  }

  async getProjectCustomers(projectId: string): Promise<ProjectCustomer[]> {
    const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);
    if (buildings.length === 0) return [];

    const buildingIds = buildings.map(b => `building-${b.id}`);

    const allUnits = (await Promise.all(
        buildingIds.map(id => this.firestoreRepo.getUnitsByBuildingId(id))
    )).flat();

    const soldUnits = allUnits.filter(u => u.status === 'sold' && u.soldTo);

    const customerUnitCount: { [contactId: string]: number } = {};
    soldUnits.forEach(unit => {
        customerUnitCount[unit.soldTo!] = (customerUnitCount[unit.soldTo!] || 0) + 1;
    });

    const customerIds = Object.keys(customerUnitCount);
    if (customerIds.length === 0) return [];

    const contacts = await this.firestoreRepo.getContactsByIds(customerIds);

    return contacts.map(contact => ({
      contactId: contact.id!,
      name: getContactDisplayName(contact),
      phone: getPrimaryPhone(contact) || null,
      unitsCount: customerUnitCount[contact.id!] || 0,
    }));
  }

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    try {
        const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);

        if (buildings.length === 0) {
            return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
        }

        let totalUnits = 0;
        let soldUnits = 0;
        let totalSoldArea = 0;

        for (const building of buildings) {
            const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);

            units.forEach(unit => {
                totalUnits++;
                const isSold = unit.status === 'sold' || (unit.soldTo && unit.soldTo.trim() !== '');
                if (isSold) {
                    soldUnits++;
                    totalSoldArea += parseFloat(String(unit.area)) || 0;
                }
            });
        }

        const stats = { totalUnits, soldUnits, totalSoldArea };
        return stats;

    } catch (error) {
        return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
    }
  }

  async debugProjectData(projectId: string): Promise<void> {
    if (!db) {
        return;
    }
    try {
        const admin = await getFirebaseAdmin();

        const projectDoc = await admin.getDoc(admin.doc(db, 'projects', projectId));
        if (projectDoc.exists()) {
            // Document exists
        }

        const buildingsQuery = admin.query(admin.collection(db, 'buildings'), admin.where('projectId', '==', projectId));
        const buildings = await admin.getDocs(buildingsQuery);
        buildings.docs.forEach(doc => {
            // Process building
        });

        for (const building of buildings.docs) {
            const unitsQuery = admin.query(admin.collection(db, 'units'), admin.where('buildingId', '==', `building-${building.id}`));
            const units = await admin.getDocs(unitsQuery);
            units.docs.forEach(doc => {
                const data = doc.data();
                // Process unit
            });
        }

        try {
            const directUnitsQuery = admin.query(admin.collection(db, 'units'), admin.where('projectId', '==', projectId));
            const directUnits = await admin.getDocs(directUnitsQuery);
            if (!directUnits.empty) {
                // Has direct units
            }
        } catch (e) {
            // Query failed
        }
    } catch (error) {
        // Error in debug
    }
  }
}