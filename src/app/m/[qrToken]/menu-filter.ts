export function filterMenuCategories<T extends { id: string }>(categories: readonly T[], activeCategoryId: string | null): readonly T[] {
  return activeCategoryId === null ? categories : categories.filter((category) => category.id === activeCategoryId);
}
