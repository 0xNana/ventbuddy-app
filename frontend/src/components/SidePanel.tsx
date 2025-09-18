import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Shield, 
  Coins, 
  Users, 
  Star,
  Lock,
  Crown,
  Zap
} from "lucide-react";
import { PremiumModal } from "./PremiumModal";
import { useState } from "react";
import { useAccount } from "wagmi";

export const SidePanel = () => {
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<{id: string, name: string} | null>(null);
  const { address } = useAccount();

  const handleCreatorSubscription = (creatorId: string, creatorName: string) => {
    setSelectedCreator({ id: creatorId, name: creatorName });
    setIsSubscriptionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Trending Topics */}
      <Card className="bg-background border-border/50 relative">
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="outline" className="text-xs px-2 py-1 bg-background/90">
            Coming Soon
          </Badge>
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">#WorkStress</span>
            <Badge variant="secondary">142</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">#Relationships</span>
            <Badge variant="secondary">89</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">#MentalHealth</span>
            <Badge variant="secondary">76</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">#Anonymous</span>
            <Badge variant="secondary">234</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Stats */}
      <Card className="bg-background border-border/50 relative">
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="outline" className="text-xs px-2 py-1 bg-background/90">
            Coming Soon
          </Badge>
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm">Encrypted Vents</span>
            </div>
            <span className="text-sm font-medium">1,247</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Anonymous Users</span>
            </div>
            <span className="text-sm font-medium">892</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-tip" />
              <span className="text-sm">Tips Today</span>
            </div>
            <span className="text-sm font-medium">$3,421</span>
          </div>
        </CardContent>
      </Card>

      {/* Top Creators */}
      <Card className="bg-background border-border/50 relative">
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="outline" className="text-xs px-2 py-1 bg-background/90">
            Coming Soon
          </Badge>
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-premium" />
            Top Creators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-premium flex items-center justify-center">
                <Crown className="h-3 w-3 text-premium-foreground" />
              </div>
              <span className="text-sm">DeepThoughts</span>
            </div>
            <span className="text-sm font-medium">$1,234</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-tip flex items-center justify-center">
                <span className="text-xs font-medium text-tip-foreground">V</span>
              </div>
              <span className="text-sm">VentMaster</span>
            </div>
            <span className="text-sm font-medium">$892</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">A</span>
              </div>
              <span className="text-sm">Anonymous247</span>
            </div>
            <span className="text-sm font-medium">$567</span>
          </div>
        </CardContent>
      </Card>

      {/* Creator Subscriptions */}
      <Card className="bg-background border-border/50 relative">
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="outline" className="text-xs px-2 py-1 bg-background/90">
            Coming Soon
          </Badge>
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-premium" />
            Subscribe to Creators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-premium flex items-center justify-center">
                <Crown className="h-3 w-3 text-premium-foreground" />
              </div>
              <span className="text-sm">DeepThoughts</span>
            </div>
            <Badge variant="secondary">Premium</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-tip flex items-center justify-center">
                <span className="text-xs font-medium text-tip-foreground">V</span>
              </div>
              <span className="text-sm">VentMaster</span>
            </div>
            <Badge variant="secondary">Expert</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-primary flex items-center justify-center">
                <span className="text-xs font-medium text-primary-foreground">A</span>
              </div>
              <span className="text-sm">Anonymous247</span>
            </div>
            <Badge variant="secondary">Privacy</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Creator Subscription Modal */}
      {selectedCreator && (
        <PremiumModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => {
            setIsSubscriptionModalOpen(false);
            setSelectedCreator(null);
          }}
          creatorId={selectedCreator.id}
          creatorName={selectedCreator.name}
        />
      )}
    </div>
  );
};