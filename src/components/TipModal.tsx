import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Coins, Lock, Unlock, CreditCard } from "lucide-react";
import { useState } from "react";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTip: (amount: number) => void;
  author: string;
  preview: string;
}

export const TipModal = ({ isOpen, onClose, onTip, author, preview }: TipModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState(2);
  const tipAmounts = [1, 2, 5, 10, 20];

  const handleTip = () => {
    onTip(selectedAmount);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Unlock Encrypted Vent
          </DialogTitle>
          <DialogDescription>
            Support {author} and unlock their private vent. All tips are encrypted and secure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="p-4 rounded-lg bg-background/50 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-primary/50">
                <Lock className="h-3 w-3 mr-1" />
                Preview
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground filter blur-sm">
              {preview}...
            </p>
          </div>

          {/* Tip Amount Selection */}
          <div>
            <p className="text-sm font-medium mb-3">Select tip amount:</p>
            <div className="grid grid-cols-5 gap-2">
              {tipAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? "tip" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAmount(amount)}
                  className="text-sm"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">You'll unlock:</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Full vent content</li>
              <li>• Ability to comment</li>
              <li>• Support the creator</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="tip" onClick={handleTip}>
            <CreditCard className="h-4 w-4" />
            Tip ${selectedAmount} & Unlock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};