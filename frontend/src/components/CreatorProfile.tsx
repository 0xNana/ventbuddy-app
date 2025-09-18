import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  Users
} from 'lucide-react';
import { useDisplayName } from '../hooks/useUserProfile';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CreatorProfileProps {
  creatorAddress: string;
}

export function CreatorProfile({ 
  creatorAddress
}: CreatorProfileProps) {
  const { address } = useAccount();
  const { displayName: creatorDisplayName, isLoading: isLoadingDisplayName } = useDisplayName(creatorAddress);
  const [creatorData, setCreatorData] = useState({
    subscriberCount: 0
  });
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Don't show subscription options if user is the creator
  const isOwnProfile = address?.toLowerCase() === creatorAddress.toLowerCase();

  // Fetch creator data
  useEffect(() => {
    const fetchCreatorData = async () => {
      if (!creatorAddress) {
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);

      try {
        console.log('📊 Fetching creator data for:', creatorAddress);

        // Fetch subscription data for this creator - SIMPLIFIED: Use placeholder since access_logs has schema issues
        const subscriptionData: any[] = []; // Placeholder - could be enhanced later
        
        console.log('📊 Creator profile - using placeholder values for subscription data due to access_logs schema issues');

        // Calculate subscriber count from subscriptions table
        const { data: subscriptionCountData, error: countError } = await supabase
          .from('subscriptions')
          .select('subscriber_address')
          .eq('creator_address', creatorAddress.toLowerCase());

        if (countError) {
          console.error('Error fetching subscriber count:', countError);
        }

        const subscriberCount = new Set(subscriptionCountData?.map(sub => sub.subscriber_address) || []).size;

        setCreatorData({
          subscriberCount
        });

        console.log('✅ Creator data fetched:', {
          subscriberCount
        });

      } catch (error) {
        console.error('❌ Failed to fetch creator data:', error);
        toast.error('Failed to load creator data');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchCreatorData();
  }, [creatorAddress, address]);




  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading creator profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Creator Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {isLoadingDisplayName ? '...' : creatorDisplayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">
                  {isLoadingDisplayName ? 'Loading...' : creatorDisplayName}
                </CardTitle>
                <CardDescription className="mt-1">
                  <span className="text-sm text-muted-foreground">Creator Profile</span>
                </CardDescription>
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-2">
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {creatorData.subscriberCount} followers
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>


    </div>
  );
}
