import { logger } from './logger';

/**
 * Performance monitoring utilities using the centralized logger
 */

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  component?: string;
}

class PerformanceMonitor {
  private entries: Map<string, PerformanceEntry> = new Map();

  /**
   * Start timing an operation
   */
  start(name: string, component?: string): void {
    const entry: PerformanceEntry = {
      name,
      startTime: performance.now(),
      component
    };
    
    this.entries.set(name, entry);
    logger.debug(`Started timing: ${name}`, undefined, component);
  }

  /**
   * End timing an operation and log the result
   */
  end(name: string): number | null {
    const entry = this.entries.get(name);
    if (!entry) {
      logger.warn(`Performance entry not found: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    entry.endTime = endTime;
    entry.duration = duration;

    // Log the performance result
    logger.performance(entry.name, duration, entry.component);

    // Clean up
    this.entries.delete(name);

    return duration;
  }

  /**
   * Measure a function's execution time
   */
  async measure<T>(
    name: string, 
    fn: () => Promise<T>, 
    component?: string
  ): Promise<T> {
    this.start(name, component);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Measure a synchronous function's execution time
   */
  measureSync<T>(
    name: string, 
    fn: () => T, 
    component?: string
  ): T {
    this.start(name, component);
    try {
      const result = fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Get all active timers
   */
  getActiveTimers(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Clear all timers
   */
  clear(): void {
    this.entries.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const measureAsync = performanceMonitor.measure.bind(performanceMonitor);
export const measureSync = performanceMonitor.measureSync.bind(performanceMonitor);
export const startTimer = performanceMonitor.start.bind(performanceMonitor);
export const endTimer = performanceMonitor.end.bind(performanceMonitor);

// React hook for performance monitoring
export function usePerformance(componentName: string) {
  return {
    start: (name: string) => startTimer(name, componentName),
    end: endTimer,
    measure: <T>(name: string, fn: () => Promise<T>) => 
      measureAsync(name, fn, componentName),
    measureSync: <T>(name: string, fn: () => T) => 
      measureSync(name, fn, componentName)
  };
}

export default performanceMonitor;
