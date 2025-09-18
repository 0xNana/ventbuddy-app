import { VentFeedSkeleton } from './VentFeedSkeleton';
import { SidebarSkeleton } from './SidebarSkeleton';
import { FaucetTapSkeleton } from './FaucetTapSkeleton';
import { Skeleton } from './ui/skeleton';

export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* X/Twitter-style Three-Column Layout Container */}
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-12 lg:gap-6 lg:min-h-screen">
        {/* Left Sidebar - 3 columns */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen bg-background">
            <SidebarSkeleton />
          </div>
        </div>
        
        {/* Main Content Area - 6 columns (centered) */}
        <div className="lg:col-span-6 pb-16 lg:pb-0">
          <div className="h-screen flex flex-col">
            {/* Fixed Header */}
            <div className="flex-shrink-0 p-6 border-b border-border/50">
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            
            {/* Scrollable Feed Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <VentFeedSkeleton count={4} />
            </div>
          </div>
        </div>

        {/* Right Side Panel - 3 columns */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen overflow-y-auto custom-scrollbar bg-background">
            <div className="border-l border-border/50 h-full">
              <div className="p-6 space-y-6">
                {/* Faucet Header */}
                <div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                
                {/* Faucet Section */}
                <div>
                  <FaucetTapSkeleton />
                </div>
                
                {/* Side Panel Section */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/50 lg:hidden z-20">
        <div className="flex justify-around py-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1 h-auto py-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
