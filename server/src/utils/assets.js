// Public URLs for uploaded images. The ?v= part changes whenever the image is replaced, so browsers can cache forever.
export const assetVersion = (key) => key.split('/').pop().slice(0, 8);
export const avatarUrl = (userId, key) => (key ? `/api/users/${userId}/avatar?v=${assetVersion(key)}` : null);
export const logoUrl = (companyId, key) => (key ? `/api/companies/${companyId}/logo?v=${assetVersion(key)}` : null);
