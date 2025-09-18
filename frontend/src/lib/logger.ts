/**
 * Centralized Logger for Ventbuddy App
 * 
 * Features:
 * - Development-only logging (disabled in production)
 * - Multiple log levels (debug, info, warn, error)
 * - Consistent formatting with emojis and timestamps
 * - Easy to disable/enable globally
 * - Performance-friendly (no-op in production)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  component?: string;
}

class Logger {
  private isDevelopment: boolean;
  private isEnabled: boolean;
  private logLevel: LogLevel;

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    // Enable logging based on environment variables or development mode
    const envEnabled = import.meta.env.VITE_LOGGER_ENABLED;
    this.isEnabled = envEnabled ? envEnabled === 'true' : this.isDevelopment;
    
    // Set log level (can be overridden by environment variable)
    this.logLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'debug';
  }

  /**
   * Enable or disable logging programmatically
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled) return false;

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Format log entry with consistent styling
   */
  private formatLog(entry: LogEntry): string {
    const { level, message, data, timestamp, component } = entry;
    
    const emojis: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    };

    const colors: Record<LogLevel, string> = {
      debug: '#6B7280', // gray
      info: '#3B82F6',  // blue
      warn: '#F59E0B',  // yellow
      error: '#EF4444'  // red
    };

    const emoji = emojis[level];
    const color = colors[level];
    const componentStr = component ? `[${component}] ` : '';
    
    return `${emoji} ${componentStr}${message}`;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, component?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      component
    };

    const formattedMessage = this.formatLog(entry);

    // Use appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '');
        break;
    }
  }

  /**
   * Debug level logging - detailed information for debugging
   */
  debug(message: string, data?: any, component?: string): void {
    this.log('debug', message, data, component);
  }

  /**
   * Info level logging - general information
   */
  info(message: string, data?: any, component?: string): void {
    this.log('info', message, data, component);
  }

  /**
   * Warning level logging - something unexpected happened
   */
  warn(message: string, data?: any, component?: string): void {
    this.log('warn', message, data, component);
  }

  /**
   * Error level logging - something went wrong
   */
  error(message: string, data?: any, component?: string): void {
    this.log('error', message, data, component);
  }

  /**
   * Log function entry/exit for debugging
   */
  trace(functionName: string, component?: string): void {
    this.debug(`→ Entering ${functionName}`, undefined, component);
  }

  /**
   * Log function exit
   */
  traceExit(functionName: string, result?: any, component?: string): void {
    this.debug(`← Exiting ${functionName}`, result, component);
  }

  /**
   * Log API calls
   */
  api(method: string, url: string, data?: any, component?: string): void {
    this.info(`API ${method.toUpperCase()} ${url}`, data, component);
  }

  /**
   * Log database operations
   */
  db(operation: string, table: string, data?: any, component?: string): void {
    this.debug(`DB ${operation.toUpperCase()} ${table}`, data, component);
  }

  /**
   * Log smart contract interactions
   */
  contract(method: string, data?: any, component?: string): void {
    this.info(`Contract ${method}`, data, component);
  }

  /**
   * Log user actions
   */
  user(action: string, data?: any, component?: string): void {
    this.info(`User ${action}`, data, component);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, component?: string): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, undefined, component);
  }

  /**
   * Log security events
   */
  security(event: string, data?: any, component?: string): void {
    this.warn(`Security: ${event}`, data, component);
  }
}

// Create singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogLevel };

// Export convenience methods for direct use
export const {
  debug,
  info,
  warn,
  error,
  trace,
  traceExit,
  api,
  db,
  contract,
  user,
  performance,
  security
} = logger;

// Export the logger instance as default
export default logger;
