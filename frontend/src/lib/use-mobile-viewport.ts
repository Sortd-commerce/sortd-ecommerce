"use client";

import { useEffect, useState } from "react";

export function useMobileViewport(maxWidth = 799) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [maxWidth]);

  return mobile;
}
