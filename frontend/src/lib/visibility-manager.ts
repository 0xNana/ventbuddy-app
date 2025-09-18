import { supabase } from './supabase';

/**
 * Visibility Manager Service
 * Handles visibility caching, event logging, and real-time updates
 */
export class VisibilityManager {
  private cache = new Map<string, {
    visibility: number;
    timestamp: number;
    eventType: string;
  }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  /**
   * Get visibility for a post/reply with caching
   * Supports both legacy numeric IDs and encrypted string IDs
   */
  async getVisibility(postId: number | string, replyId?: number | string): Promise<{
    visibility: number;
    eventType: string;
    isCached: boolean;
  }> {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        visibility: cached.visibility,
        eventType: cached.eventType,
        isCached: true
      };
    }

    // Fetch from Supabase
    try {
      let result;
      
      // Check if we're using encrypted IDs (string) or legacy IDs (number)
      const isEncryptedPostId = typeof postId === 'string';
      const isEncryptedReplyId = replyId && typeof replyId === 'string';
      
      if (isEncryptedPostId || isEncryptedReplyId) {
        // Use encrypted ID columns
        if (replyId) {
          result = await supabase
            .from('visibility_events')
            .select('visibility_type, event_type, created_at')
            .eq('encrypted_post_id', postId)
            .eq('encrypted_reply_id', replyId)
            .order('created_at', { ascending: false })
            .limit(1);
        } else {
          result = await supabase
            .from('visibility_events')
            .select('visibility_type, event_type, created_at')
            .eq('encrypted_post_id', postId)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      } else {
        // Use legacy numeric ID columns
        if (replyId) {
          result = await supabase.rpc('get_latest_reply_visibility', {
            post_id_param: postId as number,
            reply_id_param: replyId as number
          });
        } else {
          result = await supabase.rpc('get_latest_visibility', {
            post_id_param: postId as number
          });
        }
      }

      if (result.data && result.data.length > 0) {
        const visibilityData = result.data[0];
        const visibility = visibilityData.visibility_type;
        const eventType = visibilityData.event_type;

        // Update cache
        this.cache.set(cacheKey, {
          visibility,
          timestamp: Date.now(),
          eventType
        });

        return {
          visibility,
          eventType,
          isCached: false
        };
      }
    } catch (error) {
      console.error('Error fetching visibility:', error);
    }

    // Default to public if no data found
    return {
      visibility: 1, // Public
      eventType: 'created',
      isCached: false
    };
  }

  /**
   * Log a visibility event to Supabase
   * Supports both legacy numeric IDs and encrypted string IDs
   */
  async logVisibilityEvent(data: {
    postId: number | string;
    replyId?: number | string;
    contentType: 'post' | 'reply';
    visibilityType: number;
    eventType: 'created' | 'updated' | 'unlocked' | 'revealed';
    userAddress?: string;
    encryptedVisibility?: string;
    encryptedUnlockPrice?: string; // Optional - stored in encrypted_content table, not here
    contentHash: string;
    previewHash: string;
    supabaseId: string;
  }): Promise<void> {
    try {
      // DEBUG: Log the data being inserted
      console.log('🔍 DEBUG - Logging visibility event:', {
        postId: data.postId,
        contentType: data.contentType,
        visibilityType: data.visibilityType,
        eventType: data.eventType
      });

      // Determine if we're using encrypted IDs or legacy numeric IDs
      const isEncryptedPostId = typeof data.postId === 'string';
      const isEncryptedReplyId = data.replyId && typeof data.replyId === 'string';
      
      const insertData: any = {
        content_type: data.contentType,
        visibility_type: data.visibilityType,
        event_type: data.eventType,
        user_address: data.userAddress || null,
        encrypted_visibility: data.encryptedVisibility || null,
        // Note: encrypted_unlock_price is stored in encrypted_content table, not here
        content_hash: data.contentHash,
        preview_hash: data.previewHash,
        supabase_id: data.supabaseId
      };
      
      // Add ID fields based on type
      if (isEncryptedPostId) {
        insertData.encrypted_post_id = data.postId;
        // Note: post_id column no longer exists in visibility_events table
      } else {
        // Convert numeric postId to encrypted format for consistency
        insertData.encrypted_post_id = `0x${(data.postId as number).toString(16).padStart(64, '0')}`;
      }
      
      if (data.replyId) {
        if (isEncryptedReplyId) {
          insertData.encrypted_reply_id = data.replyId;
        } else {
          // Convert numeric replyId to encrypted format for consistency
          insertData.encrypted_reply_id = `0x${(data.replyId as number).toString(16).padStart(64, '0')}`;
        }
        // Note: reply_id column no longer exists in visibility_events table
      } else {
        insertData.encrypted_reply_id = null;
      }

      console.log('🔍 DEBUG - Insert data:', insertData);

      const { error } = await supabase
        .from('visibility_events')
        .insert(insertData);

      if (error) {
        console.error('Error logging visibility event:', error);
        return;
      }

      // Update local cache
      const cacheKey = data.replyId ? `${data.postId}_${data.replyId}` : data.postId.toString();
      this.cache.set(cacheKey, {
        visibility: data.visibilityType,
        timestamp: Date.now(),
        eventType: data.eventType
      });

      // Notify listeners
      this.notifyListeners('visibility_updated', {
        postId: data.postId,
        replyId: data.replyId,
        visibility: data.visibilityType,
        eventType: data.eventType
      });

    } catch (error) {
      console.error('Error in logVisibilityEvent:', error);
    }
  }

  /**
   * Update visibility cache (called by real-time events)
   */
  updateVisibilityCache(postId: number, replyId: number | undefined, visibility: number, eventType: string): void {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    this.cache.set(cacheKey, {
      visibility,
      timestamp: Date.now(),
      eventType
    });

    // Notify listeners
    this.notifyListeners('visibility_updated', {
      postId,
      replyId,
      visibility,
      eventType
    });
  }

  /**
   * Clear cache for a specific post/reply
   */
  clearCache(postId: number, replyId?: number): void {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Check if user has access to content based on access_logs
   */
  async checkUserAccess(contentId: string, contentType: 'post' | 'reply', userEncryptedId: string): Promise<{
    hasAccess: boolean;
    accessType: string | null;
    lastAccess: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select('access_type, created_at')
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('user_encrypted_id', userEncryptedId)
        .in('access_type', ['tip', 'unlock', 'view'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking user access:', error);
        return { hasAccess: false, accessType: null, lastAccess: null };
      }

      if (data && data.length > 0) {
        return {
          hasAccess: true,
          accessType: data[0].access_type,
          lastAccess: data[0].created_at
        };
      }

      return { hasAccess: false, accessType: null, lastAccess: null };
    } catch (error) {
      console.error('Error in checkUserAccess:', error);
      return { hasAccess: false, accessType: null, lastAccess: null };
    }
  }

  /**
   * Check if user has access to content using plain address (no FHE encryption needed for reads)
   * This is used for checking access without triggering FHE encryption
   * 
   * SIMPLIFIED APPROACH: Instead of querying access_logs, we'll use visibility_type from visibility_events
   * - visibility_type = 0: Public content (everyone has access)
   * - visibility_type = 1: Tippable content (requires payment, check if user is author)
   */
  async checkUserAccessByAddress(contentId: number | string, contentType: 'post' | 'reply', userAddress: string): Promise<{
    hasAccess: boolean;
    accessType: string | null;
    lastAccess: string | null;
  }> {
    try {
      // Determine if we're using encrypted content ID or legacy numeric ID
      const isEncryptedContentId = typeof contentId === 'string';
      
      // Query visibility_events to get the visibility type
      let visibilityQuery = supabase
        .from('visibility_events')
        .select('visibility_type, event_type, created_at, user_address')
        .eq('content_type', contentType)
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Add the appropriate content ID filter
      if (isEncryptedContentId) {
        visibilityQuery = visibilityQuery.eq('encrypted_post_id', contentId);
      } else {
        // Convert numeric ID to encrypted format for consistency
        const encryptedContentId = `0x${(contentId as number).toString(16).padStart(64, '0')}`;
        visibilityQuery = visibilityQuery.eq('encrypted_post_id', encryptedContentId);
      }
      
      const { data: visibilityData, error: visibilityError } = await visibilityQuery;

      if (visibilityError) {
        console.error('Error querying visibility_events:', visibilityError);
        return { hasAccess: false, accessType: null, lastAccess: null };
      }

      if (visibilityData && visibilityData.length > 0) {
        const visibilityEvent = visibilityData[0];
        const visibilityType = visibilityEvent.visibility_type;
        
        // Check access based on visibility type
        if (visibilityType === 0) {
          // Public content - everyone has access
          return {
            hasAccess: true,
            accessType: 'public',
            lastAccess: visibilityEvent.created_at
          };
        } else if (visibilityType === 1) {
          // Tippable content - check if user is the author or has paid
          // For now, we'll assume if user is the author, they have access
          // TODO: Add payment verification logic here
          const isAuthor = visibilityEvent.user_address?.toLowerCase() === userAddress.toLowerCase();
          
          if (isAuthor) {
            return {
              hasAccess: true,
              accessType: 'author',
              lastAccess: visibilityEvent.created_at
            };
          } else {
            // User is not author - they need to pay to access
            return {
              hasAccess: false,
              accessType: 'requires_payment',
              lastAccess: null
            };
          }
        }
      }

      // Default: no access if no visibility data found
      return { hasAccess: false, accessType: null, lastAccess: null };
    } catch (error) {
      console.error('Error in checkUserAccessByAddress:', error);
      return { hasAccess: false, accessType: null, lastAccess: null };
    }
  }

  /**
   * Create a deterministic hash for user-content access checking
   * This allows us to check access without FHE encryption
   */
  private async createUserContentHash(userAddress: string, contentId: number | string): Promise<string> {
    // Create a deterministic hash that can be used for access checking
    // This is a simple approach - in production you might want something more sophisticated
    const input = `${userAddress.toLowerCase()}_${contentId}`;
    
    // Use Web Crypto API for consistent hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `0x${hashHex}`;
  }

  /**
   * Log access to content (for tracking who has accessed what)
   * This is used for analytics and access control
   * 
   * SIMPLIFIED APPROACH: Instead of logging to access_logs table, we'll log visibility events
   * when users unlock content, which provides the same tracking capability
   */
  async logAccess(data: {
    contentId: number | string;
    contentType: 'post' | 'reply';
    userAddress: string; // Changed from userEncryptedId to userAddress
    accessType: 'view' | 'tip' | 'unlock' | 'subscribe';
    amountWei?: number;
  }): Promise<void> {
    try {
      // For now, we'll just log this access event to the console
      // In the future, we could log to a separate analytics table if needed
      console.log('✅ Access logged:', {
        contentId: data.contentId,
        contentType: data.contentType,
        accessType: data.accessType,
        userAddress: data.userAddress,
        amountWei: data.amountWei,
        timestamp: new Date().toISOString()
      });
      
      // TODO: If we need to track access for analytics, we could:
      // 1. Create a separate analytics table
      // 2. Log to visibility_events with event_type = 'accessed'
      // 3. Use a different approach entirely
      
    } catch (error) {
      console.error('Error in logAccess:', error);
    }
  }

  /**
   * Debug function to check visibility for a specific content
   */
  async debugVisibility(contentId: string, contentType: 'post' | 'reply' = 'post'): Promise<{
    contentId: string;
    contentType: string;
    visibilityEvents: any[];
    latestEvent: any;
    visibilityType: number | null;
    isLocked: boolean;
  }> {
    try {
      // Query visibility events for this content
      const { data: events, error } = await supabase
        .from('visibility_events')
        .select('*')
        .eq('encrypted_post_id', contentId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching visibility events for debug:', error);
        return {
          contentId,
          contentType,
          visibilityEvents: [],
          latestEvent: null,
          visibilityType: null,
          isLocked: false
        };
      }

      const latestEvent = events?.[0] || null;
      const visibilityType = latestEvent?.visibility_type ?? null;
      const isLocked = visibilityType === 1;

      console.log('🔍 DEBUG - Visibility check:', {
        contentId,
        contentType,
        totalEvents: events?.length || 0,
        latestEvent,
        visibilityType,
        isLocked
      });

      return {
        contentId,
        contentType,
        visibilityEvents: events || [],
        latestEvent,
        visibilityType,
        isLocked
      };
    } catch (error) {
      console.error('Error in debugVisibility:', error);
      return {
        contentId,
        contentType,
        visibilityEvents: [],
        latestEvent: null,
        visibilityType: null,
        isLocked: false
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; visibility: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      visibility: value.visibility,
      age: now - value.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const visibilityManager = new VisibilityManager();
