"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    fetchUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    Notification 
} from '@/lib/dataService'; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area"; 
import { toast, useToast } from "@/components/ui/use-toast";
import { BellRing, CheckCheck, MailWarning, MessageSquareText, UserCheck, Home } from "lucide-react"; // Added Home icon
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime'; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const getNotificationIcon = (type: string | null): React.ReactNode => {
    switch (type) {
        case 'new_comment':
            return <MessageSquareText className="h-5 w-5 text-blue-500" />;
        case 'ticket_assigned':
            return <UserCheck className="h-5 w-5 text-green-500" />;
        case 'status_change': 
            return <MailWarning className="h-5 w-5 text-orange-500" />;
        default:
            return <BellRing className="h-5 w-5 text-gray-500" />;
    }
};

export default function NotificationsPage() {
    const { user, session, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast: showToast } = useToast();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            
            const fetchedNotifications = await fetchUserNotifications(user.id, 50, false); 
            setNotifications(fetchedNotifications);
        } catch (err: any) {
            console.error("Failed to load notifications:", err);
            setError(err.message || "Could not fetch notifications.");
            showToast({ title: "Error", description: "Failed to load notifications.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        if (authLoading) return;
        if (!session || !user) {
            router.push('/login');
            return;
        }
        loadNotifications();
    }, [session, user, authLoading, router, loadNotifications]);

    const handleMarkAsRead = async (notificationId: number) => {
        try {
            const updatedNotification = await markNotificationAsRead(notificationId);
            if (updatedNotification) {
                setNotifications(prev =>
                    prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
                );
                showToast({ description: "Notification marked as read." });
            }
        } catch (err: any) {
            showToast({ title: "Error", description: "Failed to mark notification as read.", variant: "destructive" });
        }
    };

    const handleMarkAllRead = async () => {
        if (!user) return;
        try {
            const { success, count } = await markAllNotificationsAsRead(user.id);
            if (success) {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                showToast({ description: `${count || 0} notifications marked as read.` });
            }
        } catch (err: any) {
            showToast({ title: "Error", description: "Failed to mark all notifications as read.", variant: "destructive" });
        }
    };

    if (authLoading || (!session && !authLoading)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }
    
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="container mx-auto max-w-3xl py-8 px-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-6 group">
                <Home size={18} className="mr-2 group-hover:animate-pulse" /> Back to Dashboard
            </Button>
            <Card className="shadow-lg">
                <CardHeader className="border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-2xl font-semibold">Notifications</CardTitle>
                            <CardDescription>View and manage your recent notifications.</CardDescription>
                        </div>
                        {unreadCount > 0 && (
                             <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isLoading}>
                                <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read ({unreadCount})
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading && <p className="p-6 text-center text-muted-foreground">Loading notifications...</p>}
                    {error && <p className="p-6 text-center text-red-500">Error: {error}</p>}
                    {!isLoading && !error && notifications.length === 0 && (
                        <p className="p-6 text-center text-muted-foreground">You have no notifications yet.</p>
                    )}
                    {!isLoading && !error && notifications.length > 0 && (
                        <ScrollArea className="h-[calc(100vh-220px)]"> {}
                            <ul className="divide-y divide-border">
                                {notifications.map(notification => (
                                    <li
                                        key={notification.id}
                                        className={`p-4 hover:bg-muted/50 transition-colors ${notification.is_read ? 'opacity-70' : 'bg-primary/5 dark:bg-primary/10'}`}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <div className="flex-shrink-0 mt-1">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium text-foreground ${!notification.is_read ? 'font-semibold' : ''}`}>
                                                    {notification.message}
                                                </p>
                                                {notification.tickets?.subject && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Related Ticket: "{notification.tickets.subject}"
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    <ClientOnlyDateTime dateString={notification.created_at} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                                                </p>
                                            </div>
                                            {!notification.is_read && (
                                                <TooltipProvider delayDuration={100}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 flex-shrink-0"
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                            >
                                                                <CheckCheck className="h-4 w-4" />
                                                                <span className="sr-only">Mark as read</span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Mark as read</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    )}
                </CardContent>
                 {notifications.length > 0 && (
                    <CardFooter className="border-t p-4 flex justify-end">
                        <p className="text-xs text-muted-foreground">Showing up to 50 latest notifications.</p>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
