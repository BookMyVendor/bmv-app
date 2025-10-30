export interface Lead {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  event_type: string;
  event_date: string | null;
  city: string | null;
  message: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  budget_range: string | null;
  guest_count: number | null;
  venue: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  businesses: {
    business_name: string;
    id: string;
  };
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  performed_by: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'status_change'
  | 'follow_up'
  | 'proposal_sent'
  | 'contract_signed'
  | 'payment_received';

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFormData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  event_type: string;
  event_date: string;
  city: string;
  message: string;
  budget_range: string;
  guest_count: string;
  venue: string;
}

export interface LeadFilters {
  statuses: string[];
  eventTypes: string[];
  cities: string[];
  priorities: string[];
  dateRange: DateRange | null;
  searchQuery: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  won: number;
  lost: number;
  conversionRate: number;
}

export const EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Corporate Event',
  'Anniversary',
  'Engagement',
  'Baby Shower',
  'Graduation',
  'Conference',
  'Product Launch',
  'Holiday Party',
  'Charity Event',
  'Other',
] as const;

export const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: '#FF9500' },
  { value: 'contacted', label: 'Contacted', color: '#007AFF' },
  { value: 'qualified', label: 'Qualified', color: '#5856D6' },
  { value: 'proposal', label: 'Proposal Sent', color: '#AF52DE' },
  { value: 'negotiation', label: 'Negotiation', color: '#FF2D55' },
  { value: 'won', label: 'Won', color: '#34C759' },
  { value: 'lost', label: 'Lost', color: '#999' },
];

export const PRIORITY_OPTIONS: { value: LeadPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#8E8E93' },
  { value: 'medium', label: 'Medium', color: '#007AFF' },
  { value: 'high', label: 'High', color: '#FF9500' },
  { value: 'urgent', label: 'Urgent', color: '#FF3B30' },
];

export const BUDGET_RANGES = [
  'Under $1,000',
  '$1,000 - $2,500',
  '$2,500 - $5,000',
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000+',
  'Not specified',
] as const;

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note: 'Note Added',
  call: 'Phone Call',
  email: 'Email Sent',
  meeting: 'Meeting',
  status_change: 'Status Changed',
  follow_up: 'Follow-up Scheduled',
  proposal_sent: 'Proposal Sent',
  contract_signed: 'Contract Signed',
  payment_received: 'Payment Received',
};
