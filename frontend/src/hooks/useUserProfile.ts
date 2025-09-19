import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabase';
import { useLogger } from './useLogger';

export interface UserProfile {
  id: string;
  wallet_address: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_username_public: boolean;
  is_profile_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileData {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  is_username_public?: boolean;
  is_profile_public?: boolean;
}


export function useUserProfile() {
  const { address } = useAccount();
  const log = useLogger('useUserProfile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.debug('Fetching user profile', { address });

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();

      if (error) {
        log.error('Error fetching user profile', error);
        setError('Failed to fetch profile');
        return;
      }

      if (data) {
        setProfile(data);
        log.info('User profile fetched', { profileId: data.id, username: data.username });
      } else {
        log.debug('No profile found for user', { address });
        setProfile(null);
      }

    } catch (err) {
      log.error('Failed to fetch user profile', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const createProfile = useCallback(async (profileData: CreateProfileData) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Creating user profile', { profileData });

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: address.toLowerCase(),
          username: profileData.username || null,
          display_name: profileData.display_name || null,
          bio: profileData.bio || null,
          avatar_url: profileData.avatar_url || null,
          is_username_public: profileData.is_username_public || false,
          is_profile_public: profileData.is_profile_public || false
        })
        .select()
        .maybeSingle();

      if (error) {
        log.error('Error creating profile', error);
        setError(error.message);
        return;
      }

      setProfile(data);
      log.info('User profile created', { profileId: data.id, username: data.username });
      return data;

    } catch (err) {
      log.error('Failed to create user profile', err);
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const updateProfile = useCallback(async (profileData: Partial<CreateProfileData>) => {
    if (!address || !profile) {
      setError('Profile not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Updating user profile', { profileData });

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          username: profileData.username !== undefined ? profileData.username : profile.username,
          display_name: profileData.display_name !== undefined ? profileData.display_name : profile.display_name,
          bio: profileData.bio !== undefined ? profileData.bio : profile.bio,
          avatar_url: profileData.avatar_url !== undefined ? profileData.avatar_url : profile.avatar_url,
          is_username_public: profileData.is_username_public !== undefined ? profileData.is_username_public : profile.is_username_public,
          is_profile_public: profileData.is_profile_public !== undefined ? profileData.is_profile_public : profile.is_profile_public
        })
        .eq('wallet_address', address.toLowerCase())
        .select()
        .maybeSingle();

      if (error) {
        log.error('Error updating profile', error);
        setError(error.message);
        return;
      }

      setProfile(data);
      log.info('User profile updated', { profileId: data.id, username: data.username });
      return data;

    } catch (err) {
      log.error('Failed to update user profile', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  }, [address, profile]);

  const checkUsernameAvailability = useCallback(async (username: string): Promise<boolean> => {
    if (!username || username.length < 3) return false;

    try {
      const { data, error } = await supabase
        .rpc('is_username_available', {
          check_username: username,
          exclude_wallet: address?.toLowerCase() || null
        });

      if (error) {
        log.error('Error checking username availability', error);
        return false;
      }

      return data;
    } catch (err) {
      log.error('Failed to check username availability', err);
      return false;
    }
  }, [address]);


  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    createProfile,
    updateProfile,
    checkUsernameAvailability,
    refetch: fetchProfile
  };
}


export function useDisplayName(walletAddress: string) {
  const log = useLogger('useDisplayName');
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchDisplayName = useCallback(async () => {
    if (!walletAddress) {
      setDisplayName('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      log.debug('Fetching display name', { walletAddress });

      
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('username, display_name, is_username_public, is_profile_public')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      if (profileError) {
        log.error('Error fetching user profile', profileError);
        setDisplayName('Anon');
        return;
      }

      if (profileData) {
        log.debug('Profile data found', { 
          username: profileData.username, 
          displayName: profileData.display_name,
          isUsernamePublic: profileData.is_username_public,
          isProfilePublic: profileData.is_profile_public
        });
        
        
        if (profileData.is_username_public && profileData.username) {
          log.debug('Using public username', { username: profileData.username });
          setDisplayName(profileData.username);
          return;
        }
        
        
        if (profileData.is_profile_public) {
          const displayName = profileData.display_name || profileData.username || 'Anon';
          log.debug('Using public profile display name', { displayName });
          setDisplayName(displayName);
          return;
        }
        
        log.debug('Profile found but not public, using Anon');
      } else {
        log.debug('No profile data found for wallet', { walletAddress });
      }

      
      setDisplayName('Anon');
      log.debug('Display name set to Anon (no public profile found)');

    } catch (err) {
      log.error('Failed to fetch display name', err);
      
      setDisplayName('Anon');
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchDisplayName();
  }, [fetchDisplayName]);

  return {
    displayName,
    isLoading
  };
}
