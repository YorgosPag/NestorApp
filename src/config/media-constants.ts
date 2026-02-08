// Centralized media constants (avatars, placeholders, etc.)

export const DEFAULT_AVATAR_PLACEHOLDER_URL = 'https://placehold.co/40x40.png';

export const getAvatarPlaceholderUrl = (initials: string) => {
  const safeInitials = encodeURIComponent(initials);
  return `${DEFAULT_AVATAR_PLACEHOLDER_URL}?text=${safeInitials}`;
};
