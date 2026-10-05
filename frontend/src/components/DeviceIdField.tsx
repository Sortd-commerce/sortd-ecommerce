"use client";

import { useEffect, useState } from "react";

const KEY = "sortd_device_id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 8) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(KEY, created);
  return created;
}

export function DeviceIdField() {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);
  return <input type="hidden" name="device_id" value={deviceId} />;
}
