import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabase';
import { contentEncryptionService } from '../lib/content-encryption';
import { toast } from 'sonner';
import { useLogger } from './useLogger';


export function useSimpleReplies() {
  const { address } = useAccount();
  const log = useLogger('useSimpleReplies');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const getEncryptedAddress = useCallback(async (): Promise<string | null> => {
    if (!address) return null;
    
    try {
      const { data: userSession, error } = await supabase
        .from('user_sessions')
        .select('encrypted_address')
        .eq('wallet_address', address)
        .maybeSingle();

      if (error) {
        console.error('Failed to get encrypted address:', error);
        return null;
      }
      
      if (!userSession) {
        console.warn('User not registered yet - no encrypted address available');
        return null;
      }

      return userSession?.encrypted_address || null;
    } catch (err) {
      console.error('Error getting encrypted address:', err);
      return null;
    }
  }, [address]);


  const createReply = useCallback(async (
    rawPostId: string,
    content: string,
    parentReplyId?: string
  ) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    if (!content.trim()) {
      setError('Please enter reply content');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Creating encrypted reply', {
        rawPostId,
        parentReplyId,
        contentLength: content.length,
        author: address
      });

     
      const encryptedAddress = await getEncryptedAddress();
      if (!encryptedAddress) {
        throw new Error('Failed to get encrypted address. Please ensure you are registered.');
      }

      
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;

     
      const encryptedContent = contentEncryptionService.encryptContent(content);
      const encryptedPreview = contentEncryptionService.encryptContent(preview);

      
      const contentHash = await contentEncryptionService.generateHash(content);
      const previewHash = await contentEncryptionService.generateHash(preview);

      
      const replyId = Date.now();

      log.debug('Content encrypted', {
        originalLength: content.length,
        previewLength: preview.length,
        encryptedContentLength: encryptedContent.length,
        encryptedPreviewLength: encryptedPreview.length,
        replyId
      });

      
      const { data, error: insertError } = await supabase
        .from('encrypted_replies')
        .insert({
          post_id: rawPostId,
          raw_post_id: parseInt(rawPostId.toString()), 
          reply_id: replyId,
          content_hash: contentHash,
          preview_hash: previewHash,
          encrypted_content: encryptedContent,
          encrypted_preview: encryptedPreview,
          replier_id: encryptedAddress,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create reply: ${insertError.message}`);
      }

      
      const { error: statsError } = await supabase
        .from('reply_stats')
        .insert({
          post_id: rawPostId,
          reply_id: replyId,
          upvote_count: 0,
          downvote_count: 0,
          last_updated: new Date().toISOString(),
          raw_post_id: rawPostId
        });

      if (statsError) {
        console.warn('Failed to create reply stats:', statsError);
      }

      log.info('Encrypted reply created successfully', { replyId: data?.id });
      toast.success('Reply posted successfully!');
      
      return data;
    } catch (err: any) {
      log.error('Encrypted reply creation failed', err);
      const errorMessage = err.message || 'Failed to create reply';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, getEncryptedAddress]);

  
  const getReplies = useCallback(async (rawPostId: string) => {
    try {
      const { data, error } = await supabase
        .from('encrypted_replies')
        .select('*')
        .eq('post_id', rawPostId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch replies: ${error.message}`);
      }

      
      const decryptedReplies = await Promise.all(
        (data || []).map(async (reply) => {
          log.debug('Processing encrypted reply', {
            id: reply.id,
            postId: reply.post_id,
            replyId: reply.reply_id,
            hasEncryptedContent: !!reply.encrypted_content,
            encryptedContentLength: reply.encrypted_content?.length || 0
          });

          try {
            
            log.debug('Decrypting reply using main post service');
            const decryptedContent = contentEncryptionService.decryptContent(reply.encrypted_content);
            log.debug('Reply decrypted successfully', {
              length: decryptedContent.length
            });
            
            
            return {
              id: reply.id.toString(),
              raw_post_id: reply.post_id,
              author_id: reply.replier_id, 
              content: decryptedContent,
              encrypted_content: reply.encrypted_content,
              encrypted_author_id: reply.replier_id,
              isEncrypted: true,
              created_at: reply.created_at,
              updated_at: reply.updated_at
            };
          } catch (decryptError) {
            console.error('❌ Failed to decrypt reply:', decryptError);
            return {
              id: reply.id.toString(),
              raw_post_id: reply.post_id,
              author_id: reply.replier_id,
              content: '[Decryption failed]',
              encrypted_content: reply.encrypted_content,
              encrypted_author_id: reply.replier_id,
              isEncrypted: true,
              created_at: reply.created_at,
              updated_at: reply.updated_at
            };
          }
        })
      );

      
      return decryptedReplies;
    } catch (err) {
      console.error('❌ Failed to fetch replies:', err);
      return [];
    }
  }, []);

  
  const decryptReplyContent = useCallback((reply: any): string => {
    if (reply.encrypted_content) {
      try {
        return contentEncryptionService.decryptContent(reply.encrypted_content);
      } catch (error) {
        console.error('Failed to decrypt reply content:', error);
        return '[Decryption failed]';
      }
    }
    return reply.content || '';
  }, []);

  
  const getReplyCounts = useCallback(async (rawPostId: string) => {
    try {
      const { data, error } = await supabase
        .from('reply_stats')
        .select('*')
        .eq('raw_post_id', rawPostId);

      if (error) {
        console.error('Failed to fetch reply counts:', error);
        return { totalReplies: 0, totalUpvotes: 0, totalDownvotes: 0 };
      }

      const totalReplies = data?.length || 0;
      const totalUpvotes = data?.reduce((sum, stat) => sum + (stat.upvote_count || 0), 0) || 0;
      const totalDownvotes = data?.reduce((sum, stat) => sum + (stat.downvote_count || 0), 0) || 0;

      return {
        totalReplies,
        totalUpvotes,
        totalDownvotes,
        replyStats: data || []
      };
    } catch (err) {
      console.error('❌ Failed to fetch reply counts:', err);
      return { totalReplies: 0, totalUpvotes: 0, totalDownvotes: 0 };
    }
  }, []);

    
  const getReplyStats = useCallback(async (postId: number, replyId: number) => {
    try {
      const { data, error } = await supabase
        .from('reply_stats')
        .select('*')
        .eq('post_id', postId)
        .eq('reply_id', replyId)
        .single();

      if (error) {
        console.error('Failed to fetch reply stats:', error);
        return { upvote_count: 0, downvote_count: 0 };
      }

      return {
        upvote_count: data?.upvote_count || 0,
        downvote_count: data?.downvote_count || 0
      };
    } catch (err) {
      console.error('❌ Failed to fetch reply stats:', err);
      return { upvote_count: 0, downvote_count: 0 };
    }
  }, []);

  return {
    createReply,
    getReplies,
    decryptReplyContent,
    getEncryptedAddress,
    getReplyCounts,
    getReplyStats,
    isLoading,
    error,
  };
}
