import { Button } from "@claudio-code/ui/button"
import { Splash } from "@claudio-code/ui/logo"
import { useLanguage } from "@/context/language"
import type { Locale } from "@/context/language"

export function DialogLanguageOnboarding() {
  const language = useLanguage()

  function pick(locale: Locale) {
    language.setLocale(locale)
    language.complete()
  }

  return (
    <div class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background-base p-6">
      <Splash class="w-16 h-20 opacity-50" />
      <div class="flex flex-col items-center gap-2 text-center max-w-md">
        <h1 class="text-18-medium text-text-strong">Welcome</h1>
        <p class="text-14-regular text-text-base">Choose your language / Escolha seu idioma</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button type="button" class="flex-1" variant="primary" onClick={() => pick("en")}>
          English
        </Button>
        <Button type="button" class="flex-1" variant="secondary" onClick={() => pick("br")}>
          Português (Brasil)
        </Button>
      </div>
    </div>
  )
}
