// lib/dataService.ts
import { supabase } from './supabaseClient'; // Ensure this path is correct

// --- Interfaces ---

// Access environment variable directly here for manual URL construction fallback
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;


export interface TicketType {
  id: number;
  name: string;
  description?: string | null;
}

export interface Specialization {
  id: number;
  name: string;
  description?: string | null;
}

export interface UserProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  updated_at?: string;
  specialization_id?: number | null;
  specializations?: Specialization | null;
}

export interface Ticket {
  id: number;
  subject: string;
  description: string;
  created_at: string;
  status_id: number;
  ticket_statuses: { name: string; color_code?: string | null } | null;
  priority_id: number;
  ticket_priorities: { name: string } | null;
  requester_id: string;
  assignee_id?: string | null;
  profiles: UserProfile | null;
  assignee_profile?: UserProfile | null;
  updated_at?: string;
  ticket_type_id?: number | null;
  ticket_types?: TicketType | null;
}

export interface NewTicketData {
  subject: string;
  description: string;
  priority_id: number;
  requester_id: string;
  status_id: number;
  ticket_type_id: number;
}

export interface PriorityOption {
  id: number;
  name: string;
}

export interface StatusOption {
  id: number;
  name: string;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: string;
  comment_text: string;
  is_internal_note: boolean;
  created_at: string;
  profiles: UserProfile | null;
}

export interface NewCommentData {
    ticket_id: number;
    user_id: string;
    comment_text: string;
    is_internal_note?: boolean;
}

export interface AgentOption {
    id: string;
    full_name?: string | null;
    specialization_id?: number | null;
    specializations?: Specialization | null;
}

export interface Notification {
    id: number;
    user_id: string;
    ticket_id: number | null;
    message: string;
    is_read: boolean;
    type: string | null;
    created_at: string;
    tickets?: { subject: string } | null;
}

export interface KBCategory {
    id: number;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at: string;
    article_count?: number; // Optional: if you join count of articles
}

export interface KBArticle {
    id: number;
    category_id?: number | null;
    author_id?: string | null;
    title: string;
    content: string; // Markdown or HTML
    slug: string;
    tags?: string[] | null;
    is_published: boolean;
    view_count: number;
    created_at: string;
    updated_at: string;
    kb_categories?: { name: string } | null; // Joined category name
    profiles?: { full_name: string | null } | null; // Joined author name
}

export interface NewKBArticleData {
    category_id?: number | null;
    author_id: string; // Logged-in user creating the article
    title: string;
    content: string;
    slug: string;
    tags?: string[] | null;
    is_published?: boolean;
}

export interface UpdateKBArticleData {
    category_id?: number | null;
    title?: string;
    content?: string;
    slug?: string;
    tags?: string[] | null;
    is_published?: boolean;
}

const TICKET_SELECT_QUERY = `
  id, subject, description, created_at, updated_at, status_id, priority_id, requester_id, assignee_id, ticket_type_id,
  ticket_statuses:ticket_statuses!tickets_status_id_fkey ( name, color_code ),
  ticket_priorities:ticket_priorities!tickets_priority_id_fkey ( name ),
  ticket_types:ticket_types!tickets_ticket_type_id_fkey ( id, name, description ),
  profiles:profiles!tickets_requester_id_fkey ( id, full_name, avatar_url, role, specialization_id, specializations:specializations!profiles_specialization_id_fkey(id, name, description) ),
  assignee_profile:profiles!tickets_assignee_id_fkey ( id, full_name, avatar_url, role, specialization_id, specializations:specializations!profiles_specialization_id_fkey(id, name, description) )
`;


export async function fetchTicketsForUser(limit: number, offset: number): Promise<{ tickets: Ticket[], count: number | null }> {
  const { data, error, count } = await supabase
    .from('tickets')
    .select(`${TICKET_SELECT_QUERY}`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1); // Supabase range is inclusive

  if (error) { console.error('Error fetching tickets:', error.message); throw error; }
  return { tickets: (data as unknown as Ticket[]) || [], count };
}

export async function createTicket(ticketData: NewTicketData): Promise<Ticket | null> {
  const { data, error } = await supabase.from('tickets').insert([{ ...ticketData }]).select(TICKET_SELECT_QUERY).single();
  if (error) { console.error('Error creating ticket:', error.message); throw error; }
  return data as unknown as Ticket | null;
}

export async function fetchTicketPriorities(): Promise<PriorityOption[]> {
  const { data, error } = await supabase.from('ticket_priorities').select('id, name, sort_order').order('sort_order', { ascending: true });
  if (error) { console.error('Error fetching ticket priorities:', error.message); throw error; }
  return data || [];
}

export async function fetchTicketStatuses(): Promise<StatusOption[]> {
    const { data, error } = await supabase.from('ticket_statuses').select('id, name');
    if (error) { console.error('Error fetching ticket statuses:', error.message); throw error; }
    return data || [];
}

export async function fetchTicketTypes(): Promise<TicketType[]> {
    const { data, error } = await supabase.from('ticket_types').select('id, name, description').order('name', { ascending: true });
    if (error) { console.error('Error fetching ticket types:', error.message); throw error; }
    return data || [];
}

export async function fetchTicketCountsByStatus(statusName?: string): Promise<number | null> {
    let query = supabase.from('tickets').select('count', { count: 'exact', head: true });

    if (statusName) {
        // First, find the status ID for the given name
        const { data: statusData, error: statusError } = await supabase
            .from('ticket_statuses')
            .select('id')
            .eq('name', statusName)
            .maybeSingle(); // Use maybeSingle to handle cases with no matching row

        if (statusError) {
            console.error(`Error finding status ID for name "${statusName}":`, statusError.message);
            throw statusError;
        }

        if (statusData) {
            query = query.eq('status_id', statusData.id);
        } else {
            console.warn(`Status "${statusName}" not found.`);
            return 0; // Status not found, so count is 0
        }
    }

    const { count, error } = await query;

    if (error) {
        console.error(`Error fetching ticket count for status "${statusName || 'all'}":`, error.message);
        throw error;
    }

    return count;
}

export async function fetchTicketCountsOverTime(
    interval: 'day' | 'week' | 'month',
    startDate: string,
    endDate: string
): Promise<{ time_period: string; count: number }[]> {
    // Supabase doesn't have a direct way to group by arbitrary time intervals like 'week' or 'month' easily in RPCs
    // without specific database functions. A common approach is to fetch data within the range
    // and process/group it on the client side, or create a custom SQL function/view in Supabase.
    // For simplicity and broader compatibility, we'll fetch tickets within the range and process on the client.
    // A more scalable solution for large datasets would involve a backend function or materialized view.

    const { data, error } = await supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(`Error fetching tickets for time series data (${interval}):`, error.message);
        throw error;
    }

    if (!data) return [];

    // Client-side grouping
    const counts: { [key: string]: number } = {};
    const formatOptions: Intl.DateTimeFormatOptions = {};

    if (interval === 'day') {
        formatOptions.year = 'numeric';
        formatOptions.month = '2-digit';
        formatOptions.day = '2-digit';
    } else if (interval === 'week') {
         // Note: Week grouping is tricky client-side without a library or server-side logic
         // This is a simplified approach, might need refinement based on desired week definition (e.g., ISO 8601)
         // For now, we'll group by the start date of the week.
         formatOptions.year = 'numeric';
         formatOptions.month = '2-digit';
         formatOptions.day = '2-digit';
         // Need a way to get the start of the week for each date
    } else if (interval === 'month') {
        formatOptions.year = 'numeric';
        formatOptions.month = 'long';
    }

    data.forEach(ticket => {
        const date = new Date(ticket.created_at);
        let periodKey: string;

        if (interval === 'week') {
             // Simple week grouping: use the date of the first day of the week (e.g., Sunday)
             const firstDayOfWeek = new Date(date);
             firstDayOfWeek.setDate(date.getDate() - date.getDay()); // Adjust to Sunday
             periodKey = firstDayOfWeek.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
        } else {
             periodKey = date.toLocaleDateString(undefined, formatOptions);
        }


        counts[periodKey] = (counts[periodKey] || 0) + 1;
    });

    // Convert counts object to array of { time_period, count }
    const result = Object.keys(counts).map(key => ({
        time_period: key,
        count: counts[key]
    }));

    // Sort by time period (this might need more robust date parsing for correct sorting)
    // For 'day' and 'month' with numeric year/month, string sort might work. 'week' is trickier.
    // A better approach would be to store the actual date object or a sortable string/number.
     result.sort((a, b) => {
         // Simple string comparison for sorting - may not be perfect for all date formats/intervals
         return a.time_period.localeCompare(b.time_period);
     });


    return result;
}

// --- Report Specific Data Fetching Functions ---

export async function fetchTicketVolumeBy(dimension: 'type' | 'status' | 'priority' | 'assignee'): Promise<{ dimension: string; count: number }[]> {
    let selectQuery = '';
    let joinTable = '';
    let dimensionColumn = '';
    let dimensionNameColumn = '';

    switch (dimension) {
        case 'type':
            selectQuery = 'ticket_type_id, count';
            joinTable = 'ticket_types';
            dimensionColumn = 'ticket_type_id';
            dimensionNameColumn = 'name';
            break;
        case 'status':
            selectQuery = 'status_id, count';
            joinTable = 'ticket_statuses';
            dimensionColumn = 'status_id';
            dimensionNameColumn = 'name';
            break;
        case 'priority':
            selectQuery = 'priority_id, count';
            joinTable = 'ticket_priorities';
            dimensionColumn = 'priority_id';
            dimensionNameColumn = 'name';
            break;
        case 'assignee':
            selectQuery = 'assignee_id, count';
            joinTable = 'profiles'; // Joining with profiles to get assignee name
            dimensionColumn = 'assignee_id';
            dimensionNameColumn = 'full_name';
            break;
        default:
            throw new Error(`Invalid dimension: ${dimension}`);
    }

    // This requires a database function or view for efficient grouping and counting.
    // As a client-side fallback (less efficient for large data), we can fetch all tickets
    // and group/count them here. A better approach would be a Supabase RPC or SQL view.

    const { data, error } = await supabase
        .from('tickets')
        .select(`${dimensionColumn}${dimension === 'assignee' ? ', assignee_profile:profiles!tickets_assignee_id_fkey(full_name)' : ''}`);


    if (error) {
        console.error(`Error fetching ticket volume by ${dimension}:`, error.message);
        throw error;
    }

    if (!data) return [];

    const counts: { [key: string]: number } = {};

    data.forEach(ticket => {
        let key: string | null | undefined;
        if (dimension === 'assignee') {
             key = (ticket as any).assignee_profile?.full_name;
             if (key === null || key === undefined) {
                 key = 'Unassigned';
             }
        } else {
             key = (ticket as any)[dimensionColumn]?.toString();
             if (key === null || key === undefined) {
                 key = `Unknown ${dimension}`;
             }
        }


        if (key !== undefined && key !== null) { // Ensure key is not undefined or null
             counts[key] = (counts[key] || 0) + 1;
        }
    });

    // If grouping by ID, try to fetch names (less efficient)
    if (dimension !== 'assignee' && (dimensionColumn === 'ticket_type_id' || dimensionColumn === 'status_id' || dimensionColumn === 'priority_id')) {
        try {
            const { data: namesData, error: namesError } = await supabase.from(joinTable).select('id, name');
            if (!namesError && namesData) {
                const nameMap = new Map(namesData.map(item => [item.id.toString(), item.name]));
                 return Object.keys(counts).map(id => ({
                     dimension: nameMap.get(id) || `Unknown ${dimension} (${id})`,
                     count: counts[id]
                 }));
            }
        } catch (e) {
            console.error(`Failed to fetch names for ${dimension} IDs:`, e);
        }
    }


    return Object.keys(counts).map(key => ({
        dimension: key,
        count: counts[key]
    }));
}

export async function fetchAgentPerformance(): Promise<{ agent: string; assigned: number; resolved: number; closed: number; average_resolution_time: string | null }[]> {
    // This is a complex report requiring aggregation and joins.
    // A database view or RPC would be the most efficient.
    // Client-side processing would be very inefficient for large datasets.
    // Placeholder implementation: Fetch all tickets and agents and process client-side.

    const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, assignee_id, status_id, created_at, updated_at');

    const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'agent');

    const { data: statusesData, error: statusesError } = await supabase
        .from('ticket_statuses')
        .select('id, name');


    if (ticketsError) { console.error('Error fetching tickets for agent performance:', ticketsError.message); throw ticketsError; }
    if (agentsError) { console.error('Error fetching agents for agent performance:', agentsError.message); throw agentsError; }
    if (statusesError) { console.error('Error fetching statuses for agent performance:', statusesError.message); throw statusesError; }

    if (!ticketsData || !agentsData || !statusesData) return [];

    const statusNameMap = new Map(statusesData.map(s => [s.id, s.name]));
    const agentNameMap = new Map(agentsData.map(a => [a.id, a.full_name || 'Unknown Agent']));

    const agentMetrics: { [agentId: string]: { assigned: number; resolved: number; closed: number; resolutionTimes: number[] } } = {};

    agentsData.forEach(agent => {
        agentMetrics[agent.id] = { assigned: 0, resolved: 0, closed: 0, resolutionTimes: [] };
    });

    ticketsData.forEach(ticket => {
        if (ticket.assignee_id && agentMetrics[ticket.assignee_id]) {
            agentMetrics[ticket.assignee_id].assigned++;

            const statusName = statusNameMap.get(ticket.status_id);
            if (statusName === 'Resolved') { // Assuming 'Resolved' is the status name for resolved tickets
                agentMetrics[ticket.assignee_id].resolved++;
                if (ticket.created_at && ticket.updated_at) {
                    const createdAt = new Date(ticket.created_at).getTime();
                    const updatedAt = new Date(ticket.updated_at).getTime();
                    agentMetrics[ticket.assignee_id].resolutionTimes.push(updatedAt - createdAt); // Time in milliseconds
                }
            }
            if (statusName === 'Closed') { // Assuming 'Closed' is the status name for closed tickets
                agentMetrics[ticket.assignee_id].closed++;
                if (ticket.created_at && ticket.updated_at) { // Record resolution time for all closed tickets
                    const createdAt = new Date(ticket.created_at).getTime();
                    const updatedAt = new Date(ticket.updated_at).getTime();
                    agentMetrics[ticket.assignee_id].resolutionTimes.push(updatedAt - createdAt); // Time in milliseconds
                }
            }
        }
    });

    const result = Object.keys(agentMetrics).map(agentId => {
        const metrics = agentMetrics[agentId];
        const totalResolutionTime = metrics.resolutionTimes.reduce((sum, time) => sum + time, 0);
        const averageResolutionTime = metrics.resolutionTimes.length > 0
            ? totalResolutionTime / metrics.resolutionTimes.length
            : null;

        // Format average resolution time (e.g., in hours or days)
        const formatTime = (ms: number | null): string | null => {
            if (ms === null) return null;
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        };


        return {
            agent: agentNameMap.get(agentId) || 'Unknown Agent',
            assigned: metrics.assigned,
            resolved: metrics.resolved,
            closed: metrics.closed,
            average_resolution_time: formatTime(averageResolutionTime),
        };
    });

    return result.sort((a, b) => a.agent.localeCompare(b.agent));
}

export async function fetchResolutionTimesBy(dimension: 'type' | 'priority' | 'agent'): Promise<{ dimension: string; average_resolution_time: string | null }[]> {
     // Similar to agent performance, this is complex and best handled by a database function/view.
     // Client-side fallback: Fetch all tickets and process.

     const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, ticket_type_id, priority_id, assignee_id, status_id, created_at, updated_at');

     const { data: typesData, error: typesError } = await supabase
        .from('ticket_types')
        .select('id, name');

     const { data: prioritiesData, error: prioritiesError } = await supabase
        .from('ticket_priorities')
        .select('id, name');

     const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'agent');

     const { data: statusesData, error: statusesError } = await supabase
        .from('ticket_statuses')
        .select('id, name');


     if (ticketsError) { console.error('Error fetching tickets for resolution time:', ticketsError.message); throw ticketsError; }
     if (typesError) { console.error('Error fetching ticket types for resolution time:', typesError.message); throw typesError; }
     if (prioritiesError) { console.error('Error fetching priorities for resolution time:', prioritiesError.message); throw prioritiesError; }
     if (agentsError) { console.error('Error fetching agents for resolution time:', agentsError.message); throw agentsError; }
     if (statusesError) { console.error('Error fetching statuses for resolution time:', statusesError.message); throw statusesError; }

     if (!ticketsData || !typesData || !prioritiesData || !agentsData || !statusesData) return [];

     const statusNameMap = new Map(statusesData.map(s => [s.id, s.name]));
     const typeNameMap = new Map(typesData.map(t => [t.id, t.name]));
     const priorityNameMap = new Map(prioritiesData.map(p => [p.id, p.name]));
     const agentNameMap = new Map(agentsData.map(a => [a.id, a.full_name || 'Unknown Agent']));


     const resolutionTimes: { [key: string]: number[] } = {};

     ticketsData.forEach(ticket => {
         const statusName = statusNameMap.get(ticket.status_id);
         // Only consider tickets that have been resolved or closed after being resolved
         if (statusName === 'Resolved' || statusName === 'Closed') {
             if (ticket.created_at && ticket.updated_at) {
                 const createdAt = new Date(ticket.created_at).getTime();
                 const updatedAt = new Date(ticket.updated_at).getTime();
                 const duration = updatedAt - createdAt; // Time in milliseconds

                 let key: string | null | undefined;
                 switch (dimension) {
                     case 'type':
                         key = ticket.ticket_type_id ? typeNameMap.get(ticket.ticket_type_id) : 'Unknown Type';
                         break;
                     case 'priority':
                         key = ticket.priority_id ? priorityNameMap.get(ticket.priority_id) : 'Unknown Priority';
                         break;
                     case 'agent':
                         key = ticket.assignee_id ? agentNameMap.get(ticket.assignee_id) : 'Unassigned';
                         break;
                 }

                 if (key !== undefined && key !== null) {
                     if (!resolutionTimes[key]) {
                         resolutionTimes[key] = [];
                     }
                     resolutionTimes[key].push(duration);
                 }
             }
         }
     });

     const result = Object.keys(resolutionTimes).map(key => {
         const times = resolutionTimes[key];
         const totalTime = times.reduce((sum, time) => sum + time, 0);
         const averageTime = times.length > 0 ? totalTime / times.length : null;

         const formatTime = (ms: number | null): string | null => {
            if (ms === null) return null;
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        };

         return {
             dimension: key,
             average_resolution_time: formatTime(averageTime),
         };
     });

     return result.sort((a, b) => a.dimension.localeCompare(b.dimension));
}

export async function fetchCustomerTicketCounts(): Promise<{ customer: string; ticket_count: number }[]> {
    // Requires grouping by requester_id and joining with profiles.
    // Best handled by a database function/view.
    // Client-side fallback: Fetch all tickets and profiles and process.

    const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, requester_id');

    const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name');

    if (ticketsError) { console.error('Error fetching tickets for customer report:', ticketsError.message); throw ticketsError; }
    if (profilesError) { console.error('Error fetching profiles for customer report:', profilesError.message); throw profilesError; }

    if (!ticketsData || !profilesData) return [];

    const profileNameMap = new Map(profilesData.map(p => [p.id, p.full_name || 'Unknown Customer']));
    const ticketCounts: { [customerId: string]: number } = {};

    ticketsData.forEach(ticket => {
        const customerId = ticket.requester_id;
        ticketCounts[customerId] = (ticketCounts[customerId] || 0) + 1;
    });

    const result = Object.keys(ticketCounts).map(customerId => ({
        customer: profileNameMap.get(customerId) || `Unknown Customer (${customerId})`,
        ticket_count: ticketCounts[customerId],
    }));

    return result.sort((a, b) => a.customer.localeCompare(b.customer));
}

export async function fetchOverallAverageResolutionTime(): Promise<string | null> {
    // Fetch tickets that are either 'Resolved' or 'Closed'
    const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('created_at, updated_at, status_id');

    const { data: statusesData, error: statusesError } = await supabase
        .from('ticket_statuses')
        .select('id, name');

    if (ticketsError) {
        console.error('Error fetching tickets for overall average resolution time:', ticketsError.message);
        throw ticketsError;
    }
    if (statusesError) {
        console.error('Error fetching statuses for overall average resolution time:', statusesError.message);
        throw statusesError;
    }

    if (!ticketsData || !statusesData) return null;

    const statusNameMap = new Map(statusesData.map(s => [s.id, s.name]));
    const resolutionTimes: number[] = [];

    ticketsData.forEach(ticket => {
        const statusName = statusNameMap.get(ticket.status_id);
        if ((statusName === 'Resolved' || statusName === 'Closed') && ticket.created_at && ticket.updated_at) {
            const createdAt = new Date(ticket.created_at).getTime();
            const updatedAt = new Date(ticket.updated_at).getTime();
            resolutionTimes.push(updatedAt - createdAt); // Time in milliseconds
        }
    });

    const totalResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0);
    const averageResolutionTime = resolutionTimes.length > 0
        ? totalResolutionTime / resolutionTimes.length
        : null;

    const formatTime = (ms: number | null): string | null => {
        if (ms === null) return null;
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    return formatTime(averageResolutionTime);
}


export async function createTicketType(newTicketType: { name: string; description?: string | null }): Promise<TicketType | null> {
    const { data, error } = await supabase.from('ticket_types').insert(newTicketType).select('id, name, description').single();
    if (error) { console.error('Error creating ticket type:', error.message); throw error; }
    return data as TicketType | null;
}

export async function updateTicketType(id: number, updates: { name?: string; description?: string | null }): Promise<TicketType | null> {
    const { data, error } = await supabase.from('ticket_types').update(updates).eq('id', id).select('id, name, description').single();
    if (error) { console.error(`Error updating ticket type #${id}:`, error.message); throw error; }
    return data as TicketType | null;
}

export async function deleteTicketType(id: number): Promise<void> {
    const { error } = await supabase.from('ticket_types').delete().eq('id', id);
    if (error) { console.error(`Error deleting ticket type #${id}:`, error.message); throw error; }
}

export interface TicketTypeSpecializationRoute {
    ticket_type_id: number;
    specialization_id: number;
}

export async function addTicketTypeSpecializationRoute(ticketTypeId: number, specializationId: number): Promise<TicketTypeSpecializationRoute | null> {
    const { data, error } = await supabase.from('ticket_type_specialization_routes').insert({ ticket_type_id: ticketTypeId, specialization_id: specializationId }).select().single();
    if (error) {
        console.error(`Error adding route (TT: ${ticketTypeId}, S: ${specializationId}):`, error.message);
        if (error.code === '23505') console.warn('This route already exists.');
        throw error;
    }
    return data as TicketTypeSpecializationRoute | null;
}

export async function removeTicketTypeSpecializationRoute(ticketTypeId: number, specializationId: number): Promise<void> {
    const { error } = await supabase.from('ticket_type_specialization_routes').delete().eq('ticket_type_id', ticketTypeId).eq('specialization_id', specializationId);
    if (error) { console.error(`Error removing route (TT: ${ticketTypeId}, S: ${specializationId}):`, error.message); throw error; }
}

export async function fetchRoutesForTicketType(ticketTypeId: number): Promise<{ specialization_id: number; specializations: { name: string } | null }[]> {
    const { data, error } = await supabase
        .from('ticket_type_specialization_routes')
        .select(` specialization_id, specializations:specializations!inner (name) `)
        .eq('ticket_type_id', ticketTypeId);

    if (error) { console.error(`Error fetching routes for ticket type ${ticketTypeId}:`, error.message); throw error; }
    if (!data) return [];

    return data.map(item => ({
        specialization_id: item.specialization_id as number,
        specializations: item.specializations as unknown as { name: string } | null
    }));
}

export async function fetchRoutesForSpecialization(specializationId: number): Promise<{ ticket_type_id: number; ticket_types: { name: string } | null }[]> {
    const { data, error } = await supabase
        .from('ticket_type_specialization_routes')
        .select(` ticket_type_id, ticket_types:ticket_types!inner (name) `)
        .eq('specialization_id', specializationId);

    if (error) { console.error(`Error fetching routes for specialization ${specializationId}:`, error.message); throw error; }
    if (!data) return [];
    return data.map(item => ({
        ticket_type_id: item.ticket_type_id as number,
        ticket_types: item.ticket_types as unknown as { name: string } | null
    }));
}

export async function fetchSpecializations(): Promise<Specialization[]> {
    const { data, error } = await supabase.from('specializations').select('id, name, description').order('name', { ascending: true });
    if (error) { console.error('Error fetching specializations:', error.message); throw error; }
    return data || [];
}

export async function createSpecialization(newSpecialization: { name: string; description?: string | null }): Promise<Specialization | null> {
    const { data, error } = await supabase.from('specializations').insert(newSpecialization).select('id, name, description').single();
    if (error) { console.error('Error creating specialization:', error.message); throw error; }
    return data as Specialization | null;
}

export async function updateSpecialization(id: number, updates: { name?: string; description?: string | null }): Promise<Specialization | null> {
    const { data, error } = await supabase.from('specializations').update(updates).eq('id', id).select('id, name, description').single();
    if (error) { console.error(`Error updating specialization #${id}:`, error.message); throw error; }
    return data as Specialization | null;
}

export async function deleteSpecialization(id: number): Promise<void> {
    const { error } = await supabase.from('specializations').delete().eq('id', id);
    if (error) { console.error(`Error deleting specialization #${id}:`, error.message); throw error; }
}

export async function updateTicketStatus(ticketId: number, statusId: number): Promise<Ticket | null> {
    const { data, error } = await supabase.from('tickets').update({ status_id: statusId, updated_at: new Date().toISOString() }).eq('id', ticketId).select(TICKET_SELECT_QUERY).single();
    if (error) { console.error(`Error updating status for ticket #${ticketId}:`, error.message); throw error; }
    return data as unknown as Ticket | null;
}

export async function deleteTicket(ticketId: number): Promise<{ success: boolean }> {
    const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
    if (error) { console.error(`Error deleting ticket #${ticketId}:`, error.message); throw error; }
    return { success: true };
}

export async function fetchCommentsForTicket(ticketId: number): Promise<Comment[]> {
    const { data, error } = await supabase.from('ticket_comments').select(`id, ticket_id, user_id, comment_text, is_internal_note, created_at, profiles!inner ( id, full_name, avatar_url, role, specialization_id, specializations:specializations!profiles_specialization_id_fkey(id, name) )`).eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (error) { console.error(`Error fetching comments for ticket #${ticketId}:`, error.message); throw error; }
    return (data as unknown as Comment[]) || [];
}

export async function addCommentToTicket(commentData: NewCommentData): Promise<Comment | null> {
    const { data, error } = await supabase.from('ticket_comments').insert([{ ...commentData, is_internal_note: commentData.is_internal_note || false }]).select(`id, ticket_id, user_id, comment_text, is_internal_note, created_at, profiles!inner ( id, full_name, avatar_url, role, specialization_id, specializations:specializations!profiles_specialization_id_fkey(id, name) )`).single();
    if (error) { console.error('Error adding comment:', error.message); throw error; }
    return data as unknown as Comment | null;
}

export async function fetchAgents(): Promise<AgentOption[]> {
    const { data, error } = await supabase.from('profiles').select(`id, full_name, specialization_id, specializations:specializations!profiles_specialization_id_fkey (id, name, description)`).eq('role', 'agent').order('full_name', { ascending: true });
    if (error) { console.error('Error fetching agents:', error.message); throw error; }
    return (data as unknown as AgentOption[]) || [];
}

export async function assignTicket(ticketId: number, agentId: string | null): Promise<Ticket | null> {
    const { data, error } = await supabase.from('tickets').update({ assignee_id: agentId, updated_at: new Date().toISOString() }).eq('id', ticketId).select(TICKET_SELECT_QUERY).single();
    if (error) { console.error(`Error assigning ticket #${ticketId}:`, error.message); throw error; }
    return data as unknown as Ticket | null;
}

export async function updateTicketPriority(ticketId: number, priorityId: number): Promise<Ticket | null> {
    const { data, error } = await supabase.from('tickets').update({ priority_id: priorityId, updated_at: new Date().toISOString() }).eq('id', ticketId).select(TICKET_SELECT_QUERY).single();
    if (error) { console.error(`Error updating priority for ticket #${ticketId}:`, error.message); throw error; }
    return data as unknown as Ticket | null;
}

export async function fetchUserProfileById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.from('profiles').select(`*, specializations:specializations!profiles_specialization_id_fkey (id, name, description)`).eq('id', userId).single();
    if (error) { console.error(`Error fetching profile for user ${userId}:`, error.message); return null; }
    return data as unknown as UserProfile | null;
}

export async function updateUserProfile(userId: string, updates: { full_name?: string; avatar_url?: string; specialization_id?: number | null; role?: string; }): Promise<UserProfile | null> {
    const profileUpdateData: Partial<UserProfile> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.specialization_id === null) profileUpdateData.specialization_id = null;
    if (updates.role === null || updates.role === '') profileUpdateData.role = updates.role;
    const { data, error } = await supabase.from('profiles').update(profileUpdateData).eq('id', userId).select(`*, specializations:specializations!profiles_specialization_id_fkey (id, name, description)`).single();
    if (error) { console.error('Error updating user profile:', error.message); throw error; }
    return data as unknown as UserProfile | null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (uploadError) { console.error('Error uploading avatar:', uploadError.message); throw uploadError; }
    return fileName;
}

export function getAvatarPublicUrl(filePath: string): string | null {
    if (!filePath) return null;

    // Attempt to get the public URL using Supabase SDK
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

    // If SDK method returns a public URL, use it
    if (data?.publicUrl) {
        return data.publicUrl;
    }

    // Fallback: Manually construct the public URL if SDK method fails
    // This might be necessary in some local development setups
    if (supabaseUrl) {
        // Ensure filePath doesn't start with a slash if bucket name is included
        const cleanedFilePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        // Construct the URL: [SUPABASE_URL]/storage/v1/object/public/[BUCKET_NAME]/[FILE_PATH]
        const manualUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${cleanedFilePath}`;
        console.warn(`Supabase getPublicUrl failed for ${filePath}. Using manual fallback URL: ${manualUrl}`);
        return manualUrl;
    }

    // If both methods fail, return null
    console.error(`Failed to get public URL for ${filePath}. Supabase URL not available for manual construction.`);
    return null;
}

export async function fetchUserNotifications(userId: string, limit: number = 10, onlyUnread: boolean = false): Promise<Notification[]> {
    let query = supabase.from('notifications').select(`id, user_id, ticket_id, message, is_read, type, created_at, tickets ( subject )`).eq('user_id', userId);
    if (onlyUnread) { query = query.eq('is_read', false); }
    query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) { console.error('Error fetching user notifications:', error.message); throw error; }
    return (data as unknown as Notification[]) || [];
}

export async function markNotificationAsRead(notificationId: number): Promise<Notification | null> {
    const { data, error } = await supabase.from('notifications').update({ is_read: true, updated_at: new Date().toISOString() }).eq('id', notificationId).select(`id, user_id, ticket_id, message, is_read, type, created_at, tickets ( subject )`).single();
    if (error) { console.error(`Error marking notification #${notificationId} as read:`, error.message); throw error; }
    return data as unknown as Notification | null;
}

export async function markAllNotificationsAsRead(userId: string): Promise<{ success: boolean; count?: number }> {
    const { count, error } = await supabase.from('notifications').update({ is_read: true, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false);
    if (error) { console.error(`Error marking all notifications as read for user ${userId}:`, error.message); throw error; }
    return { success: true, count: count || 0 };
}

export async function fetchAllUsersWithProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            id, full_name, avatar_url, role, updated_at, specialization_id,
            specializations:specializations!profiles_specialization_id_fkey (id, name, description)
        `)
        .order('full_name', { ascending: true });

    if (error) { console.error('Error fetching all users with profiles:', error.message); throw error; }
    if (!data) return [];
    return data.map(profile_from_db => ({
        ...profile_from_db,
        specializations: profile_from_db.specializations as unknown as Specialization | null
    })) as UserProfile[];
}

// --- CORRECTED fetchCompatibleAgentsForTicketType ---
export async function fetchCompatibleAgentsForTicketType(ticketTypeId: number): Promise<AgentOption[]> {
    const { data, error } = await supabase
        .from('ticket_type_specialization_routes')
        .select(`
            specializations:specializations!inner (
                id, 
                name,
                description,
                profiles!inner (
                    id,
                    full_name,
                    role,
                    avatar_url,
                    specialization_id 
                )
            )
        `)
        .eq('ticket_type_id', ticketTypeId);

    if (error) {
        console.error(`Error fetching compatible agents for ticket type ${ticketTypeId}:`, error.message);
        throw error;
    }

    const agentsList: AgentOption[] = [];
    const agentIds = new Set<string>();

    if (data) {
        data.forEach(route => {
            const compatibleSpecialization = route.specializations as unknown as (Specialization & { profiles: UserProfile[] | null });
            
            if (compatibleSpecialization && compatibleSpecialization.profiles) {
                compatibleSpecialization.profiles.forEach(profile => {
                    if (profile.role === 'agent' && !agentIds.has(profile.id)) {
                        agentsList.push({
                            id: profile.id,
                            full_name: profile.full_name,
                            specialization_id: compatibleSpecialization.id,
                            specializations: {
                                id: compatibleSpecialization.id,
                                name: compatibleSpecialization.name,
                                description: compatibleSpecialization.description
                            }
                        });
                        agentIds.add(profile.id);
                    }
                });
            }
        });
    }
    return agentsList.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
}

// == KB Categories ==
export async function fetchKBCategories(): Promise<KBCategory[]> {
    const { data, error } = await supabase
        .from('kb_categories')
        .select(`
            *,
            kb_articles ( count )
        `) // Optionally count articles in each category
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching KB categories:', error.message);
        throw error;
    }
    return data?.map(cat => ({
        ...cat,
        article_count: Array.isArray(cat.kb_articles) ? cat.kb_articles[0]?.count || 0 : 0
    })) || [];
}

export async function createKBCategory(categoryData: { name: string; description?: string | null }): Promise<KBCategory | null> {
    const { data, error } = await supabase
        .from('kb_categories')
        .insert(categoryData)
        .select()
        .single();
    if (error) {
        console.error('Error creating KB category:', error.message);
        throw error;
    }
    return data as KBCategory | null;
}

export async function updateKBCategory(id: number, updates: { name?: string; description?: string | null }): Promise<KBCategory | null> {
    const { data, error } = await supabase
        .from('kb_categories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) {
        console.error(`Error updating KB category #${id}:`, error.message);
        throw error;
    }
    return data as KBCategory | null;
}

export async function deleteKBCategory(id: number): Promise<void> {
    // Note: Consider implications if articles are linked.
    // The FK on kb_articles.category_id is ON DELETE SET NULL.
    const { error } = await supabase
        .from('kb_categories')
        .delete()
        .eq('id', id);
    if (error) {
        console.error(`Error deleting KB category #${id}:`, error.message);
        throw error;
    }
}

// == KB Articles ==
const KB_ARTICLE_SELECT_QUERY = `
    id, category_id, author_id, title, content, slug, tags, is_published, view_count, created_at, updated_at,
    kb_categories ( name ),
    profiles ( full_name )
`;

// lib/dataService.ts (relevant part)
export async function fetchKBArticles(
    options?: {
        categoryId?: number;
        searchQuery?: string;
        publishedOnly?: boolean;
        limit?: number;
        offset?: number; // Ensure 'offset' is here
    }
): Promise<{ articles: KBArticle[], count: number | null }> { // Ensure this return type is here
    let query = supabase.from('kb_articles').select(KB_ARTICLE_SELECT_QUERY, { count: 'exact' });

    // ... (your existing filter logic) ...

    if (options?.searchQuery && options.searchQuery.trim() !== "") {
        const searchTerm = `%${options.searchQuery.trim()}%`;
        query = query.or(
`title.ilike.${searchTerm},content.ilike.${searchTerm},tags.cs.{${options.searchQuery.trim()
   .replace(/[,{}]/g,'')}}`
        );
    }
    // ... (other filters and ordering) ...

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    if (options?.offset !== undefined) {
        query = query.range(options.offset,
                            options.offset + (options.limit || 10) - 1);
    }
    const { data, error, count } = await query;
    console.log("fetchKBArticles - Raw Supabase data:", data);
    console.log("fetchKBArticles - Supabase error:", error);
    console.log("fetchKBArticles - Supabase count:", count);

    if (error) {
        console.error('Error fetching KB articles:', error.message);
        throw error;
    }
    // Ensure you return the object structure
    return { articles: (data as unknown as KBArticle[]) || [], count: count };
}

export async function fetchKBArticleById(id: number): Promise<KBArticle | null> {
    const { data, error } = await supabase
        .from('kb_articles')
        .select(KB_ARTICLE_SELECT_QUERY)
        .eq('id', id)
        .single();
    if (error) {
        console.error(`Error fetching KB article #${id}:`, error.message);
        if (error.code === 'PGRST116') return null; // Row not found
        throw error;
    }
    return data as unknown as KBArticle | null;
}

export async function fetchKBArticleBySlug(slug: string): Promise<KBArticle | null> {
    const { data, error } = await supabase
        .from('kb_articles')
        .select(KB_ARTICLE_SELECT_QUERY)
        .eq('slug', slug)
        // .eq('is_published', true) // Consider if admins should see unpublished by slug too
        .single();
    if (error) {
        console.error(`Error fetching KB article by slug "${slug}":`, error.message);
        if (error.code === 'PGRST116') return null; // Row not found
        throw error;
    }
    return data as unknown as KBArticle | null;
}

export async function createKBArticle(articleData: NewKBArticleData): Promise<KBArticle | null> {
    const { data, error } = await supabase
        .from('kb_articles')
        .insert(articleData)
        .select(KB_ARTICLE_SELECT_QUERY)
        .single();
    if (error) {
        console.error('Error creating KB article:', error.message);
        throw error;
    }
    return data as unknown as KBArticle | null;
}

export async function updateKBArticle(id: number, updates: UpdateKBArticleData): Promise<KBArticle | null> {
    const { data, error } = await supabase
        .from('kb_articles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(KB_ARTICLE_SELECT_QUERY)
        .single();
    if (error) {
        console.error(`Error updating KB article #${id}:`, error.message);
        throw error;
    }
    return data as unknown as KBArticle | null;
}

export async function deleteKBArticle(id: number): Promise<void> {
    const { error } = await supabase
        .from('kb_articles')
        .delete()
        .eq('id', id);
    if (error) {
        console.error(`Error deleting KB article #${id}:`, error.message);
        throw error;
    }
}

export async function incrementKBArticleViewCount(articleId: number): Promise<void> {
    const { error } = await supabase.rpc('increment_kb_view_count', { article_id_to_increment: articleId })
    if (error) {
        console.error('Error incrementing view count for article #', articleId, ':', error)
    }
}
