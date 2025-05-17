// app/knowledge-base/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext'; // To ensure user is logged in if KB is not public
import { fetchKBCategories, KBCategory } from '@/lib/dataService'; // Assuming KBCategory is exported
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, BookText, ChevronRight, Home, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function KnowledgeBasePage() {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [categories, setCategories] = useState<KBCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const loadCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedCategories = await fetchKBCategories();
            // Assuming fetchKBCategories might return article_count if joined
            setCategories(fetchedCategories.map(cat => ({ ...cat, article_count: cat.article_count || 0 })));
        } catch (err: any) {
            console.error("Failed to load KB categories:", err);
            setError(err.message || "Could not fetch categories.");
            toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        // Wait for auth to resolve before deciding to load or redirect
        if (authLoading) {
            return;
        }
        // Example: Redirect if KB is not public and user is not logged in
        // if (!session) {
        //     router.push('/login');
        //     return;
        // }
        loadCategories();
    }, [authLoading, session, router, loadCategories]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            // Navigate to a search results page or handle search inline
            router.push(`/knowledge-base/search?query=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading Knowledge Base...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive">Error loading knowledge base: {error}</p>
                <Button onClick={() => loadCategories()} className="mt-4">Try Again</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-4">
                 <Button variant="outline" onClick={() => router.push('/dashboard')} className="mb-2 group">
                    <Home size={18} className="mr-2 group-hover:animate-pulse" /> Back to Dashboard
                </Button>
            </div>
            <header className="text-center mb-10">
                <BookText size={48} className="mx-auto text-primary mb-3" />
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                    Knowledge Base
                </h1>
                <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
                    Find answers, guides, and troubleshooting tips for all your questions.
                </p>
            </header>

            <form onSubmit={handleSearchSubmit} className="mb-12 max-w-2xl mx-auto">
                <div className="relative">
                    <Input
                        type="search"
                        placeholder="Search articles..."
                        className="h-12 pl-10 pr-4 text-base rounded-lg shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                </div>
                {/* <Button type="submit" className="mt-3 w-full sm:w-auto">Search</Button> */}
            </form>

            {categories.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground">No categories available at the moment.</p>
            )}

            {categories.length > 0 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                        <Link
                            href={`/knowledge-base/category/${category.id}`} // Or use a slug if you add one to categories
                            key={category.id}
                            passHref
                        >
                            <Card className="hover:shadow-xl hover:border-primary/50 transition-all duration-200 ease-in-out cursor-pointer group h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors">
                                        {category.name}
                                    </CardTitle>
                                    <CardDescription className="text-sm line-clamp-2">
                                        {category.description || 'Browse articles in this category.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    {/* You could show a few popular articles here later */}
                                </CardContent>
                                <CardFooter className="mt-auto pt-4 border-t">
                                    <div className="text-sm text-primary font-medium flex items-center group-hover:underline">
                                        View Articles ({category.article_count || 0})
                                        <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                                    </div>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
