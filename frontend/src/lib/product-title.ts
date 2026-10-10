export function displayLineTitle(title: string, variantTitle?: string | null) {
  const name = (title || "").trim() || "Item";
  const variant = (variantTitle || "").trim();
  if (!variant || variant.toLowerCase() === "default") return name;
  if (name.toLowerCase().includes(variant.toLowerCase())) return name;
  return `${name} · ${variant}`;
}

export function cartLineTitle(line: { title: string; detail?: string | null }) {
  return displayLineTitle(line.title, line.detail);
}
