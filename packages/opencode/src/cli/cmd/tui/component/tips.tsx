import { createMemo, For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { englishTips } from "@tui/i18n/tips-en"
import { portugueseTips } from "@tui/i18n/tips-pt-br"
import { useTuiI18n } from "@tui/i18n/context"

type TipPart = { text: string; highlight: boolean }

function parse(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g
  const found = Array.from(tip.matchAll(regex))
  const state = found.reduce(
    (acc, match) => {
      const start = match.index ?? 0
      if (start > acc.index) {
        acc.parts.push({ text: tip.slice(acc.index, start), highlight: false })
      }
      acc.parts.push({ text: match[1], highlight: true })
      acc.index = start + match[0].length
      return acc
    },
    { parts, index: 0 },
  )

  if (state.index < tip.length) {
    parts.push({ text: tip.slice(state.index), highlight: false })
  }

  return parts
}

export function Tips() {
  const theme = useTheme().theme
  const i18n = useTuiI18n()
  const tip = createMemo(() => {
    i18n.locale()
    const list = i18n.locale() === "pt-BR" ? portugueseTips() : englishTips()
    return list[Math.floor(Math.random() * list.length)]
  })
  const parts = createMemo(() => parse(tip()))

  return (
    <box flexDirection="row" maxWidth="100%">
      <text flexShrink={0} style={{ fg: theme.warning }}>
        ● {i18n.t("tui.tips.badge")}{" "}
      </text>
      <text flexShrink={1}>
        <For each={parts()}>
          {(part) => <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>}
        </For>
      </text>
    </box>
  )
}
