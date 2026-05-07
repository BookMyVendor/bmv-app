import { axiosFunctionsCall } from '../axiosClient';

export interface Category {
  id: string;
  name: string;
  slug?: string | null;
  parent_category_id?: string | null;
  category_type?: 'business' | 'event';
  business_model?: 'service' | 'rental' | null;
  category_level?: number;
  children?: Category[];
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
  const body: Record<string, unknown> = { ...params };
  return axiosFunctionsCall<Category[]>('categories-list', body, 'categories');
}

/** Spec: category-form-fields-list { category_id } */
export async function getCategoryFormFields(categoryId: string) {
  return axiosFunctionsCall<unknown[]>('category-form-fields-list', { category_id: categoryId }, 'category_form_fields');
}

/** Spec: event-templates-list { limit, offset } */
export async function getEventTemplates(params: { limit?: number; offset?: number } = {}) {
  return axiosFunctionsCall<Category[]>('event-templates-list', params as any, 'event_templates');
}

/** Spec: event-sub-templates-list { template_id, limit, offset } */
export async function getEventSubTemplates(params: { template_id?: string; limit?: number; offset?: number } = {}) {
  return axiosFunctionsCall<Category[]>('event-sub-templates-list', params as any, 'event_sub_templates');
}
/** Spec: event-type-categories-list */
export async function getEventTypeCategories() {
  console.log('Calling getEventTypeCategories...');
  return axiosFunctionsCall<Category[]>('event-type-categories-list', {}, 'event_type_categories');
}

/** Spec: category-tree */
export async function getCategoryTree() {
  return axiosFunctionsCall<Category[]>('category-tree', {}, 'categories');
}
