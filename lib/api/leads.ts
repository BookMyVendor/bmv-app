import { functionsCall } from '../apiClient';

export interface Lead {
  id: string;
  business_id: string;
  vendor_id: string;
  lead_status: string;
  customer_name?: string | null;
  [key: string]: unknown;
}

export interface LeadCommunication {
  id: string;
  lead_id: string;
  [key: string]: unknown;
}

export interface LeadStats {
  total: number;
  monthly: number;
  today: number;
  byStatus: Record<string, number>;
}

/** Spec: leads-list { business_id?, status?, limit?, offset? } -> { success: true, leads: [...] } */
export async function getLeads(params: {
  vendor_id?: string;
  business_id?: string;
  lead_status?: string | string[];
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}) {
  const body: Record<string, unknown> = {};
  if (params?.business_id) body.business_id = params.business_id;
  if (params?.lead_status !== undefined) body.status = Array.isArray(params.lead_status) ? params.lead_status[0] : params.lead_status;
  if (params?.limit !== undefined) body.limit = params.limit;
  if (params?.offset !== undefined) body.offset = params.offset;
  return functionsCall<Lead[]>('leads-list', body, 'leads');
}

/** Not in spec; backend may implement lead-get with { lead_id }. */
export async function getLead(id: string) {
  const res = await functionsCall<Lead>('lead-get', { lead_id: id }, 'lead');
  if (res.data) return res;
  const list = await functionsCall<Lead[]>('leads-list', { limit: 500 }, 'leads');
  if (list.data) {
    const found = list.data.find((l) => l.id === id);
    if (found) return { data: found };
  }
  return res;
}

/** Spec: submit-customer-lead returns { success: true, leadId: string }. */
export async function createLead(body: Record<string, unknown>) {
  const res = await functionsCall<{ leadId: string }>('submit-customer-lead', body as Record<string, unknown>);
  const leadId = res.data && typeof res.data === 'object' && 'leadId' in res.data ? (res.data as any).leadId : undefined;
  if (leadId) return { data: { id: leadId, ...body } as Lead, error: res.error };
  return { data: undefined, error: res.error };
}

/** Spec: lead-update { lead_id, status?, ... } */
export async function updateLead(id: string, body: Record<string, unknown>) {
  return functionsCall<Lead>('lead-update', { lead_id: id, ...body } as Record<string, unknown>, 'lead');
}

/** Spec: lead-communications-list { lead_id } */
export async function getLeadCommunications(leadId: string) {
  return functionsCall<LeadCommunication[]>('lead-communications-list', { lead_id: leadId }, 'communications');
}

/** Spec: lead-communication-create { lead_id, message, ... } */
export async function createLeadCommunication(leadId: string, body: Record<string, unknown>) {
  return functionsCall<LeadCommunication>('lead-communication-create', { lead_id: leadId, ...body } as Record<string, unknown>, 'communication');
}

/** Not in spec; call leads-list and compute, or backend may expose leads-stats. */
export async function getLeadStats(vendorId: string, statuses?: string[]) {
  const res = await functionsCall<Lead[]>('leads-list', { limit: 1000, ...(statuses?.length ? { status: statuses[0] } : {}) }, 'leads');
  if (res.error || !res.data) return { data: { total: 0, monthly: 0, today: 0, byStatus: {} } as LeadStats, error: res.error };
  const leads = res.data;
  const now = new Date();
  const byStatus: Record<string, number> = {};
  let monthly = 0;
  let today = 0;
  leads.forEach((l) => {
    byStatus[l.lead_status] = (byStatus[l.lead_status] || 0) + 1;
    const created = l.created_at ? new Date((l as any).created_at) : null;
    if (created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) monthly++;
    if (created && created.toDateString() === now.toDateString()) today++;
  });
  return {
    data: { total: leads.length, monthly, today, byStatus },
    error: undefined,
  };
}

/** Not in spec; backend may implement lead-delete with { lead_id }. */
export async function deleteLead(id: string) {
  return functionsCall<void>('lead-delete', { lead_id: id });
}
