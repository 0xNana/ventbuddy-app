import { VentFeedSkeleton } from './VentFeedSkeleton';
import { SidebarSkeleton } from './SidebarSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-12 lg:gap-6 lg:min-h-screen">
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen bg-background">
            <SidebarSkeleton />
          </div>
        </div>
        
        <div className="lg:col-span-6 pb-16 lg:pb-0">
          <div className="h-screen flex flex-col">
            <div className="flex-shrink-0 p-6 border-b border-border/50">
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <VentFeedSkeleton count={4} />
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-0 h-screen overflow-y-auto custom-scrollbar bg-background">
            <div className="border-l border-border/50 h-full">
              <div className="p-6 space-y-6">
                <div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                
                <div>
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
                
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
