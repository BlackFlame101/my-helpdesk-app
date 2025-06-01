"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ChatbotWindow from '@/components/chatbot/ChatbotWindow'; // Adjust path
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    fetchTicketsForUser, Ticket, createTicket, NewTicketData,
    fetchTicketPriorities, PriorityOption,
    fetchTicketStatuses, StatusOption,
    updateTicketStatus,
    deleteTicket,
    fetchCommentsForTicket, Comment,
    addCommentToTicket, NewCommentData,
    fetchAgents, AgentOption,
    assignTicket,
    updateTicketPriority,
    getAvatarPublicUrl,
    fetchUserNotifications, Notification as NotificationType,
    fetchTicketTypes, TicketType, // Added
    fetchCompatibleAgentsForTicketType, // Added
    fetchCustomers, UserProfile
} from '@/lib/dataService';

import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';


import {
  Search, Plus, Info, MoreHorizontal, BarChart2, Users, Zap, Layers,
  MessageSquare, Settings, Archive, AlertTriangle, Trash2, Bell,
  ChevronDown, MessageCircle, Home, X, Filter, CheckCircle, Clock, MinusCircle, XCircle, AlertCircle
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import LogoutButton from '@/components/auth/LogoutButton'; 


const DEFAULT_OPEN_STATUS_ID = 1;


interface ClientOnlyFormatProps {
  dateString: string | undefined | null;
  options?: Intl.DateTimeFormatOptions;
  placeholder?: string;
}
const ClientOnlyDateTime: React.FC<ClientOnlyFormatProps> = ({ dateString, options, placeholder }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!dateString) return <span>{placeholder || ''}</span>;
  const hasTimeOptions = options && (options.timeStyle || options.hour || options.minute || options.second);
  if (!mounted) {
    const placeholderDate = new Date(dateString).toISOString().split('T')[0];
    return <span>{placeholder === undefined ? placeholderDate : placeholder}</span>;
  }
  try {
    const date = new Date(dateString);
    const formattedDate = hasTimeOptions ? date.toLocaleString(undefined, options) : date.toLocaleDateString(undefined, options);
    return <span>{formattedDate}</span>;
  } catch (e) {
    console.error("Error formatting date/time:", e);
    return <span>Invalid Date</span>;
  }
};



export default function RevampedDashboardPage() {
  const { user, profile, session, loading: authLoading, isAdmin, isAgent, isProfileLoading, unreadNotificationsCount: contextUnreadCount } = useAuth(); // Added isAdmin
  const router = useRouter();
  const { toast: showToast } = useToast();

  

  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]); // Added
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<Ticket | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketDetailsOpen, setTicketDetailsOpen] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [activeNavItem, setActiveNavItem] = useState("tickets");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // You can make this configurable
  const [totalTickets, setTotalTickets] = useState<number | null>(null);

  // Comment specific states
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Agent assignment states
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [compatibleAgents, setCompatibleAgents] = useState<AgentOption[]>([]); // Added
  const [isLoadingCompatibleAgents, setIsLoadingCompatibleAgents] = useState(false); // Added
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAssigningTicket, setIsAssigningTicket] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false); // State for internal note toggle
  // unreadNotificationsCount is now managed by AuthContext

  const initialLoadDone = useRef(false);

  const isMobile = useIsMobile();

  


const loadInitialData = useCallback(async (showLoadingIndicator = true) => {

    if (!session) return;


    if (showLoadingIndicator) {
      setIsLoadingData(true);
    } else {
      setIsBackgroundLoading(true);
    }

    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const [ticketData, fetchedPriorities, fetchedStatuses, fetchedAgents, fetchedTicketTypes] = await Promise.all([
        fetchTicketsForUser(itemsPerPage, offset), // Fetch with pagination
        fetchTicketPriorities(),
        fetchTicketStatuses(),
        fetchAgents(),
        fetchTicketTypes()
      ]);

      // Update tickets only if the array length changed or any ticket IDs are different
      const shouldUpdateTickets = tickets.length !== ticketData.tickets.length || 
        tickets.some((ticket, index) => ticket.id !== ticketData.tickets[index]?.id);
      if (shouldUpdateTickets) {
        setTickets(ticketData.tickets);
      }

      // Always update total count as it's a simple value
      setTotalTickets(ticketData.count);

      // Update priorities only if the array length changed or any priority IDs are different
      const shouldUpdatePriorities = priorities.length !== fetchedPriorities.length ||
        priorities.some((priority, index) => priority.id !== fetchedPriorities[index]?.id);
      if (shouldUpdatePriorities) {
        setPriorities(fetchedPriorities);
      }

      // Update statuses only if the array length changed or any status IDs are different
      const shouldUpdateStatuses = statuses.length !== fetchedStatuses.length ||
        statuses.some((status, index) => status.id !== fetchedStatuses[index]?.id);
      if (shouldUpdateStatuses) {
        setStatuses(fetchedStatuses);
      }

      // Update agents only if the array length changed or any agent IDs are different
      const shouldUpdateAgents = agents.length !== fetchedAgents.length ||
        agents.some((agent, index) => agent.id !== fetchedAgents[index]?.id);
      if (shouldUpdateAgents) {
        setAgents(fetchedAgents);
      }

      // Update ticket types only if the array length changed or any type IDs are different
      const shouldUpdateTicketTypes = ticketTypes.length !== fetchedTicketTypes.length ||
        ticketTypes.some((type, index) => type.id !== fetchedTicketTypes[index]?.id);
      if (shouldUpdateTicketTypes) {
        setTicketTypes(fetchedTicketTypes);
      }

      setDataError(null);
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      if (showLoadingIndicator) {
        setDataError(err.message || "Could not fetch data.");
        showToast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
      }
    } finally {
      if (showLoadingIndicator) {
        setIsLoadingData(false);
      } else {
        setIsBackgroundLoading(false);
      }
    }
  }, [session, showToast, currentPage, itemsPerPage, tickets, priorities, statuses, agents, ticketTypes]); // Added currentPage and itemsPerPage

  useEffect(() => {
    if (authLoading) {


      return;
    }

    if (!session) {
      router.push('/login');
      initialLoadDone.current = false;
      return;
    }


    const showMainLoader = !initialLoadDone.current;
    loadInitialData(showMainLoader);
    initialLoadDone.current = true;

    // The unread count is now handled by AuthContext's real-time subscription.
    // No need for a separate fetch here unless AuthContext isn't providing it yet
    // or if you want a redundant fetch on dashboard load specifically.
    // For now, we'll rely on the context.

  }, [session, authLoading, router, loadInitialData, user, currentPage]); // Added currentPage to dependencies

  

  const statusCounts = useMemo(() => {
      const counts: { [key: string]: number } = {};
      statuses.forEach(status => { counts[status.name] = 0; });
      tickets.forEach(ticket => {
          const statusName = statuses.find(s => s.id === ticket.status_id)?.name;
          if (statusName) { counts[statusName] = (counts[statusName] || 0) + 1; }
      });
      return counts;
  }, [tickets, statuses]);

  const folderCounts = { Archive: 0, Spam: 0, Trash: 0 };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const ticketSubject = ticket.subject?.toLowerCase() || "";
      const ticketDescription = ticket.description?.toLowerCase() || "";
      const requesterName = ticket.profiles?.full_name?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" || ticketSubject.includes(query) || ticketDescription.includes(query) || requesterName.includes(query);
      const statusName = statuses.find(s => s.id === ticket.status_id)?.name;
      const matchesStatus = selectedStatusFilter === "all" || statusName === selectedStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchQuery, selectedStatusFilter, statuses]);


  

  const handleNavClick = (item: string) => {
    setActiveNavItem(item);
    // Map item names to routes
    const routes: { [key: string]: string } = {
      dashboard: '/dashboard',
      tickets: '/tickets',
      reports: '/reports',
      users: '/users',
      automations: '/automations',
      knowledge: '/knowledge-base',
      settings: '/settings',
    };
    const route = routes[item];
    if (route) {
      router.push(route);
    } else {
      // Optional: Handle unknown items, maybe show a toast or log a warning
      console.warn(`Unknown navigation item: ${item}`);
      showToast({ description: `Navigation for ${item} is not yet implemented.` });
    }
  };

  const handleCreateTicketSubmit = async (formData: { subject: string; description: string; priorityId: string; ticketTypeId: string; requesterId?: string }) => {
    if (!user) {
      showToast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const openStatus = statuses.find(s => s.name.toLowerCase() === 'open');
    const openStatusId = openStatus ? openStatus.id : DEFAULT_OPEN_STATUS_ID;

    const newTicketPayload: NewTicketData = {
      subject: formData.subject,
      description: formData.description,
      priority_id: parseInt(formData.priorityId, 10),
      requester_id: formData.requesterId || user.id,
      status_id: openStatusId,
      ticket_type_id: parseInt(formData.ticketTypeId, 10)
    };

    try {
      const created = await createTicket(newTicketPayload);
      if (created) {
        // Fetch the complete ticket data to get the assigned agent information
        const offset = (currentPage - 1) * itemsPerPage;
        const { tickets: updatedTickets } = await fetchTicketsForUser(itemsPerPage, offset);
        
        // Find the newly created ticket in the updated list
        const updatedTicket = updatedTickets.find(t => t.id === created.id) || created;
        
        setTickets(prev => {
          // Replace the ticket if it exists, otherwise add it to the beginning
          const exists = prev.some(t => t.id === updatedTicket.id);
          if (exists) {
            return prev.map(t => t.id === updatedTicket.id ? updatedTicket : t);
          }
          return [updatedTicket, ...prev];
        });
        
        setNewTicketOpen(false);
        showToast({ 
          title: "Success", 
          description: `Ticket "${created.subject}" created${updatedTicket.assignee_profile ? ` and assigned to ${updatedTicket.assignee_profile.full_name}` : ''}.` 
        });
      }
    } catch (error: any) {
      console.error("Failed to create ticket:", error);
      showToast({ title: "Error", description: error.message || "Failed to create ticket.", variant: "destructive" });
    }
  };

  const handleTicketSelect = async (ticket: Ticket) => {
    setSelectedTicketDetail(ticket);
    setTicketDetailsOpen(true);
    setComments([]); 
    setNewCommentText(""); 
    setSelectedAgentId(ticket.assignee_id || null);
    setCompatibleAgents([]); // Clear previous compatible agents

    if (ticket) {
      // Fetch comments
      setIsLoadingComments(true);
      setCommentError(null);
      fetchCommentsForTicket(ticket.id)
        .then(setComments)
        .catch(err => {
          console.error("Failed to fetch comments:", err);
          setCommentError(err.message || "Could not fetch comments.");
          showToast({ title: "Error", description: "Failed to load comments.", variant: "destructive" });
        })
        .finally(() => setIsLoadingComments(false));

      // Fetch compatible agents if ticket_type_id exists
      if (ticket.ticket_type_id) {
        setIsLoadingCompatibleAgents(true);
        fetchCompatibleAgentsForTicketType(ticket.ticket_type_id)
          .then(setCompatibleAgents)
          .catch(err => {
            console.error("Failed to fetch compatible agents:", err);
            showToast({ title: "Error", description: "Failed to load compatible agents for this ticket type.", variant: "destructive" });
          })
          .finally(() => setIsLoadingCompatibleAgents(false));
      }
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedTicketDetail || !user || !newCommentText.trim()) {
      showToast({ title: "Error", description: "Cannot submit empty comment or no ticket selected.", variant: "destructive" });
      return;
    }

    setIsSubmittingComment(true);
    const commentData: NewCommentData = {
      ticket_id: selectedTicketDetail.id,
      user_id: user.id,
      comment_text: newCommentText.trim(),
      is_internal_note: isAgent ? isInternalNote : false, // Only agents can set internal notes
    };

    try {
      const newComment = await addCommentToTicket(commentData);
      if (newComment) {
        setComments(prevComments => [...prevComments, newComment]);
        setNewCommentText("");
        setIsInternalNote(false); // Reset internal note toggle
        showToast({ description: "Comment added successfully." });
      }
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      showToast({ title: "Error", description: error.message || "Failed to add comment.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAssignTicket = async (ticketId: number, agentId: string | null) => {
    if (!(isAgent || isAdmin)) {
      showToast({ title: "Permission Denied", description: "Only agents and admins can assign tickets.", variant: "destructive" });
      return;
    }
    setIsAssigningTicket(true);
    try {
      const updatedTicket = await assignTicket(ticketId, agentId);
      if (updatedTicket) {
        setTickets(prevTickets => prevTickets.map(t => (t.id === ticketId ? updatedTicket : t)));
        if (selectedTicketDetail?.id === ticketId) {
          setSelectedTicketDetail(updatedTicket);
          setSelectedAgentId(updatedTicket.assignee_id || null);
        }
        showToast({ description: `Ticket #${ticketId} ${agentId ? 'assigned to ' + agents.find(a=>a.id === agentId)?.full_name : 'unassigned'}.` });
      }
    } catch (error: any) {
      console.error(`Failed to assign ticket #${ticketId}:`, error);
      showToast({ title: "Assignment Failed", description: error.message || "Could not assign ticket.", variant: "destructive" });
    } finally {
      setIsAssigningTicket(false);
    }
  };

  const handlePriorityChange = async (ticketId: number, priorityId: number) => {
    if (!(isAgent || isAdmin)) {
      showToast({ title: "Permission Denied", description: "Only agents and admins can change ticket priority.", variant: "destructive" });
      return;
    }
    const priorityObject = priorities.find(p => p.id === priorityId);
    if (!priorityObject) {
      showToast({ title: "Error", description: `Invalid priority selected.`, variant: "destructive" });
      return;
    }

    setIsUpdatingPriority(true);
    try {
      const updatedTicket = await updateTicketPriority(ticketId, priorityId);
      if (updatedTicket) {
        setTickets(prevTickets => prevTickets.map(t => (t.id === ticketId ? updatedTicket : t)));
        if (selectedTicketDetail?.id === ticketId) {
          setSelectedTicketDetail(updatedTicket);
        }
        showToast({ description: `Ticket #${ticketId} priority updated to ${priorityObject.name}.` });
      }
    } catch (error: any) {
      console.error(`Failed to update priority for ticket #${ticketId}:`, error);
      showToast({ title: "Update Failed", description: error.message || "Could not update priority.", variant: "destructive" });
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleStatusChange = async (ticketId: number, newStatusName: string) => {
    if (!(isAgent || isAdmin)) {
      showToast({ title: "Permission Denied", description: "Only agents and admins can change ticket status.", variant: "destructive" });
      return;
    }
    const statusObject = statuses.find(s => s.name === newStatusName);
    if (!statusObject) {
      showToast({ title: "Error", description: `Invalid status selected: ${newStatusName}`, variant: "destructive" });
      return;
    }
    setIsUpdatingTicket(true);
    try {
      const updatedTicket = await updateTicketStatus(ticketId, statusObject.id);
      if (updatedTicket) {
        setTickets(prevTickets => prevTickets.map(t => (t.id === ticketId ? updatedTicket : t)));
        if (selectedTicketDetail?.id === ticketId) { setSelectedTicketDetail(updatedTicket); }
        showToast({ description: `Ticket #${ticketId} status updated to ${newStatusName}` });
      }
    } catch (error: any) {
      console.error(`Failed to update status for ticket #${ticketId}:`, error);
      showToast({ title: "Update Failed", description: error.message || "Could not update status.", variant: "destructive" });
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const handleDeleteTicket = async (ticketId: number) => {
    
    if (!(isAgent || isAdmin)) { // Allow admin or agent to delete
        showToast({ title: "Permission Denied", description: "You do not have permission to delete tickets.", variant: "destructive" });
        return;
    }
    setIsUpdatingTicket(true);
    try {
        await deleteTicket(ticketId);
        setTickets(prev => prev.filter(t => t.id !== ticketId));
        setSelectedTicketDetail(null);
        setTicketDetailsOpen(false);
        showToast({ description: `Ticket #${ticketId} deleted.`, variant: "default" });
    } catch (error: any) {
        console.error(`Failed to delete ticket #${ticketId}:`, error);
        showToast({ title: "Deletion Failed", description: error.message || "Could not delete ticket.", variant: "destructive" });
    } finally {
        setIsUpdatingTicket(false);
    }
  };


  
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading authentication...</p></div>;
  }
  if (!session) {
    return <div className="flex items-center justify-center min-h-screen"><p>Redirecting to login...</p></div>;
  }

  
  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        <div className="flex-1 flex flex-col">
          <div className="flex flex-1">
            {!isMobile && (
              <div className="w-64 border-r bg-muted/20 p-4 flex flex-col gap-6">
                
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Ticket Views</h2>
                  <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        disabled={!(isAdmin || isAgent || profile?.role === 'customer') || isProfileLoading}
                      >
                        <Plus size={16} className="mr-1.5" /> New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px]">
                      <DialogHeader> <DialogTitle>Create New Ticket</DialogTitle> <DialogDescription>Fill in the details below.</DialogDescription> </DialogHeader>
                      <NewTicketForm 
                        onSubmit={handleCreateTicketSubmit} 
                        priorities={priorities} 
                        ticketTypes={ticketTypes} // Pass ticketTypes
                        isSubmittingProfileUpdate={isProfileLoading} />
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Statuses</h3>
                  <div className="space-y-1">
                    <Button variant={selectedStatusFilter === "all" ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => setSelectedStatusFilter("all")}> All Tickets <Badge variant="outline" className="ml-auto">{tickets.length}</Badge> </Button>
                    {statuses.map((status) => ( <Button key={status.id} variant={selectedStatusFilter === status.name ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => setSelectedStatusFilter(status.name)}> {status.name} <Badge variant="outline" className="ml-auto">{statusCounts[status.name] || 0}</Badge> </Button> ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Folders</h3>
                  {Object.entries(folderCounts).map(([folder, count]) => ( <Button key={folder} variant="ghost" size="sm" className="w-full justify-start"> {folder === "Archive" && <Archive size={14} className="mr-2 text-muted-foreground" />} {folder === "Spam" && <AlertCircle size={14} className="mr-2 text-muted-foreground" />} {folder === "Trash" && <Trash2 size={14} className="mr-2 text-muted-foreground" />} {folder} <Badge variant="outline" className="ml-auto">{count}</Badge> </Button> ))}
                </div>
              </div>
            )}

            
            <main className="flex-1 p-4 md:p-6 pb-20 overflow-y-auto">
              
              <div className="flex items-center justify-between mb-4 flex-wrap">
                <h1 className="text-2xl font-semibold"> {selectedStatusFilter === "all" ? "All Tickets" : `${selectedStatusFilter} Tickets`} </h1>
                <div className="flex items-center gap-2">
                  <div className="relative w-full max-w-xs"> <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input type="search" placeholder="Search tickets..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /> </div>
                  <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                      <SheetTrigger asChild>
                          {isMobile && <Button variant="outline" size="icon"><Filter size={18}/></Button>}
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[300px]">
                          <SheetHeader><SheetTitle>Filter Tickets</SheetTitle></SheetHeader>
                           <div className="py-6">
                              <h3 className="text-sm font-medium mb-3">Status</h3>
                              <div className="space-y-2">
                               <Button variant={selectedStatusFilter === "all" ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => {setSelectedStatusFilter("all"); setShowMobileFilters(false);}}> All Tickets <Badge variant="outline" className="ml-auto">{tickets.length}</Badge> </Button>
                                {statuses.map((status) => ( <Button key={status.id} variant={selectedStatusFilter === status.name ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => {setSelectedStatusFilter(status.name); setShowMobileFilters(false);}}> {status.name} <Badge variant="outline" className="ml-auto">{statusCounts[status.name] || 0}</Badge> </Button> ))}
                              </div>
                           </div>
                      </SheetContent>
                  </Sheet>
                </div>
              </div>

              
              {isLoadingData && <p className="text-center py-10">Loading tickets...</p>}
              {dataError && <p className="text-red-500 text-center py-10">Error: {dataError}</p>}
              {!isLoadingData && !dataError && filteredTickets.length === 0 && (
                <div className="text-center py-10 text-muted-foreground"> <MessageSquare size={48} className="mx-auto mb-2" /> <p>No tickets found matching your criteria.</p> {selectedStatusFilter !== "all" && <Button variant="link" onClick={() => setSelectedStatusFilter("all")}>View all tickets</Button>} </div>
              )}
              {!isLoadingData && !dataError && filteredTickets.length > 0 && (
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2'}`}>
                  {filteredTickets.map((ticket) => {
                    const currentStatus = ticket.ticket_statuses;
                    const currentPriority = ticket.ticket_priorities;
                    const currentProfile = ticket.profiles;
                    return (
                      <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer mb-4" onClick={() => handleTicketSelect(ticket)}>
                        <CardHeader>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-semibold leading-tight truncate" title={ticket.subject}> {ticket.subject} </CardTitle>
                            </div>
                            <div className="flex items-center gap-x-1 flex-shrink-0">
                              {ticket.ticket_types && <Badge variant="outline" className="text-xs capitalize">{ticket.ticket_types.name}</Badge>}
                              {currentStatus && (
                                <Badge 
                                  variant={
                                    currentStatus.name.toLowerCase() === 'open' ? 'info' :
                                    currentStatus.name.toLowerCase() === 'in progress' ? 'pending' :
                                    currentStatus.name.toLowerCase() === 'resolved' ? 'success' :
                                    currentStatus.name.toLowerCase() === 'closed' ? 'closed' :
                                    'secondary'
                                  } 
                                  className="whitespace-nowrap capitalize"
                                >
                                  {currentStatus.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardDescription className="text-xs text-muted-foreground">
                            #TICK-{String(ticket.id).padStart(5, '0')} by {currentProfile?.full_name || 'N/A'} • <ClientOnlyDateTime dateString={ticket.created_at} options={{ dateStyle: 'short' }} />
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-4">
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3"> {ticket.description} </p>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                            {currentPriority && <Badge variant="outline" className="capitalize py-0.5 px-1.5 font-normal">{currentPriority.name}</Badge>}
                            <span>Last update: <ClientOnlyDateTime dateString={ticket.created_at} options={{ dateStyle: 'short', timeStyle: 'short' }} /></span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {!isLoadingData && !dataError && totalTickets !== null && totalTickets > itemsPerPage && (
                <div className="flex justify-center items-center space-x-2 sm:space-x-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoadingData}
                  >
                    Previous
                  </Button>
                  <span>Page {currentPage} of {Math.ceil(totalTickets / itemsPerPage)}</span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage * itemsPerPage >= totalTickets || isLoadingData}
                  >
                    Next
                  </Button>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      
      <Dialog open={ticketDetailsOpen} onOpenChange={setTicketDetailsOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col">
          {selectedTicketDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-10">{selectedTicketDetail.subject}</DialogTitle>
                <DialogDescription> 
                  Ticket #TICK-{String(selectedTicketDetail.id).padStart(5, '0')} 
                  {selectedTicketDetail.ticket_types?.name && ` • Type: ${selectedTicketDetail.ticket_types.name}`}
                  • Status: {selectedTicketDetail.ticket_statuses?.name || 'N/A'} 
                  • Priority: {selectedTicketDetail.ticket_priorities?.name || 'N/A'} 
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-1 -m-1 pr-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    <div className="md:col-span-2 space-y-4">
                        <Card> <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader> <CardContent className="text-sm whitespace-pre-wrap">{selectedTicketDetail.description}</CardContent> </Card>
                        
                        {/* Comments Section */}
                        <Card>
                            <CardHeader><CardTitle className="text-base">Activity & Comments</CardTitle></CardHeader>
                            <CardContent>
                                {isLoadingComments && <p className="text-sm text-muted-foreground">Loading comments...</p>}
                                {commentError && <p className="text-sm text-red-500">{commentError}</p>}
                                {!isLoadingComments && !commentError && comments.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                                )}
                                {!isLoadingComments && !commentError && comments.length > 0 && (
                                    <div className="space-y-4">
                                        {comments.filter(comment => !comment.is_internal_note || isAgent).map(comment => ( // Filter internal notes for non-agents
                                            <div key={comment.id} className={`flex items-start space-x-3 ${comment.is_internal_note ? 'p-2 bg-amber-50 border border-amber-200 rounded-md' : ''}`}>
                                                <Avatar className="h-8 w-8">
                                                <AvatarImage src={comment.profiles?.avatar_url ? getAvatarPublicUrl(comment.profiles.avatar_url) || undefined : undefined} alt={comment.profiles?.full_name || 'User'} />
                                                    <AvatarFallback>{comment.profiles?.full_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-sm font-medium flex items-center"> {/* Changed p to div */}
                                                            <span>{comment.profiles?.full_name || 'Anonymous User'}</span>
                                                            {comment.profiles?.role === 'agent' && <Badge variant="outline" className="ml-1 text-xs">Agent</Badge>}
                                                            {comment.is_internal_note && (isAgent || isAdmin) && <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-700">Internal Note</Badge>}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            <ClientOnlyDateTime dateString={comment.created_at} options={{ dateStyle: 'short', timeStyle: 'short' }} />
                                                        </p>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{comment.comment_text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-6">
                                    <Textarea
                                        placeholder="Add a comment..."
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        rows={3}
                                        className="mb-2"
                                        disabled={isSubmittingComment || isProfileLoading}
                                    />
                                    <div className="flex items-center justify-between">
                                        <Button 
                                            onClick={handleCommentSubmit} 
                                            disabled={isSubmittingComment || !newCommentText.trim() || isProfileLoading}
                                        >
                                            {isSubmittingComment ? "Submitting..." : "Add Comment"}
                                        </Button>
                                        {(isAgent || isAdmin) && ( // Changed condition to include isAdmin
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="internal-note"
                                                    checked={isInternalNote}
                                                    onCheckedChange={(checked) => setIsInternalNote(checked as boolean)}
                                                    disabled={isSubmittingComment || isProfileLoading}
                                                />
                                                <Label htmlFor="internal-note" className="text-sm font-medium text-muted-foreground">
                                                    Internal Note (Visible to agents only)
                                                </Label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="md:col-span-1 space-y-4">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Requester Details</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <p><strong>Name:</strong> {selectedTicketDetail.profiles?.full_name || 'N/A'}</p>
                                <p><strong>Created:</strong> <ClientOnlyDateTime dateString={selectedTicketDetail.created_at} options={{dateStyle: 'medium', timeStyle: 'short'}}/></p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle className="text-base">Ticket Properties</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div>
                                    <Label className="text-xs">Status</Label>
                                    <Select
                                        value={statuses.find(s => s.id === selectedTicketDetail.status_id)?.name}
                                        onValueChange={(newStatusName) => handleStatusChange(selectedTicketDetail.id, newStatusName)}
                                        disabled={!(isAgent || isAdmin) || isUpdatingTicket || isProfileLoading}
                                    >
                                        <SelectTrigger disabled={!(isAgent || isAdmin) || isUpdatingTicket || isProfileLoading}>
                                            <SelectValue placeholder="Select status..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {statuses.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(isAgent || isAdmin) && ( // Priority dropdown for agents and admins
                                <div className="mt-2">
                                    <Label className="text-xs">Priority</Label>
                                    <Select
                                        value={selectedTicketDetail.priority_id ? String(selectedTicketDetail.priority_id) : ""}
                                        onValueChange={(priorityId) => handlePriorityChange(selectedTicketDetail.id, parseInt(priorityId, 10))}
                                        disabled={!(isAgent || isAdmin) || isUpdatingPriority || isProfileLoading}
                                    >
                                        <SelectTrigger disabled={!(isAgent || isAdmin) || isUpdatingPriority || isProfileLoading}>
                                            <SelectValue placeholder="Select priority..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {priorities.map(p => (
                                                <SelectItem key={p.id} value={String(p.id)}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                )}
                                {(isAgent || isAdmin) && (
                                <div className="mt-2">
                                    <Label className="text-xs">Assignee</Label>
                                    <Select
                                        value={selectedAgentId || ""}
                                        onValueChange={(agentId) => handleAssignTicket(selectedTicketDetail.id, agentId === "unassigned" ? null : agentId)}
                                        disabled={!(isAgent || isAdmin) || isAssigningTicket || isProfileLoading || isLoadingCompatibleAgents}
                                    >
                                        <SelectTrigger disabled={!(isAgent || isAdmin) || isAssigningTicket || isProfileLoading || isLoadingCompatibleAgents}>
                                            <SelectValue placeholder={isLoadingCompatibleAgents ? "Loading agents..." : "Select agent..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {(compatibleAgents.length > 0 ? compatibleAgents : agents).map(agent => (
                                                <SelectItem key={agent.id} value={agent.id}>
                                                    {agent.full_name || `Agent ID: ${agent.id.substring(0, 6)}...`}
                                                    {agent.specializations?.name && <span className="text-xs text-muted-foreground ml-1">({agent.specializations.name})</span>}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedTicketDetail.assignee_profile && (
                                        <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                            <Avatar className="h-5 w-5 mr-1.5">
                                                <AvatarImage src={selectedTicketDetail.assignee_profile.avatar_url ? getAvatarPublicUrl(selectedTicketDetail.assignee_profile.avatar_url) || undefined : undefined} />
                                                <AvatarFallback>{selectedTicketDetail.assignee_profile.full_name?.[0]?.toUpperCase() || 'A'}</AvatarFallback>
                                            </Avatar>
                                            Assigned to: {selectedTicketDetail.assignee_profile.full_name || 'N/A'}
                                            {selectedTicketDetail.assignee_profile.specializations?.name && 
                                              <span className="text-xs text-muted-foreground ml-1">({selectedTicketDetail.assignee_profile.specializations.name})</span>
                                            }
                                        </div>
                                    )}
                                </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
              </div>
              <DialogFooter className="mt-auto pt-4 border-t">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={!(isAgent || isAdmin) || isUpdatingTicket || isProfileLoading}>{(isAgent || isAdmin) && "Delete Ticket"}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete ticket
                            #TICK-{String(selectedTicketDetail.id).padStart(5, '0')} and all associated data.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isUpdatingTicket}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleDeleteTicket(selectedTicketDetail.id)}
                            disabled={isUpdatingTicket}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isUpdatingTicket ? "Deleting..." : "Yes, delete ticket"}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={() => setTicketDetailsOpen(false)} disabled={isUpdatingTicket}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}



interface NewTicketFormProps {
  onSubmit: (data: { subject: string; description: string; priorityId: string; ticketTypeId: string; requesterId?: string }) => Promise<void>;
  priorities: PriorityOption[];
  ticketTypes: TicketType[];
  isSubmittingProfileUpdate?: boolean;
}

const NewTicketForm: React.FC<NewTicketFormProps> = ({ onSubmit, priorities, ticketTypes, isSubmittingProfileUpdate }) => {
  const { user, isAgent } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState<string>(() => {
    const normal = priorities.find(p => p.name.toLowerCase() === 'normal');
    return normal ? String(normal.id) : (priorities.length > 0 ? String(priorities[0].id) : '');
  });
  const [ticketTypeId, setTicketTypeId] = useState<string>(ticketTypes.length > 0 ? String(ticketTypes[0].id) : '');
  const [requesterId, setRequesterId] = useState<string>('');
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast: showToast } = useToast();

  // Fetch customers if user is an agent
  useEffect(() => {
    if (isAgent) {
      const loadCustomers = async () => {
        try {
          const fetchedCustomers = await fetchCustomers();
          setCustomers(fetchedCustomers);
        } catch (error) {
          console.error('Failed to load customers:', error);
          showToast({ 
            title: "Error", 
            description: "Failed to load customers list.", 
            variant: "destructive" 
          });
        }
      };
      loadCustomers();
    }
  }, [isAgent, showToast]);

  useEffect(() => {
    if (!priorityId && priorities.length > 0) {
      const normal = priorities.find(p => p.name.toLowerCase() === 'normal');
      setPriorityId(normal ? String(normal.id) : String(priorities[0].id));
    }
    if (!ticketTypeId && ticketTypes.length > 0) {
      setTicketTypeId(String(ticketTypes[0].id));
    }
    // Set default requesterId to current user if not an agent
    if (!isAgent && user) {
      setRequesterId(user.id);
    }
  }, [priorities, priorityId, ticketTypes, ticketTypeId, isAgent, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priorityId) {
      showToast({ title: "Missing Field", description: "Please select a priority.", variant: "destructive"});
      return;
    }
    if (!ticketTypeId) {
      showToast({ title: "Missing Field", description: "Please select a ticket type.", variant: "destructive"});
      return;
    }
    if (isAgent && !requesterId) {
      showToast({ title: "Missing Field", description: "Please select a requester.", variant: "destructive"});
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ 
        subject, 
        description, 
        priorityId, 
        ticketTypeId,
        requesterId: isAgent ? requesterId : user?.id
      });
    } catch (error: any) {
      console.error('Failed to submit ticket:', error);
      showToast({ 
        title: "Error", 
        description: error.message || "Failed to create ticket. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="form-subject">Subject</Label>
        <Input 
          id="form-subject" 
          value={subject} 
          onChange={(e) => setSubject(e.target.value)} 
          required 
          disabled={isSubmitting || isSubmittingProfileUpdate} 
        />
      </div>

      {isAgent && (
        <div className="grid gap-2">
          <Label htmlFor="form-requester">Requester</Label>
          <Select 
            value={requesterId} 
            onValueChange={setRequesterId} 
            required 
            disabled={isSubmitting || customers.length === 0 || isSubmittingProfileUpdate}
          >
            <SelectTrigger id="form-requester">
              <SelectValue placeholder="Select requester..." />
            </SelectTrigger>
            <SelectContent>
              {customers.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.full_name || customer.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="form-priority">Priority</Label>
          <Select 
            value={priorityId} 
            onValueChange={setPriorityId} 
            required 
            disabled={isSubmitting || priorities.length === 0 || isSubmittingProfileUpdate}
          >
            <SelectTrigger id="form-priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {priorities.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="form-ticket-type">Ticket Type</Label>
          <Select 
            value={ticketTypeId} 
            onValueChange={setTicketTypeId} 
            required 
            disabled={isSubmitting || ticketTypes.length === 0 || isSubmittingProfileUpdate}
          >
            <SelectTrigger id="form-ticket-type">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {ticketTypes.map(tt => (
                <SelectItem key={tt.id} value={String(tt.id)}>{tt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="form-description">Description</Label>
        <Textarea 
          id="form-description" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          required 
          rows={5} 
          disabled={isSubmitting || isSubmittingProfileUpdate} 
        />
      </div>

      <DialogFooter>
        <Button 
          type="submit" 
          disabled={isSubmitting || !priorityId || !ticketTypeId || (isAgent && !requesterId) || isSubmittingProfileUpdate}
        >
          {isSubmitting ? "Submitting..." : "Create Ticket"}
        </Button>
      </DialogFooter>
    </form>
  );
};
