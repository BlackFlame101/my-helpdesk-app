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
const INITIAL_AUTH_TIMEOUT = 10000; // 10 seconds maximum for initial auth

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
  const [loading, setLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [initComplete, setInitComplete] = useState(false);
  
  // Refs
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const authRetryCountRef = useRef(0);
  const initialAuthTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (initialAuthTimeoutRef.current) {
      clearTimeout(initialAuthTimeoutRef.current);
      initialAuthTimeoutRef.current = null;
    }
  }, []);

  // Complete app state reset function
  const resetAppState = useCallback(() => {
    console.log("Resetting application state...");
    clearAllTimeouts();
    
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
    
    clearAllTimeouts();
    
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
  }, [clearAllTimeouts]);

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

  // First, declare setupNotificationChannel
  const setupNotificationChannel = useCallback(async (userId: string) => {
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

    if (!userId || !mountedRef.current) return;

    try {
      console.log(`Setting up notification channel for user ${userId}`);
      
      // Create a simple channel name with no special characters
      const channelName = `notifications_${userId.replace(/-/g, '_')}`;
      
      // Create the channel
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications', 
            filter: `user_id=eq.${userId}` 
          },
          (payload) => {
            console.log('New notification received:', payload);
            if (mountedRef.current) {
              refreshUnreadCount();
            }
          }
        );

      // Subscribe to the channel
      await channel.subscribe();
      
      console.log(`Subscribed to notifications for user ${userId}`);
      if (mountedRef.current) {
        notificationChannelRef.current = channel;
      } else {
        // If component unmounted during setup, immediately clean up
        supabase.removeChannel(channel).catch(err => 
          console.error("Error removing channel after unmount:", err)
        );
      }
    } catch (error) {
      console.error(`Error setting up notification channel for user ${userId}:`, error);
      // Try to re-subscribe once on error after a delay
      if (mountedRef.current) {
        setTimeout(() => {
          if (mountedRef.current && user?.id === userId) {
            setupNotificationChannel(userId).catch(e => 
              console.error("Notification channel retry failed:", e)
            );
          }
        }, 5000);
      }
    }
  }, [user?.id, refreshUnreadCount]);

  // Then declare initializeUserAfterAuth which uses it
  const initializeUserAfterAuth = useCallback(async (userId: string) => {
    try {
      await fetchUserProfileAndNotifications(userId);
      // Ensure notification channel is set up
      await setupNotificationChannel(userId);
    } catch (error) {
      console.error("Error initializing user after auth:", error);
      throw error;
    }
  }, [fetchUserProfileAndNotifications, setupNotificationChannel]);

  // Then add the notification channel effect
  useEffect(() => {
    const currentUserId = user?.id;
    if (currentUserId) {
      setupNotificationChannel(currentUserId);
    }

    return () => {
      // Clean up timeouts
      clearAllTimeouts();
      
      // Clean up notification channel synchronously
      if (notificationChannelRef.current) {
        try {
          // Use Promise.resolve to handle both sync and async cases
          Promise.resolve(supabase.removeChannel(notificationChannelRef.current))
            .catch(error => {
              console.error('Error removing notification channel on cleanup:', error);
            })
            .finally(() => {
              notificationChannelRef.current = null;
            });
        } catch (error) {
          console.error('Error initiating channel cleanup:', error);
          notificationChannelRef.current = null;
        }
      }
    };
  }, [user?.id, setupNotificationChannel, clearAllTimeouts]);

  // Function to refresh auth state - can be called manually to reinitialize
  const refreshAuthState = useCallback(async () => {
    console.log("[Auth Debug] Starting refreshAuthState");
    if (authRetryCountRef.current > 3 || !mountedRef.current) {
      console.warn("[Auth Debug] Too many auth refresh attempts or component unmounted, aborting");
      setLoading(false); // Ensure we're not stuck loading
      return;
    }
    
    authRetryCountRef.current += 1;
    console.log("[Auth Debug] Attempt #", authRetryCountRef.current);
    
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      console.log("[Auth Debug] Got session response:", { hasSession: !!currentSession, hasError: !!sessionError });
      
      if (sessionError) {
        console.error("[Auth Debug] Session error:", sessionError);
        throw sessionError;
      }

      if (!mountedRef.current) {
        console.log("[Auth Debug] Component unmounted during session fetch");
        return;
      }
      
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      console.log("[Auth Debug] Updated session and user state:", { hasUser: !!currentUser });

      if (currentUser) {
        try {
          console.log("[Auth Debug] Fetching user profile");
          await fetchUserProfileAndNotifications(currentUser.id);
          console.log("[Auth Debug] Successfully fetched profile");
          // Ensure we clear loading state after successful profile fetch
          if (mountedRef.current) {
            setLoading(false);
            setInitComplete(true);
          }
        } catch (profileError) {
          console.error("[Auth Debug] Error fetching initial user profile:", profileError);
          if (mountedRef.current) {
            setProfile(null);
            setUnreadNotificationsCount(0);
            setLoading(false);
            setInitComplete(true);
          }
        }
      } else {
        console.log("[Auth Debug] No user, clearing profile");
        setProfile(null);
        setUnreadNotificationsCount(0);
        if (mountedRef.current) {
          setLoading(false);
          setInitComplete(true);
        }
      }
    } catch (error) {
      console.error("[Auth Debug] Error refreshing auth state:", error);
      if (mountedRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setUnreadNotificationsCount(0);
        setLoading(false);
        setInitComplete(true);
      }
    }
  }, [fetchUserProfileAndNotifications]);

  // Effect for initial session and auth state changes
  useEffect(() => {
    console.log("[Auth Debug] Initializing auth effect");
    mountedRef.current = true;
    let isEffectActive = true; // Add local flag for this effect instance
    
    // Set a timeout to prevent infinite loading
    initialAuthTimeoutRef.current = setTimeout(() => {
      if (isEffectActive && loading) {
        console.warn('[Auth Debug] Initial auth timed out, resetting state...');
        setLoading(false);
        setInitComplete(true);
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    }, INITIAL_AUTH_TIMEOUT);

    // Initialize auth state
    refreshAuthState().catch(error => {
      console.error("[Auth Debug] Error during initial auth:", error);
      if (isEffectActive) {
        setLoading(false);
        setInitComplete(true);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        console.log("[Auth Debug] Auth state change event:", _event);
        if (!isEffectActive) {
          console.log("[Auth Debug] Ignoring auth change - effect cleanup triggered");
          return;
        }
        
        try {
          setSession(currentSession);
          const newCurrentUser = currentSession?.user ?? null;
          setUser(newCurrentUser);
          console.log("[Auth Debug] Updated auth state:", { hasUser: !!newCurrentUser });

          if (newCurrentUser) {
            try {
              console.log("[Auth Debug] Initializing user after auth change");
              await initializeUserAfterAuth(newCurrentUser.id);
              console.log("[Auth Debug] Successfully initialized user");
            } catch (profileError) {
              console.error("[Auth Debug] Error initializing user on auth change:", profileError);
              safeSetProfileLoading(false);
              
              if (isEffectActive && newCurrentUser.id) {
                setTimeout(() => {
                  if (isEffectActive && newCurrentUser.id) {
                    initializeUserAfterAuth(newCurrentUser.id).catch(e => 
                      console.error("[Auth Debug] Retry user initialization failed:", e)
                    );
                  }
                }, 2000);
              }
            }
          } else {
            console.log("[Auth Debug] No user in auth change, clearing profile");
            setProfile(null);
            setUnreadNotificationsCount(0);
          }
        } catch (error) {
          console.error("[Auth Debug] Error in auth state change handler:", error);
          safeSetProfileLoading(false);
        } finally {
          if (_event === 'INITIAL_SESSION' && isEffectActive) {
            console.log("[Auth Debug] Initial session complete");
            setLoading(false);
            setInitComplete(true);
            // Clear the initial auth timeout since we're done
            if (initialAuthTimeoutRef.current) {
              clearTimeout(initialAuthTimeoutRef.current);
              initialAuthTimeoutRef.current = null;
            }
          }
        }
      }
    );

    return () => {
      console.log("[Auth Debug] Cleaning up auth effect");
      isEffectActive = false; // Mark this effect instance as inactive
      mountedRef.current = false;
      clearAllTimeouts();
      
      if (authListener?.subscription) {
        try {
          authListener.subscription.unsubscribe();
        } catch (error) {
          console.error("[Auth Debug] Error unsubscribing from auth listener:", error);
        }
      }
    };
  }, [refreshAuthState, fetchUserProfileAndNotifications, clearAllTimeouts, safeSetProfileLoading, profile?.id, loading]);

  // Finally update the login function to use initializeUserAfterAuth
  const login = useCallback(async (email: string, password: string) => {
    try {
      safeSetProfileLoading(true);
      const authData = await withRetry(async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
      }, 1); // 1 retry for login

      // If login successful, immediately initialize the user
      if (authData.user) {
        await initializeUserAfterAuth(authData.user.id);
      }

      return authData;
    } catch (error) {
      console.error("Login error after retries:", error);
      throw error; // Re-throw for UI handling
    } finally {
      safeSetProfileLoading(false);
    }
  }, [initializeUserAfterAuth, safeSetProfileLoading]);

  // Signup function with proper error handling and retry
  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      safeSetProfileLoading(true);
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
    } finally {
      safeSetProfileLoading(false);
    }
  };

  // Logout function with proper error handling
  const logout = async () => {
    try {
      safeSetProfileLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Force reset state regardless of success to ensure UI consistency
      resetAppState();
    } catch (error) {
      console.error("Logout error:", error);
      // Force reset state on error
      resetAppState();
      throw error; // Re-throw for UI handling
    } finally {
      safeSetProfileLoading(false);
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
