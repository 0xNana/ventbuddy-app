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
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    const envEnabled = import.meta.env.VITE_LOGGER_ENABLED;
    this.isEnabled = envEnabled ? envEnabled === 'true' : this.isDevelopment;
    
    this.logLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'debug';
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

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

  debug(message: string, data?: any, component?: string): void {
    this.log('debug', message, data, component);
  }

  info(message: string, data?: any, component?: string): void {
    this.log('info', message, data, component);
  }

  warn(message: string, data?: any, component?: string): void {
    this.log('warn', message, data, component);
  }

  error(message: string, data?: any, component?: string): void {
    this.log('error', message, data, component);
  }

  trace(functionName: string, component?: string): void {
    this.debug(`→ Entering ${functionName}`, undefined, component);
  }

  traceExit(functionName: string, result?: any, component?: string): void {
    this.debug(`← Exiting ${functionName}`, result, component);
  }

  api(method: string, url: string, data?: any, component?: string): void {
    this.info(`API ${method.toUpperCase()} ${url}`, data, component);
  }

  db(operation: string, table: string, data?: any, component?: string): void {
    this.debug(`DB ${operation.toUpperCase()} ${table}`, data, component);
  }

  contract(method: string, data?: any, component?: string): void {
    this.info(`Contract ${method}`, data, component);
  }

  user(action: string, data?: any, component?: string): void {
    this.info(`User ${action}`, data, component);
  }

  performance(operation: string, duration: number, component?: string): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, undefined, component);
  }

  security(event: string, data?: any, component?: string): void {
    this.warn(`Security: ${event}`, data, component);
  }
}

export const logger = new Logger();

export type { LogLevel };

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

export default logger;
