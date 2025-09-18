import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { visibilityManager } from '../lib/visibility-manager';
import { supabase } from '../lib/supabase';

/**
 * Hook for managing visibility events and real-time updates
 * Combines Supabase Realtime with contract event listening
 */
export function useVisibilityEvents() {
  const { address, isConnected } = useAccount();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get visibility for a post or reply
   */
  const getVisibility = useCallback(async (postId: number, replyId?: number) => {
    try {
      return await visibilityManager.getVisibility(postId, replyId);
    } catch (err) {
      console.error('Error getting visibility:', err);
      // Defer state update to avoid React render warnings
      setTimeout(() => {
        setError(err instanceof Error ? err.message : 'Failed to get visibility');
      }, 0);
      return {
        visibility: 1, // Default to public
        eventType: 'created',
        isCached: false
      };
    }
  }, []);

  /**
   * Log a visibility event
   */
  const logVisibilityEvent = useCallback(async (data: {
    postId: number;
    replyId?: number;
    contentType: 'post' | 'reply';
    visibilityType: number;
    eventType: 'created' | 'updated' | 'unlocked' | 'revealed';
    userAddress?: string;
    encryptedVisibility?: string;
    encryptedUnlockPrice?: string;
    contentHash: string;
    previewHash: string;
    supabaseId: string;
  }) => {
    try {
      await visibilityManager.logVisibilityEvent(data);
    } catch (err) {
      console.error('Error logging visibility event:', err);
      // Defer state update to avoid React render warnings
      setTimeout(() => {
        setError(err instanceof Error ? err.message : 'Failed to log visibility event');
      }, 0);
    }
  }, []);

  /**
   * Clear visibility cache
   */
  const clearCache = useCallback((postId?: number, replyId?: number) => {
    if (postId !== undefined) {
      visibilityManager.clearCache(postId, replyId);
    } else {
      visibilityManager.clearAllCache();
    }
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return visibilityManager.getCacheStats();
  }, []);

  /**
   * Set up real-time subscriptions
   */
  useEffect(() => {
    if (!isConnected || !address) {
      setIsListening(false);
      return;
    }

    const setupRealtimeSubscriptions = async () => {
      try {
        // Set up Supabase real-time subscription for visibility events
        const subscription = supabase
          .channel('visibility_events')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'visibility_events',
            },
            (payload) => {
              try {
                const { post_id, reply_id, visibility_type, event_type } = payload.new;
                
                visibilityManager.updateVisibilityCache(
                  post_id,
                  reply_id,
                  visibility_type,
                  event_type
                );

                // Emit custom event for components to listen to
                window.dispatchEvent(new CustomEvent('visibilityUpdated', {
                  detail: {
                    postId: post_id,
                    replyId: reply_id,
                    visibility: visibility_type,
                    eventType: event_type
                  }
                }));
              } catch (error) {
                console.error('Error handling visibility event:', error);
              }
            }
          )
          .subscribe();

        // Defer state updates to avoid React render warnings
        setTimeout(() => {
          setIsListening(true);
          setError(null);
        }, 0);
      } catch (err) {
        console.error('❌ Failed to set up visibility subscriptions:', err);
        // Defer state updates to avoid React render warnings
        setTimeout(() => {
          setError(err instanceof Error ? err.message : 'Failed to set up subscriptions');
          setIsListening(false);
        }, 0);
      }
    };

    setupRealtimeSubscriptions();

    // Cleanup function
    return () => {
      // Cleanup is handled automatically by Supabase when the component unmounts
      // Defer state update to avoid React render warnings
      setTimeout(() => {
        setIsListening(false);
      }, 0);
    };
  }, [isConnected, address]);

  /**
   * Set up visibility manager event listeners
   */
  useEffect(() => {
    const handleVisibilityUpdate = (data: any) => {
      // Defer to avoid React render warnings
      setTimeout(() => {
        // You can emit custom events here if needed
        window.dispatchEvent(new CustomEvent('visibilityUpdated', { detail: data }));
      }, 0);
    };

    visibilityManager.addEventListener('visibility_updated', handleVisibilityUpdate);

    return () => {
      visibilityManager.removeEventListener('visibility_updated', handleVisibilityUpdate);
    };
  }, []);

  return {
    getVisibility,
    logVisibilityEvent,
    clearCache,
    getCacheStats,
    isListening,
    error,
  };
}

/**
 * Hook for getting visibility of a specific post/reply
 */
export function usePostVisibility(postId: number, replyId?: number) {
  const { getVisibility } = useVisibilityEvents();
  const [visibility, setVisibility] = useState<{
    visibility: number;
    eventType: string;
    isCached: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisibility = useCallback(async () => {
    if (!postId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getVisibility(postId, replyId);
      setVisibility(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch visibility');
    } finally {
      setIsLoading(false);
    }
  }, [postId, replyId, getVisibility]);

  // Fetch visibility on mount and when postId/replyId changes
  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  // Listen for visibility updates
  useEffect(() => {
    const handleVisibilityUpdate = (event: CustomEvent) => {
      const { postId: updatedPostId, replyId: updatedReplyId } = event.detail;
      
      // Check if this update is for our post/reply
      if (updatedPostId === postId && updatedReplyId === replyId) {
        fetchVisibility();
      }
    };

    window.addEventListener('visibilityUpdated', handleVisibilityUpdate as EventListener);
    
    return () => {
      window.removeEventListener('visibilityUpdated', handleVisibilityUpdate as EventListener);
    };
  }, [postId, replyId, fetchVisibility]);

  return {
    visibility,
    isLoading,
    error,
    refetch: fetchVisibility,
  };
}
