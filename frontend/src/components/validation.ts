export const RESTRICTED_SLUGS = ['instagram', 'google', 'facebook', 'admin', 'login', 'support'];

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export function isValidSlugFormat(slug: string): boolean {
  if (!slug) return true; // empty is allowed (random)
  const regex = /^[a-z0-9-]+$/;
  return regex.test(slug);
}

export function evaluateSlugState(slug: string): 'available' | 'taken' | 'restricted' | 'invalid' | 'empty' {
  if (!slug) return 'empty';
  
  if (!isValidSlugFormat(slug)) return 'invalid';

  if (RESTRICTED_SLUGS.includes(slug.toLowerCase())) {
     return 'restricted';
  }

  if (slug.toLowerCase() === 'test') { // Hardcoded per user agreement
    return 'taken';
  }

  return 'available';
}
