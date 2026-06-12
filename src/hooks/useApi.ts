import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UseApiOptions {
  enabled?: boolean;
}

/**
 * Custom hook for fetching data using React Query
 */
export const useApi = <T,>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: UseApiOptions
) => {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  });
};

/**
 * Custom hook for mutations (create, update, delete)
 */
export const useApiMutation = <T, V>(
  mutationFn: (data: T) => Promise<V>,
  queryKeyToInvalidate?: string[]
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (queryKeyToInvalidate) {
        queryKeyToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
  });
};
