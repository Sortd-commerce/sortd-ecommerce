"use client";

import { useEffect, useState } from "react";

const KEY = "sortd_device_id";

export function DeviceIdField() {
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length >= 8) {
      setDeviceId(existing);
      return;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(KEY, created);
    setDeviceId(created);
  }, []);
  return <input type="hidden" name="device_id" value={deviceId} />;
}
