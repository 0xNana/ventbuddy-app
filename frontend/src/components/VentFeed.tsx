import { VentCard } from "./VentCard";
import { VentFeedSkeleton } from "./VentFeedSkeleton";
import { TipModal } from "./TipModal";
import { useState, useEffect } from "react";
import { usePosts } from "@/hooks/useContract";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Database } from "lucide-react";
import { toast } from "sonner";

export const VentFeed = () => {
  const [selectedVent, setSelectedVent] = useState<string | null>(null);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const { posts, isLoading, error } = usePosts();

  const handleTip = (amount: number) => {
    console.log(`Tipped $${amount} for vent ${selectedVent}`);
    toast.success(`Successfully tipped ${amount} ETH!`);
    setTipModalOpen(false);
  };


  // Show loading state with skeleton
  if (isLoading && posts.length === 0) {
    return <VentFeedSkeleton count={3} />;
  }

  // Show error state
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

  // Show empty state
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
      {/* Posts */}
      {posts.map((post, index) => (
        <VentCard
          key={post.rawPostId || `post-${index}`}
          {...post}
        />
      ))}


      {/* Tip Modal */}
      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        onTip={handleTip}
        author="Anon"
        preview="Encrypted content preview"
      />
    </div>
  );
};