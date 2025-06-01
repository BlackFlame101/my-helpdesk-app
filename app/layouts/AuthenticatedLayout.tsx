"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getAvatarPublicUrl } from '@/lib/dataService';
import {
  Home,
  MessageSquare,
  BarChart2,
  Users,
  Zap,
  Layers,
  Settings,
  Bell,
} from 'lucide-react';
import LogoutButton from '@/components/auth/LogoutButton';
import ChatbotWindow from '@/components/chatbot/ChatbotWindow';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: "dashboard", label: "Dashboard", icon: Home, path: '/dashboard' },
  { name: "tickets", label: "Tickets", icon: MessageSquare, path: '/tickets' },
  { name: "reports", label: "Reports", icon: BarChart2, path: '/reports' },
  { name: "users", label: "Users", icon: Users, path: '/users' },
  { name: "automations", label: "Automations", icon: Zap, path: '/automations' },
  { name: "knowledge", label: "Knowledge Base", icon: Layers, path: '/knowledge-base' },
];

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, unreadNotificationsCount, isAdmin } = useAuth();

  // Function to check if a path is active (including sub-paths)
  const isPathActive = (path: string) => {
    return pathname?.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <TooltipProvider>
        <div className="fixed inset-y-0 left-0 w-14 border-r bg-muted/40 flex flex-col items-center py-4 z-50">
          <div className="flex flex-col items-center gap-y-3">
            {navigationItems.map((item) => (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link href={item.path}>
                    <Button
                      variant={isPathActive(item.path) ? "default" : "ghost"}
                      size="icon"
                      className={`rounded-lg w-10 h-10 ${
                        isPathActive(item.path)
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon size={20} />
                      <span className="sr-only">Navigation for {item.label}</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="mt-auto flex flex-col items-center gap-y-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/settings">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg w-10 h-10 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Settings size={20} />
                    <span className="sr-only">Settings</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/notifications">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg w-10 h-10 text-muted-foreground hover:bg-muted hover:text-foreground relative"
                  >
                    <Bell size={20} />
                    {unreadNotificationsCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
                      >
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Notifications</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-lg w-10 h-10">
                      <Avatar className="h-8 w-8" key={profile?.avatar_url || profile?.id}>
                        <AvatarImage 
                          src={profile?.avatar_url ? getAvatarPublicUrl(profile.avatar_url) || undefined : undefined} 
                          alt={profile?.full_name || user?.email || 'User'} 
                        />
                        <AvatarFallback>
                          {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Profile</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="right" className="ml-2">
                <DropdownMenuLabel>{profile?.full_name || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  My Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => router.push('/admin/management')}>
                    Admin Management
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>Support</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild 
                  onSelect={(e) => e.preventDefault()} 
                  className="p-0 focus:bg-transparent" 
                >
                  <LogoutButton />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TooltipProvider>

      {/* Main Content */}
      <div className="flex-1 pl-14">
        <main className="py-4 px-6">
          {children}
        </main>
      </div>
      <ChatbotWindow />
    </div>
  );
} 