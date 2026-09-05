"use client";

import { useEffect, useState } from "react";

const HEALTH_URL = "/api/health";
const HEALTH_INTERVAL_MS = 30_000;

async function pingApi(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(HEALTH_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!response.ok) {
      return false;
    }
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
    } | null;
    return Boolean(payload?.success);
  } catch {
    return false;
  }
}

/**
 * True when the browser reports online AND the API health endpoint responds.
 * Stays false until the first successful health check.
 */
export function useOnlineStatus() {
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [apiReachable, setApiReachable] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);

  useEffect(() => {
    function onOnline() {
      setNetworkOnline(true);
    }
    function onOffline() {
      setNetworkOnline(false);
      setApiReachable(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setNetworkOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!networkOnline) {
      setApiReachable(false);
      setHealthChecked(true);
      return;
    }

    let cancelled = false;
    async function check() {
      const ok = await pingApi();
      if (!cancelled) {
        setApiReachable(ok);
        setHealthChecked(true);
      }
    }
    void check();
    const handle = window.setInterval(() => void check(), HEALTH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [networkOnline]);

  if (!healthChecked) {
    return false;
  }
  return networkOnline && apiReachable;
}
