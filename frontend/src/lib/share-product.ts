export type ShareProductInput = {
  title: string;
  url: string;
};

export async function shareProduct({ title, url }: ShareProductInput): Promise<"shared" | "copied" | "failed"> {
  const text = `Check out ${title} on Sortd`;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "failed";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
