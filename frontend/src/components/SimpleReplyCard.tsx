import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { MessageSquare, User, Clock, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SimpleReplyCardProps {
  reply: {
    id: string;
    raw_post_id: string;
    author_id: string;
    content: string;
    encrypted_content?: string;
    encrypted_author_id?: string;
    isEncrypted?: boolean;
    created_at: string;
    updated_at: string;
  };
  className?: string;
}

export function SimpleReplyCard({ reply, className }: SimpleReplyCardProps) {
  const { address } = useAccount();
  const [userEncryptedAddress, setUserEncryptedAddress] = useState<string | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  
  useEffect(() => {
    const getUserEncryptedAddress = async () => {
      if (!address) return;
      
      try {
        const { data: userSession, error } = await supabase
          .from('user_sessions')
          .select('encrypted_address')
          .eq('wallet_address', address)
          .maybeSingle();

        if (userSession?.encrypted_address) {
          setUserEncryptedAddress(userSession.encrypted_address);
          const replyAuthorId = reply.encrypted_author_id || reply.author_id;
          setIsAuthor(userSession.encrypted_address === replyAuthorId);
        }
      } catch (err) {
        console.error('Error getting user encrypted address:', err);
      }
    };

    getUserEncryptedAddress();
  }, [address, reply.author_id]);
  
  const displayAddress = reply.encrypted_author_id || reply.author_id;
  
  const formatAddress = (addr: string) => {
    if (addr.length > 42) {
      return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card className={`bg-background border-border/50 ${className || ''}`}>
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
            
            {isAuthor && (
              <Badge variant="outline" className="text-xs">
                Your Reply
              </Badge>
            )}
          </div>

          <div className="pl-8">
            <p className="text-sm text-foreground leading-relaxed">
              {reply.content}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
