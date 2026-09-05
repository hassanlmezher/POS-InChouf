'use client';
import { useEffect, useState, useCallback } from 'react';
export async function api<T>(
  path: string,
  method: string = 'GET',
  data?: unknown,
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    ...(method !== 'GET' && data ? {body: JSON.stringify(data)} : {}),
  });
  const value = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(value.error || 'Request failed.');
  return value as T;
}
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load.');
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}
export async function uploadFile(path: string, file: File) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'X-File-Name': file.name },
    body: file,
  });
  const data = (await res.json()) as {
    id: string;
    name: string;
    type: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error);
  return data as { id: string; name: string; type: string };
}
export const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';
