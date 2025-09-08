import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lock, Unlock, Heart, MessageCircle, Coins, Eye } from "lucide-react";
import { useState } from "react";

interface VentCardProps {
  id: string;
  author: string;
  content: string;
  isLocked: boolean;
  tipAmount?: number;
  likes: number;
  comments: number;
  timestamp: string;
  isPremium?: boolean;
}

export const VentCard = ({ 
  author, 
  content, 
  isLocked, 
  tipAmount, 
  likes, 
  comments, 
  timestamp,
  isPremium 
}: VentCardProps) => {
  const [isUnlocked, setIsUnlocked] = useState(!isLocked);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  return (
    <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-medium text-primary-foreground">
                {author.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{author}</p>
              <p className="text-xs text-muted-foreground">{timestamp}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPremium && (
              <Badge variant="secondary" className="bg-gradient-premium text-premium-foreground">
                Premium
              </Badge>
            )}
            {isLocked && (
              <Badge variant="outline" className="border-primary/50">
                <Lock className="h-3 w-3 mr-1" />
                Encrypted
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className={`relative transition-all duration-500 ${!isUnlocked && isLocked ? 'filter blur-md' : ''}`}>
          <p className="text-foreground leading-relaxed">
            {content}
          </p>
          
          {!isUnlocked && isLocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
              <div className="text-center">
                <Lock className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium mb-3">Unlock this vent</p>
                <Button 
                  variant="tip" 
                  size="sm"
                  onClick={handleUnlock}
                >
                  <Coins className="h-4 w-4" />
                  Tip ${tipAmount || 2} to Unlock
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Heart className="h-4 w-4" />
            {likes}
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <MessageCircle className="h-4 w-4" />
            {comments}
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        </div>
        
        {isUnlocked && !isLocked && (
          <div className="flex items-center gap-2">
            <Unlock className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Unlocked</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};