import type { TuiLocale } from "./types"

export function detectLocaleFromEnv(): TuiLocale {
  const raw = process.env.LC_ALL ?? process.env.LANG ?? process.env.LANGUAGE ?? ""
  const lang = raw.split(":")[0]?.toLowerCase() ?? ""
  if (lang.startsWith("pt")) return "pt-BR"
  return "en"
}
