import { layoutUtilities } from '../../../styles/design-tokens';

const { grid, randomHeight } = layoutUtilities;

export const getSkeletonTableGridStyles = (columns: number) => ({
  ...grid.templateColumns(columns),
  alignItems: 'center' as const,
  gap: '1rem'
});

export const getSkeletonBarHeight = (min: number = 20, max: number = 100) => ({
  height: randomHeight(min, max),
  minHeight: '20px',
  transition: 'all 0.2s ease-in-out'
});
