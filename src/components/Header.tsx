import { Button } from "@/components/ui/button";
import { Lock, Plus, User, Shield, Coins } from "lucide-react";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ventbuddy</h1>
            <p className="text-xs text-muted-foreground">Your encrypted vent buddy</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <Lock className="h-4 w-4" />
            Privacy
          </Button>
          <Button variant="ghost" size="sm">
            <Coins className="h-4 w-4" />
            Earnings
          </Button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="encrypted" size="sm">
            <Plus className="h-4 w-4" />
            New Vent
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};