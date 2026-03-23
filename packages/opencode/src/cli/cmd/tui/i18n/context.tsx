import { createSimpleContext } from "@tui/context/helper"
import { useKV } from "@tui/context/kv"
import { createEffect, createMemo, createSignal } from "solid-js"
import { detectLocaleFromEnv } from "./detect"
import { dictEn } from "./dict-en"
import { dictPtBr } from "./dict-pt-br"
import type { TuiLocale } from "./types"

export const { use: useTuiI18n, provider: TuiI18nProvider } = createSimpleContext({
  name: "TuiI18n",
  init: () => {
    const kv = useKV()
    const [locale, setLocale] = createSignal<TuiLocale>("en")

    createEffect(() => {
      if (!kv.ready) return
      const nested = (kv.store as { tui?: { locale?: TuiLocale } }).tui?.locale
      if ((nested === "en" || nested === "pt-BR") && kv.get("tui_locale") === undefined) {
        kv.set("tui_locale", nested)
      }
      const override = process.env.CLAUDIO_TUI_LOCALE
      if (override === "en" || override === "pt-BR") {
        if (kv.get("tui_locale") !== override) kv.set("tui_locale", override)
        setLocale(override)
        return
      }
      const cur = kv.get("tui_locale") as TuiLocale | undefined
      if (cur === "en" || cur === "pt-BR") {
        setLocale(cur)
        return
      }
      if (Object.keys(kv.store).length > 0) {
        const d = detectLocaleFromEnv()
        kv.set("tui_locale", d)
        setLocale(d)
      }
    })

    const dict = createMemo(() => (locale() === "pt-BR" ? dictPtBr : dictEn))

    function t(key: string) {
      return dict()[key] ?? dictEn[key] ?? key
    }

    const needsOnboarding = createMemo(() => {
      if (!kv.ready) return false
      if (kv.get("tui_locale") !== undefined) return false
      return Object.keys(kv.store).length === 0
    })

    function applyLocale(next: TuiLocale) {
      kv.set("tui_locale", next)
      setLocale(next)
    }

    return { t, locale, applyLocale, needsOnboarding }
  },
})
