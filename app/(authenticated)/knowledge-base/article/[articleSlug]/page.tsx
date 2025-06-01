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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, UserCircle, CalendarDays, TagIcon, BookOpen, BookText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ArticleDetailPage() {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();

    const articleSlug = typeof params?.articleSlug === 'string' ? params.articleSlug : null;

    const [article, setArticle] = useState<KBArticle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadArticle = useCallback(async (slug: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedArticle = await fetchKBArticleBySlug(slug);

            if (fetchedArticle) {
                setArticle(fetchedArticle);
                incrementKBArticleViewCount(fetchedArticle.id).catch(viewCountError => {
                    console.warn("Failed to increment view count:", viewCountError);
                });
            } else {
                setError("Article not found or not published.");
                setArticle(null);
            }
        } catch (err: any) {
            console.error("Failed to load article:", err);
            setError(err.message || "Could not fetch article.");
            toast({ title: "Error", description: err.message || "Failed to load article.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (articleSlug) {
            loadArticle(articleSlug);
        } else {
            setError("Article slug not provided in URL.");
            setIsLoading(false);
        }
    }, [authLoading, articleSlug, loadArticle, router]);

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading article...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive mb-4">Error: {error}</p>
                    <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-2">
                        Back to Knowledge Base
                    </Button>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Article not found.</p>
                    <Button variant="outline" onClick={() => router.push('/knowledge-base')} className="mt-4">
                        Back to Knowledge Base
                    </Button>
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

            <div className="max-w-3xl mx-auto">
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
                    >
                        {article.content}
                    </ReactMarkdown>
                </article>
            </div>
        </div>
    );
} 