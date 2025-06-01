"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchKBArticles, KBArticle } from '@/lib/dataService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Search as SearchIcon, TagIcon, BookText } from 'lucide-react';
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

function SearchResultsDisplay() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const query = searchParams.get('query');

    const [articles, setArticles] = useState<KBArticle[]>([]);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const articlesPerPage = 10;

    const loadSearchResults = useCallback(async (searchTerm: string, page: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const offset = (page - 1) * articlesPerPage;
            const { articles: fetchedArticles, count } = await fetchKBArticles({
                searchQuery: searchTerm,
                publishedOnly: true,
                limit: articlesPerPage,
                offset: offset
            });
            setArticles(fetchedArticles);
            setTotalCount(count);
        } catch (err: any) {
            console.error("Failed to load search results:", err);
            setError(err.message || "Could not fetch search results.");
            toast({ title: "Error", description: "Failed to load search results.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast, articlesPerPage]);

    // Reset currentPage when query changes
    useEffect(() => {
        if (query !== null) {
            setCurrentPage(1);
        } else {
            setArticles([]);
            setTotalCount(0);
            setIsLoading(false);
        }
    }, [query]);

    // Load search results when either query or currentPage changes
    useEffect(() => {
        if (query) {
            loadSearchResults(query, currentPage);
        }
    }, [query, currentPage, loadSearchResults]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Searching for articles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive mb-3">Error: {error}</p>
                <Button onClick={() => query && loadSearchResults(query, 1)}>Try Again</Button>
            </div>
        );
    }
    
    const totalPages = totalCount ? Math.ceil(totalCount / articlesPerPage) : 0;

    return (
        <div>
            <header className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold">Search Results</h1>
                    <Button variant="outline" size="sm" onClick={() => router.push('/knowledge-base')} className="text-sm group">
                        <BookText size={16} className="mr-2 group-hover:text-primary"/> Back to Knowledge Base
                    </Button>
                </div>
                <p className="mt-2 text-muted-foreground">
                    {query && `Results for: "${query}"`}
                    {totalCount !== null && (
                        <> • Found {totalCount} article{totalCount !== 1 ? 's' : ''}.
                        {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}</>
                    )}
                </p>
            </header>

            {articles.length === 0 && !isLoading && (
                <div className="text-center py-10">
                    <SearchIcon size={48} className="mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No articles found matching your search term.</p>
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
                                    {article.kb_categories && (
                                        <Badge variant="outline" className="mt-1 w-fit text-xs">
                                            <BookText size={12} className="mr-1.5"/>
                                            {article.kb_categories.name}
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {stripMarkdownContent(article.content.substring(0, 400))}...
                                    </p>
                                    {article.tags && article.tags.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {article.tags.map(tag => (
                                                <Badge key={tag} variant="secondary" className="font-normal text-xs">
                                                   <TagIcon size={12} className="mr-1"/> {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="text-xs text-muted-foreground justify-between">
                                    <span>By: {article.profiles?.full_name || 'Unknown Author'}</span>
                                    <span>Last updated: <ClientOnlyDateTime dateString={article.updated_at} options={{dateStyle: 'medium'}}/></span>
                                </CardFooter>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-10 flex justify-center items-center space-x-2">
                    <Button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isLoading}
                        variant="outline"
                    >
                        Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                         <Button
                            key={pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="icon"
                            disabled={isLoading}
                        >
                            {pageNumber}
                        </Button>
                    ))}
                    <Button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || isLoading}
                        variant="outline"
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function KnowledgeBaseSearchPage() {
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="ml-2">Loading...</p>
                </div>
            }>
                <SearchResultsDisplay />
            </Suspense>
        </div>
    );
} 