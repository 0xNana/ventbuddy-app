import { VentCard } from "./VentCard";
import { TipModal } from "./TipModal";
import { useState } from "react";

const mockVents = [
  {
    id: "1",
    author: "Anonymous",
    content: "Feeling overwhelmed with work lately. The constant pressure is getting to me and I don't know how to handle it anymore...",
    isLocked: false,
    likes: 12,
    comments: 3,
    timestamp: "2 hours ago",
    isPremium: false,
  },
  {
    id: "2", 
    author: "Creator42",
    content: "Had the worst day ever. Everything that could go wrong did go wrong. Started with spilling coffee on my laptop, then...",
    isLocked: true,
    tipAmount: 3,
    likes: 24,
    comments: 8,
    timestamp: "4 hours ago",
    isPremium: true,
  },
  {
    id: "3",
    author: "VentBuddy",
    content: "Sometimes I wonder if anyone actually cares about what I have to say. The loneliness is crushing and I feel like I'm screaming into the void...",
    isLocked: true,
    tipAmount: 2,
    likes: 45,
    comments: 15,
    timestamp: "6 hours ago",
    isPremium: false,
  },
  {
    id: "4",
    author: "Anonymous",
    content: "Finally stood up to my toxic boss today. It felt amazing but now I'm worried about the consequences. Did I do the right thing?",
    isLocked: false,
    likes: 89,
    comments: 23,
    timestamp: "8 hours ago",
    isPremium: false,
  },
  {
    id: "5",
    author: "DeepThoughts",
    content: "The weight of expectations is suffocating me. Everyone thinks I have it all together but inside I'm falling apart...",
    isLocked: true,
    tipAmount: 5,
    likes: 67,
    comments: 19,
    timestamp: "12 hours ago",
    isPremium: true,
  },
];

export const VentFeed = () => {
  const [selectedVent, setSelectedVent] = useState<string | null>(null);
  const [tipModalOpen, setTipModalOpen] = useState(false);

  const handleTip = (amount: number) => {
    console.log(`Tipped $${amount} for vent ${selectedVent}`);
    // Handle tip logic here
  };

  return (
    <div className="space-y-6">
      {mockVents.map((vent) => (
        <VentCard
          key={vent.id}
          {...vent}
        />
      ))}

      <TipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        onTip={handleTip}
        author="Creator42"
        preview="Had the worst day ever. Everything that could go wrong"
      />
    </div>
  );
};