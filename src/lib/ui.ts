import type { Source } from "./types";

export const SOURCE_BG: Record<Source, string> = {
  airbnb: "bg-airbnb",
  booking: "bg-booking",
  manual: "bg-manual",
  outro: "bg-outro",
};

export const SOURCE_TEXT: Record<Source, string> = {
  airbnb: "text-airbnb",
  booking: "text-booking",
  manual: "text-manual",
  outro: "text-outro",
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export type ActionState = { error?: string; ok?: string } | undefined;

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
