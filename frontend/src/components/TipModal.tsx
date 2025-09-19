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
import { Lock, Unlock, Coins } from "lucide-react";
import { useState } from "react";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTip: (amount: number) => void;
  author: string;
  isUnlock?: boolean; 
}

export const TipModal = ({ isOpen, onClose, onTip, author, isUnlock = false }: TipModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState(0.01); 
  const tipAmounts = [0.001, 0.01, 0.05, 0.1, 0.5]; 

  const handleTip = () => {
    onTip(selectedAmount);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-gradient-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isUnlock ? (
                <>
                  <Lock className="h-5 w-5 text-primary" />
                  Unlock Encrypted Vent
                </>
              ) : (
                <>
                  <Coins className="h-5 w-5 text-primary" />
                  Tip Creator
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isUnlock 
                ? `Support ${author} and unlock their private vent. All tips are encrypted and secure.`
                : `Show your appreciation to ${author} for their content. All tips are secure and go directly to the creator.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            
            <div className="p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="border-primary/50">
                  {isUnlock ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Private Content
                    </>
                  ) : (
                    <>
                      <Coins className="h-3 w-3 mr-1" />
                      Content
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground italic">
                {isUnlock ? (
                  '[Private content - tip to unlock]'
                ) : (
                  '[Content preview removed for security]'
                )}
              </p>
            </div>

            
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
                    {amount} ETH
                  </Button>
                ))}
              </div>
            </div>

            
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                {isUnlock ? (
                  <>
                    <Unlock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">You'll unlock:</span>
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Your tip supports:</span>
                  </>
                )}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {isUnlock ? (
                  <>
                    <li>• Full vent content</li>
                    <li>• Ability to comment</li>
                    <li>• Support the creator</li>
                  </>
                ) : (
                  <>
                    <li>• Creator's continued content</li>
                    <li>• Platform development</li>
                    <li>• Community growth</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="tip" onClick={handleTip}>
              <Coins className="h-4 w-4" />
              {isUnlock ? `Tip ${selectedAmount} ETH & Unlock` : `Tip ${selectedAmount} ETH`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};