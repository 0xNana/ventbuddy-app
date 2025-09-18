import { Button } from "@/components/ui/button";
import { Shield, Home, FileText, User } from "lucide-react";
import { ProfileDropdown } from "./ProfileDropdown";
import { useNavigate, useLocation } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (tab: string) => {
    // For now, we'll use a simple approach to switch tabs
    // In a real app, you might want to use state management or URL routing
    const event = new CustomEvent('navigateToTab', { detail: { tab } });
    window.dispatchEvent(event);
  };

  const isActive = (tab: string) => {
    // Simple active state logic - you can enhance this based on your routing needs
    return location.pathname === '/' && tab === 'feed';
  };

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
        <nav className="hidden md:flex items-center gap-2">
          <Button 
            variant={isActive('feed') ? "default" : "ghost"} 
            size="sm"
            onClick={() => handleNavigation('feed')}
          >
            <Home className="h-4 w-4 mr-2" />
            Feed
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleNavigation('create')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Post
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleNavigation('profile')}
          >
            <User className="h-4 w-4 mr-2" />
            Profile
          </Button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  );
};