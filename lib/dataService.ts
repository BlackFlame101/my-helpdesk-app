// lib/dataService.ts
import { supabase } from './supabaseClient'; // Ensure this path is correct

// --- Interfaces ---

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
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data?.publicUrl || null;
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
            `title.ilike.<span class="math-inline">\{searchTerm\},content\.ilike\.</span>{searchTerm},tags.cs.{${options.searchQuery.trim()}}`
        );
    }
    // ... (other filters and ordering) ...

    if (options?.limit) {
        query = query.limit(options.limit);
    }
    if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
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
