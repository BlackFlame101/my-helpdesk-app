"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Adjust path
import { useRouter } from 'next/navigation';
import { 
  createTicket, 
  fetchTicketPriorities, 
  fetchTicketTypes,
  PriorityOption,
  TicketType 
} from '@/lib/dataService'; // Adjust path
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast"; // Assuming you use shadcn/ui toast

// Define default status ID for 'Open' tickets.
// You should get this from your database or a config file in a real app.
const DEFAULT_OPEN_STATUS_ID = 1; // Example: Assuming 'Open' status has ID 1

export default function NewTicketPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState<string>('');
  const [ticketTypeId, setTicketTypeId] = useState<string>('');
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/login'); // Redirect if not logged in
    }
  }, [session, authLoading, router]);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;
    
    (async () => {
      try {
        const [fetchedPriorities, fetchedTypes] = await Promise.all([
          fetchTicketPriorities(),
          fetchTicketTypes()
        ]);

        // Only update state if component is still mounted
        if (mounted) {
          setPriorities(fetchedPriorities);
          setTicketTypes(fetchedTypes);

          // Set default values if available
          if (fetchedPriorities.length > 0) {
            const normalPriority = fetchedPriorities.find(p => p.name.toLowerCase() === 'normal');
            setPriorityId(normalPriority ? String(normalPriority.id) : String(fetchedPriorities[0].id));
          }
          if (fetchedTypes.length > 0) {
            setTicketTypeId(String(fetchedTypes[0].id));
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Failed to load form data:", err);
          toast({
            title: "Error",
            description: "Could not load form data.",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      mounted = false;
      ac.abort(); // Abort any pending requests
    };
  }, []); // Empty dependency array → run once on mount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create a ticket.");
      return;
    }
    if (!priorityId) {
      setError("Please select a priority.");
      toast({ title: "Missing Field", description: "Please select a priority.", variant: "destructive"});
      return;
    }
    if (!ticketTypeId) {
      setError("Please select a ticket type.");
      toast({ title: "Missing Field", description: "Please select a ticket type.", variant: "destructive"});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newTicketData = {
        subject,
        description,
        priority_id: parseInt(priorityId, 10),
        requester_id: user.id,
        status_id: DEFAULT_OPEN_STATUS_ID,
        ticket_type_id: parseInt(ticketTypeId, 10)
      };

      const created = await createTicket(newTicketData);
      
      if (created) {
        toast({
          title: "Ticket Created!",
          description: `Ticket #${created.id} "${created.subject}" has been successfully submitted.`,
        });
        router.push('/dashboard'); // Redirect to dashboard or ticket detail page
      } else {
        throw new Error("Ticket creation returned no data.");
      }
    } catch (err: any) {
      console.error("Ticket creation error:", err);
      setError(err.message || "Failed to create ticket. Please try again.");
      toast({
        title: "Creation Failed",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New Support Ticket</CardTitle>
          <CardDescription>Fill in the details below and we'll get back to you as soon as possible.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Issue with login"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={priorityId}
                  onValueChange={setPriorityId}
                  required
                  disabled={isLoading || priorities.length === 0}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-type">Ticket Type</Label>
                <Select
                  value={ticketTypeId}
                  onValueChange={setTicketTypeId}
                  required
                  disabled={isLoading || ticketTypes.length === 0}
                >
                  <SelectTrigger id="ticket-type">
                    <SelectValue placeholder="Select type..." />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your issue in detail..."
                required
                rows={6}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-stretch">
            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit Ticket'}
            </Button>
            <Button variant="outline" className="w-full mt-2" onClick={() => router.back()} disabled={isLoading}>
                Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
