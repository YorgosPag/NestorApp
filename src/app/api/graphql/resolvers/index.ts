import { buildingResolvers } from './buildingResolvers';
import { projectResolvers } from './projectResolvers';
import { contactResolvers } from './contactResolvers';
import { storageResolvers } from './storageResolvers';
import { opportunityResolvers } from './opportunityResolvers';
import { communicationResolvers } from './communicationResolvers';
import { analyticsResolvers } from './analyticsResolvers';
import { scalarResolvers } from './scalarResolvers';

export const resolvers = {
  ...scalarResolvers,
  Query: {
    ...buildingResolvers.Query,
    ...projectResolvers.Query,
    ...contactResolvers.Query,
    ...storageResolvers.Query,
    ...opportunityResolvers.Query,
    ...communicationResolvers.Query,
    ...analyticsResolvers.Query,
  },
  Mutation: {
    ...buildingResolvers.Mutation,
    ...projectResolvers.Mutation,
    ...contactResolvers.Mutation,
    ...storageResolvers.Mutation,
    ...opportunityResolvers.Mutation,
    ...communicationResolvers.Mutation,
  },
  Subscription: {
    ...communicationResolvers.Subscription,
    ...analyticsResolvers.Subscription,
  },
  // Type resolvers για related fields
  Building: buildingResolvers.Building,
  Project: projectResolvers.Project,
  Contact: contactResolvers.Contact,
  StorageItem: storageResolvers.StorageItem,
  Opportunity: opportunityResolvers.Opportunity,
  Communication: communicationResolvers.Communication,
};