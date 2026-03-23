import { createEffect } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useTuiI18n } from "./context"
import type { TuiLocale } from "./types"

export function TuiLanguageOnboarding() {
  const dialog = useDialog()
  const i18n = useTuiI18n()
  let shown = false

  createEffect(() => {
    if (!i18n.needsOnboarding() || shown) return
    if (dialog.stack.length > 0) return
    shown = true
    dialog.replace(() => (
      <DialogSelect<TuiLocale>
        title={i18n.t("tui.onboarding.title")}
        skipFilter
        current={i18n.locale()}
        options={[
          {
            title: i18n.t("tui.onboarding.en"),
            value: "en",
            onSelect: (d) => {
              i18n.applyLocale("en")
              d.clear()
            },
          },
          {
            title: i18n.t("tui.onboarding.pt"),
            value: "pt-BR",
            onSelect: (d) => {
              i18n.applyLocale("pt-BR")
              d.clear()
            },
          },
        ]}
      />
    ))
  })

  return null
}
