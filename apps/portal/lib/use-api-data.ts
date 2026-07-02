"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiDataOptions<T> {
  fetcher: (apiKey: string) => Promise<T>;
  mockData: T;
  apiKey: string;
}

interface UseApiDataResult<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiData<T>({
  fetcher,
  mockData,
  apiKey,
}: UseApiDataOptions<T>): UseApiDataResult<T> {
  const [data, setData] = useState<T>(mockData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const doFetch = useCallback(async () => {
    if (!apiKey) { setData(mockData); return; }

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher(apiKey);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, mockData, apiKey]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      doFetch();
    }
  }, [doFetch]);

  return { data, isLoading, error, refetch: doFetch };
}
