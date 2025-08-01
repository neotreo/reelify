import React from 'react';

// Memory monitoring utility for debugging
// Add this to your component for testing memory improvements

export const useMemoryMonitor = (componentName: string) => {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    const logMemory = () => {
      if ('memory' in window.performance) {
        const memory = (window.performance as any).memory;
        console.log(`[${componentName}] Memory Usage:`, {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        });
      }
    };

    // Log initial memory
    logMemory();

    // Log memory every 10 seconds
    const interval = setInterval(logMemory, 10000);

    return () => {
      clearInterval(interval);
      console.log(`[${componentName}] Component unmounted - memory monitoring stopped`);
    };
  }, [componentName]);
};

// Usage in your component:
// useMemoryMonitor('ShortCreator');
