import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function VentCardSkeleton() {
  return (
    <Card className="bg-background border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar skeleton */}
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              {/* Username skeleton */}
              <Skeleton className="h-4 w-24" />
              {/* Timestamp skeleton */}
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge skeletons */}
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {/* Content skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          {/* Engagement buttons skeleton */}
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <Skeleton className="h-8 w-12 rounded" />
        </div>
        
        {/* Tip button skeleton */}
        <Skeleton className="h-8 w-24 rounded" />
      </CardFooter>
    </Card>
  );
}
