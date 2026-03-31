import { functionsCall } from '../apiClient';

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  slug?: string | null;
  parent_category_id?: string | null;
  [key: string]: unknown;
}

/** Spec: categories-list body { slug?, parent_id?, limit?, offset? }. */
export async function getCategories(params?: {
  slug?: string;
  parent_id?: string;
  category_type?: string;
  category_level?: string;
  visible?: boolean;
  business_model?: string;
  limit?: number;
  offset?: number;
}) {
  const body: Record<string, unknown> = {};
  if (params?.slug) body.slug = params.slug;
  if (params?.parent_id) body.parent_id = params.parent_id;
  if (params?.limit !== undefined) body.limit = params.limit;
  if (params?.offset !== undefined) body.offset = params.offset;
  return functionsCall<Category[]>('categories-list', body, 'categories');
}

/** Spec: category-form-fields-list { category_id } */
export async function getCategoryFormFields(categoryId: string) {
  return functionsCall<unknown[]>('category-form-fields-list', { category_id: categoryId }, 'category_form_fields');
}

/** Spec: event-templates-list { limit, offset } */
export async function getEventTemplates(params: { limit?: number; offset?: number } = {}) {
  return functionsCall<unknown[]>('event-templates-list', params as any, 'event_templates');
}

/** Spec: event-sub-templates-list { template_id, limit, offset } */
export async function getEventSubTemplates(params: { template_id?: string; limit?: number; offset?: number } = {}) {
  return functionsCall<unknown[]>('event-sub-templates-list', params as any, 'event_sub_templates');
}
