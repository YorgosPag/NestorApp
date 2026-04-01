import type { IProjectsService, IProjectsRepository, ProjectStructure, ProjectBuilding, ProjectProperty } from '../contracts';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';

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

    const structureBuildings: ProjectBuilding[] = [];
    const allUnitOwnerIds = new Set<string>();

    for (const building of buildingsData) {
        // 🏢 ENTERPRISE: Use configurable building ID pattern
        const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
        const properties: ProjectProperty[] = (await this.firestoreRepo.getPropertiesByBuildingId(`${buildingIdPattern}${building.id}`))
          .map(prop => ({ ...prop }));

        properties.forEach(p => {
            if (p.soldTo) allUnitOwnerIds.add(p.soldTo);
        });

        // ✅ ENTERPRISE: Proper typing with customerName property
        const propertiesWithCustomerName: ProjectProperty[] = properties.map(prop => ({
            ...prop,
            customerName: null as string | null
        }));

        // ✅ ENTERPRISE: Proper type intersection - remove properties conflict
        const { properties: _, ...buildingWithoutProperties } = building;
        structureBuildings.push({
            ...buildingWithoutProperties,
            properties: propertiesWithCustomerName,
            storages: [],
            parkingSpots: []
        } as ProjectBuilding);
    }

    const contactsMap = new Map<string, string>();
    if (allUnitOwnerIds.size > 0) {
        const contacts = await this.firestoreRepo.getContactsByIds(Array.from(allUnitOwnerIds));
        contacts.forEach(contact => {
            if (contact.id) {
                contactsMap.set(contact.id, getContactDisplayName(contact));
            }
        });
    }

    for (const building of structureBuildings) {
        for (const prop of building.properties) {
            if (prop.soldTo) {
                prop.customerName = contactsMap.get(prop.soldTo) || null;
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

    const allProperties = (await Promise.all(
        buildingIds.map(id => this.firestoreRepo.getPropertiesByBuildingId(id))
    )).flat();

    const soldProperties = allProperties.filter(p => p.status === 'sold' && p.soldTo);

    const customerPropertyCount: { [contactId: string]: number } = {};
    soldProperties.forEach(prop => {
        customerPropertyCount[prop.soldTo!] = (customerPropertyCount[prop.soldTo!] || 0) + 1;
    });

    const customerIds = Object.keys(customerPropertyCount);
    if (customerIds.length === 0) return [];

    const contacts = await this.firestoreRepo.getContactsByIds(customerIds);

    return contacts.map(contact => ({
      contactId: contact.id!,
      name: getContactDisplayName(contact),
      phone: getPrimaryPhone(contact) || null,
      propertiesCount: customerPropertyCount[contact.id!] || 0,
    }));
  }

  async getProjectStats(projectId: string): Promise<ProjectStats> {
    try {
        const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);

        if (buildings.length === 0) {
            return { totalProperties: 0, soldProperties: 0, totalSoldArea: 0 };
        }

        let totalProperties = 0;
        let soldProperties = 0;
        let totalSoldArea = 0;

        for (const building of buildings) {
            // 🏢 ENTERPRISE: Use configurable building ID pattern
            const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
            const properties = await this.firestoreRepo.getPropertiesByBuildingId(`${buildingIdPattern}${building.id}`);

            properties.forEach(prop => {
                totalProperties++;
                const isSold = prop.status === 'sold' || (prop.soldTo && prop.soldTo.trim() !== '');
                if (isSold) {
                    soldProperties++;
                    totalSoldArea += parseFloat(String(prop.area)) || 0;
                }
            });
        }

        const stats = { totalProperties, soldProperties, totalSoldArea };
        return stats;

    } catch (error) {
        return { totalProperties: 0, soldProperties: 0, totalSoldArea: 0 };
    }
  }

  async debugProjectData(projectId: string): Promise<void> {
    try {
        const database = getAdminFirestore();
        if (!database) return;
        const projectDoc = await database.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
        if (projectDoc.exists) {
            // Document exists
        }

        const buildingsQuery = database.collection(COLLECTIONS.BUILDINGS).where(FIELDS.PROJECT_ID, '==', projectId);
        const buildings = await buildingsQuery.get();
        buildings.docs.forEach(doc => {
            // Process building
        });

        for (const building of buildings.docs) {
            // 🏢 ENTERPRISE: Use configurable building ID pattern
            const buildingIdPattern = process.env.NEXT_PUBLIC_BUILDING_ID_PATTERN || 'building-';
            const propertiesQuery = database.collection(COLLECTIONS.PROPERTIES).where(FIELDS.BUILDING_ID, '==', `${buildingIdPattern}${building.id}`);
            const propertiesSnap = await propertiesQuery.get();
            propertiesSnap.docs.forEach(doc => {
                const data = doc.data();
                // Process property
            });
        }

        try {
            const directPropertiesQuery = database.collection(COLLECTIONS.PROPERTIES).where(FIELDS.PROJECT_ID, '==', projectId);
            const directProperties = await directPropertiesQuery.get();
            if (!directProperties.empty) {
                // Has direct properties
            }
        } catch (e) {
            // Query failed
        }
    } catch (error) {
        // Error in debug
    }
  }
}
