// app/knowledge-base/article/[articleSlug]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
    fetchKBArticleBySlug,
    KBArticle,
    incrementKBArticleViewCount
} from '@/lib/dataService';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"; // Removed CardFooter as it's not used here
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ChevronLeft, UserCircle, CalendarDays, TagIcon, BookOpen, BookText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ArticleDetailPage() {
    const { session, loading: authLoading } = useAuth(); // Only need session and authLoading here for now
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();

    // Ensure articleSlug is consistently a string or null
    const articleSlug = typeof params?.articleSlug === 'string' ? params.articleSlug : null;

    const [article, setArticle] = useState<KBArticle | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start true
    const [error, setError] = useState<string | null>(null);

    const loadArticle = useCallback(async (slug: string) => {
        console.log(`loadArticle: Called for slug "${slug}"`);
        setIsLoading(true); // Set loading true at the start of fetching
        setError(null);
        try {
            console.log(`loadArticle: Fetching article for slug "${slug}"`);
            const fetchedArticle = await fetchKBArticleBySlug(slug);
            console.log("loadArticle: Fetched article data:", fetchedArticle);

            if (fetchedArticle) {
                setArticle(fetchedArticle);
                // Increment view count (fire and forget)
                incrementKBArticleViewCount(fetchedArticle.id).catch(viewCountError => {
                    console.warn("Failed to increment view count:", viewCountError);
                });
            } else {
                console.log("loadArticle: Article not found or not published for slug:", slug);
                setError("Article not found or not published.");
                setArticle(null); // Ensure article is null if not found
            }
        } catch (err: any) {
            console.error("loadArticle: Failed to load article -", err);
            setError(err.message || "Could not fetch article.");
            toast({ title: "Error", description: err.message || "Failed to load article.", variant: "destructive" });
        } finally {
            console.log("loadArticle: FINALLY - Setting isLoading to false for slug:", slug);
            setIsLoading(false);
        }
    }, [toast]); // toast is stable from useToast

    useEffect(() => {
        console.log("ArticlePage useEffect triggered. authLoading:", authLoading, "articleSlug:", articleSlug);
        if (authLoading) {
            console.log("ArticlePage: Auth is loading, waiting...");
            // Optionally, if not loading yet, set isLoading to true until auth resolves
            // if (!isLoading) setIsLoading(true); 
            return; 
        }

        // Auth is resolved (authLoading is false)
        if (articleSlug) {
            console.log("ArticlePage: Auth resolved, articleSlug present. Calling loadArticle.");
            loadArticle(articleSlug);
        } else {
            console.log("ArticlePage: No articleSlug found in params.");
            setError("Article slug not provided in URL.");
            setIsLoading(false); // Stop loading if no slug
        }
    // loadArticle is memoized and only changes if articleSlug changes via its own dependency.
    // Adding articleSlug to ensure effect re-runs if slug changes (e.g., navigating between articles if this component wasn't fully unmounted/remounted)
    }, [authLoading, articleSlug, loadArticle, router]); // Removed session as it's handled by authLoading guard


    if (authLoading || isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading article...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive mb-4">Error: {error}</p>
                <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-2">
                    Back to Knowledge Base
                </Button>
            </div>
        );
    }

    if (!article) {
         return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Article not found.</p>
                <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-4">
                    Back to Knowledge Base
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="group text-sm">
                    <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-0.5 transition-transform"/> Back
                </Button>
            </div>

            <article className="prose dark:prose-invert lg:prose-xl max-w-none bg-card p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
                <header className="mb-8 border-b pb-6 dark:border-slate-700">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3">
                        {article.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        {article.kb_categories && (
                            <Link href={`/knowledge-base/category/${article.category_id}`} className="hover:text-primary transition-colors">
                                <Badge variant="secondary" className="cursor-pointer">
                                    <BookText size={14} className="mr-1.5"/>{article.kb_categories.name}
                                </Badge>
                            </Link>
                        )}
                        {article.profiles?.full_name && (
                            <div className="flex items-center">
                                <UserCircle size={14} className="mr-1.5"/> Author: {article.profiles.full_name}
                            </div>
                        )}
                        <div className="flex items-center">
                            <CalendarDays size={14} className="mr-1.5"/>
                            Last updated: <ClientOnlyDateTime dateString={article.updated_at} options={{dateStyle: 'long'}} />
                        </div>
                        <div>View Count: {article.view_count}</div>
                    </div>
                    {article.tags && article.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {article.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="font-normal text-xs">
                                    <TagIcon size={12} className="mr-1"/> {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </header>

                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    // components={{ /* Your custom renderers if needed */ }}
                >
                    {article.content}
                </ReactMarkdown>
            </article>

            <div className="mt-12 text-center">
                <Button variant="outline" onClick={() => router.push('/knowledge-base')}>
                    <ChevronLeft size={18} className="mr-2"/> Back to All Categories
                </Button>
            </div>
        </div>
    );
}

