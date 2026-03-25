import { describe, expect, it } from 'vitest';
import {
  buildCategoryIndex,
  cleanupInvalidSpecializations,
  dedupeIds,
  searchScopedCategories,
  type CategoryRecord,
} from './categoryPickerUtils';

const categories: CategoryRecord[] = [
  {
    id: 's-root',
    name: 'Photography',
    slug: 'photography',
    parent_category_id: null,
    category_level: 1,
    category_type: 'business',
    sort_order: 1,
  },
  {
    id: 's-child',
    name: 'Wedding Photography',
    slug: 'wedding-photography',
    parent_category_id: 's-root',
    category_level: 2,
    category_type: 'business',
    sort_order: 2,
  },
  {
    id: 'e-root',
    name: 'Event Planners',
    slug: 'event-planners',
    parent_category_id: null,
    category_level: 1,
    category_type: 'event',
    sort_order: 1,
  },
  {
    id: 'e-child',
    name: 'Corporate Events',
    slug: 'corporate-events',
    parent_category_id: 'e-root',
    category_level: 2,
    category_type: 'event',
    sort_order: 2,
  },
];

describe('event parent resolution', () => {
  it('resolves by slug with highest priority', () => {
    const index = buildCategoryIndex(categories);
    expect(index.eventParentId).toBe('e-root');
    expect(index.eventResolutionPath).toBe('slug');
  });
});

describe('search scoping', () => {
  it('only searches inside scoped ids', () => {
    const index = buildCategoryIndex(categories);
    const result = searchScopedCategories('event', ['s-root', 's-child'], index);
    expect(result).toEqual([]);
  });
});

describe('dedupe + cleanup on primary switch', () => {
  it('dedupes and drops invalid specialization ids', () => {
    const index = buildCategoryIndex(categories);
    const deduped = dedupeIds(['s-child', 's-child', 'e-child']);
    const cleaned = cleanupInvalidSpecializations(deduped, 's-root', index);
    expect(cleaned).toEqual(['s-child']);
  });
});
