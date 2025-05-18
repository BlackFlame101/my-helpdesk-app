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
const PROFILE_FETCH_TIMEOUT = 8000; // 8 seconds
const NOTIFICATION_DEBOUNCE = 300; // 300ms
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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
  resetAppState: () => void; // New function to reset the entire app state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Utility function for retry logic
const withRetry = async <T,>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY,
  onRetry?: (attempt: number, error: any) => void
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${retries + 1}):`, error);
      
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      if (attempt < retries) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * (2 ** attempt)));
      }
    }
  }
  
  throw lastError;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // For initial auth session check
  const [isProfileLoading, setIsProfileLoading] = useState(false); // For profile/notification fetching
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [initComplete, setInitComplete] = useState(false); // Track if initialization is complete
  
  // Refs
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const authRetryCountRef = useRef(0);
  
  // Clear any existing timeouts to prevent memory leaks
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Complete app state reset function
  const resetAppState = useCallback(() => {
    console.log("Resetting application state...");
    clearTimeouts();
    
    // Reset all state
    setSession(null);
    setUser(null);
    setProfile(null);
    setUnreadNotificationsCount(0);
    setIsProfileLoading(false);
    
    // Clean up realtime subscriptions
    if (notificationChannelRef.current) {
      try {
        supabase.removeChannel(notificationChannelRef.current).catch(err => 
          console.error("Error removing channel during reset:", err)
        );
        notificationChannelRef.current = null;
      } catch (error) {
        console.error("Failed to clean up notification channel:", error);
      }
    }
    
    // Re-initialize auth if needed
    if (!loading && mountedRef.current && initComplete) {
      console.log("Attempting to reinitialize auth after reset...");
      refreshAuthState();
    }
  }, [loading, initComplete]);

  // Safe version of setIsProfileLoading with timeout protection
  const safeSetProfileLoading = useCallback((isLoading: boolean) => {
    if (!mountedRef.current) return;
    
    clearTimeouts();
    
    if (isLoading) {
      // If setting to loading=true, also set a timeout to reset it
      setIsProfileLoading(true);
      timeoutRef.current = setTimeout(() => {
        console.warn("Profile fetch operation timed out, resetting loading state");
        if (mountedRef.current) {
          setIsProfileLoading(false);
        }
      }, PROFILE_FETCH_TIMEOUT);
    } else {
      // If setting to loading=false, just set it
      setIsProfileLoading(false);
    }
  }, [clearTimeouts]);

  // Debounced version of the notification refresh to prevent rapid refetching
  const debouncedRefreshNotifications = useCallback(
    debounce(async (userId: string) => {
      if (!userId || !mountedRef.current) return;
      
      try {
        const unreadNotifs = await fetchUserNotifications(userId, 100, true);
        if (mountedRef.current) {
          setUnreadNotificationsCount(unreadNotifs.length);
        }
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

  // Main function to fetch user profile and notifications with retry
  const fetchUserProfileAndNotifications = useCallback(async (userId: string) => {
    if (!userId || !mountedRef.current) return;
    
    safeSetProfileLoading(true);
    
    try {
      await withRetry(async () => {
        if (!mountedRef.current) return;
        
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
        
        // Only process results if component is still mounted
        if (!mountedRef.current) return;
        
        // Handle profile response
        if (profileResponse.status === 'fulfilled') {
          const { data: profileData, error: profileError } = profileResponse.value;
          
          if (profileError) {
            console.error('Error fetching profile in context:', profileError);
            throw profileError; // Propagate error for retry
          } else {
            setProfile(profileData as UserProfile);
          }
        } else {
          console.error('Profile fetch rejected:', profileResponse.reason);
          throw profileResponse.reason; // Propagate error for retry
        }
        
        // Handle notifications response
        if (notificationsResponse.status === 'fulfilled') {
          setUnreadNotificationsCount(notificationsResponse.value.length);
        } else {
          console.error('Notifications fetch rejected:', notificationsResponse.reason);
          // Don't throw here as notifications are less critical than profile
          setUnreadNotificationsCount(0);
        }
      }, 2); // 2 retries for profile fetching
    } catch (error) {
      console.error('All retries failed fetching profile and notifications:', error);
      if (mountedRef.current) {
        setProfile(null);
        setUnreadNotificationsCount(0);
      }
    } finally {
      safeSetProfileLoading(false);
    }
  }, [safeSetProfileLoading]);

  // Function to refresh auth state - can be called manually to reinitialize
  const refreshAuthState = useCallback(async () => {
    if (authRetryCountRef.current > 3 || !mountedRef.current) {
      console.warn("Too many auth refresh attempts or component unmounted, aborting");
      return;
    }
    
    authRetryCountRef.current += 1;
    
    try {
      setLoading(true);
      
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (!mountedRef.current) return;
      
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        try {
          await fetchUserProfileAndNotifications(currentUser.id);
        } catch (profileError) {
          console.error("Error fetching initial user profile:", profileError);
          if (mountedRef.current) {
            setProfile(null);
            setUnreadNotificationsCount(0);
          }
        }
      } else {
        setProfile(null);
        setUnreadNotificationsCount(0);
      }
      
      setInitComplete(true);
    } catch (error) {
      console.error("Error refreshing auth state:", error);
      if (mountedRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setUnreadNotificationsCount(0);
        setInitComplete(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        
        // Reset retry counter after a successful refresh or final attempt
        setTimeout(() => {
          authRetryCountRef.current = 0;
        }, 10000);
      }
    }
  }, [fetchUserProfileAndNotifications]);

  // Effect for initial session and auth state changes
  useEffect(() => {
    mountedRef.current = true;
    
    refreshAuthState();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mountedRef.current) return;
        
        try {
          // First update react state with basic session info
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
                // Reset states on error and retry once more
                safeSetProfileLoading(false);
                
                // One more attempt after a short delay
                setTimeout(() => {
                  if (mountedRef.current && newCurrentUser.id) {
                    fetchUserProfileAndNotifications(newCurrentUser.id).catch(e => 
                      console.error("Retry fetch user profile failed:", e)
                    );
                  }
                }, 2000);
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
          if (_event === 'INITIAL_SESSION' && mountedRef.current) {
            setLoading(false);
            setInitComplete(true);
          }
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeouts();
      
      if (authListener?.subscription) {
        try {
          authListener.subscription.unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from auth listener:", error);
        }
      }
    };
  }, [refreshAuthState, fetchUserProfileAndNotifications, clearTimeouts, safeSetProfileLoading, profile?.id]);

  // Effect for Realtime Notification Subscription
  useEffect(() => {
    const currentUserId = user?.id;

    const setupNotificationChannel = async () => {
      // Don't proceed if component unmounted
      if (!mountedRef.current) return;
      
      // Cleanup previous channel if it exists
      if (notificationChannelRef.current) {
        try {
          await supabase.removeChannel(notificationChannelRef.current);
        } catch (err) {
          console.error('Error removing previous notification channel:', err);
        }
        notificationChannelRef.current = null;
      }

      if (!currentUserId || !mountedRef.current) return;

      try {
        console.log(`Setting up notification channel for user ${currentUserId}`);
        
        // Create a simple channel name with no special characters
        const channelName = `notifications_${currentUserId.replace(/-/g, '_')}`;
        
        const channel = supabase
          .channel(channelName)
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
              if (mountedRef.current) {
                refreshUnreadCount();
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`Subscribed to notifications for user ${currentUserId}`);
            } else if (err) {
              console.error(`Notification subscription error for user ${currentUserId}:`, err);
              
              // Try to re-subscribe once on error after a delay
              if (mountedRef.current && err) {
                setTimeout(() => {
                  if (mountedRef.current && user?.id === currentUserId) {
                    setupNotificationChannel().catch(e => 
                      console.error("Notification channel retry failed:", e)
                    );
                  }
                }, 5000);
              }
            }
          });
          
        if (mountedRef.current) {
          notificationChannelRef.current = channel;
        } else {
          // If component unmounted during setup, immediately clean up
          supabase.removeChannel(channel).catch(err => 
            console.error("Error removing channel after unmount:", err)
          );
        }
      } catch (error) {
        console.error("Error setting up notification channel:", error);
      }
    };

    setupNotificationChannel();

    return () => {
      const cleanupChannel = async () => {
        if (notificationChannelRef.current) {
          try {
            await supabase.removeChannel(notificationChannelRef.current);
          } catch (error) {
            console.error('Error removing notification channel on cleanup:', error);
          } finally {
            notificationChannelRef.current = null;
          }
        }
      };
      
      cleanupChannel();
    };
  }, [user?.id, refreshUnreadCount]);

  // Login function with proper error handling and retry
  const login = async (email: string, password: string) => {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      }, 1); // 1 retry for login
    } catch (error) {
      console.error("Login error after retries:", error);
      throw error; // Re-throw for UI handling
    }
  };

  // Signup function with proper error handling and retry
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        return data;
      }, 1); // 1 retry for signup
    } catch (error) {
      console.error("Signup error after retries:", error);
      throw error; // Re-throw for UI handling
    }
  };

  // Logout function with proper error handling
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Force reset state regardless of success to ensure UI consistency
      resetAppState();
    } catch (error) {
      console.error("Logout error:", error);
      // Force reset state on error
      resetAppState();
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
        refreshUnreadCount,
        resetAppState
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

// Create a reset function that can be called from any component when critical UI errors are detected
export const useResetAuth = () => {
  const { resetAppState } = useAuth();
  return resetAppState;
};

// Custom hook to wrap components with error boundary functionality
export const useAuthErrorHandling = (callback: Function) => {
  const { resetAppState } = useAuth();
  
  return useCallback(async (...args: any[]) => {
    try {
      return await callback(...args);
    } catch (error) {
      console.error("Auth operation failed:", error);
      // For certain critical errors, reset the entire app state
      if (error instanceof Error && (
        error.message?.includes("JWT") || 
        error.message?.includes("token") ||
        error.message?.includes("session") ||
        error.message?.includes("auth")
      )) {
        console.warn("Critical auth error detected, resetting application state");
        resetAppState();
      }
      throw error;
    }
  }, [callback, resetAppState]);
};
