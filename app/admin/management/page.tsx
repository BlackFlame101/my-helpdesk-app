// app/admin/management/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    // Existing imports
    fetchTicketTypes, createTicketType, updateTicketType, deleteTicketType, TicketType,
    fetchSpecializations, createSpecialization, updateSpecialization, deleteSpecialization, Specialization,
    addTicketTypeSpecializationRoute, removeTicketTypeSpecializationRoute, fetchRoutesForTicketType,
    fetchAllUsersWithProfiles, updateUserProfile, UserProfile,
    // New KB imports
    fetchKBCategories, createKBCategory, updateKBCategory, deleteKBCategory, KBCategory,
    fetchKBArticles, createKBArticle, updateKBArticle, deleteKBArticle, KBArticle, NewKBArticleData, UpdateKBArticleData
} from '@/lib/dataService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast, useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
    DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // <-- Added missing Badge import
import { PlusCircle, Edit, Trash2, Loader2, BookOpen, TagIcon, Users2, Link2Icon, Settings2, Home } from 'lucide-react'; // <-- Added Home import
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime';

// Helper to generate a basic slug
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};


export default function AdminManagementPage() {
    const { user, profile, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast: showToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Ticket Type states
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [showTicketTypeDialog, setShowTicketTypeDialog] = useState(false);
    const [isEditingTicketType, setIsEditingTicketType] = useState(false);
    const [currentTicketType, setCurrentTicketType] = useState<Partial<TicketType> | null>(null);
    const [ticketTypeName, setTicketTypeName] = useState('');
    const [ticketTypeDescription, setTicketTypeDescription] = useState('');
    const [isSubmittingTicketType, setIsSubmittingTicketType] = useState(false);

    // Specialization states
    const [specializations, setSpecializations] = useState<Specialization[]>([]);
    const [showSpecializationDialog, setShowSpecializationDialog] = useState(false);
    const [isEditingSpecialization, setIsEditingSpecialization] = useState(false);
    const [currentSpecialization, setCurrentSpecialization] = useState<Partial<Specialization> | null>(null);
    const [specializationName, setSpecializationName] = useState('');
    const [specializationDescription, setSpecializationDescription] = useState('');
    const [isSubmittingSpecialization, setIsSubmittingSpecialization] = useState(false);

    // Compatibility Route states
    const [selectedTicketTypeIdForRoutes, setSelectedTicketTypeIdForRoutes] = useState<string>('');
    const [routesForSelectedTicketType, setRoutesForSelectedTicketType] = useState<{ specialization_id: number; specializations: { name: string } | null }[]>([]);
    const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
    const [targetSpecializationIds, setTargetSpecializationIds] = useState<Set<number>>(new Set());
    const [showRouteManagementDialog, setShowRouteManagementDialog] = useState(false);
    const [isSubmittingRoutes, setIsSubmittingRoutes] = useState(false);

    // User Management states
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [showUserEditDialog, setShowUserEditDialog] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [selectedSpecializationIdForUser, setSelectedSpecializationIdForUser] = useState<string>('');

    const [isSubmittingUserUpdate, setIsSubmittingUserUpdate] = useState(false);

    // KB States
    const [kbCategories, setKbCategories] = useState<KBCategory[]>([]);
    const [showKBCategoryDialog, setShowKBCategoryDialog] = useState(false);
    const [isEditingKBCategory, setIsEditingKBCategory] = useState(false);
    const [currentKBCategory, setCurrentKBCategory] = useState<Partial<KBCategory> | null>(null);
    const [kbCategoryName, setKbCategoryName] = useState('');
    const [kbCategoryDescription, setKbCategoryDescription] = useState('');
    const [isSubmittingKBCategory, setIsSubmittingKBCategory] = useState(false);

    const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
    const [showKBArticleDialog, setShowKBArticleDialog] = useState(false);
    const [isEditingKBArticle, setIsEditingKBArticle] = useState(false);
    const [currentKBArticle, setCurrentKBArticle] = useState<Partial<KBArticle> & { id?: number } | null>(null);
    const [kbArticleTitle, setKbArticleTitle] = useState('');
    const [kbArticleSlug, setKbArticleSlug] = useState('');
    const [kbArticleContent, setKbArticleContent] = useState('');
    const [kbArticleCategoryId, setKbArticleCategoryId] = useState<string>('');
    const [kbArticleTags, setKbArticleTags] = useState('');
    const [kbArticleIsPublished, setKbArticleIsPublished] = useState(false);
    const [isSubmittingKBArticle, setIsSubmittingKBArticle] = useState(false);

const NONE_SPECIALIZATION_VALUE = "__NONE_SPECIALIZATION__"; // Constant for "None" option
const NO_CATEGORY_VALUE = "__NO_CATEGORY__"; // Constant for "Uncategorized" option

    const loadInitialAdminData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [
                fetchedTicketTypes,
                fetchedSpecializationsData,
                fetchedUsers,
                fetchedKBCategories,
                fetchedKBArticlesData
            ] = await Promise.all([
                fetchTicketTypes(),
                fetchSpecializations(),
                fetchAllUsersWithProfiles(),
                fetchKBCategories(),
                fetchKBArticles({ publishedOnly: false })
            ]);
            setTicketTypes(fetchedTicketTypes);
            setSpecializations(fetchedSpecializationsData);
            setUsers(fetchedUsers);
            setKbCategories(fetchedKBCategories);
            console.log("Admin Page - Raw fetchedKBArticlesData:", fetchedKBArticlesData);
            setKbArticles(fetchedKBArticlesData.articles);
            console.log("Admin Page - kbArticles state set to:", fetchedKBArticlesData?.articles || []);

        } catch (err: any) {
            console.error("Failed to load admin data:", err);
            const errorMessage = err.message || "Could not fetch admin data.";
            setError(errorMessage);
            showToast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (!authLoading) {
            console.log('Admin status:', isAdmin, 'Profile:', profile);
            if (!isAdmin) {
                showToast({ title: "Unauthorized", description: "You do not have permission to view this page.", variant: "destructive" });
                router.push('/dashboard');
            } else {
                loadInitialAdminData();
            }
        }
    }, [authLoading, isAdmin, router, loadInitialAdminData, showToast]);

    // Ticket Type Handlers
    const handleOpenTicketTypeDialog = (ticketType?: TicketType) => {
        if (ticketType) {
            setIsEditingTicketType(true); setCurrentTicketType(ticketType);
            setTicketTypeName(ticketType.name); setTicketTypeDescription(ticketType.description || '');
        } else {
            setIsEditingTicketType(false); setCurrentTicketType({});
            setTicketTypeName(''); setTicketTypeDescription('');
        }
        setShowTicketTypeDialog(true);
    };
    const handleTicketTypeFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketTypeName.trim()) {
            toast({ title: "Validation Error", description: "Ticket type name cannot be empty.", variant: "destructive" });
            return;
        }
        setIsSubmittingTicketType(true);
        try {
            if (isEditingTicketType && currentTicketType?.id) {
                await updateTicketType(currentTicketType.id, { name: ticketTypeName, description: ticketTypeDescription });
                showToast({ title: "Success", description: "Ticket type updated successfully." });
            } else {
                await createTicketType({ name: ticketTypeName, description: ticketTypeDescription });
                showToast({ title: "Success", description: "Ticket type created successfully." });
            }
            setShowTicketTypeDialog(false); loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to save ticket type:", err);
            showToast({ title: "Error", description: err.message || "Failed to save ticket type.", variant: "destructive" });
        } finally { setIsSubmittingTicketType(false); }
    };
    const handleDeleteTicketType = async (ticketTypeId: number) => {
        try {
            await deleteTicketType(ticketTypeId);
            showToast({ title: "Success", description: "Ticket type deleted successfully." });
            loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to delete ticket type:", err);
            showToast({ title: "Error", description: err.message || "Failed to delete ticket type. It might be in use.", variant: "destructive" });
        }
    };

    // Specialization Handlers
    const handleOpenSpecializationDialog = (spec?: Specialization) => {
        if (spec) {
            setIsEditingSpecialization(true); setCurrentSpecialization(spec);
            setSpecializationName(spec.name); setSpecializationDescription(spec.description || '');
        } else {
            setIsEditingSpecialization(false); setCurrentSpecialization({});
            setSpecializationName(''); setSpecializationDescription('');
        }
        setShowSpecializationDialog(true);
    };
    const handleSpecializationFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!specializationName.trim()) {
            toast({ title: "Validation Error", description: "Specialization name cannot be empty.", variant: "destructive" });
            return;
        }
        setIsSubmittingSpecialization(true);
        try {
            if (isEditingSpecialization && currentSpecialization?.id) {
                await updateSpecialization(currentSpecialization.id, { name: specializationName, description: specializationDescription });
                showToast({ title: "Success", description: "Specialization updated successfully." });
            } else {
                await createSpecialization({ name: specializationName, description: specializationDescription });
                showToast({ title: "Success", description: "Specialization created successfully." });
            }
            setShowSpecializationDialog(false); loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to save specialization:", err);
            showToast({ title: "Error", description: err.message || "Failed to save specialization.", variant: "destructive" });
        } finally { setIsSubmittingSpecialization(false); }
    };
    const handleDeleteSpecialization = async (specializationId: number) => {
        try {
            await deleteSpecialization(specializationId);
            showToast({ title: "Success", description: "Specialization deleted successfully." });
            loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to delete specialization:", err);
            showToast({ title: "Error", description: err.message || "Failed to delete specialization. It might be in use.", variant: "destructive" });
        }
    };

    // Compatibility Route Handlers
    const handleTicketTypeSelectForRoutes = async (ticketTypeId: string) => {
        setSelectedTicketTypeIdForRoutes(ticketTypeId);
        if (ticketTypeId) {
            setIsLoadingRoutes(true);
            try {
                const routes = await fetchRoutesForTicketType(parseInt(ticketTypeId, 10));
                setRoutesForSelectedTicketType(routes);
                const currentRouteIds = new Set(routes.map(r => r.specialization_id));
                setTargetSpecializationIds(currentRouteIds);
            } catch (err: any) {
                console.error("Failed to fetch routes for ticket type:", err);
                showToast({ title: "Error", description: "Failed to fetch compatibility routes.", variant: "destructive" });
                setRoutesForSelectedTicketType([]); setTargetSpecializationIds(new Set());
            } finally { setIsLoadingRoutes(false); }
        } else { setRoutesForSelectedTicketType([]); setTargetSpecializationIds(new Set()); }
    };
    const handleManageRoutesClick = () => {
        if (!selectedTicketTypeIdForRoutes) {
            showToast({ title: "Info", description: "Please select a ticket type first.", variant: "default" });
            return;
        }
        const currentRouteIds = new Set(routesForSelectedTicketType.map(r => r.specialization_id));
        setTargetSpecializationIds(currentRouteIds);
        setShowRouteManagementDialog(true);
    };
    const handleSpecializationToggleForRoute = (specializationId: number) => {
        setTargetSpecializationIds(prev => { const newSet = new Set(prev); if (newSet.has(specializationId)) { newSet.delete(specializationId); } else { newSet.add(specializationId); } return newSet; });
    };
    const handleSaveCompatibilityRoutes = async () => {
        if (!selectedTicketTypeIdForRoutes) return;
        setIsSubmittingRoutes(true);
        const ticketTypeIdNum = parseInt(selectedTicketTypeIdForRoutes, 10);
        const initialRouteIds = new Set(routesForSelectedTicketType.map(r => r.specialization_id));
        const toAdd = Array.from(targetSpecializationIds).filter(id => !initialRouteIds.has(id));
        const toRemove = Array.from(initialRouteIds).filter(id => !targetSpecializationIds.has(id));
        try {
            await Promise.all([
                ...toAdd.map(specId => addTicketTypeSpecializationRoute(ticketTypeIdNum, specId)),
                ...toRemove.map(specId => removeTicketTypeSpecializationRoute(ticketTypeIdNum, specId))
            ]);
            showToast({ title: "Success", description: "Compatibility routes updated successfully." });
            setShowRouteManagementDialog(false);
            handleTicketTypeSelectForRoutes(selectedTicketTypeIdForRoutes);
        } catch (err: any) {
            console.error("Failed to update compatibility routes:", err);
            showToast({ title: "Error", description: err.message || "Failed to update routes.", variant: "destructive" });
        } finally { setIsSubmittingRoutes(false); }
    };

    // User Management Handlers
    const handleOpenUserEditDialog = (userToEdit: UserProfile) => {
        setEditingUser(userToEdit);
        setSelectedRole(userToEdit.role || '');
        setSelectedSpecializationIdForUser(userToEdit.specialization_id ? String(userToEdit.specialization_id) : NONE_SPECIALIZATION_VALUE); // Use constant
        setShowUserEditDialog(true);
    };
    const handleUserUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSubmittingUserUpdate(true);
        const updates: { role?: string; specialization_id?: number | null } = {};
        let roleChanged = false; let specializationChanged = false;
        if (selectedRole !== editingUser.role) { updates.role = selectedRole; roleChanged = true; }
        const currentSpecId = editingUser.specialization_id ? String(editingUser.specialization_id) : NONE_SPECIALIZATION_VALUE; // Use constant for comparison
        if (selectedSpecializationIdForUser !== currentSpecId) { updates.specialization_id = selectedSpecializationIdForUser === NONE_SPECIALIZATION_VALUE ? null : parseInt(selectedSpecializationIdForUser, 10); specializationChanged = true; } // Handle constant value
        if (selectedRole !== 'agent' && updates.specialization_id !== null) { updates.specialization_id = null; specializationChanged = true; }
        if (!roleChanged && !specializationChanged) {
            showToast({ title: "No Changes", description: "No changes were made to the user.", variant: "default" });
            setIsSubmittingUserUpdate(false); setShowUserEditDialog(false); return;
        }
        try {
            await updateUserProfile(editingUser.id, updates);
            showToast({ title: "Success", description: "User profile updated successfully." });
            setShowUserEditDialog(false); loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to update user profile:", err);
            showToast({ title: "Error", description: err.message || "Failed to update user profile.", variant: "destructive" });
        } finally { setIsSubmittingUserUpdate(false); }
    };

    // KB Category Handlers
    const handleOpenKBCategoryDialog = (category?: KBCategory) => {
        if (category) {
            setIsEditingKBCategory(true); setCurrentKBCategory(category);
            setKbCategoryName(category.name); setKbCategoryDescription(category.description || '');
        } else {
            setIsEditingKBCategory(false); setCurrentKBCategory({});
            setKbCategoryName(''); setKbCategoryDescription('');
        }
        setShowKBCategoryDialog(true);
    };
    const handleKBCategoryFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kbCategoryName.trim()) {
            toast({ title: "Validation Error", description: "Category name cannot be empty.", variant: "destructive" });
            return;
        }
        setIsSubmittingKBCategory(true);
        try {
            if (isEditingKBCategory && currentKBCategory?.id) {
                await updateKBCategory(currentKBCategory.id, { name: kbCategoryName, description: kbCategoryDescription });
                showToast({ title: "Success", description: "KB Category updated." });
            } else {
                await createKBCategory({ name: kbCategoryName, description: kbCategoryDescription });
                showToast({ title: "Success", description: "KB Category created." });
            }
            setShowKBCategoryDialog(false); loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to save KB category:", err);
            showToast({ title: "Error", description: err.message || "Failed to save KB category.", variant: "destructive" });
        } finally { setIsSubmittingKBCategory(false); }
    };
    const handleDeleteKBCategory = async (categoryId: number) => {
        try {
            await deleteKBCategory(categoryId);
            showToast({ title: "Success", description: "KB Category deleted." });
            loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to delete KB category:", err);
            showToast({ title: "Error", description: err.message || "Failed to delete KB category. It might be in use.", variant: "destructive" });
        }
    };

    // KB Article Handlers
    const handleOpenKBArticleDialog = (article?: KBArticle) => {
        if (article) {
            setIsEditingKBArticle(true); setCurrentKBArticle(article);
            setKbArticleTitle(article.title); setKbArticleSlug(article.slug);
            setKbArticleContent(article.content);
            setKbArticleCategoryId(article.category_id ? String(article.category_id) : '');
            setKbArticleTags(article.tags?.join(', ') || '');
            setKbArticleIsPublished(article.is_published);
        } else {
            setIsEditingKBArticle(false); setCurrentKBArticle({});
            setKbArticleTitle(''); setKbArticleSlug(''); setKbArticleContent('');
            setKbArticleCategoryId(kbCategories.length > 0 ? String(kbCategories[0].id) : NO_CATEGORY_VALUE); // Use constant
            setKbArticleTags(''); setKbArticleIsPublished(false);
        }
        setShowKBArticleDialog(true);
    };
    const handleKBArticleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kbArticleTitle.trim() || !kbArticleSlug.trim() || !kbArticleContent.trim() || !user?.id) {
            showToast({ title: "Validation Error", description: "Title, slug, and content are required.", variant: "destructive" });
            return;
        }
        setIsSubmittingKBArticle(true);
        const articleData = {
            title: kbArticleTitle,
            slug: generateSlug(kbArticleSlug || kbArticleTitle),
            content: kbArticleContent,
            category_id: kbArticleCategoryId === NO_CATEGORY_VALUE ? null : parseInt(kbArticleCategoryId, 10), // Handle constant value
            tags: kbArticleTags.split(',').map(tag => tag.trim()).filter(tag => tag),
            is_published: kbArticleIsPublished,
        };
        try {
            if (isEditingKBArticle && currentKBArticle?.id) {
                await updateKBArticle(currentKBArticle.id, articleData);
                showToast({ title: "Success", description: "KB Article updated." });
            } else {
                await createKBArticle({ ...articleData, author_id: user.id });
                showToast({ title: "Success", description: "KB Article created." });
            }
            setShowKBArticleDialog(false); loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to save KB article:", err);
            showToast({ title: "Error", description: err.message || "Failed to save KB article.", variant: "destructive" });
        } finally { setIsSubmittingKBArticle(false); }
    };
    const handleDeleteKBArticle = async (articleId: number) => {
        try {
            await deleteKBArticle(articleId);
            showToast({ title: "Success", description: "KB Article deleted." });
            loadInitialAdminData();
        } catch (err: any) {
            console.error("Failed to delete KB article:", err);
            showToast({ title: "Error", description: err.message || "Failed to delete KB article.", variant: "destructive" });
        }
    };


    if (authLoading || (!isAdmin && !profile && !isLoading)) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading Admin...</p></div>;
    }
    if (!isAdmin) {
        return <div className="flex items-center justify-center min-h-screen"><p>Unauthorized. Redirecting...</p></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Admin Management</h1>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    <Home size={18} className="mr-2"/> Back to Dashboard
                </Button>
                 <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="ml-2">
                    <BookOpen size={18} className="mr-2"/> Go to Knowledge Base
                </Button>
            </div>

            {/* Knowledge Base Categories Section */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center"><TagIcon className="mr-2 h-5 w-5 text-primary"/>Manage KB Categories</CardTitle>
                        <Button onClick={() => handleOpenKBCategoryDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Category
                        </Button>
                    </div>
                    <CardDescription>Create, view, edit, and delete knowledge base categories.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <p className="ml-2">Loading categories...</p></div>}
                    {!isLoading && error && <p className="text-red-500 text-center py-4">{error}</p>}
                    {!isLoading && !error && (!kbCategories || kbCategories.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No categories found.</p>
                    )}
                    {!isLoading && !error && kbCategories && kbCategories.length > 0 && (
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {kbCategories.map((cat) => (
                                    <TableRow key={cat.id}>
                                        <TableCell className="font-medium">{cat.name}</TableCell>
                                        <TableCell>{cat.description || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenKBCategoryDialog(cat)} className="mr-2"><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Delete Category: {cat.name}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. Articles in this category will have their category unassigned.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteKBCategory(cat.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Knowledge Base Articles Section */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5 text-primary"/>Manage KB Articles</CardTitle>
                        <Button onClick={() => handleOpenKBArticleDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Article
                        </Button>
                    </div>
                    <CardDescription>Create, view, edit, and delete knowledge base articles.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <p className="ml-2">Loading articles...</p></div>}
                    {!isLoading && error && <p className="text-red-500 text-center py-4">{error}</p>}
                    {!isLoading && !error && (!kbArticles || kbArticles.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No articles found.</p>
                    )}
                    {!isLoading && !error && kbArticles && kbArticles.length > 0 && (
                        <Table>
                            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Author</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {kbArticles.map((article) => (
                                    <TableRow key={article.id}>
                                        <TableCell className="font-medium">{article.title}</TableCell>
                                        <TableCell>{article.kb_categories?.name || "Uncategorized"}</TableCell>
                                        <TableCell>{article.profiles?.full_name || "N/A"}</TableCell>
                                        <TableCell><Badge variant={article.is_published ? "default" : "outline"}>{article.is_published ? "Published" : "Draft"}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenKBArticleDialog(article)} className="mr-2"><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Delete Article: {article.title}?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteKBArticle(article.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>


            {/* Dialog for Add/Edit KB Category */}
            <Dialog open={showKBCategoryDialog} onOpenChange={setShowKBCategoryDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isEditingKBCategory ? 'Edit' : 'Add New'} KB Category</DialogTitle>
                        <DialogDescription>{isEditingKBCategory ? 'Update details.' : 'Provide details.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleKBCategoryFormSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="kb-cat-name" className="text-right">Name</Label>
                                <Input id="kb-cat-name" value={kbCategoryName} onChange={(e) => setKbCategoryName(e.target.value)} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="kb-cat-desc" className="text-right">Description</Label>
                                <Textarea id="kb-cat-desc" value={kbCategoryDescription} onChange={(e) => setKbCategoryDescription(e.target.value)} className="col-span-3" placeholder="Optional"/>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingKBCategory}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmittingKBCategory}>{isSubmittingKBCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditingKBCategory ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog for Add/Edit KB Article */}
            <Dialog open={showKBArticleDialog} onOpenChange={setShowKBArticleDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditingKBArticle ? 'Edit' : 'Add New'} KB Article</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleKBArticleFormSubmit}>
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="kb-art-title">Title</Label>
                                <Input id="kb-art-title" value={kbArticleTitle} onChange={(e) => {setKbArticleTitle(e.target.value); if(!isEditingKBArticle) setKbArticleSlug(generateSlug(e.target.value))}} required />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="kb-art-slug">Slug (URL friendly)</Label>
                                <Input id="kb-art-slug" value={kbArticleSlug} onChange={(e) => setKbArticleSlug(generateSlug(e.target.value))} required />
                                <p className="text-xs text-muted-foreground">Generated from title, or customize. Use lowercase letters, numbers, and hyphens.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="kb-art-category">Category</Label>
                                <Select value={kbArticleCategoryId} onValueChange={setKbArticleCategoryId}>
                                    <SelectTrigger id="kb-art-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_CATEGORY_VALUE}>Uncategorized</SelectItem>
                                        {kbCategories.map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="kb-art-content">Content (Markdown supported)</Label>
                                <Textarea id="kb-art-content" value={kbArticleContent} onChange={(e) => setKbArticleContent(e.target.value)} required rows={10} placeholder="Write your article content here..."/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="kb-art-tags">Tags (comma-separated)</Label>
                                <Input id="kb-art-tags" value={kbArticleTags} onChange={(e) => setKbArticleTags(e.target.value)} placeholder="e.g., password, login, reset" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="kb-art-published" checked={kbArticleIsPublished} onCheckedChange={(checked) => setKbArticleIsPublished(checked as boolean)} />
                                <Label htmlFor="kb-art-published" className="font-normal">Publish Article</Label>
                            </div>
                        </div>
                        <DialogFooter className="mt-4 pt-4 border-t">
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingKBArticle}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmittingKBArticle}>{isSubmittingKBArticle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditingKBArticle ? 'Save Changes' : 'Create Article'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Ticket Types Section */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Manage Ticket Types</CardTitle>
                        <Button onClick={() => handleOpenTicketTypeDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Ticket Type
                        </Button>
                    </div>
                    <CardDescription>Create, view, edit, and delete ticket types used in the help desk system.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <p className="ml-2">Loading ticket types...</p></div>}
                    {!isLoading && error && <p className="text-red-500 text-center py-4">{error}</p>}
                    {!isLoading && !error && (!ticketTypes || ticketTypes.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No ticket types found. Add one to get started.</p>
                    )}
                    {!isLoading && !error && ticketTypes && ticketTypes.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ticketTypes.map((tt) => (
                                    <TableRow key={tt.id}>
                                        <TableCell className="font-medium">{tt.name}</TableCell>
                                        <TableCell>{tt.description || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenTicketTypeDialog(tt)} className="mr-2">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the ticket type "{tt.name}".
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteTicketType(tt.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Dialog for Add/Edit Ticket Type */}
            <Dialog open={showTicketTypeDialog} onOpenChange={setShowTicketTypeDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isEditingTicketType ? 'Edit' : 'Add New'} Ticket Type</DialogTitle>
                        <DialogDescription>
                            {isEditingTicketType ? 'Update the details of the ticket type.' : 'Provide details for the new ticket type.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleTicketTypeFormSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="tt-name" className="text-right">Name</Label>
                                <Input
                                    id="tt-name"
                                    value={ticketTypeName}
                                    onChange={(e) => setTicketTypeName(e.target.value)}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="tt-description" className="text-right">Description</Label>
                                <Textarea
                                    id="tt-description"
                                    value={ticketTypeDescription}
                                    onChange={(e) => setTicketTypeDescription(e.target.value)}
                                    className="col-span-3"
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmittingTicketType}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmittingTicketType}>
                                {isSubmittingTicketType && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditingTicketType ? 'Save Changes' : 'Create Ticket Type'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Specializations Section */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Manage Specializations</CardTitle>
                        <Button onClick={() => handleOpenSpecializationDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Specialization
                        </Button>
                    </div>
                    <CardDescription>Define agent specializations for routing tickets effectively.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <p className="ml-2">Loading specializations...</p></div>}
                    {!isLoading && error && <p className="text-red-500 text-center py-4">{error}</p>}
                    {!isLoading && !error && (!specializations || specializations.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No specializations found. Add one to get started.</p>
                    )}
                    {!isLoading && !error && specializations && specializations.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {specializations.map((spec) => (
                                    <TableRow key={spec.id}>
                                        <TableCell className="font-medium">{spec.name}</TableCell>
                                        <TableCell>{spec.description || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenSpecializationDialog(spec)} className="mr-2">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the specialization "{spec.name}".
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDeleteSpecialization(spec.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Dialog for Add/Edit Specialization */}
            <Dialog open={showSpecializationDialog} onOpenChange={setShowSpecializationDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{isEditingSpecialization ? 'Edit' : 'Add New'} Specialization</DialogTitle>
                        <DialogDescription>
                            {isEditingSpecialization ? 'Update the details of the specialization.' : 'Provide details for the new specialization.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSpecializationFormSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="spec-name" className="text-right">Name</Label>
                                <Input
                                    id="spec-name"
                                    value={specializationName}
                                    onChange={(e) => setSpecializationName(e.target.value)}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="spec-description" className="text-right">Description</Label>
                                <Textarea
                                    id="spec-description"
                                    value={specializationDescription}
                                    onChange={(e) => setSpecializationDescription(e.target.value)}
                                    className="col-span-3"
                                    placeholder="Optional description"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                             <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isSubmittingSpecialization}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmittingSpecialization}>
                                {isSubmittingSpecialization && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditingSpecialization ? 'Save Changes' : 'Create Specialization'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Compatibility Management Section */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Manage Compatibility Routes</CardTitle>
                    <CardDescription>Define which specializations can handle which ticket types.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 items-start">
                        <div>
                            <Label htmlFor="route-tickettype-select">Select Ticket Type</Label>
                            <Select
                                value={selectedTicketTypeIdForRoutes}
                                onValueChange={handleTicketTypeSelectForRoutes}
                            >
                                <SelectTrigger id="route-tickettype-select">
                                    <SelectValue placeholder="Choose a ticket type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ticketTypes.map(tt => (
                                        <SelectItem key={tt.id} value={String(tt.id)}>{tt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            {selectedTicketTypeIdForRoutes && (
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold">
                                            Compatible Specializations for "{ticketTypes.find(tt => tt.id === parseInt(selectedTicketTypeIdForRoutes))?.name}"
                                        </h4>
                                        <Button onClick={handleManageRoutesClick} size="sm" disabled={isLoadingRoutes}>
                                            <Edit className="mr-2 h-4 w-4" /> Manage
                                        </Button>
                                    </div>
                                    {isLoadingRoutes && <div className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading routes...</div>}
                                    {!isLoadingRoutes && routesForSelectedTicketType.length === 0 && <p className="text-sm text-muted-foreground">No specializations currently assigned to this ticket type.</p>}
                                    {!isLoadingRoutes && routesForSelectedTicketType.length > 0 && (
                                        <ul className="list-disc pl-5 space-y-1 text-sm">
                                            {routesForSelectedTicketType.map(route => (
                                                <li key={route.specialization_id}>{route.specializations?.name || 'Unknown Specialization'}</li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog for Managing Compatibility Routes */}
            <Dialog open={showRouteManagementDialog} onOpenChange={setShowRouteManagementDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Manage Routes for {ticketTypes.find(tt => tt.id === parseInt(selectedTicketTypeIdForRoutes || '0'))?.name || 'Ticket Type'}</DialogTitle>
                        <DialogDescription>Select specializations that are compatible with this ticket type.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                        {specializations.map(spec => (
                            <div key={spec.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`spec-route-${spec.id}`}
                                    checked={targetSpecializationIds.has(spec.id)}
                                    onCheckedChange={() => handleSpecializationToggleForRoute(spec.id)}
                                />
                                <Label htmlFor={`spec-route-${spec.id}`} className="font-normal">
                                    {spec.name}
                                </Label>
                            </div>
                        ))}
                        {specializations.length === 0 && <p className="text-sm text-muted-foreground">No specializations available. Please add specializations first.</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" disabled={isSubmittingRoutes}>Cancel</Button></DialogClose>
                        <Button onClick={handleSaveCompatibilityRoutes} disabled={isSubmittingRoutes || specializations.length === 0}>
                            {isSubmittingRoutes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Route Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* User Roles Management Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Manage Users & Roles</CardTitle>
                    <CardDescription>View users, assign roles, and manage agent specializations.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> <p className="ml-2">Loading users...</p></div>}
                    {!isLoading && error && <p className="text-red-500 text-center py-4">{error}</p>}
                    {!isLoading && !error && users.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No users found.</p>
                    )}
                    {!isLoading && !error && Array.isArray(users) && users.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email (from Auth)</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Specialization</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((usr) => (
                                    <TableRow key={usr.id}>
                                        <TableCell className="font-medium">{usr.full_name || "N/A"}</TableCell>
                                        <TableCell>{user?.id === usr.id ? user?.email : '******' /* Basic privacy for other emails */}</TableCell>
                                        <TableCell className="capitalize">{usr.role || "N/A"}</TableCell>
                                        <TableCell className="capitalize">{usr.specializations?.name || (usr.role === 'agent' ? 'Not Assigned' : 'N/A')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenUserEditDialog(usr)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Dialog for Editing User Role and Specialization */}
            <Dialog open={showUserEditDialog} onOpenChange={setShowUserEditDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User: {editingUser?.full_name || editingUser?.id}</DialogTitle>
                        <DialogDescription>Modify the user's role and specialization (if applicable).</DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <form onSubmit={handleUserUpdateSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="user-role" className="text-right">Role</Label>
                                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                                        <SelectTrigger id="user-role" className="col-span-3">
                                            <SelectValue placeholder="Select role..." />
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
                                        <Label htmlFor="user-specialization" className="text-right">Specialization</Label>
                                        <Select
                                            value={selectedSpecializationIdForUser} 
                                            onValueChange={setSelectedSpecializationIdForUser} >
                                            <SelectTrigger id="user-specialization" className="col-span-3">
                                                <SelectValue placeholder="Select specialization..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                
                                                <SelectItem value={NONE_SPECIALIZATION_VALUE}>None</SelectItem>
                                                
                                                {specializations.map(spec => (
                                                    <SelectItem key={spec.id} value={String(spec.id)}>{spec.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingUserUpdate}>Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmittingUserUpdate}>
                                    {isSubmittingUserUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
