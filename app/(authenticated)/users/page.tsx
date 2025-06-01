"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    fetchAllUsersWithProfiles,
    updateUserProfile,
    UserProfile,
    fetchSpecializations,
    Specialization
} from '@/lib/dataService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Loader2, Search, Edit, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarPublicUrl } from '@/lib/dataService';
import { Badge } from "@/components/ui/badge";

const NONE_SPECIALIZATION_VALUE = 'none';

export default function UsersPage() {
    const { user, profile, isAdmin, isAgent, loading: authLoading } = useAuth();
    const router = useRouter();

    // Add mounted ref
    const mountedRef = React.useRef(true);

    // State for users list and loading
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // State for specializations
    const [specializations, setSpecializations] = useState<Specialization[]>([]);

    // State for user editing
    const [showUserEditDialog, setShowUserEditDialog] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [selectedSpecializationId, setSelectedSpecializationId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load users and specializations
    const loadData = useCallback(async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        if (!mountedRef.current) return;
        setIsLoading(true);
        setError(null);

        try {
            const [fetchedUsers, fetchedSpecializations] = await Promise.all([
                fetchAllUsersWithProfiles(),
                fetchSpecializations()
            ]);

            if (!mountedRef.current) return;
            setUsers(fetchedUsers);
            setSpecializations(fetchedSpecializations);
        } catch (err: any) {
            console.error("Failed to load data:", err);
            if (!mountedRef.current) return;
            setError(err.message || "Could not fetch data");
            if (err.message?.includes('Not authenticated')) {
                router.push('/login');
            }
        } finally {
            if (!mountedRef.current) return;
            setIsLoading(false);
        }
    }, [user, router]);

    // Add cleanup effect
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Handle user edit dialog
    const handleOpenUserEditDialog = (userToEdit: UserProfile) => {
        setEditingUser(userToEdit);
        setSelectedRole(userToEdit.role || '');
        setSelectedSpecializationId(userToEdit.specialization_id ? String(userToEdit.specialization_id) : NONE_SPECIALIZATION_VALUE);
        setShowUserEditDialog(true);
    };

    // Handle user update
    const handleUserUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        setIsSubmitting(true);
        const updates: { role?: string; specialization_id?: number | null } = {};
        
        // Check what has changed
        let roleChanged = false;
        let specializationChanged = false;

        if (selectedRole !== editingUser.role) {
            updates.role = selectedRole;
            roleChanged = true;
            // Only clear specialization if changing FROM agent role TO another role
            if (editingUser.role === 'agent' && selectedRole !== 'agent' && editingUser.specialization_id !== null) {
                updates.specialization_id = null;
                specializationChanged = true;
            }
        }

        const currentSpecId = editingUser.specialization_id ? String(editingUser.specialization_id) : NONE_SPECIALIZATION_VALUE;
        if (selectedSpecializationId !== currentSpecId) {
            // Add validation for specialization ID parsing
            if (selectedSpecializationId === NONE_SPECIALIZATION_VALUE) {
                updates.specialization_id = null;
            } else {
                // Validate that the ID is a valid numeric string
                const isValidNumber = /^\d+$/.test(selectedSpecializationId);
                if (!isValidNumber) {
                    toast.error("Invalid specialization ID format");
                    setIsSubmitting(false);
                    return;
                }
                const parsedId = parseInt(selectedSpecializationId, 10);
                // Additional validation to ensure the ID exists in specializations
                if (specializations.some(spec => spec.id === parsedId)) {
                    updates.specialization_id = parsedId;
                } else {
                    toast.error("Selected specialization not found");
                    setIsSubmitting(false);
                    return;
                }
            }
            specializationChanged = true;
        }

        if (!roleChanged && !specializationChanged) {
            toast.info("No changes were made to the user.");
            setIsSubmitting(false);
            setShowUserEditDialog(false);
            return;
        }

        try {
            await updateUserProfile(editingUser.id, updates);
            toast.success("User profile updated successfully");
            setShowUserEditDialog(false);
            loadData(); // Reload the data
        } catch (err: any) {
            console.error("Failed to update user profile:", err);
            toast.error(err.message || "Failed to update user profile");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter users based on search query
    const filteredUsers = users.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        return (
            user.full_name?.toLowerCase().includes(searchLower) ||
            user.role?.toLowerCase().includes(searchLower) ||
            user.specializations?.name?.toLowerCase().includes(searchLower)
        );
    });

    // Initial load
    useEffect(() => {
        if (!authLoading) {
            loadData();
        }
    }, [authLoading, loadData]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Users</h1>
                {isAdmin && (
                    <Button onClick={() => router.push('/admin/management')}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Advanced Management
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                        {isAdmin ? "View and manage all users in the system." : "View user information and manage assigned agents."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Search Bar */}
                    <div className="flex items-center space-x-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Users Table */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="ml-2">Loading users...</p>
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
                                        <TableHead>User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Specialization</TableHead>
                                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((usr) => (
                                        <TableRow key={usr.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar>
                                                        <AvatarImage
                                                            src={usr.avatar_url ? getAvatarPublicUrl(usr.avatar_url) || undefined : undefined}
                                                            alt={usr.full_name || 'User'}
                                                        />
                                                        <AvatarFallback>
                                                            {usr.full_name?.[0]?.toUpperCase() || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{usr.full_name || "Unnamed User"}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {user?.id === usr.id ? user?.email : '••••••'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    usr.role === 'admin' ? 'admin' :
                                                    usr.role === 'agent' ? 'agent' :
                                                    'customer'
                                                }>
                                                    {usr.role || 'No Role'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {usr.role === 'agent' ? (
                                                    usr.specializations?.name || 'Not Assigned'
                                                ) : (
                                                    'N/A'
                                                )}
                                            </TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenUserEditDialog(usr)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={showUserEditDialog} onOpenChange={setShowUserEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User: {editingUser?.full_name || 'User'}</DialogTitle>
                    </DialogHeader>
                    {editingUser && (
                        <form onSubmit={handleUserUpdateSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="role" className="text-right">
                                        Role
                                    </Label>
                                    <Select
                                        value={selectedRole}
                                        onValueChange={setSelectedRole}
                                        disabled={!isAdmin}
                                    >
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="customer">Customer</SelectItem>
                                            <SelectItem value="agent">Agent</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedRole === 'agent' && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="specialization" className="text-right">
                                            Specialization
                                        </Label>
                                        <Select
                                            value={selectedSpecializationId}
                                            onValueChange={setSelectedSpecializationId}
                                        >
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue placeholder="Select specialization" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_SPECIALIZATION_VALUE}>
                                                    None
                                                </SelectItem>
                                                {specializations.map((spec) => (
                                                    <SelectItem key={spec.id} value={String(spec.id)}>
                                                        {spec.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
} 