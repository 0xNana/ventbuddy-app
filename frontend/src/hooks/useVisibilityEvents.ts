import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { visibilityManager } from '../lib/visibility-manager';
import { supabase } from '../lib/supabase';

export function useVisibilityEvents() {
  const { address, isConnected } = useAccount();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  const getVisibility = useCallback(async (postId: number, replyId?: number) => {
    try {
      return await visibilityManager.getVisibility(postId, replyId);
    } catch (err) {
      console.error('Error getting visibility:', err);
      
      setTimeout(() => {
        setError(err instanceof Error ? err.message : 'Failed to get visibility');
      }, 0);
      return {
        visibility: 1, 
        eventType: 'created',
        isCached: false
      };
    }
  }, []);

  
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
      
      setTimeout(() => {
        setError(err instanceof Error ? err.message : 'Failed to log visibility event');
      }, 0);
    }
  }, []);

  
  const clearCache = useCallback((postId?: number, replyId?: number) => {
    if (postId !== undefined) {
      visibilityManager.clearCache(postId, replyId);
    } else {
      visibilityManager.clearAllCache();
    }
  }, []);

  
  const getCacheStats = useCallback(() => {
    return visibilityManager.getCacheStats();
  }, []);

  
  useEffect(() => {
    if (!isConnected || !address) {
      setIsListening(false);
      return;
    }

    const setupRealtimeSubscriptions = async () => {
      try {
        
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

        
        setTimeout(() => {
          setIsListening(true);
          setError(null);
        }, 0);
      } catch (err) {
        console.error('❌ Failed to set up visibility subscriptions:', err);
        setTimeout(() => {
          setError(err instanceof Error ? err.message : 'Failed to set up subscriptions');
          setIsListening(false);
        }, 0);
      }
    };

    setupRealtimeSubscriptions();

   
    return () => {
      
      setTimeout(() => {
        setIsListening(false);
      }, 0);
    };
  }, [isConnected, address]);


  useEffect(() => {
    const handleVisibilityUpdate = (data: any) => {
      setTimeout(() => {
       
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

  
  useEffect(() => {
    fetchVisibility();
  }, [fetchVisibility]);

  
  useEffect(() => {
    const handleVisibilityUpdate = (event: CustomEvent) => {
      const { postId: updatedPostId, replyId: updatedReplyId } = event.detail;
      
      
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
