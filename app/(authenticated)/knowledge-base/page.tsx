"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { fetchKBCategories, KBCategory } from '@/lib/dataService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, BookText, ChevronRight, AlertTriangle } from 'lucide-react';
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
        if (!authLoading) {
            loadCategories();
        }
    }, [authLoading, loadCategories]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            router.push(`/knowledge-base/search?query=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading Knowledge Base...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive">Error loading knowledge base: {error}</p>
                    <Button onClick={() => loadCategories()} className="mt-4">Try Again</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Knowledge Base</h1>
            </div>

            <div className="max-w-5xl mx-auto">
                <header className="text-center mb-10">
                    <BookText size={48} className="mx-auto text-primary mb-3" />
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
                </form>

                {categories.length === 0 && !isLoading && (
                    <p className="text-center text-muted-foreground">No categories available at the moment.</p>
                )}

                {categories.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {categories.map((category) => (
                            <Link
                                href={`/knowledge-base/category/${category.id}`}
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
        </div>
    );
} 