// contexts/AuthContext.tsx
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
  useCallback
} from 'react';
import { Session, User, RealtimeChannel, AuthResponse } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { fetchUserNotifications, Notification as NotificationType } from '@/lib/dataService';
import { debounce } from 'lodash'; // Make sure you have lodash installed

// Constants
const PROFILE_FETCH_TIMEOUT = 10000; // 10 seconds
const NOTIFICATION_DEBOUNCE = 300; // 300ms

export interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  // Add other profile fields as needed
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean; // For initial auth check
  isProfileLoading: boolean; // For subsequent profile fetches
  unreadNotificationsCount: number;
  login: (email: string, password: string) => Promise<AuthResponse['data']>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse['data']>;
  logout: () => Promise<void>;
  fetchUserProfile: (userId: string) => Promise<void>;
  isAdmin: boolean;
  isAgent: boolean;
  isCustomer: boolean;
  refreshUnreadCount: () => void; // Function to manually refresh count
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // For initial auth session check
  const [isProfileLoading, setIsProfileLoading] = useState(false); // For profile/notification fetching
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeouts to prevent memory leaks
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Safe version of setIsProfileLoading with timeout protection
  const safeSetProfileLoading = useCallback((isLoading: boolean) => {
    clearTimeouts();
    
    if (isLoading) {
      // If setting to loading=true, also set a timeout to reset it
      setIsProfileLoading(true);
      timeoutRef.current = setTimeout(() => {
        console.warn("Profile fetch operation timed out, resetting loading state");
        setIsProfileLoading(false);
      }, PROFILE_FETCH_TIMEOUT);
    } else {
      // If setting to loading=false, just set it
      setIsProfileLoading(false);
    }
  }, [clearTimeouts]);

  // Debounced version of the notification refresh to prevent rapid refetching
  const debouncedRefreshNotifications = useCallback(
    debounce(async (userId: string) => {
      if (!userId) return;
      
      try {
        const unreadNotifs = await fetchUserNotifications(userId, 100, true);
        setUnreadNotificationsCount(unreadNotifs.length);
      } catch (error) {
        console.error("Failed to refresh unread notifications count:", error);
      }
    }, NOTIFICATION_DEBOUNCE),
    []
  );

  // Exposed function to manually refresh notification count
  const refreshUnreadCount = useCallback(() => {
    if (user?.id) {
      debouncedRefreshNotifications(user.id);
    }
  }, [user?.id, debouncedRefreshNotifications]);

  // Main function to fetch user profile and notifications
  const fetchUserProfileAndNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    
    safeSetProfileLoading(true);
    
    try {
      // Concurrent fetching of profile and notifications
      const [profileResponse, notificationsResponse] = await Promise.allSettled([
        // Fetch profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
          
        // Fetch unread notifications count
        fetchUserNotifications(userId, 50, true)
      ]);
      
      // Handle profile response
      if (profileResponse.status === 'fulfilled') {
        const { data: profileData, error: profileError } = profileResponse.value;
        
        if (profileError) {
          console.error('Error fetching profile in context:', profileError);
          setProfile(null);
        } else {
          setProfile(profileData as UserProfile);
        }
      } else {
        console.error('Profile fetch rejected:', profileResponse.reason);
        setProfile(null);
      }
      
      // Handle notifications response
      if (notificationsResponse.status === 'fulfilled') {
        setUnreadNotificationsCount(notificationsResponse.value.length);
      } else {
        console.error('Notifications fetch rejected:', notificationsResponse.reason);
        setUnreadNotificationsCount(0);
      }
    } catch (error) {
      console.error('Error in fetchUserProfileAndNotifications:', error);
      setProfile(null);
      setUnreadNotificationsCount(0);
    } finally {
      safeSetProfileLoading(false);
    }
  }, [safeSetProfileLoading]);

  // Effect for initial session and auth state changes
  useEffect(() => {
    let mounted = true;
    setLoading(true); // Indicate initial auth check is starting

    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) return;
        
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          try {
            await fetchUserProfileAndNotifications(currentUser.id);
          } catch (profileError) {
            console.error("Error fetching initial user profile:", profileError);
            setProfile(null);
            setUnreadNotificationsCount(0);
          }
        } else {
          setProfile(null);
          setUnreadNotificationsCount(0);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setUnreadNotificationsCount(0);
        }
      } finally {
        if (mounted) {
          setLoading(false); // Always complete initial loading state
        }
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mounted) return;
        
        try {
          setSession(currentSession);
          const newCurrentUser = currentSession?.user ?? null;
          setUser(newCurrentUser);

          if (newCurrentUser) {
            // If user changes (e.g., login) or if profile is not yet loaded for current user
            if (newCurrentUser.id !== profile?.id || !profile) {
              try {
                await fetchUserProfileAndNotifications(newCurrentUser.id);
              } catch (profileError) {
                console.error("Error fetching user profile on auth change:", profileError);
                // Reset states on error
                safeSetProfileLoading(false);
              }
            }
          } else {
            // User signed out
            setProfile(null);
            setUnreadNotificationsCount(0);
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error);
          safeSetProfileLoading(false);
        } finally {
          // Reset loading after initial auth state processing
          if (_event === 'INITIAL_SESSION' && mounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeouts();
      
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [fetchUserProfileAndNotifications, clearTimeouts, safeSetProfileLoading]);

  // Effect for Realtime Notification Subscription
  useEffect(() => {
    const currentUserId = user?.id;
    let mounted = true;

    const setupNotificationChannel = async () => {
      // Cleanup previous channel if it exists
      if (notificationChannelRef.current) {
        try {
          await supabase.removeChannel(notificationChannelRef.current);
        } catch (err) {
          console.error('Error removing previous notification channel:', err);
        }
        notificationChannelRef.current = null;
      }

      if (!currentUserId || !mounted) return;

      try {
        console.log(`Setting up notification channel for user ${currentUserId}`);
        
        const channel = supabase
          .channel(`notifications:${currentUserId}`)
          .on(
            'postgres_changes',
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'notifications', 
              filter: `user_id=eq.${currentUserId}` 
            },
            (payload) => {
              console.log('New notification received:', payload);
              if (mounted) {
                refreshUnreadCount();
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`Subscribed to notifications for user ${currentUserId}`);
            } else if (err) {
              console.error(`Notification subscription error for user ${currentUserId}:`, err);
            }
          });
          
        notificationChannelRef.current = channel;
      } catch (error) {
        console.error("Error setting up notification channel:", error);
      }
    };

    setupNotificationChannel();

    return () => {
      mounted = false;
      
      const cleanupChannel = async () => {
        if (notificationChannelRef.current) {
          try {
            await supabase.removeChannel(notificationChannelRef.current);
            notificationChannelRef.current = null;
          } catch (error) {
            console.error('Error removing notification channel on cleanup:', error);
          }
        }
      };
      
      cleanupChannel();
    };
  }, [user?.id, refreshUnreadCount]);

  // Login function with proper error handling
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Login error:", error);
      throw error; // Re-throw for UI handling
    }
  };

  // Signup function with proper error handling
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Signup error:", error);
      throw error; // Re-throw for UI handling
    }
  };

  // Logout function with proper error handling
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // State resets (profile, unreadCount) are handled by onAuthStateChange
    } catch (error) {
      console.error("Logout error:", error);
      // Force reset local state on logout error
      setSession(null);
      setUser(null);
      setProfile(null);
      setUnreadNotificationsCount(0);
      throw error; // Re-throw for UI handling
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isAgent = profile?.role === 'agent';
  const isCustomer = profile?.role === 'customer';

  return (
    <AuthContext.Provider value={{
        session, 
        user, 
        profile, 
        loading, 
        isProfileLoading, 
        unreadNotificationsCount,
        login, 
        signUp, 
        logout, 
        fetchUserProfile: fetchUserProfileAndNotifications,
        isAdmin, 
        isAgent, 
        isCustomer, 
        refreshUnreadCount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};