import { Skeleton } from '@/components/ui/skeleton';

export function SidebarSkeleton() {
  return (
    <div className="w-full border-r border-border/50 h-full flex flex-col">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="w-full h-12 flex items-center gap-3 p-3 rounded-lg">
            <Skeleton className="h-5 w-5" />
            <div className="flex flex-col items-start space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border/50 space-y-3">
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>

        <Skeleton className="w-full h-8 rounded" />
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    </div>
  );
}
