export function formatAddOns(addOns) {
  return addOns.map((addon) => ({
    id: addon._id,
    name: addon.name,
    description: addon.description || '',
    price: addon.pricing?.price || 0,
    currency: addon.pricing?.currency || 'INR',
    slug: addon.slug,
    tags: addon.tags || [],
    isActive: addon.isActive,
    createdAt: new Date(addon.createdAt).toLocaleString(),
    updatedAt: new Date(addon.updatedAt).toLocaleString(),
  }));
}
