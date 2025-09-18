import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need Supabase auth, using wallet auth
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'Accept': 'application/json',
    },
  },
});

// Types for our database tables
export interface EncryptedContent {
  id: number;
  content_hash: string;
  preview_hash: string;
  encrypted_content: string;
  encrypted_preview: string;
  author_id: string;
  min_tip_amount?: number; // Minimum tip amount required to unlock tippable content
  raw_post_id: number; // Plain uint64 post ID from smart contract (sequential counter)
  encrypted_post_id?: string; // Legacy encrypted post ID (kept for backward compatibility)
  created_at: string;
  updated_at: string;
}

export interface EncryptedReply {
  id: number;
  post_id: number;
  reply_id: number;
  content_hash: string;
  preview_hash: string;
  encrypted_content: string;
  encrypted_preview: string;
  replier_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  wallet_address: string;
  encrypted_address: string;
  session_token: string;
  created_at: string;
  last_active: string;
}

export interface AccessLog {
  id: number;
  content_id: string; // Changed to string to handle encrypted post IDs
  content_type: 'post' | 'reply';
  user_encrypted_id: string;
  access_type: 'view' | 'tip' | 'unlock' | 'subscribe';
  amount_wei: number;
  created_at: string;
}

/**
 * Content Storage Service
 * Handles storing and retrieving encrypted content from Supabase
 */
export class ContentStorage {
  /**
   * Store encrypted content in Supabase
   */
  async storeEncryptedContent(
    contentHash: string,
    previewHash: string,
    encryptedContent: string,
    encryptedPreview: string,
    authorId: string,
    minTipAmount?: number,
    rawPostId?: number, // Plain uint64 post ID from smart contract
    encryptedPostId?: string // Legacy encrypted post ID (optional)
  ): Promise<EncryptedContent> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .insert({
        content_hash: contentHash,
        preview_hash: previewHash,
        encrypted_content: encryptedContent,
        encrypted_preview: encryptedPreview,
        author_id: authorId,
        min_tip_amount: minTipAmount || null,
        raw_post_id: rawPostId || null,
        encrypted_post_id: encryptedPostId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing encrypted content:', error);
      throw new Error(`Failed to store content: ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieve encrypted content by Supabase ID
   */
  async getEncryptedContent(supabaseId: number): Promise<EncryptedContent | null> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .eq('id', supabaseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error retrieving encrypted content:', error);
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieve encrypted content by raw post ID (from smart contract)
   */
  async getEncryptedContentByRawPostId(rawPostId: number): Promise<EncryptedContent | null> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .eq('raw_post_id', rawPostId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error retrieving encrypted content by raw post ID:', error);
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieve encrypted content by content hash
   */
  async getEncryptedContentByHash(contentHash: string): Promise<EncryptedContent | null> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .eq('content_hash', contentHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error retrieving content by hash:', error);
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

  /**
   * Get recent encrypted content for feed
   */
  async getRecentContent(limit: number = 20): Promise<EncryptedContent[]> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error retrieving recent content:', error);
      throw new Error(`Failed to retrieve recent content: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Store encrypted reply
   */
  async storeEncryptedReply(
    postId: number,
    replyId: number,
    contentHash: string,
    previewHash: string,
    encryptedContent: string,
    encryptedPreview: string,
    replierId: string
  ): Promise<EncryptedReply> {
    const { data, error } = await supabase
      .from('encrypted_replies')
      .insert({
        post_id: postId,
        raw_post_id: parseInt(postId.toString()), // Convert to bigint
        reply_id: replyId,
        content_hash: contentHash,
        preview_hash: previewHash,
        encrypted_content: encryptedContent,
        encrypted_preview: encryptedPreview,
        replier_id: replierId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing encrypted reply:', error);
      throw new Error(`Failed to store reply: ${error.message}`);
    }

    return data;
  }

  /**
   * Get replies for a post
   */
  async getPostReplies(postId: number): Promise<EncryptedReply[]> {
    const { data, error } = await supabase
      .from('encrypted_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error retrieving post replies:', error);
      throw new Error(`Failed to retrieve replies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get encrypted reply by ID
   */
  async getEncryptedReply(postId: number, replyId: number): Promise<EncryptedReply | null> {
    const { data, error } = await supabase
      .from('encrypted_replies')
      .select('*')
      .eq('post_id', postId)
      .eq('reply_id', replyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error retrieving reply:', error);
      throw new Error(`Failed to retrieve reply: ${error.message}`);
    }

    return data;
  }

  /**
   * Log content access for analytics
   * 
   * SIMPLIFIED APPROACH: Instead of logging to access_logs table, we'll just log to console
   * The visibility_events table already provides the necessary access tracking
   */
  async logAccess(
    contentId: number | string,
    contentType: 'post' | 'reply',
    userEncryptedId: string,
    accessType: 'view' | 'tip' | 'unlock' | 'subscribe',
    amountWei: number = 0
  ): Promise<void> {
    try {
      // For now, we'll just log this access event to the console
      // In the future, we could log to a separate analytics table if needed
      console.log('✅ Content access logged:', {
        contentId,
        contentType,
        accessType,
        userEncryptedId: userEncryptedId.substring(0, 20) + '...',
        amountWei,
        timestamp: new Date().toISOString()
      });
      
      // TODO: If we need to track access for analytics, we could:
      // 1. Create a separate analytics table
      // 2. Log to visibility_events with event_type = 'accessed'
      // 3. Use a different approach entirely
      
    } catch (error) {
      console.error('Error in logAccess:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Create or update user session
   */
  async createUserSession(
    walletAddress: string,
    encryptedAddress: string,
    sessionToken: string
  ): Promise<UserSession> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .upsert({
          wallet_address: walletAddress,
          encrypted_address: encryptedAddress,
          session_token: sessionToken,
          last_active: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user session:', {
          error,
          walletAddress,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        throw new Error(`Failed to create user session: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error('Unexpected error in createUserSession:', err);
      throw err;
    }
  }

  /**
   * Get user session by wallet address
   */
  async getUserSession(walletAddress: string): Promise<UserSession | null> {
    try {
      // Use a more specific query that's less likely to cause 406 errors
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, wallet_address, encrypted_address, session_token, created_at, last_active')
        .eq('wallet_address', walletAddress)
        .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

      if (error) {
        // Only log unexpected errors, not 406 Not Acceptable errors
        if (error.code !== '406' && error.code !== 'PGRST116') {
          console.error('Error retrieving user session:', {
            error,
            walletAddress,
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            errorHint: error.hint
          });
        }
        
        // Return null for any error to prevent app crashes
        return null;
      }

      return data;
    } catch (err) {
      // Return null instead of throwing to prevent app crashes
      return null;
    }
  }

  /**
   * Update user session last active time
   */
  async updateUserSessionActivity(walletAddress: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('wallet_address', walletAddress);

    if (error) {
      console.error('Error updating user session:', error);
      // Don't throw error for session update failures
    }
  }
}

// Export a default instance
export const contentStorage = new ContentStorage();

/**
 * Real-time subscriptions for live updates
 */
export class RealtimeSubscriptions {
  private subscriptions: Map<string, any> = new Map();

  /**
   * Subscribe to new content updates
   */
  subscribeToNewContent(callback: (payload: any) => void) {
    const subscription = supabase
      .channel('new_content')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'encrypted_content',
        },
        callback
      )
      .subscribe();

    this.subscriptions.set('new_content', subscription);
    return subscription;
  }

  /**
   * Subscribe to new reply updates
   */
  subscribeToNewReplies(callback: (payload: any) => void) {
    const subscription = supabase
      .channel('new_replies')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'encrypted_replies',
        },
        callback
      )
      .subscribe();

    this.subscriptions.set('new_replies', subscription);
    return subscription;
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelName: string) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

// Export a default instance
export const realtimeSubscriptions = new RealtimeSubscriptions();
