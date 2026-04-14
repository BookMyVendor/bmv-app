import { axiosFunctionsCall } from '../axiosClient';

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

export interface ListLeadsRequest {
  business_id?: string;
  vendor_id?: string;
  status?: string | string[];
  lead_status?: string | string[]; // Compatibility
  limit?: number;
  offset?: number;
}

/** Spec: leads-list { business_id?, status?, limit?, offset? } -> { success: true, leads: [...] } */
export async function getLeads(params: ListLeadsRequest = {}) {
  const body: Record<string, unknown> = { ...params };
  
  // Normalize lead_status -> status
  if (params.lead_status && !params.status) {
    body.status = params.lead_status;
  }
  
  return axiosFunctionsCall<Lead[]>('leads-list', body, 'leads');
}

/** Helper to fetch a single lead by ID using leads-list. */
export async function getLead(id: string) {
  const res = await axiosFunctionsCall<Lead[]>('leads-list', { lead_id: id }, 'leads');
  if (res.error || !res.data || !Array.isArray(res.data) || res.data.length === 0) {
    return { data: null, error: res.error || new Error('Lead not found') };
  }
  return { data: res.data[0], error: undefined };
}

/** Spec: submit-customer-lead { business_id, customer_name, ... } -> { success: true, leadId: string } */
export async function submitLead(body: Record<string, unknown>) {
  return axiosFunctionsCall<{ leadId: string }>('submit-customer-lead', body);
}

/** Spec: lead-update { lead_id: string; status?; ... } */
export async function updateLead(leadId: string, body: Partial<Lead> & Record<string, unknown>) {
  return axiosFunctionsCall<Lead>('lead-update', { lead_id: leadId, ...body }, 'lead');
}

/** Spec: lead-communications-list { lead_id } */
export async function getLeadCommunications(leadId: string) {
  return axiosFunctionsCall<LeadCommunication[]>('lead-communications-list', { lead_id: leadId }, 'communications');
}

/** Spec: lead-communication-create { lead_id, message, ... } */
export async function createLeadCommunication(params: { lead_id: string; message: string; [key: string]: unknown }) {
  return axiosFunctionsCall<LeadCommunication>('lead-communication-create', params, 'communication');
}

/** Not in spec; call leads-list and compute, or backend may expose leads-stats. */
export async function getLeadStats(vendorId: string, statuses?: string[]) {
  const res = await axiosFunctionsCall<Lead[]>('leads-list', { limit: 1000, ...(statuses?.length ? { status: statuses[0] } : {}) }, 'leads');
  if (res.error || !res.data) return { data: { total: 0, monthly: 0, today: 0, byStatus: {} } as LeadStats, error: res.error };
  const leads = Array.isArray(res.data) ? res.data : [];
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
  return axiosFunctionsCall<void>('lead-delete', { lead_id: id });
}
