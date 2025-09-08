import { Header } from "@/components/Header";
import { VentFeed } from "@/components/VentFeed";
import { SidePanel } from "@/components/SidePanel";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Your Encrypted Feed</h2>
              <p className="text-muted-foreground">
                Share your thoughts securely. Tip to unlock premium content.
              </p>
            </div>
            <VentFeed />
          </div>
          
          {/* Side Panel */}
          <div className="lg:col-span-1">
            <SidePanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
