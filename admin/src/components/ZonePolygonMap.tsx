"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";

export type LatLngTuple = [number, number];

export function normalizePolygon(polygon: number[][]): LatLngTuple[] {
  return polygon
    .filter((point): point is LatLngTuple => point.length >= 2)
    .map(([a, b]) => [a, b]);
}

type ZonePolygonMapProps = {
  initialPolygon?: LatLngTuple[];
  onChange: (polygon: LatLngTuple[]) => void;
};

const DUBAI_CENTER: LatLngTuple = [25.2048, 55.2708];

function toLngLat(points: LatLngTuple[]): LatLngTuple[] {
  return points.map(([lat, lng]) => [lng, lat]);
}

function toLatLng(points: LatLngTuple[]): LatLngTuple[] {
  return points.map(([lng, lat]) => [lat, lng]);
}

export function ZonePolygonMap({ initialPolygon = [], onChange }: ZonePolygonMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const seededPoints = useMemo(() => toLatLng(initialPolygon), [initialPolygon]);
  const [points, setPoints] = useState<LatLngTuple[]>(() => seededPoints);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChange(toLngLat(points));
  }, [onChange, points]);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      const L = await import("leaflet");

      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: seededPoints[0] || DUBAI_CENTER,
        zoom: seededPoints.length ? 13 : 11,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      map.on("click", (event) => {
        setPoints((current) => [...current, [event.latlng.lat, event.latlng.lng]]);
      });

      mapRef.current = map;
      layerRef.current = layer;
      setReady(true);
    }

    void mountMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [seededPoints]);

  useEffect(() => {
    if (!ready || !layerRef.current) return;

    void import("leaflet").then((L) => {
      const layer = layerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!points.length) return;

      for (const point of points) {
        L.circleMarker(point, { radius: 5, color: "#2563eb", fillOpacity: 0.9 }).addTo(layer);
      }
      if (points.length >= 2) {
        L.polyline(points, { color: "#2563eb", weight: 2 }).addTo(layer);
      }
      if (points.length >= 3) {
        L.polygon(points, { color: "#2563eb", weight: 2, fillOpacity: 0.15 }).addTo(layer);
      }
    });
  }, [points, ready]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl border border-line" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-sm" onClick={() => setPoints((current) => current.slice(0, -1))} disabled={!points.length}>
          Undo point
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={() => setPoints([])} disabled={!points.length}>
          Clear
        </button>
        <span className="text-sm text-muted">{points.length} point{points.length === 1 ? "" : "s"} · click the map to add boundary points</span>
      </div>
    </div>
  );
}
