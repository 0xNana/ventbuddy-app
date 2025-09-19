import { useCallback } from 'react';


export function useRegistration() {
  

  const hasSeenRegistration = useCallback((userAddress: string): boolean => {
    if (!userAddress) return false;
    return localStorage.getItem(`registration_seen_${userAddress}`) === 'true';
  }, []);


  const markRegistrationSeen = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.setItem(`registration_seen_${userAddress}`, 'true');
  }, []);


  const hasCompletedRegistration = useCallback((userAddress: string): boolean => {
    if (!userAddress) return false;
    return localStorage.getItem(`registration_completed_${userAddress}`) === 'true';
  }, []);


  const markRegistrationCompleted = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.setItem(`registration_completed_${userAddress}`, 'true');

    localStorage.setItem(`registration_seen_${userAddress}`, 'true');
  }, []);


  const resetRegistrationState = useCallback((userAddress: string): void => {
    if (!userAddress) return;
    localStorage.removeItem(`registration_seen_${userAddress}`);
    localStorage.removeItem(`registration_completed_${userAddress}`);
  }, []);


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
