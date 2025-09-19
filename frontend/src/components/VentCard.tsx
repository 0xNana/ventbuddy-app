import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lock, MessageCircle, Coins, Eye, Shield, AlertCircle, ThumbsUp, ThumbsDown, Share2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { usePayments } from "@/hooks/usePayments";
import { useDisplayName } from "@/hooks/useUserProfile";
import { useEngagement } from "@/hooks/useEngagement";
import { useLogger } from "@/hooks/useLogger";
import { toast } from "sonner";
import { TipModal } from "./TipModal";
import { SimpleReplyForm } from "./SimpleReplyForm";
import { NestedReplyCard } from "./NestedReplyCard";
import { useSimpleReplies } from "../hooks/useSimpleReplies";
import { supabase } from "../lib/supabase";

interface VentCardProps {
  rawPostId: number; // Primary identifier - Plain uint64 post ID from smart contract
  author: string;
  content: string;
  preview?: string;
  isLocked: boolean;
  tipAmount?: number;
  minTipAmount?: number;
  likes: number;
  comments: number;
  timestamp: string;
  isPremium?: boolean;
  contentHash?: string;
  previewHash?: string;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  decryptError?: boolean;
  visibility?: number; // 0 = Public, 1 = Tippable
  visibilityEvent?: any; // Full visibility event data from Supabase
  supabaseId?: string; // Supabase ID for engagement operations (fallback only)
}

export const VentCard = ({ 
  rawPostId,
  author, 
  content, 
  preview,
  isLocked, 
  tipAmount, 
  minTipAmount,
  likes, 
  comments, 
  timestamp,
  isPremium,
  contentHash,
  previewHash,
  authorId,
  createdAt,
  updatedAt,
  decryptError,
  visibility,
  visibilityEvent,
  supabaseId
}: VentCardProps) => {
  const { address } = useAccount();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return visibility === 0;
  });
  const [accessInfo, setAccessInfo] = useState<{ hasAccess: boolean; reason: string } | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [userEncryptedAddress, setUserEncryptedAddress] = useState<string | null>(null);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [currentComments, setCurrentComments] = useState(comments);
  const [currentUpvotes, setCurrentUpvotes] = useState(0);
  const [currentDownvotes, setCurrentDownvotes] = useState(0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasDownvoted, setHasDownvoted] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const { tipPost, unlockContent, isLoading: isPaymentLoading } = usePayments();
  const { displayName: authorDisplayName, isLoading: isLoadingAuthorName } = useDisplayName(authorId || author);
  const { upvotePost, downvotePost, hasUserUpvoted, hasUserDownvoted, getPostStats, isLoading: isEngagementLoading } = useEngagement();
  const { getReplies, getReplyCounts, getEncryptedAddress } = useSimpleReplies();
  const log = useLogger('VentCard');
  
  // Get encrypted address once and cache it
  useEffect(() => {
    const fetchEncryptedAddress = async () => {
      if (!address) {
        setUserEncryptedAddress(null);
        return;
      }
      
      try {
        const encryptedAddress = await getEncryptedAddress();
        setUserEncryptedAddress(encryptedAddress);
      } catch (err) {
        log.error('Error getting encrypted address', err);
        setUserEncryptedAddress(null);
      }
    };

    fetchEncryptedAddress();
  }, [address]);
  
  useEffect(() => {
    const checkAuthorAndVisibility = async () => {
      if (!rawPostId) return;
      
      let isContentAuthor = false;
      

      if (address && userEncryptedAddress) {
        try {
            const { data: contentData, error } = await supabase
              .from('encrypted_content')
              .select('author_id')
              .eq('raw_post_id', rawPostId)
              .single();

            if (!error && contentData) {
              isContentAuthor = userEncryptedAddress === contentData.author_id;
              
              log.debug('Author check result', { 
                rawPostId, 
                userEncryptedAddress: userEncryptedAddress.substring(0, 10) + '...',
                contentAuthorId: contentData.author_id.substring(0, 10) + '...',
                isAuthor: isContentAuthor 
              });
            } else {
              log.warn('Failed to get content author', { error: error?.message });
            }
        } catch (err) {
          log.error('Error checking content author', err);
        }
      }
      
      setIsAuthor(isContentAuthor);
      
      if (address) {
        if (visibility === 0) {
          setIsUnlocked(true);
          setAccessInfo({ hasAccess: true, reason: 'public' });
          return;
        }

        if (visibility === 1) {
          if (isContentAuthor) {
            setIsUnlocked(true);
            setAccessInfo({ hasAccess: true, reason: 'author' });
            return;
          }
          
          try {
            if (!userEncryptedAddress) {
              setIsUnlocked(false);
              setAccessInfo({ hasAccess: false, reason: 'requires_payment' });
              return;
            }

            const { data, error } = await supabase
              .from('access_logs')
              .select('*')
              .eq('content_id', rawPostId.toString())
              .eq('user_encrypted_id', userEncryptedAddress)
              .eq('content_type', 'post')
              .in('access_type', ['tip', 'unlock'])
              .order('created_at', { ascending: false })
              .limit(1);

            if (error && error.code !== 'PGRST116') {
              log.error('Failed to check access log', error);
              setIsUnlocked(false);
              setAccessInfo({ hasAccess: false, reason: 'requires_payment' });
              return;
            }

            const hasAccess = data && data.length > 0;
            if (hasAccess) {
              setIsUnlocked(true);
              setAccessInfo({ hasAccess: true, reason: 'unlock' });
            } else {
              setIsUnlocked(false);
              setAccessInfo({ hasAccess: false, reason: 'requires_payment' });
            }
          } catch (err) {
            log.error('Failed to check access log', err);
            setIsUnlocked(false);
            setAccessInfo({ hasAccess: false, reason: 'requires_payment' });
          }
          return;
        }

        setAccessInfo({ hasAccess: false, reason: 'not_connected' });
        setIsUnlocked(false);
      } else {
        if (visibility === 0) {
          setIsUnlocked(true);
          setAccessInfo({ hasAccess: true, reason: 'public' });
        } else {
          setIsUnlocked(false);
          setAccessInfo({ hasAccess: false, reason: 'not_connected' });
        }
      }
    };

    checkAuthorAndVisibility();
  }, [address, rawPostId, visibility, userEncryptedAddress]);

  // Check if user has upvoted or downvoted this post
  useEffect(() => {
    const checkUserVotes = async () => {
      if (!address || !rawPostId) return;
      
      try {
        // Get current user's encrypted address
        const { data: userSession, error: sessionError } = await supabase
          .from('user_sessions')
          .select('encrypted_address')
          .eq('wallet_address', address)
          .maybeSingle();

        if (sessionError || !userSession?.encrypted_address) {
          // User not registered or session not found
          setHasUpvoted(false);
          setHasDownvoted(false);
          return;
        }

        const [upvoted, downvoted] = await Promise.all([
          hasUserUpvoted(rawPostId, userSession.encrypted_address),
          hasUserDownvoted(rawPostId, userSession.encrypted_address)
        ]);
        setHasUpvoted(upvoted);
        setHasDownvoted(downvoted);
      } catch (error) {
        log.error('Failed to check user votes', error);
      }
    };

    checkUserVotes();
  }, [address, rawPostId]);

  useEffect(() => {
    setCurrentLikes(likes);
    setCurrentComments(comments);
  }, [likes, comments]);

  useEffect(() => {
    const loadVoteCounts = async () => {
      if (!rawPostId) return;
      
      try {
        const stats = await getPostStats(rawPostId);
        if (stats) {
          setCurrentUpvotes(stats.upvote_count);
          setCurrentDownvotes(stats.downvote_count);
        }
      } catch (error) {
        log.error('Failed to load vote counts', error);
      }
    };

    loadVoteCounts();
  }, [rawPostId, getPostStats]);

  useEffect(() => {
    const loadReplyCounts = async () => {
      if (!rawPostId) return;
      
      try {
        const replyCounts = await getReplyCounts(rawPostId.toString());
        setCurrentComments(replyCounts.totalReplies);
      } catch (error) {
        log.error('Failed to load reply counts', error);
      }
    };

    loadReplyCounts();
  }, [rawPostId, getReplyCounts, log]);

  const handleUnlock = async () => {
    if (decryptError) {
      toast.error('This content could not be decrypted');
      return;
    }

    const rawTipAmount = minTipAmount || tipAmount;
    if (!rawTipAmount) {
      toast.error('No tip amount specified');
      return;
    }

    const actualTipAmount = rawTipAmount / 1e18;

    try {
      log.info('Unlocking post', { rawPostId, amount: actualTipAmount, currency: 'ETH' });
      
      const txHash = await unlockContent(rawPostId.toString(), actualTipAmount);
      log.info('Unlock successful', { txHash });
      
      await createAccessLog(rawPostId.toString(), 'unlock', actualTipAmount);
      
      setIsUnlocked(true);
      setAccessInfo({ hasAccess: true, reason: 'unlocked' });
    } catch (error) {
      log.error('Unlock failed', error);
    }
  };

  const handleTip = async () => {
    if (decryptError) {
      toast.error('This content could not be decrypted');
      return;
    }

    const rawTipAmount = minTipAmount || tipAmount;
    if (!rawTipAmount) {
      toast.error('No tip amount specified');
      return;
    }

    const actualTipAmount = rawTipAmount / 1e18;

    try {
      log.debug('Tip amount details', {
        rawMinTipAmount: minTipAmount,
        rawTipAmount: tipAmount,
        rawTipAmountUsed: rawTipAmount,
        actualTipAmount,
        conversionApplied: 'Yes (divided by 1e18)'
      });
      
      log.info('Attempting to tip post', { rawPostId, amount: actualTipAmount, currency: 'ETH' });
      const txHash = await tipPost(rawPostId.toString(), actualTipAmount);
      log.info('Tip successful', { txHash });
      
      log.info('Waiting for transaction confirmation');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for confirmation
      
      await createAccessLog(rawPostId.toString(), 'unlock', actualTipAmount);
      
      setIsUnlocked(true);
      setAccessInfo({ hasAccess: true, reason: 'unlock' });
      log.info('Content visibility updated after successful payment');
    } catch (error) {
      log.error('Tip failed', error);
    }
  };

  const handleTipUnlocked = () => {
    setTipModalOpen(true);
  };

  const handleTipFromModal = async (amount: number) => {
    try {
      log.info('Tipping unlocked content', { rawPostId, amount, currency: 'ETH' });
      
      const txHash = await tipPost(rawPostId.toString(), amount);
      log.info('Tip successful', { txHash });
      
      await createAccessLog(rawPostId.toString(), 'tip', amount);
      
      toast.success(`Successfully tipped ${amount} ETH to the creator!`);
      setTipModalOpen(false);
    } catch (error) {
      log.error('Tip failed', error);
    }
  };

  const handleUpvote = async () => {
    if (!address) {
      toast.error('Please connect your wallet to vote on posts');
      return;
    }

    try {
      // Get current user's encrypted address
      const { data: userSession, error: sessionError } = await supabase
        .from('user_sessions')
        .select('encrypted_address')
        .eq('wallet_address', address)
        .maybeSingle();

      if (sessionError || !userSession?.encrypted_address) {
        toast.error('Unable to verify your identity. Please try again.');
        return;
      }

      const newUpvotedState = await upvotePost(rawPostId, userSession.encrypted_address);
      setHasUpvoted(newUpvotedState);
      
      if (newUpvotedState) {
        setHasDownvoted(false);
        setCurrentUpvotes(prev => prev + 1);
        if (hasDownvoted) {
          setCurrentDownvotes(prev => Math.max(prev - 1, 0));
        }
      } else {
        setCurrentUpvotes(prev => Math.max(prev - 1, 0));
      }
    } catch (error) {
      log.error('Upvote failed', error);
    }
  };

  const handleDownvote = async () => {
    if (!address) {
      toast.error('Please connect your wallet to vote on posts');
      return;
    }

    try {
      const { data: userSession, error: sessionError } = await supabase
        .from('user_sessions')
        .select('encrypted_address')
        .eq('wallet_address', address)
        .maybeSingle();

      if (sessionError || !userSession?.encrypted_address) {
        toast.error('Unable to verify your identity. Please try again.');
        return;
      }

      const newDownvotedState = await downvotePost(rawPostId, userSession.encrypted_address);
      setHasDownvoted(newDownvotedState);
      
      if (newDownvotedState) {
        setHasUpvoted(false);
        setCurrentDownvotes(prev => prev + 1);
        if (hasUpvoted) {
          setCurrentUpvotes(prev => Math.max(prev - 1, 0));
        }
      } else {
        setCurrentDownvotes(prev => Math.max(prev - 1, 0));
      }
    } catch (error) {
      log.error('Downvote failed', error);
    }
  };

  const handleReplyCreated = async (replyData: any) => {
    try {
      const replyCounts = await getReplyCounts(rawPostId.toString());
      setCurrentComments(replyCounts.totalReplies);
    } catch (error) {
      log.error('Failed to update reply count', error);
      setCurrentComments(prev => prev + 1);
    }
    
    setShowReplyForm(false);
    
    await loadReplies();
  };

  const handleReplyCancel = () => {
    setShowReplyForm(false);
  };

  const handleShare = async () => {
    try {
      const postUrl = `${window.location.origin}/post/${rawPostId}`;
      
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post on Ventbuddy',
          text: preview || 'A privacy-preserving post on Ventbuddy',
          url: postUrl,
        });
        toast.success('Post shared successfully!');
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast.success('Post link copied to clipboard!');
      }
      
      log.info('Post shared', { rawPostId, url: postUrl });
    } catch (error) {
      log.error('Failed to share post', error);
      
      const postUrl = `${window.location.origin}/post/${rawPostId}`;
      toast.error('Share failed. Here\'s the link:', {
        description: postUrl,
        duration: 10000,
      });
    }
  };

  const loadReplies = async () => {
    try {
      const repliesData = await getReplies(rawPostId.toString());
      setReplies(repliesData);
    } catch (error) {
      log.error('Failed to load replies', error);
    }
  };

  const createAccessLog = useCallback(async (contentId: string, accessType: string, amount?: number) => {
    try {
      if (!userEncryptedAddress) {
        log.warn('No encrypted address available for access log');
        return;
      }

      const { error } = await supabase
        .from('access_logs')
        .insert({
          content_id: contentId,
          content_type: 'post',
          user_encrypted_id: userEncryptedAddress,
          access_type: accessType,
          amount_wei: amount ? amount * Math.pow(10, 18) : 0,
          raw_post_id: parseInt(rawPostId.toString()),
          created_at: new Date().toISOString()
        });

      if (error) {
        log.error('Failed to create access log', error);
      } else {
        log.info('Access log created successfully');
      }
    } catch (err) {
      log.error('Failed to create access log', err);
    }
  }, [userEncryptedAddress]);

  const handleShowReplies = async () => {
    if (!showReplies) {
      await loadReplies();
    }
    setShowReplies(!showReplies);
  };

  return (
    <Card className="bg-background border-border/50 hover:border-primary/30 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-medium text-primary-foreground">
                {isLoadingAuthorName ? '...' : authorDisplayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{isLoadingAuthorName ? 'Loading...' : authorDisplayName}</p>
              <p className="text-xs text-muted-foreground">{timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {visibility !== undefined && (
              <>
                {visibility === 0 && (
                  <Badge variant="outline" className="border-green-500/50 text-green-400">
                    <Eye className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                )}
                {visibility === 1 && (
                  <Badge 
                    variant="outline" 
                    className="border-purple-500/50 text-purple-400"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    Private
                  </Badge>
                )}
              </>
            )}
            
            {isPremium && (
              <Badge variant="secondary" className="bg-gradient-premium text-premium-foreground">
                Premium
              </Badge>
            )}
            {decryptError && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Decrypt Error
              </Badge>
            )}
            <Badge variant="outline" className="border-green-500/50 text-green-400">
              <Shield className="h-3 w-3 mr-1" />
              FHE Protected
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className={`relative transition-all duration-500 ${!isUnlocked && isLocked ? 'filter blur-md' : ''}`}>
          <p className="text-foreground leading-relaxed">
            {decryptError ? (
              <span className="text-red-400 italic">
                This content could not be decrypted. It may be corrupted or encrypted with a different key.
              </span>
            ) : isUnlocked || !isLocked ? (
              content
            ) : (
              <span className="text-muted-foreground italic">
                [Private content - unlock to view]
              </span>
            )}
          </p>
          
          {!isUnlocked && isLocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
              <div className="text-center">
                {visibility === 1 && (
                  <>
                    <Coins className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <p className="text-sm font-medium mb-2">Private content</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {isAuthor ? 'This is your content' : 'Use the Tip Creator button below to unlock'}
                    </p>
                  </>
                )}
                {visibility === undefined && (
                  <>
                    <Lock className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium mb-3">Loading visibility...</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled
                    >
                      <Eye className="h-4 w-4" />
                      Loading...
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`${hasUpvoted ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={handleUpvote}
              disabled={isEngagementLoading}
            >
              <ThumbsUp className={`h-4 w-4 ${hasUpvoted ? 'fill-current' : ''}`} />
            </Button>
            <span className="text-sm font-medium min-w-[2rem] text-center text-green-600">
              {currentUpvotes}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`${hasDownvoted ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={handleDownvote}
              disabled={isEngagementLoading}
            >
              <ThumbsDown className={`h-4 w-4 ${hasDownvoted ? 'fill-current' : ''}`} />
            </Button>
            <span className="text-sm font-medium min-w-[2rem] text-center text-red-600">
              {currentDownvotes}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground"
            onClick={handleShowReplies}
          >
            <MessageCircle className="h-4 w-4" />
            {currentComments}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground"
            onClick={handleShare}
            title="Share this post"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        
        {(isUnlocked || (!isUnlocked && visibility === 1)) && (
          <div className="flex items-center gap-2">
            {isUnlocked && (
              <span className="text-xs text-muted-foreground">
                {accessInfo?.reason === 'author' ? 'Your Content' : 
                 accessInfo?.reason === 'public' ? 'Public' :
                 accessInfo?.reason === 'tip' ? 'Tipped' :
                 accessInfo?.reason === 'unlock' ? 'Unlocked' : ''}
              </span>
            )}
            {accessInfo?.reason !== 'author' && (
              <Button 
                variant="tip" 
                size="sm"
                onClick={!isUnlocked && visibility === 1 ? handleTip : handleTipUnlocked}
                disabled={isPaymentLoading}
                className="ml-2"
              >
                <Coins className="h-3 w-3" />
                {!isUnlocked && visibility === 1 ? `Unlock ${(minTipAmount || tipAmount || 0) / 1e18} ETH` : 'Tip Creator'}
              </Button>
            )}
          </div>
        )}
      </CardFooter>

      {showReplies && (
        <div className="border-t border-border/50 p-4 space-y-4">
          <SimpleReplyForm
            rawPostId={rawPostId.toString()}
            onReplyCreated={handleReplyCreated}
            onCancel={handleReplyCancel}
          />
            {replies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Replies ({replies.length})
              </h4>
              {replies.map((reply) => (
                <NestedReplyCard
                  key={reply.id}
                  reply={reply}
                  rawPostId={rawPostId.toString()}
                  onReplyCreated={handleReplyCreated}
                  onReplyTipped={(replyId, amount) => {
                    log.info('Reply tipped', { replyId, amount });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        onTip={handleTipFromModal}
        author={authorDisplayName || author}
        isUnlock={false}
      />

    </Card>
  );
};