"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchKBArticles, KBArticle,
    fetchKBCategoryById, KBCategory
} from '@/lib/dataService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ListChecks, BookText, TagIcon, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime';
import { Badge } from '@/components/ui/badge';
import { remark } from 'remark';
import stripMarkdown from 'strip-markdown';

// Utility function to safely strip markdown content
const stripMarkdownContent = (content: string): string => {
    const processedContent = remark()
        .use(stripMarkdown)
        .processSync(content)
        .toString()
        .trim();
    return processedContent;
};

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
            // Fetch the single category directly by ID
            const currentCategory = await fetchKBCategoryById(categoryId);
            setCategory(currentCategory);

            if (!currentCategory) {
                throw new Error("Category not found.");
            }

            const { articles: fetchedArticles, count } = await fetchKBArticles({
                categoryId: categoryId,
                publishedOnly: true
            });
            setArticles(fetchedArticles);

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
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading articles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive mb-4">Error: {error}</p>
                    <Button onClick={() => categoryId && loadCategoryAndArticles()} className="mt-4">Try Again</Button>
                    <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-2">Back to Knowledge Base</Button>
                </div>
            </div>
        );
    }

    if (!category) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Category not found.</p>
                    <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-4">Back to Knowledge Base</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-end mb-8">
                <Button variant="outline" size="sm" onClick={() => router.push('/knowledge-base')} className="text-sm group">
                    <BookText size={16} className="mr-2 group-hover:text-primary"/> Back to Knowledge Base
                </Button>
            </div>

            <div className="max-w-4xl mx-auto">
                <header className="mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {category.name}
                    </h2>
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
                                            {stripMarkdownContent(article.content.substring(0, 400))}...
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
        </div>
    );
} 