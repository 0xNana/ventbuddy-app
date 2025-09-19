import { VentCard } from "./VentCard";
import { VentFeedSkeleton } from "./VentFeedSkeleton";
import { usePosts } from "@/hooks/useContract";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Database } from "lucide-react";

export const VentFeed = () => {
  const { posts, isLoading, error } = usePosts();


  
  if (isLoading && posts.length === 0) {
    return <VentFeedSkeleton count={3} />;
  }

  
  if (error && posts.length === 0) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load posts: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  
  if (!isLoading && posts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
          <p className="text-muted-foreground mb-4">
            Be the first to express yourself in this privacy-preserving space and find support
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {posts.map((post, index) => (
        <VentCard
          key={post.rawPostId || `post-${index}`}
          {...post}
        />
      ))}
    </div>
  );
};