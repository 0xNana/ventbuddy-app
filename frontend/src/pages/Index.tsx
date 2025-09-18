import { useState, useEffect } from "react";
import { useAccount } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Home, Plus, User } from "lucide-react";
import { VentFeed } from "@/components/VentFeed";
import { SidePanel } from "@/components/SidePanel";
import { CreatePostForm } from "@/components/CreatePostForm";
import { ProfileCard } from "@/components/ProfileCard";
import { CreatorProfile } from "@/components/CreatorProfile";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EnhancedRegistrationModal } from "@/components/EnhancedRegistrationModal";
import { CypherpunkHomePage } from "@/components/CypherpunkHomePage";
import { Sidebar } from "@/components/Sidebar";
import { SidebarSkeleton } from "@/components/SidebarSkeleton";
import { useRegistrationStatus } from "@/hooks/useContract";

const Index = () => {
  const { isConnected, address } = useAccount();
  const { isRegistered, isLoading: isRegistrationLoading } = useRegistrationStatus();
  const [activeTab, setActiveTab] = useState("feed");
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [viewingCreator, setViewingCreator] = useState<string | null>(null);

  // Listen for navigation events from header
  useEffect(() => {
    const handleNavigateToTab = (event: CustomEvent) => {
      setActiveTab(event.detail.tab);
    };

    const handleNavigateToCreator = (event: CustomEvent) => {
      setViewingCreator(event.detail.creatorAddress);
      setActiveTab('creator');
    };

    window.addEventListener('navigateToTab', handleNavigateToTab as EventListener);
    window.addEventListener('navigateToCreator', handleNavigateToCreator as EventListener);
    
    return () => {
      window.removeEventListener('navigateToTab', handleNavigateToTab as EventListener);
      window.removeEventListener('navigateToCreator', handleNavigateToCreator as EventListener);
    };
  }, []);

  // Check if user needs to register when they connect
  useEffect(() => {
    if (isConnected && address && !isRegistrationLoading) {
      // Only show registration modal if user is not registered
      if (isRegistered === false) {
        setShowRegistrationModal(true);
      } else if (isRegistered === true) {
        // User is registered, make sure modal is closed
        setShowRegistrationModal(false);
      }
    }
  }, [isConnected, address, isRegistered, isRegistrationLoading]);

  // Reset to cypherpunk interface when user disconnects
  useEffect(() => {
    if (!isConnected) {
      setActiveTab("feed"); // Reset to default tab
      setViewingCreator(null); // Clear any creator view
      setShowRegistrationModal(false); // Close any modals
    }
  }, [isConnected]);

  if (!isConnected) {
    return <CypherpunkHomePage onEnterApp={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* X/Twitter-style Three-Column Layout Container */}
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-12 lg:gap-6 lg:min-h-screen">
        {/* Left Sidebar - 3 columns */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen bg-background">
            {isRegistrationLoading ? (
              <SidebarSkeleton />
            ) : (
              <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            )}
          </div>
        </div>
        
        {/* Main Content Area - 6 columns (centered) */}
        <div className="lg:col-span-6 pb-16 lg:pb-0">
          {activeTab === "feed" && (
            <div className="h-screen flex flex-col">
              {/* Fixed Header */}
              <div className="flex-shrink-0 p-6 border-b border-border/50">
                <h2 className="text-2xl font-bold">Encrypted Feed</h2>
                <p className="text-muted-foreground">
                  All content is FHE encrypted
                </p>
              </div>
              
              {/* Scrollable Feed Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <VentFeed />
              </div>
            </div>
          )}
          
          {activeTab === "create" && (
            <div className="h-screen overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-2xl mx-auto">
                <ErrorBoundary>
                  <CreatePostForm />
                </ErrorBoundary>
              </div>
            </div>
          )}
          
          {activeTab === "profile" && (
            <div className="h-screen overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-4xl mx-auto">
                <ProfileCard />
              </div>
            </div>
          )}
          
          {activeTab === "creator" && viewingCreator && (
            <div className="h-screen overflow-y-auto p-6 custom-scrollbar">
              <div className="max-w-4xl mx-auto">
                <CreatorProfile
                  creatorAddress={viewingCreator}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side Panel - 3 columns */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen overflow-y-auto custom-scrollbar bg-background">
            <div className="border-l border-border/50 h-full">
              <div className="p-6 space-y-6">
                {/* Side Panel Section */}
                <div>
                  <SidePanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar - Only visible on small screens */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 lg:hidden z-20">
        <div className="flex justify-around py-2">
          <Button
            variant={activeTab === "feed" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("feed")}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Home className="h-4 w-4" />
            <span className="text-xs">Feed</span>
          </Button>
          <Button
            variant={activeTab === "create" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("create")}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">Create</span>
          </Button>
          <Button
            variant={activeTab === "profile" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("profile")}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <User className="h-4 w-4" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </div>

      {/* User Registration Modal */}
      {address && (
        <EnhancedRegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          userAddress={address}
        />
      )}
    </div>
  );
};

export default Index;
