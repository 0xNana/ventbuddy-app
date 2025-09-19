import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MessageSquare, User, Clock, Reply, Shield, Coins, Lock, Eye } from 'lucide-react';
import { SimpleReplyForm } from './SimpleReplyForm';
import { supabase } from '../lib/supabase';
import { usePayments } from '../hooks/usePayments';
import { toast } from 'sonner';

interface NestedReplyCardProps {
  reply: {
    id: string;
    raw_post_id: string;
    reply_id?: number;
    parent_reply_id?: string;
    author_id: string;
    content: string;
    encrypted_content?: string;
    encrypted_author_id?: string;
    isEncrypted?: boolean;
    created_at: string;
    updated_at: string;
    children?: NestedReplyCardProps['reply'][];
    min_tip_amount?: number;
  };
  rawPostId: string;
  onReplyCreated?: (replyData: any) => void;
  onReplyTipped?: (replyId: string, amount: number) => void;
  depth?: number;
  className?: string;
}

export function NestedReplyCard({ 
  reply, 
  rawPostId, 
  onReplyCreated, 
  onReplyTipped,
  depth = 0, 
  className 
}: NestedReplyCardProps) {
  const { address } = useAccount();
  const { tipReply, isLoading: isPaymentLoading } = usePayments();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [userEncryptedAddress, setUserEncryptedAddress] = useState<string | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [tipAmount, setTipAmount] = useState<string>('0.001');
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessInfo, setAccessInfo] = useState<{ hasAccess: boolean; reason: string } | null>(null);
  
  const isLocked = reply.min_tip_amount && reply.min_tip_amount > 0;
  
  const maxDepth = 3;

  const checkReplyAccess = useCallback(async (replyId: string) => {
    if (!address || !replyId) return false;
    
    try {
      const { data: accessData, error } = await supabase
        .from('access_log')
        .select('*')
        .eq('content_id', replyId)
        .eq('content_type', 'reply')
        .eq('user_address', address)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        return false;
      }

      return accessData && accessData.length > 0;
    } catch (error) {
      return false;
    }
  }, [address]);

  // Combined effect to check author status and visibility access
  useEffect(() => {
    const checkAuthorAndVisibility = async () => {
      if (!reply.id) return;
      
      let isReplyAuthor = false;
      
      // First, check if user is the author (only if user is connected)
      if (address) {
        try {
          const { data: userSession, error: sessionError } = await supabase
            .from('user_sessions')
            .select('encrypted_address')
            .eq('wallet_address', address)
            .maybeSingle();

          if (!sessionError && userSession?.encrypted_address) {
            setUserEncryptedAddress(userSession.encrypted_address);

            // Query encrypted_replies table directly to get the replier_id
            const { data: replyData, error: replyError } = await supabase
              .from('encrypted_replies')
              .select('replier_id')
              .eq('id', reply.id)
              .single();

            if (!replyError && replyData) {
              // Compare current user's encrypted address with reply replier_id
              isReplyAuthor = userSession.encrypted_address === replyData.replier_id;
            } else {
              console.warn('Failed to get reply author', { error: replyError?.message });
            }
          }
        } catch (err) {
          console.error('Error checking reply author', err);
        }
      }
      
      // Set author state
      setIsAuthor(isReplyAuthor);
      
      // Now check visibility access
      if (address) {
        if (!isLocked) {
          setIsUnlocked(true);
          setAccessInfo({ hasAccess: true, reason: 'public' });
          return;
        }

        if (isLocked) {
          if (isReplyAuthor) {
            setIsUnlocked(true);
            setAccessInfo({ hasAccess: true, reason: 'author' });
            return;
          }
          
          // Otherwise, check if they have paid access
          const hasAccess = await checkReplyAccess(reply.id);
          if (hasAccess) {
            setIsUnlocked(true);
            setAccessInfo({ hasAccess: true, reason: 'unlock' });
          } else {
            setIsUnlocked(false);
            setAccessInfo({ hasAccess: false, reason: 'requires_payment' });
          }
          return;
        }
      } else {
        if (!isLocked) {
          setIsUnlocked(true);
          setAccessInfo({ hasAccess: true, reason: 'public' });
        } else {
          setIsUnlocked(false);
          setAccessInfo({ hasAccess: false, reason: 'not_connected' });
        }
      }
    };

    checkAuthorAndVisibility();
  }, [address, reply.id, isLocked, checkReplyAccess]);
  
  const formatAddress = (addr: string) => {
    if (addr.length > 42) {
      return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const displayAddress = reply.encrypted_author_id || reply.author_id;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleReplyCreated = (replyData: any) => {
    setShowReplyForm(false);
    if (onReplyCreated) {
      onReplyCreated(replyData);
    }
  };

  const handleReplyCancel = () => {
    setShowReplyForm(false);
  };

  const handleTipReply = async () => {
    if (!address) {
      toast.error('Please connect your wallet to tip replies');
      return;
    }

    if (!reply.reply_id) {
      toast.error('Reply ID not available for tipping');
      return;
    }

    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    if (isLocked && reply.min_tip_amount && amount < reply.min_tip_amount) {
      toast.error(`Minimum tip amount is ${reply.min_tip_amount} ETH`);
      return;
    }

    try {
      const action = isLocked && !isUnlocked ? 'unlocking' : 'tipping';

      const result = await tipReply(parseInt(rawPostId), reply.reply_id, amount);
      
      if (result.success) {
        
        if (isLocked && !isUnlocked) {
          toast.success(`Successfully unlocked reply for ${amount} ETH!`);
          setIsUnlocked(true);
          setAccessInfo({ hasAccess: true, reason: 'unlock' });
        } else {
          toast.success(`Successfully tipped ${amount} ETH to the reply author!`);
        }
        
        if (onReplyTipped) {
          onReplyTipped(reply.id, amount);
        }
      } else {
        // Error toast is already shown by the hook
      }
    } catch (error) {
      // Error toast is already shown by the hook
    }
  };

  return (
    <div className={`space-y-3 ${className || ''}`}>
      <Card 
        className={`bg-background border-border/50 ${
          depth > 0 ? 'ml-4 border-l-2 border-l-primary/20' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center">
                  {reply.isEncrypted ? (
                    <Shield className="h-3 w-3 text-primary-foreground" />
                  ) : (
                    <User className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {isAuthor ? 'You' : formatAddress(displayAddress)}
                    </p>
                    {reply.isEncrypted && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="h-2 w-2 mr-1" />
                        Encrypted
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(reply.created_at)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isAuthor && (
                  <Badge variant="outline" className="text-xs">
                    Your Reply
                  </Badge>
                )}
                
                {((!isAuthor && reply.reply_id) || (isLocked && !isUnlocked)) && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.001"
                      min={isLocked ? reply.min_tip_amount || 0 : 0}
                      placeholder={isLocked ? (reply.min_tip_amount || 0.001).toString() : "0.001"}
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="w-16 px-1 py-0.5 text-xs border rounded"
                    />
                    <Button
                      variant={isLocked && !isUnlocked ? "default" : "ghost"}
                      size="sm"
                      onClick={handleTipReply}
                      disabled={isPaymentLoading}
                      className={`text-xs ${isLocked && !isUnlocked ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Coins className="h-3 w-3" />
                      {isPaymentLoading ? 'Processing...' : 
                       isLocked && !isUnlocked ? 'Unlock' : 'Tip'}
                    </Button>
                  </div>
                )}
                
                {depth < maxDepth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Reply className="h-3 w-3" />
                    Reply
                  </Button>
                )}
              </div>
            </div>

            <div className="pl-8">
              <div className={`relative transition-all duration-500 ${!isUnlocked && isLocked ? 'filter blur-md' : ''}`}>
                <p className="text-sm text-foreground leading-relaxed">
                  {isUnlocked || !isLocked ? (
                    reply.content
                  ) : (
                    <span className="text-muted-foreground italic">
                      [Private reply - tip to unlock]
                    </span>
                  )}
                </p>
                
                {!isUnlocked && isLocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
                    <div className="text-center">
                      <Coins className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                      <p className="text-xs font-medium mb-1">Private reply</p>
                      <p className="text-xs text-muted-foreground">
                        Tip {reply.min_tip_amount} ETH to unlock
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showReplyForm && depth < maxDepth && (
        <div className="ml-8">
          <SimpleReplyForm
            rawPostId={rawPostId}
            parentReplyId={reply.id}
            onReplyCreated={handleReplyCreated}
            onCancel={handleReplyCancel}
          />
        </div>
      )}

      {reply.children && reply.children.length > 0 && (
        <div className="space-y-3">
          {reply.children.map((childReply) => (
            <NestedReplyCard
              key={childReply.id}
              reply={childReply}
              rawPostId={rawPostId}
              onReplyCreated={onReplyCreated}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
