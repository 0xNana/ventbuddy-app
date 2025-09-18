import { useCallback } from 'react';
import { logger, LogLevel } from '../lib/logger';

/**
 * React hook for using the centralized logger in components
 * 
 * Usage:
 * const log = useLogger('ComponentName');
 * log.info('User clicked button', { buttonId: 'submit' });
 */
export function useLogger(componentName: string) {
  const log = useCallback(
    (level: LogLevel, message: string, data?: any) => {
      logger[level](message, data, componentName);
    },
    [componentName]
  );

  return {
    debug: useCallback((message: string, data?: any) => log('debug', message, data), [log]),
    info: useCallback((message: string, data?: any) => log('info', message, data), [log]),
    warn: useCallback((message: string, data?: any) => log('warn', message, data), [log]),
    error: useCallback((message: string, data?: any) => log('error', message, data), [log]),
    
    // Convenience methods
    api: useCallback((method: string, url: string, data?: any) => {
      logger.api(method, url, data, componentName);
    }, [componentName]),
    
    db: useCallback((operation: string, table: string, data?: any) => {
      logger.db(operation, table, data, componentName);
    }, [componentName]),
    
    contract: useCallback((method: string, data?: any) => {
      logger.contract(method, data, componentName);
    }, [componentName]),
    
    user: useCallback((action: string, data?: any) => {
      logger.user(action, data, componentName);
    }, [componentName]),
    
    performance: useCallback((operation: string, duration: number) => {
      logger.performance(operation, duration, componentName);
    }, [componentName]),
    
    security: useCallback((event: string, data?: any) => {
      logger.security(event, data, componentName);
    }, [componentName]),
    
    trace: useCallback((functionName: string) => {
      logger.trace(functionName, componentName);
    }, [componentName]),
    
    traceExit: useCallback((functionName: string, result?: any) => {
      logger.traceExit(functionName, result, componentName);
    }, [componentName])
  };
}

export default useLogger;
