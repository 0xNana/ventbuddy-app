
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Plus, 
  User, 
  LogOut,
  Wallet
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWallet } from '@/hooks/useContract';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { isConnected, address } = useAccount();
  const { disconnect } = useWallet();

  const menuItems = [
    {
      id: 'feed',
      label: 'Feed',
      icon: Home,
      description: 'View all posts'
    },
    {
      id: 'create',
      label: 'Create',
      icon: Plus,
      description: 'Create new post'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      description: 'Your profile & settings'
    }
  ];

  const handleDisconnect = () => {
    disconnect();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="w-full border-r border-border/50 h-full flex flex-col">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">Ventbuddy</h1>
            <p className="text-xs text-muted-foreground">Secured by FHE</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start gap-3 h-12 ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              }`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="h-5 w-5" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs opacity-70">{item.description}</span>
              </div>
            </Button>
          );
        })}
      </div>

      {isConnected && address && (
        <div className="p-4 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {formatAddress(address)}
              </p>
              <Badge variant="outline" className="text-xs">
                Connected
              </Badge>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={handleDisconnect}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        </div>
      )}

      <div className="p-4 border-t border-border/50">
        <div className="text-center">
        </div>
      </div>
    </div>
  );
};
