export interface Lead {
  id: string;
  customer_id: string | null;
  business_id: string | null;
  vendor_id: string | null;
  category_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  event_type?: string; // Computed from category_id
  event_date: string | null;
  event_location: string | null;
  city?: string | null; // Computed from business_id
  lead_status: LeadStatus;
  lead_type: 'inquiry' | 'quote_request' | 'booking_interest';
  lead_source: 'website' | 'mobile' | 'referral' | 'direct';
  budget_range: string | null;
  guest_count: number | null;
  event_duration_hours: number | null;
  requirements: string | null;
  business_name?: string; // Computed from business_id
  created_at: string;
  updated_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'converted' | 'lost';

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
  monthly: number;
  today: number;
  byStatus: Record<LeadStatus, number>;
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
  { value: 'quoted', label: 'Quoted', color: '#5856D6' },
  { value: 'converted', label: 'Converted', color: '#34C759' },
  { value: 'lost', label: 'Lost', color: '#999' },
];

export const PRIORITY_OPTIONS: { value: LeadPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#8E8E93' },
  { value: 'medium', label: 'Medium', color: '#007AFF' },
  { value: 'high', label: 'High', color: '#FF9500' },
  { value: 'urgent', label: 'Urgent', color: '#FF3B30' },
];

export const BUDGET_RANGES = [
  'Under ₹1,000',
  '₹1,000 - ₹2,500',
  '₹2,500 - ₹5,000',
  '₹5,000 - ₹10,000',
  '₹10,000 - ₹25,000',
  '₹25,000 - ₹50,000',
  '₹50,000+',
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
