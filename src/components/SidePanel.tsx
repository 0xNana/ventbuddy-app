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

export const SidePanel = () => {
  return (
    <div className="space-y-6">
      {/* Trending Topics */}
      <Card className="bg-gradient-card border-border/50">
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
      <Card className="bg-gradient-card border-border/50">
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
      <Card className="bg-gradient-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-premium" />
            Top Creators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-premium flex items-center justify-center">
              <Crown className="h-4 w-4 text-premium-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">DeepThoughts</p>
              <p className="text-xs text-muted-foreground">$1,234 this month</p>
            </div>
            <Button variant="premium" size="sm">
              Follow
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-tip flex items-center justify-center">
              <span className="text-sm font-medium text-tip-foreground">V</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">VentMaster</p>
              <p className="text-xs text-muted-foreground">$892 this month</p>
            </div>
            <Button variant="tip" size="sm">
              Follow
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-medium text-primary-foreground">A</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Anonymous247</p>
              <p className="text-xs text-muted-foreground">$567 this month</p>
            </div>
            <Button variant="encrypted" size="sm">
              Follow
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="bg-gradient-premium border-premium/30">
        <CardContent className="p-6 text-center">
          <Crown className="h-12 w-12 mx-auto mb-4 text-premium-foreground" />
          <h3 className="font-bold text-premium-foreground mb-2">Go Premium</h3>
          <p className="text-sm text-premium-foreground/80 mb-4">
            Unlock advanced privacy features and earn more from your vents
          </p>
          <Button variant="outline" className="w-full border-premium-foreground/20 text-premium-foreground hover:bg-premium-foreground/10">
            <Coins className="h-4 w-4" />
            Upgrade Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};