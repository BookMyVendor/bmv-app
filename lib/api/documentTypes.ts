import { axiosFunctionsCall } from '../axiosClient';

export interface DocumentType {
  id: string;
  type_code: string;
  display_name: string;
  is_active?: boolean;
  [key: string]: unknown;
}

/** Spec: document-types-list body { type_code?, is_active?, limit?, offset? }. type_code can be single. */
export async function getDocumentTypes(typeCodes?: string[]) {
  const body: Record<string, unknown> = {};
  if (typeCodes?.length) body.type_code = typeCodes.length === 1 ? typeCodes[0] : typeCodes;
  return axiosFunctionsCall<DocumentType[]>('document-types-list', body, 'document_types');
}
