import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface PostStats {
  raw_post_id: number; 
  upvote_count: number;
  downvote_count: number;
  reply_count: number;
  last_updated: string;
}

interface ReplyStats {
  post_id: number;
  reply_id: number;
  upvote_count: number;
  downvote_count: number;
  last_updated: string;
}

interface UserEngagement {
  raw_post_id: number; 
  user_encrypted_id: string;
  engagement_type: 'upvote' | 'downvote';
  created_at: string;
}

export function useEngagement() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);

  
  const getPostStats = useCallback(async (rawPostId: number): Promise<PostStats | null> => {
    try {
      const { data, error } = await supabase
        .from('post_stats')
        .select('*')
        .eq('raw_post_id', rawPostId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching post stats:', error);
        return null;
      }

      return data || {
        raw_post_id: rawPostId,
        upvote_count: 0,
        downvote_count: 0,
        reply_count: 0,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching post stats:', error);
      return null;
    }
  }, []);

  
  const getMultiplePostStats = useCallback(async (rawPostIds: number[]): Promise<PostStats[]> => {
    try {
      const { data, error } = await supabase
        .from('post_stats')
        .select('*')
        .in('raw_post_id', rawPostIds);

      if (error) {
        console.error('Error fetching multiple post stats:', error);
        return [];
      }

      
      const existingStats = data || [];
      const existingRawPostIds = existingStats.map(stat => stat.raw_post_id);
      const missingRawPostIds = rawPostIds.filter(id => !existingRawPostIds.includes(id));
      
      const defaultStats = missingRawPostIds.map(rawPostId => ({
        raw_post_id: rawPostId,
        upvote_count: 0,
        downvote_count: 0,
        reply_count: 0,
        last_updated: new Date().toISOString()
      }));

      return [...existingStats, ...defaultStats];
    } catch (error) {
      console.error('Error fetching multiple post stats:', error);
      return [];
    }
  }, []);

  
  const upvotePost = useCallback(async (rawPostId: number, userEncryptedId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      
      const rawPostIdValue = parseInt(rawPostId.toString());
      
      
      if (!rawPostIdValue || isNaN(rawPostIdValue) || rawPostIdValue <= 0) {
        console.error('❌ Invalid rawPostId value:', { rawPostId, rawPostIdValue });
        return false;
      }

      
      const { data: existingUpvote, error: checkError } = await supabase
        .from('post_engagement')
        .select('id')
        .eq('raw_post_id', rawPostIdValue)
        .eq('user_encrypted_id', userEncryptedId)
        .eq('engagement_type', 'upvote')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing upvote:', checkError);
        return false;
      }

      if (existingUpvote) {
        
        const { error: deleteError } = await supabase
          .from('post_engagement')
          .delete()
          .eq('raw_post_id', rawPostIdValue)
          .eq('user_encrypted_id', userEncryptedId)
          .eq('engagement_type', 'upvote');

        if (deleteError) {
          console.error('Error removing upvote:', deleteError);
          return false;
        }



        toast.success('Upvote removed');
        return false; 
      } else {
        
        await supabase
          .from('post_engagement')
          .delete()
          .eq('raw_post_id', rawPostIdValue)
          .eq('user_encrypted_id', userEncryptedId)
          .eq('engagement_type', 'downvote');

        
        const { error: insertError } = await supabase
          .from('post_engagement')
          .insert({
            raw_post_id: rawPostIdValue,
            user_encrypted_id: userEncryptedId,
            engagement_type: 'upvote'
          });

        if (insertError) {
          console.error('Error adding upvote:', insertError);
          return false;
        }

        

        toast.success('Post upvoted!');
        return true; 
      }
    } catch (error) {
      console.error('Error toggling upvote:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  const downvotePost = useCallback(async (rawPostId: number, userEncryptedId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      
      const rawPostIdValue = parseInt(rawPostId.toString());
      
      
      if (!rawPostIdValue || isNaN(rawPostIdValue) || rawPostIdValue <= 0) {
        console.error('❌ Invalid rawPostId value for downvote:', { rawPostId, rawPostIdValue });
        return false;
      }

      
      const { data: existingDownvote, error: checkError } = await supabase
        .from('post_engagement')
        .select('id')
        .eq('raw_post_id', rawPostIdValue)
        .eq('user_encrypted_id', userEncryptedId)
        .eq('engagement_type', 'downvote')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing downvote:', checkError);
        return false;
      }

      if (existingDownvote) {
        
        const { error: deleteError } = await supabase
          .from('post_engagement')
          .delete()
          .eq('raw_post_id', rawPostIdValue)
          .eq('user_encrypted_id', userEncryptedId)
          .eq('engagement_type', 'downvote');

        if (deleteError) {
          console.error('Error removing downvote:', deleteError);
          return false;
        }



        toast.success('Downvote removed');
          return false; 
      } else {
        
        await supabase
          .from('post_engagement')
          .delete()
          .eq('raw_post_id', rawPostIdValue)
          .eq('user_encrypted_id', userEncryptedId)
          .eq('engagement_type', 'upvote');

        
        const { error: insertError } = await supabase
          .from('post_engagement')
          .insert({
            raw_post_id: rawPostIdValue,
            user_encrypted_id: userEncryptedId,
            engagement_type: 'downvote'
          });

        if (insertError) {
          console.error('Error adding downvote:', insertError);
          return false;
        }

        

        toast.success('Post downvoted');
        return true; 
      }
    } catch (error) {
      console.error('Error toggling downvote:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  
  const hasUserUpvoted = useCallback(async (rawPostId: number, userEncryptedId: string): Promise<boolean> => {
    try {
      const rawPostIdValue = parseInt(rawPostId.toString());
      
      const { data, error } = await supabase
        .from('post_engagement')
        .select('id')
        .eq('raw_post_id', rawPostIdValue)
        .eq('user_encrypted_id', userEncryptedId)
        .eq('engagement_type', 'upvote')
        .maybeSingle();

      if (error) {
        console.error('Error checking user upvote:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking user upvote:', error);
      return false;
    }
  }, []);

  
  const hasUserDownvoted = useCallback(async (rawPostId: number, userEncryptedId: string): Promise<boolean> => {
    try {
      const rawPostIdValue = parseInt(rawPostId.toString());
      
      const { data, error } = await supabase
        .from('post_engagement')
        .select('id')
        .eq('raw_post_id', rawPostIdValue)
        .eq('user_encrypted_id', userEncryptedId)
        .eq('engagement_type', 'downvote')
        .maybeSingle();

      if (error) {
        console.error('Error checking user downvote:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking user downvote:', error);
      return false;
    }
  }, []);

  
  const updateReplyCount = useCallback(async (rawPostId: number, newCount: number) => {
    try {
      const rawPostIdValue = parseInt(rawPostId.toString());
      
      
      if (!rawPostIdValue || isNaN(rawPostIdValue) || rawPostIdValue <= 0) {
        console.error('❌ Invalid rawPostId value for updateReplyCount:', { rawPostId, rawPostIdValue });
        return;
      }
      
      const { error } = await supabase
        .from('post_stats')
        .upsert({
          raw_post_id: rawPostIdValue,
          reply_count: newCount,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'raw_post_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error updating reply count:', error);
      }
    } catch (error) {
      console.error('Error updating reply count:', error);
    }
  }, []);

  
  const updatePostStatsCounts = useCallback(async (rawPostId: number) => {
    try {
      
      const [upvoteResult, downvoteResult] = await Promise.all([
        supabase
          .from('post_engagement')
          .select('id', { count: 'exact' })
          .eq('raw_post_id', rawPostId)
          .eq('engagement_type', 'upvote'),
        supabase
          .from('post_engagement')
          .select('id', { count: 'exact' })
          .eq('raw_post_id', rawPostId)
          .eq('engagement_type', 'downvote')
      ]);

      const upvoteCount = upvoteResult.count || 0;
      const downvoteCount = downvoteResult.count || 0;

      
      const { data: existingStats } = await supabase
        .from('post_stats')
        .select('reply_count')
        .eq('raw_post_id', rawPostId)
        .maybeSingle();

      const replyCount = existingStats?.reply_count || 0;


      const { error } = await supabase
        .from('post_stats')
        .upsert({
          raw_post_id: rawPostId,
          upvote_count: upvoteCount,
          downvote_count: downvoteCount,
          reply_count: replyCount,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'raw_post_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error updating post stats counts:', error);
      } else {
        console.log(`Updated post ${rawPostId} stats: ${upvoteCount} upvotes, ${downvoteCount} downvotes`);
      }
    } catch (error) {
      console.error('Error in updatePostStatsCounts:', error);
    }
  }, []);

  
  const fixAllPostStatsCounts = useCallback(async () => {
    try {
      console.log('Starting to fix all post stats counts...');
      
      
      const { data: engagementData, error: engagementError } = await supabase
        .from('post_engagement')
        .select('raw_post_id')
        .order('raw_post_id');

      if (engagementError) {
        console.error('Error fetching engagement data:', engagementError);
        return;
      }

      
      const uniquePostIds = [...new Set(engagementData?.map(item => item.raw_post_id) || [])];
      
      console.log(`Found ${uniquePostIds.length} posts with engagement data`);

      
      for (const postId of uniquePostIds) {
        await updatePostStatsCounts(postId);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('Finished fixing all post stats counts');
    } catch (error) {
      console.error('Error in fixAllPostStatsCounts:', error);
    }
  }, [updatePostStatsCounts]);

  return {
    getPostStats,
    getMultiplePostStats,
    upvotePost,
    downvotePost,
    hasUserUpvoted,
    hasUserDownvoted,
    updateReplyCount,
    updatePostStatsCounts,
    fixAllPostStatsCounts,
    isLoading
  };
}


export function useEngagementSubscription(rawPostIds: number[]) {
  const [stats, setStats] = useState<PostStats[]>([]);

  useEffect(() => {
    if (rawPostIds.length === 0) return;

    
    const subscription = supabase
      .channel('post-stats-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_stats',
          filter: `raw_post_id=in.(${rawPostIds.join(',')})`
        },
        (payload) => {
          console.log('Real-time stats update:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setStats(prev => {
              const newStats = payload.new as PostStats;
              const existingIndex = prev.findIndex(stat => stat.raw_post_id === newStats.raw_post_id);
              
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newStats;
                return updated;
              } else {
                return [...prev, newStats];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [rawPostIds]);

  return stats;
}
