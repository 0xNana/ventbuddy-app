import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useSimpleReplies } from '../hooks/useSimpleReplies';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';

interface SimpleReplyFormProps {
  rawPostId: string;
  parentReplyId?: string;
  onReplyCreated?: (replyData: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function SimpleReplyForm({ rawPostId, parentReplyId, onReplyCreated, onCancel, className }: SimpleReplyFormProps) {
  const { address } = useAccount();
  const { createReply, isLoading, error } = useSimpleReplies();
  
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      toast.error('Please connect your wallet to reply');
      return;
    }

    if (!content.trim()) {
      toast.error('Please enter reply content');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('🚀 Submitting encrypted reply:', {
        rawPostId,
        parentReplyId,
        content: content.substring(0, 50) + '...'
      });

      const result = await createReply(rawPostId, content, parentReplyId);
      
      console.log('✅ Encrypted reply created successfully:', result);
      
      setContent('');
      
      if (onReplyCreated) {
        onReplyCreated(result);
      }
    } catch (err) {
      console.error('❌ Encrypted reply submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setContent('');
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">
          {parentReplyId ? 'Reply to this reply' : 'Reply to this post'}
        </h3>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts..."
            className="min-h-[100px] resize-none"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {content.length}/500 characters
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim() || content.length > 500}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Post Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
