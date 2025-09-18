import { useCallback } from 'react';

/**
 * Hook for managing user registration state using localStorage
 * This avoids RPC calls and provides a smooth onboarding experience
 */
export function useRegistration() {
  
  /**
   * Check if user has seen the registration modal
   */
  const hasSeenRegistration = useCallback((userAddress: string): boolean => {
    if (!userAddress) return false;
    return localStorage.getItem(`registration_seen_${userAddress}`) === 'true';
  }, []);

  /**
   * Mark that user has seen the registration modal
   */
  const markRegistrationSeen = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.setItem(`registration_seen_${userAddress}`, 'true');
  }, []);

  /**
   * Check if user has completed registration
   */
  const hasCompletedRegistration = useCallback((userAddress: string): boolean => {
    if (!userAddress) return false;
    return localStorage.getItem(`registration_completed_${userAddress}`) === 'true';
  }, []);

  /**
   * Mark that user has completed registration
   */
  const markRegistrationCompleted = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.setItem(`registration_completed_${userAddress}`, 'true');
    // Also mark as seen
    localStorage.setItem(`registration_seen_${userAddress}`, 'true');
  }, []);

  /**
   * Reset registration state for a user (useful for testing)
   */
  const resetRegistrationState = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.removeItem(`registration_seen_${userAddress}`);
    localStorage.removeItem(`registration_completed_${userAddress}`);
  }, []);

  /**
   * Get registration status for a user
   */
  const getRegistrationStatus = useCallback((userAddress: string) => {
    if (!userAddress) return { hasSeen: false, hasCompleted: false };
    
    return {
      hasSeen: hasSeenRegistration(userAddress),
      hasCompleted: hasCompletedRegistration(userAddress)
    };
  }, [hasSeenRegistration, hasCompletedRegistration]);

  return {
    hasSeenRegistration,
    markRegistrationSeen,
    hasCompletedRegistration,
    markRegistrationCompleted,
    resetRegistrationState,
    getRegistrationStatus
  };
}
