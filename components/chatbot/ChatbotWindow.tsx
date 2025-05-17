// components/chatbot/ChatbotWindow.tsx
"use client";

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Bot, X as CloseIcon, Send, User as UserIcon, CornerDownLeft, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { fetchKBArticles, KBArticle, getAvatarPublicUrl } from '@/lib/dataService'; // Import KB functions and types
import Link from 'next/link'; // For linking to articles
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime'; // Assuming this is in components folder
import router from 'next/router';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot' | 'system';
    timestamp: Date;
    avatar?: string | null;
    senderName?: string;
    articles?: Pick<KBArticle, 'id' | 'title' | 'slug'>[]; // Optional: for bot messages with article links
}

export default function ChatbotWindow() {
    const { user, profile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoadingResponse, setIsLoadingResponse] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    id: crypto.randomUUID(),
                    text: "Hello! I'm your help assistant. How can I help you today? Try asking about our features or common issues.",
                    sender: 'bot',
                    timestamp: new Date(),
                    senderName: 'Help Bot'
                }
            ]);
        }
    }, [isOpen, messages.length]); // Ensure messages.length is a dependency

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleSendMessage = async (e?: FormEvent<HTMLFormElement>) => {
        if (e) e.preventDefault();
        const userMessageText = inputValue.trim();
        if (!userMessageText) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: userMessageText,
            sender: 'user',
            timestamp: new Date(),
            avatar: profile?.avatar_url,
            senderName: profile?.full_name || user?.email || "You"
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue("");
        setIsLoadingResponse(true);

        try {
            const { articles: searchResults, count } = await fetchKBArticles({
                searchQuery: userMessageText,
                publishedOnly: true,
                limit: 3 // Fetch top 3 relevant articles
            });

            let botResponseText: string;
            let foundArticles: Pick<KBArticle, 'id' | 'title' | 'slug'>[] | undefined = undefined;

            if (searchResults && searchResults.length > 0) {
                botResponseText = "I found some articles that might help:\n";
                foundArticles = searchResults.map(article => ({
                    id: article.id,
                    title: article.title,
                    slug: article.slug
                }));
            } else {
                botResponseText = "I couldn't find an exact answer in our knowledge base. You can try rephrasing your question or create a support ticket.";
            }

            const botMessage: ChatMessage = {
                id: crypto.randomUUID(),
                text: botResponseText,
                sender: 'bot',
                timestamp: new Date(),
                senderName: 'Help Bot',
                articles: foundArticles
            };
            setMessages(prev => [...prev, botMessage]);

        } catch (error) {
            console.error("Error fetching KB articles for chatbot:", error);
            const errorBotMessage: ChatMessage = {
                id: crypto.randomUUID(),
                text: "Sorry, I encountered an error trying to find an answer. Please try again later or create a support ticket.",
                sender: 'bot',
                timestamp: new Date(),
                senderName: 'Help Bot'
            };
            setMessages(prev => [...prev, errorBotMessage]);
        } finally {
            setIsLoadingResponse(false);
        }
    };

    return (
        <>
            {/* Floating Action Button to toggle chat */}
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    size="icon"
                    className="rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={toggleChat}
                    aria-label={isOpen ? "Close chat" : "Open chat"}
                >
                    {isOpen ? <CloseIcon size={28} /> : <MessageCircle size={28} />}
                </Button>
            </div>

            {/* Chat Window */}
            {isOpen && (
                <Card className="fixed bottom-24 right-6 z-[100] w-full max-w-sm md:max-w-md shadow-2xl flex flex-col h-[70vh] max-h-[600px] dark:border-slate-700 bg-card">
                    <CardHeader className="flex flex-row items-center justify-between p-4 border-b dark:border-slate-700">
                        <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10"><Bot size={20} className="text-primary"/></AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-lg font-semibold text-card-foreground">Help Assistant</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleChat} className="text-muted-foreground hover:text-foreground">
                            <CloseIcon size={20} />
                            <span className="sr-only">Close chat</span>
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4">
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end space-x-2 ${
                                            msg.sender === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                    >
                                        {msg.sender === 'bot' && (
                                            <Avatar className="h-7 w-7 self-start">
                                                <AvatarFallback className="bg-primary/20 text-primary"><Bot size={16}/></AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div
                                            className={`max-w-[75%] p-2.5 rounded-xl shadow-sm break-words ${
                                                msg.sender === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                                    : 'bg-muted dark:bg-slate-700 text-card-foreground dark:text-slate-200 rounded-bl-none'
                                            }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                            {msg.articles && msg.articles.length > 0 && (
                                                <div className="mt-2 space-y-1.5">
                                                    {msg.articles.map(article => (
                                                        <Link
                                                            href={`/knowledge-base/article/${article.slug}`}
                                                            key={article.id}
                                                            passHref
                                                            target="_blank" // Open in new tab
                                                            rel="noopener noreferrer"
                                                            className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                                            onClick={() => setIsOpen(false)} // Optionally close chat on link click
                                                        >
                                                            <div className="flex items-center">
                                                                {article.title} <ExternalLink size={12} className="ml-1 opacity-70"/>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.text.includes("create a support ticket") && (
                                                 <Button 
                                                    variant="link" 
                                                    className="p-0 h-auto text-sm mt-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                    onClick={() => {
                                                        router.push('/tickets/new');
                                                        setIsOpen(false); // Close chat on click
                                                    }}
                                                >
                                                    Create a Support Ticket
                                                </Button>
                                            )}
                                            <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/70'}`}>
                                                <ClientOnlyDateTime dateString={msg.timestamp.toISOString()} options={{ hour: 'numeric', minute: 'numeric' }} />
                                            </p>
                                        </div>
                                        {msg.sender === 'user' && (
                                            <Avatar className="h-7 w-7 self-start">
                                                <AvatarImage src={msg.avatar ? getAvatarPublicUrl(msg.avatar) || undefined : undefined} alt={msg.senderName} />
                                                <AvatarFallback>{msg.senderName?.charAt(0).toUpperCase() || <UserIcon size={16}/>}</AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                {isLoadingResponse && (
                                    <div className="flex items-end space-x-2 justify-start">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="bg-primary/20 text-primary"><Bot size={16}/></AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[70%] p-2.5 rounded-xl shadow-sm bg-muted dark:bg-slate-700 text-muted-foreground dark:text-slate-200 rounded-bl-none">
                                            <p className="text-sm italic">Help Bot is typing...</p>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="p-4 border-t dark:border-slate-700">
                        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
                            <Input
                                type="text"
                                placeholder="Ask a question..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1"
                                disabled={isLoadingResponse}
                                autoComplete="off"
                            />
                            <Button type="submit" size="icon" disabled={isLoadingResponse || !inputValue.trim()}>
                                <Send size={20} />
                                <span className="sr-only">Send message</span>
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
