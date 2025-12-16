
import type { IProjectsService, IProjectsRepository, ProjectStructure } from '../contracts';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import { db } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';

const getFirebaseAdmin = async () => {
  const admin = await import('firebase-admin/firestore');
  return admin;
};

export class ProjectsService implements IProjectsService {
  private firestoreRepo: IProjectsRepository;
  private mockRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>;

  constructor(
    firestoreRepo: IProjectsRepository,
    mockRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>
  ) {
    this.firestoreRepo = firestoreRepo;
    this.mockRepo = mockRepo;
  }
  
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    // Debug logging removed
    // Debug logging removed
    const result = await this.firestoreRepo.getProjectsByCompanyId(companyId);
    // Debug logging removed
    return result;
  }

  async getProjectStructure(projectId: string): Promise<ProjectStructure | null> {
    // Debug logging removed
    
    const project = await this.firestoreRepo.getProjectById(projectId);
    if (!project) {
        // Warning logging removed
        return null;
    }
    // Debug logging removed

    const buildingsData = await this.firestoreRepo.getBuildingsByProjectId(projectId);
    // Debug logging removed

    const structureBuildings = [];
    const allUnitOwnerIds = new Set<string>();

    for (const building of buildingsData) {
        const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);
        // Debug logging removed
        
        units.forEach(u => {
            if (u.soldTo) allUnitOwnerIds.add(u.soldTo);
        });

        structureBuildings.push({ ...building, units });
    }
    
    // Debug logging removed
    
    const contactsMap = new Map<string, string>();
    if (allUnitOwnerIds.size > 0) {
        // Debug logging removed
        const contacts = await this.firestoreRepo.getContactsByIds(Array.from(allUnitOwnerIds));
        // Debug logging removed
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
        // Debug logging removed
        const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);
        // Debug logging removed
        
        if (buildings.length === 0) {
            // Debug logging removed
            return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
        }
        
        let totalUnits = 0;
        let soldUnits = 0;
        let totalSoldArea = 0;

        for (const building of buildings) {
            const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);
            // Debug logging removed

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
        // Debug logging removed
        return stats;

    } catch (error) {
        // Error logging removed
        return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
    }
  }

  async debugProjectData(projectId: string): Promise<void> {
    if (!db) {
        // Error logging removed
        return;
    }
    try {
        // Debug logging removed
        
        const admin = await getFirebaseAdmin();
        
        const projectDoc = await admin.getDoc(admin.doc(db, COLLECTIONS.PROJECTS, projectId));
        // Debug logging removed
        if (projectDoc.exists()) {
            // Debug logging removed
        }
        
        const buildingsQuery = admin.query(admin.collection(db, COLLECTIONS.BUILDINGS), admin.where('projectId', '==', projectId));
        const buildings = await admin.getDocs(buildingsQuery);
        // Debug logging removed
        buildings.docs.forEach(doc => {
            // Debug logging removed
        });
        
        for (const building of buildings.docs) {
            const unitsQuery = admin.query(admin.collection(db, COLLECTIONS.UNITS), admin.where('buildingId', '==', `building-${building.id}`));
            const units = await admin.getDocs(unitsQuery);
            // Debug logging removed
            units.docs.forEach(doc => {
                const data = doc.data();
                // Debug logging removed
            });
        }
        
        try {
            const directUnitsQuery = admin.query(admin.collection(db, COLLECTIONS.UNITS), admin.where('projectId', '==', projectId));
            const directUnits = await admin.getDocs(directUnitsQuery);
            if (!directUnits.empty) {
                // Debug logging removed
            }
        } catch (e) {
            // Debug logging removed
        }
    } catch (error) {
        // Error logging removed
    }
  }
}
