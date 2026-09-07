'use client';
import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';

type ActivityListener = () => void;
const activityListeners = new Set<ActivityListener>();
let apiRequests = 0;
let pageNavigation = false;

function notifyActivity() {
  activityListeners.forEach((listener) => listener());
}
function startApiRequest() {
  apiRequests += 1;
  notifyActivity();
}
function finishApiRequest() {
  apiRequests = Math.max(0, apiRequests - 1);
  notifyActivity();
}
export function startPageNavigation() {
  pageNavigation = true;
  notifyActivity();
}
export function endPageNavigation() {
  pageNavigation = false;
  notifyActivity();
}
export function useNetworkActivity() {
  return useSyncExternalStore(
    (listener) => {
      activityListeners.add(listener);
      return () => activityListeners.delete(listener);
    },
    () => apiRequests > 0 || pageNavigation,
    () => false,
  );
}
export async function api<T>(
  path: string,
  method: string = 'GET',
  data?: unknown,
  options: { silent?: boolean } = {},
): Promise<T> {
  const multipart =
    typeof FormData !== 'undefined' && data instanceof FormData;
  if (!options.silent) startApiRequest();
  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers:
        data && !multipart ? { 'Content-Type': 'application/json' } : undefined,
      ...(method !== 'GET' && data
        ? { body: multipart ? data : JSON.stringify(data) }
        : {}),
    });
    const value = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(value.error || 'Request failed.');
    return value as T;
  } finally {
    if (!options.silent) finishApiRequest();
  }
}
export function useResource<T>(
  path: string | null,
  options: { intervalMs?: number } = {},
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async (silent = false) => {
    if (!path) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setData(await api<T>(path, 'GET', undefined, { silent }));
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
  useEffect(() => {
    if (!path || !options.intervalMs) return;
    const timer = window.setInterval(() => void refresh(true), options.intervalMs);
    return () => window.clearInterval(timer);
  }, [path, options.intervalMs, refresh]);
  return { data, error, loading, refresh, setData };
}
export async function uploadFile(path: string, file: File) {
  startApiRequest();
  try {
    const res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-File-Name': encodeURIComponent(file.name),
      },
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
  } finally {
    finishApiRequest();
  }
}
export const message = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';
