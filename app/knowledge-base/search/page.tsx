// app/knowledge-base/search/page.tsx
"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { fetchKBArticles, KBArticle } from '@/lib/dataService';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // For a search bar on this page too
import { Loader2, AlertTriangle, Search as SearchIcon, ListChecks, ChevronRight, Home, BookText, TagIcon, ChevronLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime'; // Assuming this is in components folder
import { Badge } from '@/components/ui/badge';

// Define a component to handle the actual search logic and display
// This is to allow useSearchParams to be used within a Suspense boundary if needed,
// though for client components, direct use is fine.
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
    const articlesPerPage = 10; // Or make this configurable

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

    useEffect(() => {
        if (query) {
            loadSearchResults(query, currentPage);
        } else {
            setArticles([]);
            setTotalCount(0);
            setIsLoading(false);
        }
    }, [query, currentPage, loadSearchResults]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)]">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">Searching for articles...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)]">
                <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                <p className="text-destructive mb-3">Error: {error}</p>
                <Button onClick={() => query && loadSearchResults(query, 1)} >Try Again</Button>
            </div>
        );
    }
    
    const totalPages = totalCount ? Math.ceil(totalCount / articlesPerPage) : 0;

    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Search Results for: "{query}"
                </h1>
                {totalCount !== null && (
                    <p className="mt-2 text-muted-foreground">
                        Found {totalCount} article{totalCount !== 1 ? 's' : ''}.
                        {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                    </p>
                )}
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
                                        {article.content.substring(0, 250).replace(/<[^>]+>/g, '')}...
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

            {/* Pagination Controls */}
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


// Main page component that uses Suspense for searchParams
export default function KnowledgeBaseSearchPage() {
    return (
        <div className="container mx-auto max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
             <div className="mb-6 flex justify-between items-center">
                 <Button variant="outline" size="sm" onClick={() => window.history.back()} className="group text-sm">
                    <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-0.5 transition-transform"/> Back
                </Button>
                <Button variant="ghost" onClick={() => window.location.href = '/knowledge-base'} className="group text-sm">
                    <BookText size={16} className="mr-2 group-hover:text-primary"/> Knowledge Base Home
                </Button>
            </div>
            <Suspense fallback={<div className="flex justify-center items-center min-h-[200px]"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
                <SearchResultsDisplay />
            </Suspense>
        </div>
    );
}
