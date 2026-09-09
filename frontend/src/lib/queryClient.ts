import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 3 * 60 * 1000, // 3 minutes default freshness to prevent redundant requests
      gcTime: 15 * 60 * 1000,   // 15 minutes cache garbage collection
    },
  },
});

