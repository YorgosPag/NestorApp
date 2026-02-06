import type { IProjectsService, IProjectsRepository, ProjectStructure } from '../contracts';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import type { Building } from '@/types/building/contracts';
import type { Property } from '@/types/property-viewer';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// ✅ ENTERPRISE FIX: Use Firebase Admin methods from db instance, not direct imports
// Firebase Admin SDK Firestore functions are methods on the db instance, not standalone functions

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

    const structureBuildings: Array<Building & { units: Array<Property & { customerName?: string | null }> }> = [];
    const allUnitOwnerIds = new Set<string>();

    for (const building of buildingsData) {
        // 🏢 ENTERPRISE: Use configurable building ID pattern
        const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
        const units = await this.firestoreRepo.getUnitsByBuildingId(`${buildingIdPattern}${building.id}`);

        units.forEach(u => {
            if (u.soldTo) allUnitOwnerIds.add(u.soldTo);
        });

        // ✅ ENTERPRISE: Proper typing with customerName property
        const unitsWithCustomerName: Array<Property & { customerName?: string | null }> = units.map(unit => ({
            ...unit,
            customerName: null as string | null
        }));

        // ✅ ENTERPRISE: Proper type intersection - remove units property conflict
        const { units: _, ...buildingWithoutUnits } = building;
        structureBuildings.push({
            ...buildingWithoutUnits,
            units: unitsWithCustomerName
        } as Building & { units: Array<Property & { customerName?: string | null }> });
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
                unit.customerName = contactsMap.get(unit.soldTo) || null;
            }
        }
    }

    return { project, buildings: structureBuildings } as ProjectStructure;
  }

  async getProjectCustomers(projectId: string): Promise<ProjectCustomer[]> {
    const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);
    if (buildings.length === 0) return [];

    // 🏢 ENTERPRISE: Use configurable building ID pattern
    const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
    const buildingIds = buildings.map(b => `${buildingIdPattern}${b.id}`);

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
            // 🏢 ENTERPRISE: Use configurable building ID pattern
            const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
            const units = await this.firestoreRepo.getUnitsByBuildingId(`${buildingIdPattern}${building.id}`);

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
        const database = getAdminFirestore();
        if (!database) return;
        const projectDoc = await database.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
        if (projectDoc.exists) {
            // Document exists
        }

        const buildingsQuery = database.collection(COLLECTIONS.BUILDINGS).where('projectId', '==', projectId);
        const buildings = await buildingsQuery.get();
        buildings.docs.forEach(doc => {
            // Process building
        });

        for (const building of buildings.docs) {
            // 🏢 ENTERPRISE: Use configurable building ID pattern
            const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
            const unitsQuery = database.collection(COLLECTIONS.UNITS).where('buildingId', '==', `${buildingIdPattern}${building.id}`);
            const units = await unitsQuery.get();
            units.docs.forEach(doc => {
                const data = doc.data();
                // Process unit
            });
        }

        try {
            const directUnitsQuery = database.collection(COLLECTIONS.UNITS).where('projectId', '==', projectId);
            const directUnits = await directUnitsQuery.get();
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
