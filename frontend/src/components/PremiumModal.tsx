import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string; // Required - the creator's wallet address
  creatorName: string; // Required - the creator's display name
  creatorAvatar?: string; // Optional - creator's avatar
}

export const PremiumModal = ({ isOpen, onClose, creatorId, creatorName, creatorAvatar }: PremiumModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Premium Content
          </DialogTitle>
          <DialogDescription>
            Subscription functionality is currently unavailable.
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-center py-6">
          <div className="text-muted-foreground mb-4">
            <p>Premium subscriptions are temporarily disabled.</p>
            <p className="text-sm mt-2">Please check back later for updates.</p>
          </div>
          
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};