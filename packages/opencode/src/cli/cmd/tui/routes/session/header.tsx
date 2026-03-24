import { type Accessor, createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { pipe, sumBy } from "remeda"
import { useTheme } from "@tui/context/theme"
import { SplitBorder } from "@tui/component/border"
import type { AssistantMessage, Session } from "@claudio-code/sdk/v2"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "../../context/keybind"
import { Flag } from "@/flag/flag"
import { useTerminalDimensions } from "@opentui/solid"
import { Link } from "@tui/ui/link"

const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme()
  return (
    <text fg={theme.text}>
      <span style={{ bold: true }}>#</span> <span style={{ bold: true }}>{props.session().title}</span>
    </text>
  )
}

const ContextInfo = (props: { context: Accessor<string | undefined>; cost: Accessor<string> }) => {
  const { theme } = useTheme()
  return (
    <Show when={props.context()}>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        {props.context()} ({props.cost()})
      </text>
    </Show>
  )
}

const ManagedInfo = (props: {
  plan: Accessor<string | undefined>
  quota: Accessor<string | undefined>
  reset: Accessor<string | undefined>
  cta: Accessor<string | undefined>
  url: Accessor<string | undefined>
}) => {
  const { theme } = useTheme()
  return (
    <Show when={props.plan()}>
      <box flexDirection="row" gap={1} flexShrink={0}>
        <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
          {props.plan()}
          <Show when={props.quota()}>
            <span> • {props.quota()}</span>
          </Show>
          <Show when={props.reset()}>
            <span> • {props.reset()}</span>
          </Show>
        </text>
        <Show when={props.url() && props.cta()}>
          <Link href={props.url()!} fg={theme.primary}>
            {props.cta()!}
          </Link>
        </Show>
      </box>
    </Show>
  )
}

const WorkspaceInfo = (props: { workspace: Accessor<string | undefined> }) => {
  const { theme } = useTheme()
  return (
    <Show when={props.workspace()}>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        {props.workspace()}
      </text>
    </Show>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

  const cost = createMemo(() => {
    const total = pipe(
      messages(),
      sumBy((x) => (x.role === "assistant" ? x.cost : 0)),
    )
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const currentProvider = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" || x.role === "user")
    if (!last) return undefined
    if (last.role === "assistant") return last.providerID
    return last.model.providerID
  })

  const managed = createMemo(() => (currentProvider() === "claudio" ? sync.data.managed : null))
  const plan = createMemo(() => managed()?.model?.label ?? (managed() ? `Claudio ${managed()!.tier}` : undefined))
  const quota = createMemo(() => {
    const info = managed()
    if (!info) return undefined
    if (info.quota.unit === "prompts") return `${info.quota.remaining} left`
    return `${(info.quota.remaining / 100_000_000).toFixed(2)} included`
  })
  const reset = createMemo(() => {
    const raw = managed()?.quota.reset_at
    if (!raw) return undefined
    const date = new Date(raw)
    if (Number.isNaN(date.valueOf())) return undefined
    return `resets ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}`
  })
  const cta = createMemo(() => {
    const info = managed()
    if (!info?.upgrade_url) return undefined
    return info.entitlement === "senior" ? "Manage" : "Upgrade"
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const workspace = createMemo(() => {
    const id = session()?.workspaceID
    if (!id) return "Workspace local"
    const info = sync.workspace.get(id)
    if (!info) return `Workspace ${id}`
    return `Workspace ${id} (${info.type})`
  })

  const { theme } = useTheme()
  const keybind = useKeybind()
  const command = useCommandDialog()
  const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
  const dimensions = useTerminalDimensions()
  const narrow = createMemo(() => dimensions().width < 80)

  return (
    <box flexShrink={0}>
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
        backgroundColor={theme.backgroundPanel}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="column" gap={1}>
              <box flexDirection={narrow() ? "column" : "row"} justifyContent="space-between" gap={narrow() ? 1 : 0}>
                {Flag.CLAUDIO_EXPERIMENTAL_WORKSPACES ? (
                  <box flexDirection="column">
                    <text fg={theme.text}>
                      <b>Subagent session</b>
                    </text>
                    <WorkspaceInfo workspace={workspace} />
                  </box>
                ) : (
                  <text fg={theme.text}>
                    <b>Subagent session</b>
                  </text>
                )}

                <Show when={managed()} fallback={<ContextInfo context={context} cost={cost} />}>
                  <ManagedInfo plan={plan} quota={quota} reset={reset} cta={cta} url={() => managed()?.upgrade_url} />
                </Show>
              </box>
              <box flexDirection="row" gap={2}>
                <box
                  onMouseOver={() => setHover("parent")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.parent")}
                  backgroundColor={hover() === "parent" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    Parent <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("prev")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.previous")}
                  backgroundColor={hover() === "prev" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    Prev <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
                  </text>
                </box>
                <box
                  onMouseOver={() => setHover("next")}
                  onMouseOut={() => setHover(null)}
                  onMouseUp={() => command.trigger("session.child.next")}
                  backgroundColor={hover() === "next" ? theme.backgroundElement : theme.backgroundPanel}
                >
                  <text fg={theme.text}>
                    Next <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
                  </text>
                </box>
              </box>
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection={narrow() ? "column" : "row"} justifyContent="space-between" gap={1}>
              {Flag.CLAUDIO_EXPERIMENTAL_WORKSPACES ? (
                <box flexDirection="column">
                  <Title session={session} />
                  <WorkspaceInfo workspace={workspace} />
                </box>
              ) : (
                <Title session={session} />
              )}
              <Show when={managed()} fallback={<ContextInfo context={context} cost={cost} />}>
                <ManagedInfo plan={plan} quota={quota} reset={reset} cta={cta} url={() => managed()?.upgrade_url} />
              </Show>
            </box>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
