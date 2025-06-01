"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    fetchTicketsForUser,
    fetchTicketTypes,
    fetchTicketPriorities,
    fetchTicketStatuses,
    fetchCustomers,
    createTicket,
    Ticket,
    TicketType,
    PriorityOption,
    StatusOption,
    NewTicketData,
    UserProfile
} from '@/lib/dataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from "@/components/ui/textarea";

export default function TicketsPage() {
    const { user, isAgent, loading: authLoading } = useAuth();
    const router = useRouter();

    // State for tickets and loading
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // State for new ticket form
    const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({
        subject: '',
        description: '',
        priority_id: '',
        status_id: '',
        ticket_type_id: '',
        requester_id: '',
    });

    // State for dropdown options
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [ticketPriorities, setTicketPriorities] = useState<PriorityOption[]>([]);
    const [ticketStatuses, setTicketStatuses] = useState<StatusOption[]>([]);
    const [customers, setCustomers] = useState<UserProfile[]>([]);

    // Load tickets
    const loadTickets = useCallback(async () => {
        if (!user) {
            router.push('/login');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        try {
            const { tickets: fetchedTickets } = await fetchTicketsForUser(100, 0);
            setTickets(fetchedTickets);
        } catch (err: any) {
            console.error("Failed to load tickets:", err);
            setError(err.message || "Could not fetch tickets.");
            if (err.message?.includes('Not authenticated')) {
                router.push('/login');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, router]);

    // Load dropdown options
    const loadDropdownOptions = useCallback(async () => {
        if (!user) return;
        
        try {
            const [types, priorities, statuses, customersList] = await Promise.all([
                fetchTicketTypes(),
                fetchTicketPriorities(),
                fetchTicketStatuses(),
                isAgent ? fetchCustomers() : Promise.resolve([]),
            ]);
            setTicketTypes(types);
            setTicketPriorities(priorities);
            setTicketStatuses(statuses);
            if (customersList) {
                setCustomers(customersList);
            }
        } catch (err: any) {
            console.error("Failed to load dropdown options:", err);
            toast.error("Failed to load some options. Please refresh the page.");
            if (err.message?.includes('Not authenticated')) {
                router.push('/login');
            }
        }
    }, [user, isAgent, router]);

    // Handle ticket creation
    const handleCreateTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("You must be logged in to create a ticket.");
            router.push('/login');
            return;
        }

        setIsLoading(true);
        try {
            const ticketPayload: NewTicketData = {
                ...newTicket,
                requester_id: isAgent ? newTicket.requester_id : user.id,
                priority_id: Number(newTicket.priority_id),
                status_id: Number(newTicket.status_id),
                ticket_type_id: Number(newTicket.ticket_type_id),
            };
            
            await createTicket(ticketPayload);
            await loadTickets();
            setIsNewTicketDialogOpen(false);
            setNewTicket({
                subject: '',
                description: '',
                priority_id: '',
                status_id: '',
                ticket_type_id: '',
                requester_id: '',
            });
            toast.success("Ticket created successfully!");
        } catch (err: any) {
            console.error("Failed to create ticket:", err);
            toast.error(err.message || "Failed to create ticket.");
            if (err.message?.includes('Not authenticated')) {
                router.push('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Filter tickets
    const filteredTickets = tickets.filter(ticket => {
        const matchesStatus = statusFilter === 'all' || String(ticket.status_id) === statusFilter;
        const matchesPriority = priorityFilter === 'all' || String(ticket.priority_id) === priorityFilter;
        const matchesType = typeFilter === 'all' || String(ticket.ticket_type_id) === typeFilter;
        return matchesStatus && matchesPriority && matchesType;
    });

    // Initial load
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else {
                loadTickets();
                loadDropdownOptions();
            }
        }
    }, [authLoading, user, router, loadTickets, loadDropdownOptions]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading...</p>
        </div>;
    }

    if (!user) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Tickets</h1>
                <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Create New Ticket</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create New Ticket</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="subject">Subject</Label>
                                <Input
                                    id="subject"
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                    required
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                    required
                                />
                            </div>

                            {isAgent && (
                                <div className="space-y-2">
                                    <Label htmlFor="requester">Requester</Label>
                                    <Select
                                        value={newTicket.requester_id}
                                        onValueChange={(value) => setNewTicket({ ...newTicket, requester_id: value })}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select requester" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.map((customer) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    {customer.full_name || 'Unnamed User'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    value={String(newTicket.ticket_type_id)}
                                    onValueChange={(value) => setNewTicket({ ...newTicket, ticket_type_id: value })}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ticketTypes.map((type) => (
                                            <SelectItem key={type.id} value={String(type.id)}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select
                                    value={String(newTicket.priority_id)}
                                    onValueChange={(value) => setNewTicket({ ...newTicket, priority_id: value })}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ticketPriorities.map((priority) => (
                                            <SelectItem key={priority.id} value={String(priority.id)}>
                                                {priority.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={String(newTicket.status_id)}
                                    onValueChange={(value) => setNewTicket({ ...newTicket, status_id: value })}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ticketStatuses.map((status) => (
                                            <SelectItem key={status.id} value={String(status.id)}>
                                                {status.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Ticket'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tickets List</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {ticketStatuses.map((status) => (
                                    <SelectItem key={status.id} value={String(status.id)}>
                                        {status.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                {ticketPriorities.map((priority) => (
                                    <SelectItem key={priority.id} value={String(priority.id)}>
                                        {priority.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {ticketTypes.map((type) => (
                                    <SelectItem key={type.id} value={String(type.id)}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tickets Table */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="ml-2">Loading tickets...</p>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-red-500">Error: {error}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Requester</TableHead>
                                        <TableHead>Assignee</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Updated</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTickets.map((ticket) => (
                                        <TableRow
                                            key={ticket.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                                        >
                                            <TableCell>{ticket.subject}</TableCell>
                                            <TableCell>
                                                {ticket.ticket_statuses ? (
                                                    <Badge
                                                        variant={
                                                            ticket.ticket_statuses.name.toLowerCase() === 'open' ? 'info' :
                                                            ticket.ticket_statuses.name.toLowerCase() === 'in progress' ? 'pending' :
                                                            ticket.ticket_statuses.name.toLowerCase() === 'resolved' ? 'success' :
                                                            ticket.ticket_statuses.name.toLowerCase() === 'closed' ? 'closed' :
                                                            'secondary'
                                                        }
                                                    >
                                                        {ticket.ticket_statuses.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary">
                                                        {ticketStatuses.find(s => s.id === ticket.status_id)?.name || 'Unknown'}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {ticketPriorities.find(p => p.id === ticket.priority_id)?.name || 'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                {ticketTypes.find(t => t.id === ticket.ticket_type_id)?.name || 'Unknown'}
                                            </TableCell>
                                            <TableCell>{ticket.profiles?.full_name || 'Unknown'}</TableCell>
                                            <TableCell>{ticket.assignee_profile?.full_name || 'Unassigned'}</TableCell>
                                            <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell>{ticket.updated_at ? new Date(ticket.updated_at).toLocaleDateString() : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 