import { VentCardSkeleton } from './VentCardSkeleton';

interface VentFeedSkeletonProps {
  count?: number;
}

export function VentFeedSkeleton({ count = 3 }: VentFeedSkeletonProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, index) => (
        <VentCardSkeleton key={index} />
      ))}
    </div>
  );
}
