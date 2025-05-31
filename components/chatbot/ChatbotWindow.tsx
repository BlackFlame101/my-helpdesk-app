// components/chatbot/ChatbotWindow.tsx
"use client";

import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Bot, X as CloseIcon, Send, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarPublicUrl } from '@/lib/dataService';
import ClientOnlyDateTime from '@/components/ClientOnlyDateTime';
import { useRouter } from 'next/navigation';
import { useChat, type Message as VercelAIMessage } from 'ai/react';

export default function ChatbotWindow() {
    const { user, profile } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const { 
        messages, 
        input, 
        handleInputChange, 
        handleSubmit, 
        isLoading, 
        error,
        setMessages 
    } = useChat({
        api: '/api/chat',
        initialMessages: [],
        onError: (error: Error) => {
            console.error("Chat error:", error);
        }
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const initialBotMessage: VercelAIMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: "Hello! I'm your AI help assistant. How can I help you today?",
                createdAt: new Date(),
            };
            setMessages([initialBotMessage]);
        }
    }, [isOpen, messages.length, setMessages]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        handleSubmit(e);
    };

    return (
        <>
            {/* Floating Action Button */}
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
                                <AvatarFallback className="bg-primary/10">
                                    <Bot size={20} className="text-primary"/>
                                </AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-lg font-semibold text-card-foreground">
                                Help Assistant
                            </CardTitle>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={toggleChat} 
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <CloseIcon size={20} />
                            <span className="sr-only">Close chat</span>
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full p-4">
                            <div className="space-y-4">
                                {messages.map((msg: VercelAIMessage) => (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end space-x-2 ${
                                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                    >
                                        {msg.role === 'assistant' && (
                                            <Avatar className="h-7 w-7 self-start">
                                                <AvatarFallback className="bg-primary/20 text-primary">
                                                    <Bot size={16}/>
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                        
                                        <div
                                            className={`max-w-[75%] p-2.5 rounded-xl shadow-sm break-words ${
                                                msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                                    : 'bg-muted dark:bg-slate-700 text-card-foreground dark:text-slate-200 rounded-bl-none'
                                            }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                            {/* Support ticket link */}
                                            {msg.role === 'assistant' && 
                                             msg.content.toLowerCase().includes("create a support ticket") && (
                                                <Button
                                                    variant="link"
                                                    className="p-0 h-auto text-sm mt-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                    onClick={() => {
                                                        router.push('/tickets/new');
                                                        setIsOpen(false);
                                                    }}
                                                >
                                                    Create a Support Ticket
                                                </Button>
                                            )}

                                            <p className={`text-xs mt-1.5 ${
                                                msg.role === 'user' 
                                                    ? 'text-primary-foreground/70 text-right' 
                                                    : 'text-muted-foreground/70'
                                            }`}>
                                                {msg.createdAt ? (
                                                    <ClientOnlyDateTime 
                                                        dateString={msg.createdAt.toISOString()} 
                                                        options={{ hour: 'numeric', minute: 'numeric' }} 
                                                    />
                                                ) : (
                                                    new Date().toLocaleTimeString([], { 
                                                        hour: 'numeric', 
                                                        minute: 'numeric' 
                                                    })
                                                )}
                                            </p>
                                        </div>

                                        {msg.role === 'user' && (
                                            <Avatar className="h-7 w-7 self-start">
                                                {profile?.avatar_url ? (
                                                    <AvatarImage 
                                                        src={getAvatarPublicUrl(profile.avatar_url) || undefined} 
                                                        alt={profile.full_name || "User"} 
                                                    />
                                                ) : null}
                                                <AvatarFallback>
                                                    {profile?.full_name?.charAt(0).toUpperCase() || 
                                                     <UserIcon size={16}/>}
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}

                                {/* Loading indicator */}
                                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                                    <div className="flex items-end space-x-2 justify-start">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="bg-primary/20 text-primary">
                                                <Bot size={16}/>
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[70%] p-2.5 rounded-xl shadow-sm bg-muted dark:bg-slate-700 text-muted-foreground dark:text-slate-200 rounded-bl-none">
                                            <p className="text-sm italic">Help Bot is typing...</p>
                                        </div>
                                    </div>
                                )}

                                {/* Error display */}
                                {error && (
                                    <div className="flex items-end space-x-2 justify-start">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="bg-red-100 text-red-600">
                                                <Bot size={16}/>
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[70%] p-2.5 rounded-xl shadow-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-bl-none">
                                            <p className="text-sm">
                                                Sorry, I encountered an error: {error.message}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-4 border-t dark:border-slate-700">
                        <form onSubmit={handleFormSubmit} className="flex w-full items-center space-x-2">
                            <Input
                                type="text"
                                placeholder="Ask a question..."
                                value={input}
                                onChange={handleInputChange}
                                className="flex-1"
                                disabled={isLoading}
                                autoComplete="off"
                            />
                            <Button 
                                type="submit" 
                                size="icon" 
                                disabled={isLoading || !input.trim()}
                            >
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