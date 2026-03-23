import { Component, createMemo } from "solid-js"
import { Dialog } from "@claudio-code/ui/dialog"
import { Select } from "@claudio-code/ui/select"
import { useLanguage } from "@/context/language"

export const DialogLanguage: Component = () => {
  const language = useLanguage()

  const options = createMemo(() =>
    language.locales.map((locale) => ({
      value: locale,
      label: language.label(locale),
    })),
  )

  return (
    <Dialog
      title={language.t("dialog.language.title")}
      description={language.t("dialog.language.description")}
      transition
    >
      <div class="px-1 pb-2">
        <Select
          data-action="dialog-language"
          options={options()}
          current={options().find((o) => o.value === language.locale())}
          value={(o) => o.value}
          label={(o) => o.label}
          onSelect={(option) => option && language.setLocale(option.value)}
          variant="secondary"
          size="small"
          triggerVariant="settings"
        />
      </div>
    </Dialog>
  )
}
