import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MessageSquare, User, Clock, Reply, Shield, Coins } from 'lucide-react';
import { SimpleReplyForm } from './SimpleReplyForm';
import { supabase } from '../lib/supabase';
import { usePayments } from '../hooks/usePayments';
import { toast } from 'sonner';

interface NestedReplyCardProps {
  reply: {
    id: string;
    raw_post_id: string;
    reply_id?: number; // Add reply_id for tipping
    parent_reply_id?: string;
    author_id: string;
    content: string;
    encrypted_content?: string;
    encrypted_author_id?: string;
    isEncrypted?: boolean;
    created_at: string;
    updated_at: string;
    children?: NestedReplyCardProps['reply'][];
    min_tip_amount?: number; // Add minimum tip amount
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
  
  const maxDepth = 3; // Limit nesting depth to prevent UI issues

  // Get user's encrypted address to compare with reply author
  useEffect(() => {
    const getUserEncryptedAddress = async () => {
      if (!address) return;
      
      try {
        const { data: userSession, error } = await supabase
          .from('user_sessions')
          .select('encrypted_address')
          .eq('wallet_address', address)
          .single();

        if (userSession?.encrypted_address) {
          setUserEncryptedAddress(userSession.encrypted_address);
          // Compare with encrypted_author_id if available, otherwise with author_id
          const replyAuthorId = reply.encrypted_author_id || reply.author_id;
          setIsAuthor(userSession.encrypted_address === replyAuthorId);
        }
      } catch (err) {
        console.error('Error getting user encrypted address:', err);
      }
    };

    getUserEncryptedAddress();
  }, [address, reply.encrypted_author_id, reply.author_id]);
  
  const formatAddress = (addr: string) => {
    // If it's an encrypted address (longer), show more characters
    if (addr.length > 42) {
      return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Use the encrypted_author_id for display if available, otherwise author_id
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

    try {
      console.log('💰 Tipping reply:', {
        postId: parseInt(rawPostId),
        replyId: reply.reply_id,
        amount: amount,
        userAddress: address
      });

      const result = await tipReply(parseInt(rawPostId), reply.reply_id, amount);
      
      if (result.success) {
        console.log('✅ Reply tip successful:', result.txHash);
        toast.success(`Successfully tipped ${amount} ETH to the reply author!`);
        
        if (onReplyTipped) {
          onReplyTipped(reply.id, amount);
        }
      } else {
        console.error('❌ Reply tip failed:', result.error);
        // Error toast is already shown by the hook
      }
    } catch (error) {
      console.error('❌ Reply tip failed:', error);
      // Error toast is already shown by the hook
    }
  };

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Main Reply Card */}
      <Card 
        className={`bg-background border-border/50 ${
          depth > 0 ? 'ml-4 border-l-2 border-l-primary/20' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Reply Header */}
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
                
                {/* Tip Button - only show if not the author and has reply_id */}
                {!isAuthor && reply.reply_id && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.001"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="w-16 px-1 py-0.5 text-xs border rounded"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTipReply}
                      disabled={isPaymentLoading}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Coins className="h-3 w-3" />
                      {isPaymentLoading ? 'Tipping...' : 'Tip'}
                    </Button>
                  </div>
                )}
                
                {/* Reply Button - only show if not at max depth */}
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

            {/* Reply Content */}
            <div className="pl-8">
              <p className="text-sm text-foreground leading-relaxed">
                {reply.content}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nested Reply Form */}
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

      {/* Nested Replies */}
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
