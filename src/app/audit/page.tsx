'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για bundle optimization
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function ProjectsPage() {
  const Projects = LazyRoutes.Projects;
  return <Projects />;
}
