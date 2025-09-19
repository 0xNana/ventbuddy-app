import { supabase } from './supabase';

export class VisibilityManager {
  private cache = new Map<string, {
    visibility: number;
    timestamp: number;
    eventType: string;
  }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  async getVisibility(postId: number | string, replyId?: number | string): Promise<{
    visibility: number;
    eventType: string;
    isCached: boolean;
  }> {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        visibility: cached.visibility,
        eventType: cached.eventType,
        isCached: true
      };
    }

    try {
      let result;
      
      const isEncryptedPostId = typeof postId === 'string';
      const isEncryptedReplyId = replyId && typeof replyId === 'string';
      
      if (isEncryptedPostId || isEncryptedReplyId) {
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
      
    }

    return {
      visibility: 1,  
      eventType: 'created',
      isCached: false
    };
  }

  async logVisibilityEvent(data: {
    postId: number | string;
    replyId?: number | string;
    contentType: 'post' | 'reply';
    visibilityType: number;
    eventType: 'created' | 'updated' | 'unlocked' | 'revealed';
    userAddress?: string;
    encryptedVisibility?: string;
    encryptedUnlockPrice?: string; 
    contentHash: string;
    previewHash: string;
    supabaseId: string;
  }): Promise<void> {
    try {

      const isEncryptedPostId = typeof data.postId === 'string';
      const isEncryptedReplyId = data.replyId && typeof data.replyId === 'string';
      
      const insertData: any = {
        content_type: data.contentType,
        visibility_type: data.visibilityType,
        event_type: data.eventType,
        user_address: data.userAddress || null,
        encrypted_visibility: data.encryptedVisibility || null,
        content_hash: data.contentHash,
        preview_hash: data.previewHash,
        supabase_id: data.supabaseId
      };
      
      if (isEncryptedPostId) {
        insertData.encrypted_post_id = data.postId;
      } else {
        insertData.encrypted_post_id = `0x${(data.postId as number).toString(16).padStart(64, '0')}`;
      }
      
      if (data.replyId) {
        if (isEncryptedReplyId) {
          insertData.encrypted_reply_id = data.replyId;
        } else {
          insertData.encrypted_reply_id = `0x${(data.replyId as number).toString(16).padStart(64, '0')}`;
        }
      } else {
        insertData.encrypted_reply_id = null;
      }


      const { error } = await supabase
        .from('visibility_events')
        .insert(insertData);

      if (error) {
        return;
      }

      const cacheKey = data.replyId ? `${data.postId}_${data.replyId}` : data.postId.toString();
      this.cache.set(cacheKey, {
        visibility: data.visibilityType,
        timestamp: Date.now(),
        eventType: data.eventType
      });

      this.notifyListeners('visibility_updated', {
        postId: data.postId,
        replyId: data.replyId,
        visibility: data.visibilityType,
        eventType: data.eventType
      });

    } catch (error) {
      // Silent error handling
    }
  }

  updateVisibilityCache(postId: number, replyId: number | undefined, visibility: number, eventType: string): void {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    this.cache.set(cacheKey, {
      visibility,
      timestamp: Date.now(),
      eventType
    });

    this.notifyListeners('visibility_updated', {
      postId,
      replyId,
      visibility,
      eventType
    });
  }

  clearCache(postId: number, replyId?: number): void {
    const cacheKey = replyId ? `${postId}_${replyId}` : postId.toString();
    this.cache.delete(cacheKey);
  }

  clearAllCache(): void {
    this.cache.clear();
  }

  addEventListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeEventListener(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Silent error handling
        }
      });
    }
  }

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
      return { hasAccess: false, accessType: null, lastAccess: null };
    }
  }

  async checkUserAccessByAddress(contentId: number | string, contentType: 'post' | 'reply', userAddress: string): Promise<{
    hasAccess: boolean;
    accessType: string | null;
    lastAccess: string | null;
  }> {
    try {
      const isEncryptedContentId = typeof contentId === 'string';
      
      let visibilityQuery = supabase
        .from('visibility_events')
        .select('visibility_type, event_type, created_at, user_address')
        .eq('content_type', contentType)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (isEncryptedContentId) {
        visibilityQuery = visibilityQuery.eq('encrypted_post_id', contentId);
      } else {
        const encryptedContentId = `0x${(contentId as number).toString(16).padStart(64, '0')}`;
        visibilityQuery = visibilityQuery.eq('encrypted_post_id', encryptedContentId);
      }
      
      const { data: visibilityData, error: visibilityError } = await visibilityQuery;

      if (visibilityError) {
        return { hasAccess: false, accessType: null, lastAccess: null };
      }

      if (visibilityData && visibilityData.length > 0) {
        const visibilityEvent = visibilityData[0];
        const visibilityType = visibilityEvent.visibility_type;
        
        if (visibilityType === 0) {
          return {
            hasAccess: true,
            accessType: 'public',
            lastAccess: visibilityEvent.created_at
          };
        } else if (visibilityType === 1) {
          const isAuthor = visibilityEvent.user_address?.toLowerCase() === userAddress.toLowerCase();
          
          if (isAuthor) {
            return {
              hasAccess: true,
              accessType: 'author',
              lastAccess: visibilityEvent.created_at
            };
          } else {
            return {
              hasAccess: false,
              accessType: 'requires_payment',
              lastAccess: null
            };
          }
        }
      }

      return { hasAccess: false, accessType: null, lastAccess: null };
    } catch (error) {
      return { hasAccess: false, accessType: null, lastAccess: null };
    }
  }

  private async createUserContentHash(userAddress: string, contentId: number | string): Promise<string> {
    const input = `${userAddress.toLowerCase()}_${contentId}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `0x${hashHex}`;
  }

  async logAccess(data: {
    contentId: number | string;
    contentType: 'post' | 'reply';
    userAddress: string;
    accessType: 'view' | 'tip' | 'unlock' | 'subscribe';
    amountWei?: number;
  }): Promise<void> {
    // Access logging placeholder - can be implemented later if needed
  }

  async debugVisibility(contentId: string, contentType: 'post' | 'reply' = 'post'): Promise<{
    contentId: string;
    contentType: string;
    visibilityEvents: any[];
    latestEvent: any;
    visibilityType: number | null;
    isLocked: boolean;
  }> {
    try { 
      const { data: events, error } = await supabase
        .from('visibility_events')
        .select('*')
        .eq('encrypted_post_id', contentId)
        .eq('content_type', contentType)
        .order('created_at', { ascending: false });

      if (error) {
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


      return {
        contentId,
        contentType,
        visibilityEvents: events || [],
        latestEvent,
        visibilityType,
        isLocked
      };
    } catch (error) {
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
export const visibilityManager = new VisibilityManager();
