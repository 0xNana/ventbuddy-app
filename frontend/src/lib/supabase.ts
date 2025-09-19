import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

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

export interface EncryptedContent {
  id: number;
  content_hash: string;
  preview_hash: string;
  encrypted_content: string;
  encrypted_preview: string;
  author_id: string;
  min_tip_amount?: number;
  raw_post_id: number;
  encrypted_post_id?: string;
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
  content_id: string;
  content_type: 'post' | 'reply';
  user_encrypted_id: string;
  access_type: 'view' | 'tip' | 'unlock' | 'subscribe';
  amount_wei: number;
  created_at: string;
}

export class ContentStorage {
  async storeEncryptedContent(
    contentHash: string,
    previewHash: string,
    encryptedContent: string,
    encryptedPreview: string,
    authorId: string,
    minTipAmount?: number,
    rawPostId?: number, 
    encryptedPostId?: string 
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
      throw new Error(`Failed to store content: ${error.message}`);
    }

    return data;
  }

  async getEncryptedContent(supabaseId: number): Promise<EncryptedContent | null> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .eq('id', supabaseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

  async getEncryptedContentByRawPostId(rawPostId: number): Promise<EncryptedContent | null> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .eq('raw_post_id', rawPostId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

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
      throw new Error(`Failed to retrieve content: ${error.message}`);
    }

    return data;
  }

  async getRecentContent(limit: number = 20): Promise<EncryptedContent[]> {
    const { data, error } = await supabase
      .from('encrypted_content')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to retrieve recent content: ${error.message}`);
    }

    return data || [];
  }

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
        raw_post_id: parseInt(postId.toString()),
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
      throw new Error(`Failed to store reply: ${error.message}`);
    }

    return data;
  }

  async getPostReplies(postId: number): Promise<EncryptedReply[]> {
    const { data, error } = await supabase
      .from('encrypted_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve replies: ${error.message}`);
    }

    return data || [];
  }

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
      throw new Error(`Failed to retrieve reply: ${error.message}`);
    }

    return data;
  }

  async logAccess(
    contentId: number | string,
    contentType: 'post' | 'reply',
    userEncryptedId: string,
    accessType: 'view' | 'tip' | 'unlock' | 'subscribe',
    amountWei: number = 0
  ): Promise<void> {
    // Access logging placeholder - can be implemented later if needed
  }

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
        throw new Error(`Failed to create user session: ${error.message}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  async getUserSession(walletAddress: string): Promise<UserSession | null> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, wallet_address, encrypted_address, session_token, created_at, last_active')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) {
        
        return null;
      }

      return data;
    } catch (err) {
      return null;
    }
  }

  async updateUserSessionActivity(walletAddress: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('wallet_address', walletAddress);

    if (error) {
    }
  }
}

export const contentStorage = new ContentStorage();

export class RealtimeSubscriptions {
  private subscriptions: Map<string, any> = new Map();

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

  unsubscribe(channelName: string) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(channelName);
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach((subscription) => {
      supabase.removeChannel(subscription);
    });
    this.subscriptions.clear();
  }
}

export const realtimeSubscriptions = new RealtimeSubscriptions();
