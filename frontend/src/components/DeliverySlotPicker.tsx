"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react";
import type { CheckoutSlot } from "@/components/CheckoutForm";

function slotKey(slot: CheckoutSlot) {
  return `${slot.date}|${slot.window_id}|${slot.source}`;
}

function formatClock(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  if (minute) return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  return `${hour12} ${suffix}`;
}

function formatRange(start: string, end: string) {
  return `${formatClock(start)}–${formatClock(end)}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayOffsetFromToday(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = startOfLocalDay(new Date());
  const slotDay = startOfLocalDay(parsed);
  return Math.round((slotDay.getTime() - today.getTime()) / 86_400_000);
}

function formatDayLabel(value: string): { title: string; detail: string } {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return { title: value, detail: "" };
  const offset = dayOffsetFromToday(value);
  const weekday = parsed.toLocaleDateString("en-GB", { weekday: "long" });
  const short = parsed.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (offset === 0) return { title: "Today", detail: short };
  if (offset === 1) return { title: "Tomorrow", detail: short };
  return { title: weekday, detail: parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
}

function slotLabel(slot: CheckoutSlot) {
  const start = slot.start_time.slice(0, 5);
  const end = slot.end_time.slice(0, 5);
  const [sh, sm] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  if (sm === 0 && end.endsWith(":00:00")) {
    return `${sh % 12 || 12}–${eh % 12 || 12} ${eh >= 12 ? "PM" : "AM"}`;
  }
  return formatRange(slot.start_time, slot.end_time);
}

function confirmationCopy(slot: CheckoutSlot) {
  const parsed = new Date(`${slot.date}T12:00:00`);
  const offset = dayOffsetFromToday(slot.date);
  const day =
    offset === 0 ? "today" : offset === 1 ? "tomorrow" : parsed.toLocaleDateString("en-GB", { weekday: "long" });
  const start = slot.start_time.slice(0, 5);
  const end = slot.end_time.slice(0, 5);
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  const range = `${sh % 12 || 12} and ${eh % 12 || 12} ${eh >= 12 ? "PM" : "AM"}`;
  return `Arriving ${day} between ${range}. We'll message you when the rider is 10 minutes away.`;
}

function dayHasAvailability(daySlots: CheckoutSlot[]) {
  return daySlots.some((slot) => slot.status === "available");
}

export function DeliverySlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: CheckoutSlot[];
  value: string;
  onChange: (key: string) => void;
}) {
  const days = useMemo(() => {
    const seen = new Map<string, CheckoutSlot[]>();
    for (const slot of slots) {
      const bucket = seen.get(slot.date) || [];
      bucket.push(slot);
      seen.set(slot.date, bucket);
    }
    return [...seen.entries()]
      .map(([date, daySlots]) => ({ date, slots: daySlots }))
      .filter(({ slots: daySlots }) => dayHasAvailability(daySlots));
  }, [slots]);

  const [dayIndex, setDayIndex] = useState(0);

  useEffect(() => {
    setDayIndex(0);
  }, [days]);

  const activeDay = days[dayIndex] || days[0];
  const activeSlots = useMemo(
    () => (activeDay?.slots || []).filter((slot) => slot.status === "available"),
    [activeDay],
  );

  const bookable = useMemo(() => slots.filter((row) => row.status === "available"), [slots]);
  const selected =
    bookable.find((row) => slotKey(row) === value) ||
    bookable.find((row) => row.date === activeDay?.date) ||
    bookable[0];

  if (!bookable.length) {
    return <p className="fine-print">No delivery windows are open right now.</p>;
  }

  return (
    <div className="slot-picker">
      <div className="slot-days" role="tablist" aria-label="Delivery day">
        {days.map(({ date }, index) => {
          const label = formatDayLabel(date);
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={index === dayIndex}
              className={`slot-day ${index === dayIndex ? "slot-day-on" : ""}`}
              onClick={() => setDayIndex(index)}
            >
              <strong>{label.title}</strong>
              <small>{label.detail}</small>
            </button>
          );
        })}
      </div>

      <div className="slot-grid" role="radiogroup" aria-label="Delivery time">
        {activeSlots.map((slot) => {
          const key = slotKey(slot);
          const checked = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={checked}
              className={`slot-card slot-card--available ${checked ? "slot-card-on" : ""}`}
              onClick={() => onChange(key)}
            >
              <span className="slot-card-time">{slotLabel(slot)}</span>
              {slot.remaining <= 3 ? <span className="slot-card-urgency">{slot.remaining} left</span> : null}
              <span className="slot-card-meta">{checked ? "Your slot" : "Available"}</span>
              {checked ? (
                <span className="slot-card-check" aria-hidden>
                  <Check size={14} weight="bold" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? <p className="slot-confirm">{confirmationCopy(selected)}</p> : null}
    </div>
  );
}
