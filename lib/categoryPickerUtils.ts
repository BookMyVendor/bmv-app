export interface CategoryRecord {
  id: string;
  name: string;
  slug?: string | null;
  aliases?: string[] | null;
  icon?: string | null;
  parent_category_id: string | null;
  category_level: number;
  category_type: 'business' | 'event';
  business_model?: string | null;
  visible?: boolean | null;
  sort_order?: number | null;
}

export interface CategoryIndex {
  byId: Map<string, CategoryRecord>;
  childrenByParentId: Map<string | null, string[]>;
  serviceRootIds: string[];
  eventParentId: string | null;
  eventSubtreeIds: Set<string>;
  eventResolutionPath: 'slug' | 'name' | 'legacy-name' | 'missing';
}

const EVENT_PARENT_SLUG = 'event-planners';
const EVENT_PARENT_NAME = 'event planners';
const LEGACY_EVENT_PARENT_NAME = 'event management companies';

const normalize = (value: string): string => value.trim().toLowerCase();

const tokenizeSlug = (slug?: string | null): string[] => {
  if (!slug) {
    return [];
  }
  return slug
    .toLowerCase()
    .split(/[-_\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

export function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function toggleSelection(list: string[], id: string): string[] {
  if (list.includes(id)) {
    return list.filter((item) => item !== id);
  }
  return [...list, id];
}

export function buildCategoryIndex(categories: CategoryRecord[]): CategoryIndex {
  const byId = new Map<string, CategoryRecord>();
  const childrenByParentId = new Map<string | null, string[]>();

  for (const category of categories) {
    byId.set(category.id, category);
    const currentChildren = childrenByParentId.get(category.parent_category_id) ?? [];
    currentChildren.push(category.id);
    childrenByParentId.set(category.parent_category_id, currentChildren);
  }

  for (const [parentId, ids] of childrenByParentId.entries()) {
    ids.sort((a, b) => {
      const aSort = byId.get(a)?.sort_order ?? 0;
      const bSort = byId.get(b)?.sort_order ?? 0;
      return aSort - bSort;
    });
    childrenByParentId.set(parentId, ids);
  }

  const serviceRootIds = (childrenByParentId.get(null) ?? []).filter((id) => byId.get(id)?.category_type === 'business');

  const eventCategories = categories.filter((category) => category.category_type === 'event');
  const bySlug = eventCategories.find((category) => normalize(category.slug ?? '') === EVENT_PARENT_SLUG);
  const byName = eventCategories.find((category) => normalize(category.name) === EVENT_PARENT_NAME);
  const byLegacyName = eventCategories.find((category) => normalize(category.name) === LEGACY_EVENT_PARENT_NAME);

  const eventParent = bySlug ?? byName ?? byLegacyName ?? null;
  const eventResolutionPath: CategoryIndex['eventResolutionPath'] = bySlug
    ? 'slug'
    : byName
      ? 'name'
      : byLegacyName
        ? 'legacy-name'
        : 'missing';

  const eventSubtreeIds = new Set<string>();
  if (eventParent) {
    const stack: string[] = [eventParent.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      eventSubtreeIds.add(current);
      const childIds = childrenByParentId.get(current) ?? [];
      for (const childId of childIds) {
        stack.push(childId);
      }
    }
  }

  return {
    byId,
    childrenByParentId,
    serviceRootIds,
    eventParentId: eventParent?.id ?? null,
    eventSubtreeIds,
    eventResolutionPath,
  };
}

export function getDescendantIds(index: CategoryIndex, parentId: string): string[] {
  const descendants: string[] = [];
  const stack = [...(index.childrenByParentId.get(parentId) ?? [])];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    descendants.push(currentId);
    const childIds = index.childrenByParentId.get(currentId) ?? [];
    for (const childId of childIds) {
      stack.push(childId);
    }
  }
  return descendants;
}

export function cleanupInvalidSpecializations(
  selectedIds: string[],
  selectedPrimaryCategoryId: string | null,
  index: CategoryIndex
): string[] {
  if (!selectedPrimaryCategoryId) {
    return [];
  }
  const allowed = new Set<string>([selectedPrimaryCategoryId, ...getDescendantIds(index, selectedPrimaryCategoryId)]);
  return selectedIds.filter((id) => allowed.has(id));
}

export function searchScopedCategories(query: string, ids: string[], index: CategoryIndex): string[] {
  const normalized = normalize(query);
  if (!normalized) {
    return ids;
  }
  const terms = normalized.split(/\s+/).filter(Boolean);

  return ids.filter((id) => {
    const category = index.byId.get(id);
    if (!category) {
      return false;
    }
    const haystack = [
      category.name.toLowerCase(),
      category.slug?.toLowerCase() ?? '',
      ...tokenizeSlug(category.slug),
      ...(category.aliases ?? []).map((alias) => alias.toLowerCase()),
    ].join(' ');

    return terms.every((term) => haystack.includes(term));
  });
}
