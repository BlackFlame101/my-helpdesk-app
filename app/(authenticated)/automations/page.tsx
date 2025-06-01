"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Clock, Zap, Settings2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

// Types for automations
interface Automation {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    trigger: {
        type: string;
        conditions: AutomationCondition[];
    };
    actions: AutomationAction[];
    createdAt: string;
    lastRun?: string;
}

interface AutomationCondition {
    field: string;
    operator: string;
    value: string;
}

interface AutomationAction {
    type: string;
    settings: Record<string, any>;
}

// Sample data - In production, this would come from your backend
const sampleAutomations: Automation[] = [
    {
        id: '1',
        name: 'Auto-assign IT Tickets',
        description: 'Automatically assign IT-related tickets to available IT department agents',
        isActive: true,
        trigger: {
            type: 'ticket_created',
            conditions: [
                { field: 'type', operator: 'equals', value: 'IT Support' }
            ]
        },
        actions: [
            { type: 'assign_to_department', settings: { department: 'IT' } }
        ],
        createdAt: '2024-01-01T00:00:00Z',
        lastRun: '2024-02-20T15:30:00Z'
    },
    {
        id: '2',
        name: 'Urgent Ticket Escalation',
        description: 'Escalate high-priority tickets if not responded to within 1 hour',
        isActive: true,
        trigger: {
            type: 'time_based',
            conditions: [
                { field: 'priority', operator: 'equals', value: 'high' },
                { field: 'response_time', operator: 'greater_than', value: '1h' }
            ]
        },
        actions: [
            { type: 'escalate_priority', settings: { level: 'urgent' } },
            { type: 'notify_manager', settings: { channel: 'email' } }
        ],
        createdAt: '2024-01-15T00:00:00Z',
        lastRun: '2024-02-20T14:45:00Z'
    }
];

export default function AutomationsPage() {
    const { user, isAdmin, isAgent, loading: authLoading } = useAuth();
    const router = useRouter();
    const [automations, setAutomations] = useState<Automation[]>(sampleAutomations);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState('all');

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else if (!isAdmin && !isAgent) {
                router.push('/dashboard');
                toast.error("Only administrators and agents can access the automations page.");
            } else {
                // In production, fetch automations from your backend
                setIsLoading(false);
            }
        }
    }, [user, isAdmin, isAgent, authLoading, router]);

    const handleToggleAutomation = (automationId: string) => {
        if (!isAdmin) {
            toast.error("Only administrators can modify automations.");
            return;
        }
        setAutomations(prevAutomations =>
            prevAutomations.map(automation =>
                automation.id === automationId
                    ? { ...automation, isActive: !automation.isActive }
                    : automation
            )
        );
        toast.success("Automation status updated");
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading...</p>
            </div>
        );
    }

    if (!user || (!isAdmin && !isAgent)) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Automations</h1>
                    <p className="text-muted-foreground mt-1">
                        {isAdmin 
                            ? "Create and manage automated workflows for your help desk"
                            : "View automated workflows for your help desk"
                        }
                    </p>
                </div>
                {isAdmin && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Automation
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Create New Automation</DialogTitle>
                                <DialogDescription>
                                    Set up a new automated workflow for your tickets
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" placeholder="Enter automation name" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input id="description" placeholder="Describe what this automation does" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Trigger Type</Label>
                                    <Select>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select trigger type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ticket_created">Ticket Created</SelectItem>
                                            <SelectItem value="ticket_updated">Ticket Updated</SelectItem>
                                            <SelectItem value="time_based">Time-based</SelectItem>
                                            <SelectItem value="status_changed">Status Changed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Create Automation</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Tabs defaultValue="all" className="space-y-4" value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList>
                    <TabsTrigger value="all">All Automations</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="inactive">Inactive</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {automations.map((automation) => (
                            <AutomationCard
                                key={automation.id}
                                automation={automation}
                                onToggle={handleToggleAutomation}
                            />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="active" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {automations
                            .filter(a => a.isActive)
                            .map((automation) => (
                                <AutomationCard
                                    key={automation.id}
                                    automation={automation}
                                    onToggle={handleToggleAutomation}
                                />
                            ))}
                    </div>
                </TabsContent>

                <TabsContent value="inactive" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {automations
                            .filter(a => !a.isActive)
                            .map((automation) => (
                                <AutomationCard
                                    key={automation.id}
                                    automation={automation}
                                    onToggle={handleToggleAutomation}
                                />
                            ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

interface AutomationCardProps {
    automation: Automation;
    onToggle: (id: string) => void;
}

function AutomationCard({ automation, onToggle }: AutomationCardProps) {
    const { isAdmin } = useAuth();
    
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">{automation.name}</CardTitle>
                        <CardDescription>{automation.description}</CardDescription>
                    </div>
                    {isAdmin ? (
                        <Switch
                            checked={automation.isActive}
                            onCheckedChange={() => onToggle(automation.id)}
                        />
                    ) : (
                        <Badge variant={automation.isActive ? "success" : "secondary"}>
                            {automation.isActive ? "Active" : "Inactive"}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-sm">
                        <Zap className="h-4 w-4" />
                        <span>Trigger: {automation.trigger.type.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                        <Settings2 className="h-4 w-4" />
                        <span>{automation.actions.length} action(s)</span>
                    </div>
                    {automation.lastRun && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Last run: {new Date(automation.lastRun).toLocaleDateString()}</span>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {automation.trigger.conditions.map((condition, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                                {condition.field} {condition.operator} {condition.value}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 