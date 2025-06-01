"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    // Import necessary data fetching functions from dataService
    fetchTicketCountsByStatus,
    fetchTicketCountsOverTime,
    fetchTicketVolumeBy,
    fetchAgentPerformance,
    fetchResolutionTimesBy,
    fetchCustomerTicketCounts,
    fetchOverallAverageResolutionTime,
} from '@/lib/dataService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import Table components
import { Button } from "@/components/ui/button"; // Import Button component
import { Loader2 } from 'lucide-react'; // Import Loader2 icon
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';


export default function ReportsPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState<Record<string, boolean>>({
        overview: true,
        'ticket-volume': false,
        'agent-performance': false,
        'resolution-time': false,
        'customer-reports': false
    });
    const [error, setError] = useState<string | null>(null);

    // State for fetched data
    const [overviewMetrics, setOverviewMetrics] = useState<{
        totalTickets: number | null;
        openTickets: number | null;
        closedTickets: number | null;
        pendingTickets: number | null;
        averageResolutionTime: string | null;
    } | null>(null);
    const [ticketsOverTimeData, setTicketsOverTimeData] = useState<{ time_period: string; count: number }[] | null>(null);

    // State for time series filtering
    const [timeSeriesInterval, setTimeSeriesInterval] = useState<'day' | 'week' | 'month'>('day');
    const [timeSeriesStartDate, setTimeSeriesStartDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [timeSeriesEndDate, setTimeSeriesEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Lazy loaded states
    const [ticketVolumeData, setTicketVolumeData] = useState<{
        byType: { dimension: string; count: number }[] | null;
        byStatus: { dimension: string; count: number }[] | null;
        byPriority: { dimension: string; count: number }[] | null;
        byAssignee: { dimension: string; count: number }[] | null;
    } | null>(null);
    const [agentPerformanceData, setAgentPerformanceData] = useState<{ agent: string; assigned: number; resolved: number; closed: number; average_resolution_time: string | null }[] | null>(null);
    const [resolutionTimeData, setResolutionTimeData] = useState<{
        byType: { dimension: string; average_resolution_time: string | null; average_resolution_minutes: number | null }[] | null;
        byPriority: { dimension: string; average_resolution_time: string | null; average_resolution_minutes: number | null }[] | null;
        byAgent: { dimension: string; average_resolution_time: string | null; average_resolution_minutes: number | null }[] | null;
    } | null>(null);
    const [customerTicketCounts, setCustomerTicketCounts] = useState<{ customer: string; ticket_count: number }[] | null>(null);

    // Load overview data
    const loadOverviewData = useCallback(async () => {
        setLoading(prev => ({ ...prev, overview: true }));
        setError(null);
        try {
            const [
                totalTickets,
                openTickets,
                closedTickets,
                pendingTickets,
                averageResolutionTime,
                ticketsOverTime
            ] = await Promise.all([
                fetchTicketCountsByStatus(),
                fetchTicketCountsByStatus('Open'),
                fetchTicketCountsByStatus('Closed'),
                fetchTicketCountsByStatus('Pending'),
                fetchOverallAverageResolutionTime(),
                fetchTicketCountsOverTime(
                    timeSeriesInterval,
                    new Date(timeSeriesStartDate).toISOString(),
                    new Date(timeSeriesEndDate).toISOString()
                )
            ]);

            setOverviewMetrics({
                totalTickets,
                openTickets,
                closedTickets,
                pendingTickets,
                averageResolutionTime,
            });
            setTicketsOverTimeData(ticketsOverTime);
        } catch (err: any) {
            console.error("Failed to load overview data:", err);
            setError(err.message || "Could not fetch overview data.");
        } finally {
            setLoading(prev => ({ ...prev, overview: false }));
        }
    }, [timeSeriesInterval, timeSeriesStartDate, timeSeriesEndDate]);

    // Load ticket volume data
    const loadTicketVolumeData = useCallback(async () => {
        if (ticketVolumeData) return; // Already loaded
        setLoading(prev => ({ ...prev, 'ticket-volume': true }));
        try {
            const [byType, byStatus, byPriority, byAssignee] = await Promise.all([
                fetchTicketVolumeBy('type'),
                fetchTicketVolumeBy('status'),
                fetchTicketVolumeBy('priority'),
                fetchTicketVolumeBy('assignee')
            ]);
            setTicketVolumeData({ byType, byStatus, byPriority, byAssignee });
        } catch (err: any) {
            console.error("Failed to load ticket volume data:", err);
            setError(err.message || "Could not fetch ticket volume data.");
        } finally {
            setLoading(prev => ({ ...prev, 'ticket-volume': false }));
        }
    }, [ticketVolumeData]);

    // Load agent performance data
    const loadAgentPerformanceData = useCallback(async () => {
        if (agentPerformanceData) return; // Already loaded
        setLoading(prev => ({ ...prev, 'agent-performance': true }));
        try {
            const data = await fetchAgentPerformance();
            setAgentPerformanceData(data);
        } catch (err: any) {
            console.error("Failed to load agent performance data:", err);
            setError(err.message || "Could not fetch agent performance data.");
        } finally {
            setLoading(prev => ({ ...prev, 'agent-performance': false }));
        }
    }, [agentPerformanceData]);

    // Load resolution time data
    const loadResolutionTimeData = useCallback(async () => {
        if (resolutionTimeData) return; // Already loaded
        setLoading(prev => ({ ...prev, 'resolution-time': true }));
        try {
            const [byType, byPriority, byAgent] = await Promise.all([
                fetchResolutionTimesBy('type'),
                fetchResolutionTimesBy('priority'),
                fetchResolutionTimesBy('agent')
            ]);
            setResolutionTimeData({ byType, byPriority, byAgent });
        } catch (err: any) {
            console.error("Failed to load resolution time data:", err);
            setError(err.message || "Could not fetch resolution time data.");
        } finally {
            setLoading(prev => ({ ...prev, 'resolution-time': false }));
        }
    }, [resolutionTimeData]);

    // Load customer data
    const loadCustomerData = useCallback(async () => {
        if (customerTicketCounts) return; // Already loaded
        setLoading(prev => ({ ...prev, 'customer-reports': true }));
        try {
            const data = await fetchCustomerTicketCounts();
            setCustomerTicketCounts(data);
        } catch (err: any) {
            console.error("Failed to load customer data:", err);
            setError(err.message || "Could not fetch customer data.");
        } finally {
            setLoading(prev => ({ ...prev, 'customer-reports': false }));
        }
    }, [customerTicketCounts]);

    // Handle tab changes
    const handleTabChange = useCallback((tab: string) => {
        setActiveTab(tab);
        switch (tab) {
            case 'overview':
                loadOverviewData();
                break;
            case 'ticket-volume':
                loadTicketVolumeData();
                break;
            case 'agent-performance':
                loadAgentPerformanceData();
                break;
            case 'resolution-time':
                loadResolutionTimeData();
                break;
            case 'customer-reports':
                loadCustomerData();
                break;
        }
    }, [loadOverviewData, loadTicketVolumeData, loadAgentPerformanceData, loadResolutionTimeData, loadCustomerData]);

    // Initial load
    useEffect(() => {
        if (!authLoading) {
            loadOverviewData(); // Only load overview data initially
        }
    }, [authLoading, loadOverviewData]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading...</p>
        </div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Reports</h1>
            </div>
            
            <div className="flex flex-col gap-6">
                <Tabs defaultValue="overview" onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="ticket-volume">Ticket Volume</TabsTrigger>
                        <TabsTrigger value="agent-performance">Agent Performance</TabsTrigger>
                        <TabsTrigger value="resolution-time">Resolution Time</TabsTrigger>
                        <TabsTrigger value="customer-reports">Customer Reports</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab Content */}
                    <TabsContent value="overview">
                        {loading['overview'] ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="ml-2">Loading data...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-red-500">Error: {error}</p>
                            </div>
                        ) : (
                            <>
                                {/* Overview Metrics Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                                            {/* Icon placeholder */}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overviewMetrics?.totalTickets ?? 'N/A'}</div>
                                            {/* Optional: Add a trend indicator here */}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                                            {/* Icon placeholder */}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overviewMetrics?.openTickets ?? 'N/A'}</div>
                                        </CardContent>
                                    </Card>
                                     <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Pending Tickets</CardTitle>
                                            {/* Icon placeholder */}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overviewMetrics?.pendingTickets ?? 'N/A'}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Closed Tickets</CardTitle>
                                            {/* Icon placeholder */}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overviewMetrics?.closedTickets ?? 'N/A'}</div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Average Resolution Time</CardTitle>
                                            {/* Icon placeholder */}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overviewMetrics?.averageResolutionTime ?? 'N/A'}</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Tickets Created Over Time Graph */}
                                <Card>
                                    <CardHeader><CardTitle>Tickets Created Over Time (Last 30 Days)</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
                                            {/* Date Range Selectors */}
                                            <div className="flex items-center gap-2">
                                                <label htmlFor="startDate" className="text-sm font-medium">Start Date:</label>
                                                <input
                                                    type="date"
                                                    id="startDate"
                                                    value={timeSeriesStartDate}
                                                    onChange={(e) => setTimeSeriesStartDate(e.target.value)}
                                                    className="border rounded-md p-1 text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label htmlFor="endDate" className="text-sm font-medium">End Date:</label>
                                                <input
                                                    type="date"
                                                    id="endDate"
                                                    value={timeSeriesEndDate}
                                                    onChange={(e) => setTimeSeriesEndDate(e.target.value)}
                                                    className="border rounded-md p-1 text-sm"
                                                />
                                            </div>
                                            {/* Interval Selector */}
                                            <div className="flex items-center gap-2">
                                                <label htmlFor="interval" className="text-sm font-medium">Interval:</label>
                                                <select
                                                    id="interval"
                                                    value={timeSeriesInterval}
                                                    onChange={(e) => setTimeSeriesInterval(e.target.value as 'day' | 'week' | 'month')}
                                                    className="border rounded-md p-1 text-sm"
                                                >
                                                    <option value="day">Day</option>
                                                    <option value="week">Week</option>
                                                    <option value="month">Month</option>
                                                </select>
                                            </div>
                                            {/* Apply Filters Button */}
                                            <button
                                                onClick={() => handleTabChange('overview')} // Re-fetch overview data on button click
                                                className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50"
                                                disabled={loading['overview']}
                                            >
                                                Apply Filters
                                            </button>
                                        </div>

                                        {ticketsOverTimeData && ticketsOverTimeData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart
                                                    data={ticketsOverTimeData}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="time_period" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for the selected period and interval.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    {/* Ticket Volume Tab Content */}
                    <TabsContent value="ticket-volume">
                        {loading['ticket-volume'] ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="ml-2">Loading ticket volume data...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-red-500">Error: {error}</p>
                            </div>
                        ) : (
                            ticketVolumeData && (
                                <Card>
                                    <CardHeader><CardTitle>Ticket Volume Reports</CardTitle></CardHeader>
                                    <CardContent>
                                        <h4 className="text-lg font-semibold mb-4">Ticket Volume by Type</h4>
                                        {ticketVolumeData.byType && ticketVolumeData.byType.length > 0 ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        data={ticketVolumeData.byType}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="dimension" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="count" fill="#8884d8" />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                                
                                                <div className="mt-8">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Type</TableHead>
                                                                <TableHead className="text-right">Count</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {ticketVolumeData.byType.map((item) => (
                                                                <TableRow key={item.dimension}>
                                                                    <TableCell>{item.dimension}</TableCell>
                                                                    <TableCell className="text-right">{item.count}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for ticket volume by type.</p>
                                        )}

                                        <h4 className="text-lg font-semibold mt-8 mb-4">Ticket Volume by Status</h4>
                                        {ticketVolumeData.byStatus && ticketVolumeData.byStatus.length > 0 ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        data={ticketVolumeData.byStatus}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="dimension" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="count" fill="#82ca9d" />
                                                    </BarChart>
                                                </ResponsiveContainer>

                                                <div className="mt-8">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead className="text-right">Count</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {ticketVolumeData.byStatus.map((item) => (
                                                                <TableRow key={item.dimension}>
                                                                    <TableCell>{item.dimension}</TableCell>
                                                                    <TableCell className="text-right">{item.count}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for ticket volume by status.</p>
                                        )}

                                        <h4 className="text-lg font-semibold mt-8 mb-4">Ticket Volume by Priority</h4>
                                         {ticketVolumeData.byPriority && ticketVolumeData.byPriority.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={ticketVolumeData.byPriority}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="dimension" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="count" fill="#ffc658" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for ticket volume by priority.</p>
                                        )}

                                        <h4 className="text-lg font-semibold mt-8 mb-4">Ticket Volume by Assignee</h4>
                                         {ticketVolumeData.byAssignee && ticketVolumeData.byAssignee.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={ticketVolumeData.byAssignee}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="dimension" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="count" fill="#ff8042" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for ticket volume by assignee.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        )}
                    </TabsContent>

                    {/* Agent Performance Tab Content */}
                    <TabsContent value="agent-performance">
                        {loading['agent-performance'] ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="ml-2">Loading agent performance data...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-red-500">Error: {error}</p>
                            </div>
                        ) : (
                            agentPerformanceData && (
                                <Card>
                                    <CardHeader><CardTitle>Agent Performance Reports</CardTitle></CardHeader>
                                    <CardContent>
                                         {agentPerformanceData.length > 0 ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        data={agentPerformanceData}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="agent" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="assigned" fill="#8884d8" name="Assigned" />
                                                        <Bar dataKey="resolved" fill="#82ca9d" name="Resolved" />
                                                        <Bar dataKey="closed" fill="#ffc658" name="Closed" />
                                                    </BarChart>
                                                </ResponsiveContainer>

                                                <div className="mt-8">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Agent</TableHead>
                                                                <TableHead className="text-right">Assigned</TableHead>
                                                                <TableHead className="text-right">Resolved</TableHead>
                                                                <TableHead className="text-right">Closed</TableHead>
                                                                <TableHead className="text-right">Avg. Resolution Time</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {agentPerformanceData.map((item) => (
                                                                <TableRow key={item.agent}>
                                                                    <TableCell>{item.agent}</TableCell>
                                                                    <TableCell className="text-right">{item.assigned}</TableCell>
                                                                    <TableCell className="text-right">{item.resolved}</TableCell>
                                                                    <TableCell className="text-right">{item.closed}</TableCell>
                                                                    <TableCell className="text-right">{item.average_resolution_time || 'N/A'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for agent performance.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        )}
                    </TabsContent>

                    {/* Resolution Time Tab Content */}
                    <TabsContent value="resolution-time">
                        {loading['resolution-time'] ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="ml-2">Loading resolution time data...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-red-500">Error: {error}</p>
                            </div>
                        ) : (
                            resolutionTimeData && (
                                <Card>
                                    <CardHeader><CardTitle>Resolution Time Reports</CardTitle></CardHeader>
                                    <CardContent>
                                         <h4 className="text-lg font-semibold mb-4">Average Resolution Time by Type</h4>
                                         {resolutionTimeData.byType && resolutionTimeData.byType.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={resolutionTimeData.byType}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="dimension" />
                                                    <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip 
                                                        formatter={(value: any, name: string) => {
                                                            const item = resolutionTimeData.byType?.find(i => i.average_resolution_minutes === value);
                                                            return [item?.average_resolution_time || value, 'Resolution Time'];
                                                        }}
                                                    />
                                                    <Legend />
                                                    <Bar dataKey="average_resolution_minutes" fill="#8884d8" name="Avg. Resolution Time" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for average resolution time by type.</p>
                                        )}

                                        <h4 className="text-lg font-semibold mt-8 mb-4">Average Resolution Time by Priority</h4>
                                         {resolutionTimeData.byPriority && resolutionTimeData.byPriority.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={resolutionTimeData.byPriority}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="dimension" />
                                                    <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip 
                                                        formatter={(value: any, name: string) => {
                                                            const item = resolutionTimeData.byPriority?.find(i => i.average_resolution_minutes === value);
                                                            return [item?.average_resolution_time || value, 'Resolution Time'];
                                                        }}
                                                    />
                                                    <Legend />
                                                    <Bar dataKey="average_resolution_minutes" fill="#82ca9d" name="Avg. Resolution Time" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for average resolution time by priority.</p>
                                        )}

                                        <h4 className="text-lg font-semibold mt-8 mb-4">Average Resolution Time by Agent</h4>
                                         {resolutionTimeData.byAgent && resolutionTimeData.byAgent.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart
                                                    data={resolutionTimeData.byAgent}
                                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="dimension" />
                                                    <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip 
                                                        formatter={(value: any, name: string) => {
                                                            const item = resolutionTimeData.byAgent?.find(i => i.average_resolution_minutes === value);
                                                            return [item?.average_resolution_time || value, 'Resolution Time'];
                                                        }}
                                                    />
                                                    <Legend />
                                                    <Bar dataKey="average_resolution_minutes" fill="#ff8042" name="Avg. Resolution Time" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for average resolution time by agent.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        )}
                    </TabsContent>

                    {/* Customer Reports Tab Content */}
                    <TabsContent value="customer-reports">
                        {loading['customer-reports'] ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <p className="ml-2">Loading customer data...</p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-red-500">Error: {error}</p>
                            </div>
                        ) : (
                            customerTicketCounts && (
                                <Card>
                                    <CardHeader><CardTitle>Customer Reports</CardTitle></CardHeader>
                                    <CardContent>
                                         <h4 className="text-lg font-semibold mb-4">Customer Ticket Counts</h4>
                                         {customerTicketCounts.length > 0 ? (
                                            <>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        data={customerTicketCounts}
                                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="customer" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Legend />
                                                        <Bar dataKey="ticket_count" fill="#8884d8" name="Ticket Count" />
                                                    </BarChart>
                                                </ResponsiveContainer>

                                                <div className="mt-8">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Customer</TableHead>
                                                                <TableHead className="text-right">Ticket Count</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {customerTicketCounts.map((item) => (
                                                                <TableRow key={item.customer}>
                                                                    <TableCell>{item.customer}</TableCell>
                                                                    <TableCell className="text-right">{item.ticket_count}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">No data available for customer ticket counts.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
