"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ChatbotWindow from '../../components/chatbot/ChatbotWindow'; // Adjust path
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
    fetchCompatibleAgentsForTicketType // Added
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


      setTickets(prev => JSON.stringify(prev) !== JSON.stringify(ticketData.tickets) ? ticketData.tickets : prev);
      setTotalTickets(ticketData.count); // Set total count for pagination
      setPriorities(prev => JSON.stringify(prev) !== JSON.stringify(fetchedPriorities) ? fetchedPriorities : prev);
      setStatuses(prev => JSON.stringify(prev) !== JSON.stringify(fetchedStatuses) ? fetchedStatuses : prev);
      setAgents(prev => JSON.stringify(prev) !== JSON.stringify(fetchedAgents) ? fetchedAgents : prev);
      setTicketTypes(prev => JSON.stringify(prev) !== JSON.stringify(fetchedTicketTypes) ? fetchedTicketTypes : prev);

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
  }, [session, showToast, currentPage, itemsPerPage]); // Added currentPage and itemsPerPage

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

  const handleCreateTicketSubmit = async (formData: { subject: string; description: string; priorityId: string; ticketTypeId: string }) => { // Added ticketTypeId
    
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
      requester_id: user.id,
      status_id: openStatusId,
      ticket_type_id: parseInt(formData.ticketTypeId, 10), // Added
    };
    console.log("--- Creating Ticket (Agent Test) ---");
    console.log("Agent user from useAuth:", JSON.stringify(user, null, 2));
    console.log("Agent User ID being sent as requester_id:", user?.id);
    console.log("Full payload being sent by agent:", JSON.stringify(newTicketPayload, null, 2));

    try {
      const created = await createTicket(newTicketPayload);
      if (created) {
        setTickets(prev => [created, ...prev]);
        setNewTicketOpen(false);
        showToast({ title: "Success", description: `Ticket "${created.subject}" created.` });
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
    if (!isAgent) {
      showToast({ title: "Permission Denied", description: "Only agents can assign tickets.", variant: "destructive" });
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
    if (!isAgent) { // Assuming only agents can change priority, adjust if needed
        showToast({ title: "Permission Denied", description: "Only agents can change ticket priority.", variant: "destructive" });
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
    
    if (!isAgent) {
        showToast({ title: "Permission Denied", description: "Only agents can change ticket status.", variant: "destructive" });
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
        
        <div className="w-14 border-r bg-muted/40 flex flex-col items-center py-4 z-20">
          
          <div className="flex flex-col items-center gap-y-3 flex-1">
            {[
              { name: "dashboard", label: "Dashboard", icon: Home },
              { name: "tickets", label: "Tickets", icon: MessageSquare },
              { name: "reports", label: "Reports", icon: BarChart2 },
              { name: "users", label: "Users", icon: Users },
              { name: "automations", label: "Automations", icon: Zap },
              { name: "knowledge", label: "Knowledge Base", icon: Layers },
            ].map((item) => (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeNavItem === item.name ? "default" : "ghost"}
                    size="icon"
                    className={`rounded-lg w-10 h-10 ${activeNavItem === item.name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    onClick={() => handleNavClick(item.name)}
                  >
                    <item.icon size={20} />
                    <span className="sr-only">Navigation for {item.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          
          <div className="mt-auto flex flex-col items-center gap-y-3 mb-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg w-10 h-10 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => handleNavClick("settings")}>
                  <Settings size={20} />
                  <span className="sr-only">Settings</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-lg w-10 h-10 text-muted-foreground hover:bg-muted hover:text-foreground relative" 
                  onClick={() => router.push('/notifications')}
                >
                  <Bell size={20} />
                  {contextUnreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                      {contextUnreadCount > 9 ? '9+' : contextUnreadCount}
                    </Badge>
                  )}
                  <span className="sr-only">Notifications</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Notifications</TooltipContent>
            </Tooltip>
             <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg w-10 h-10">
                                <Avatar className="h-8 w-8" key={profile?.avatar_url || profile?.id}>
                                    <AvatarImage src={profile?.avatar_url ? getAvatarPublicUrl(profile.avatar_url) || undefined : undefined} alt={profile?.full_name || user?.email || 'User'} />
                                    <AvatarFallback>{profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">Profile</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" side="right" className="ml-2">
                    <DropdownMenuLabel>{profile?.full_name || user?.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/profile')}>
                        My Profile
                    </DropdownMenuItem>
                    {isAdmin && (
                        <DropdownMenuItem onClick={() => router.push('/admin/management')}>
                            Admin Management
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>Support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem
                        asChild 
                        onSelect={(e) => e.preventDefault()} 
                        className="p-0 focus:bg-transparent" 
                    >
                       <LogoutButton />
                    </DropdownMenuItem>
                    
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        
        <div className="flex-1 flex flex-col overflow-y-auto">
          
          <div className="flex flex-1 overflow-hidden">
            
            {!isMobile && (
              <div className="w-64 border-r bg-muted/20 p-4 flex flex-col gap-6 overflow-y-auto">
                
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

            
            <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 pb-20 w-full"> {/* Changed overflow-hidden to overflow-y-auto */}
              
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
                              {currentStatus && ( <Badge variant={currentStatus.name === 'Open' ? 'default' : currentStatus.name === 'Resolved' || currentStatus.name === 'Closed' ? 'outline' : 'secondary'} className="whitespace-nowrap capitalize"> {currentStatus.name} </Badge> )}
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
                                        <SelectTrigger disabled={!(isAgent || isAdmin) || isUpdatingTicket || isProfileLoading}><SelectValue placeholder="Select status..." /></SelectTrigger>
                                        <SelectContent>
                                            {statuses.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(isAgent || isAdmin) && ( // Priority dropdown for agents
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
    <ChatbotWindow /> {/* Add the chatbot window here */}
    </TooltipProvider>
  );
}



interface NewTicketFormProps {
  onSubmit: (data: { subject: string; description: string; priorityId: string; ticketTypeId: string }) => Promise<void>; // Added ticketTypeId
  priorities: PriorityOption[];
  ticketTypes: TicketType[]; // Added
  isSubmittingProfileUpdate?: boolean;
}

const NewTicketForm: React.FC<NewTicketFormProps> = ({ onSubmit, priorities, ticketTypes, isSubmittingProfileUpdate }) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState<string>(() => {
    const normal = priorities.find(p => p.name.toLowerCase() === 'normal');
    return normal ? String(normal.id) : (priorities.length > 0 ? String(priorities[0].id) : '');
  });
  const [ticketTypeId, setTicketTypeId] = useState<string>(ticketTypes.length > 0 ? String(ticketTypes[0].id) : ''); // Added
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast: showToast } = useToast(); // Use showToast from the hook

  useEffect(() => {
    if (!priorityId && priorities.length > 0) {
      const normal = priorities.find(p => p.name.toLowerCase() === 'normal');
      setPriorityId(normal ? String(normal.id) : String(priorities[0].id));
    }
    if (!ticketTypeId && ticketTypes.length > 0) { // Set default ticket type if not set and types are available
        setTicketTypeId(String(ticketTypes[0].id));
    }
  }, [priorities, priorityId, ticketTypes, ticketTypeId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priorityId) {
        showToast({ title: "Missing Field", description: "Please select a priority.", variant: "destructive"});
        return;
    }
    if (!ticketTypeId) { // Added check for ticketTypeId
        showToast({ title: "Missing Field", description: "Please select a ticket type.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    await onSubmit({ subject, description, priorityId, ticketTypeId }); // Added ticketTypeId
    setIsSubmitting(false);
    // Optionally reset form fields here if dialog doesn't auto-close or re-mount
    // setSubject(''); setDescription(''); setPriorityId(...); setTicketTypeId(...);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid gap-2"> 
        <Label htmlFor="form-subject">Subject</Label> 
        <Input id="form-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={isSubmitting || isSubmittingProfileUpdate} /> 
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2"> 
          <Label htmlFor="form-priority">Priority</Label> 
          <Select value={priorityId} onValueChange={setPriorityId} required disabled={isSubmitting || priorities.length === 0 || isSubmittingProfileUpdate}> 
            <SelectTrigger id="form-priority"><SelectValue placeholder="Select priority" /></SelectTrigger> 
            <SelectContent> {priorities.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)} </SelectContent> 
          </Select> 
        </div>
        <div className="grid gap-2"> {/* Added Ticket Type Select */}
          <Label htmlFor="form-ticket-type">Ticket Type</Label>
          <Select value={ticketTypeId} onValueChange={setTicketTypeId} required disabled={isSubmitting || ticketTypes.length === 0 || isSubmittingProfileUpdate}>
            <SelectTrigger id="form-ticket-type"><SelectValue placeholder="Select type..." /></SelectTrigger>
            <SelectContent>
              {ticketTypes.map(tt => <SelectItem key={tt.id} value={String(tt.id)}>{tt.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2"> 
        <Label htmlFor="form-description">Description</Label> 
        <Textarea id="form-description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} disabled={isSubmitting || isSubmittingProfileUpdate} /> 
      </div>
      <DialogFooter> 
        <Button type="submit" disabled={isSubmitting || !priorityId || !ticketTypeId || isSubmittingProfileUpdate}> 
          {isSubmitting ? "Submitting..." : "Create Ticket"} 
        </Button> 
      </DialogFooter>
    </form>
  );
};
