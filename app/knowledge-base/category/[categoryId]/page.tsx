// app/knowledge-base/category/[categoryId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchKBArticles, KBArticle,
    fetchKBCategories, KBCategory // To fetch the specific category's details
} from '@/lib/dataService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ListChecks, ChevronRight, Home, BookText, TagIcon, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime'; // Assuming this is in components folder
import { Badge } from '@/components/ui/badge';

export default function CategoryArticlesPage() {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();

    const categoryId = params?.categoryId ? Number(params.categoryId) : null;

    const [category, setCategory] = useState<KBCategory | null>(null);
    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCategoryAndArticles = useCallback(async () => {
        if (!categoryId) {
            setError("Category ID not found.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // Fetch category details
            const allCategories = await fetchKBCategories();
            const currentCategory = allCategories.find(cat => cat.id === categoryId);
            setCategory(currentCategory || null);

            if (!currentCategory) {
                // This error will be caught by the main try-catch if category fetch itself fails
                // or if find returns undefined.
                throw new Error("Category not found.");
            }

            // Fetch articles for the category
            const { articles: fetchedArticles, count } = await fetchKBArticles({ // Destructure here
                categoryId: categoryId,
                publishedOnly: true
            });
            setArticles(fetchedArticles); // Use the destructured 'articles' array

        } catch (err: any) {
            console.error("Failed to load category articles:", err);
            setError(err.message || "Could not fetch articles for this category.");
            toast({ title: "Error", description: "Failed to load articles.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [categoryId, toast]);

    useEffect(() => {
        if (authLoading) return;
        if (categoryId) {
            loadCategoryAndArticles();
        } else {
             setError("No category specified.");
             setIsLoading(false);
        }
    }, [authLoading, categoryId, loadCategoryAndArticles]);


    if (authLoading || isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading articles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive mb-4">Error: {error}</p>
                <Button onClick={() => categoryId && loadCategoryAndArticles()} className="mt-4">Try Again</Button>
                <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-2">Back to Knowledge Base</Button>
            </div>
        );
    }

    if (!category) {
         return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Category not found.</p>
                <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-4">Back to Knowledge Base</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-6">
                <Button variant="outline" size="sm" onClick={() => router.push('/knowledge-base')} className="group text-sm">
                    <ChevronRight size={16} className="mr-1 rotate-180 group-hover:-translate-x-0.5 transition-transform"/> Knowledge Base
                </Button>
            </div>

            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    {category.name}
                </h1>
                {category.description && (
                    <p className="mt-2 text-lg text-muted-foreground">
                        {category.description}
                    </p>
                )}
            </header>

            {articles.length === 0 && !isLoading && (
                <div className="text-center py-10">
                    <ListChecks size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No articles found in this category yet.</p>
                </div>
            )}

            {articles.length > 0 && (
                <div className="space-y-6">
                    {articles.map((article) => (
                        <Link
                            href={`/knowledge-base/article/${article.slug}`}
                            key={article.id}
                            passHref
                        >
                            <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-200 ease-in-out cursor-pointer group">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors">
                                        {article.title}
                                    </CardTitle>
                                    {article.tags && article.tags.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {article.tags.map(tag => (
                                                <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {article.content.substring(0, 200).replace(/<[^>]+>/g, '')}...
                                    </p>
                                </CardContent>
                                <CardFooter className="text-xs text-muted-foreground justify-between">
                                    <span>
                                        By: {article.profiles?.full_name || 'Unknown Author'}
                                    </span>
                                    <span>
                                        Last updated: <ClientOnlyDateTime dateString={article.updated_at} options={{dateStyle: 'medium'}}/>
                                    </span>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
