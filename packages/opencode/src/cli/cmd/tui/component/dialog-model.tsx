import { createMemo, createSignal } from "solid-js"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { map, pipe, flatMap, entries, filter, sortBy, take } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider"
import { useKeybind } from "../context/keybind"
import * as fuzzysort from "fuzzysort"
import open from "open"

export function useConnected() {
  const sync = useSync()
  return createMemo(() =>
    sync.data.provider.some(
      (x) => !["opencode", "claudio"].includes(x.id) || Object.values(x.models).some((y) => y.cost?.input !== 0),
    ),
  )
}

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const keybind = useKeybind()
  const [query, setQuery] = createSignal("")
  const managed = createMemo(() => sync.data.managed)

  const connected = useConnected()
  const providers = createDialogProviderOptions()

  const showExtra = createMemo(() => connected() && !props.providerID)
  const quota = createMemo(() => {
    const info = managed()
    if (!info) return "Included"
    if (info.quota.unit === "prompts") return `${info.quota.remaining} left`
    return `${(info.quota.remaining / 100_000_000).toFixed(2)} included`
  })
  const reset = createMemo(() => {
    const raw = managed()?.quota.reset_at
    if (!raw) return undefined
    const date = new Date(raw)
    if (Number.isNaN(date.valueOf())) return undefined
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
  })
  const footer = createMemo(() => [quota(), reset() ? `resets ${reset()}` : undefined].filter(Boolean).join(" • "))
  const current = createMemo(() => {
    const item = local.model.current()
    if (!item) return undefined
    return {
      kind: "model" as const,
      providerID: item.providerID,
      modelID: item.modelID,
    }
  })

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()
    const upgrade =
      managed()?.upgrade_url && !props.providerID
        ? [
            {
              value: { kind: "upgrade" as const, url: managed()!.upgrade_url! },
              title: managed()!.entitlement === "senior" ? "Manage Claudio plan" : "Upgrade Claudio",
              description:
                managed()!.tier === "junior" || managed()!.entitlement === "anonymous" || managed()!.entitlement === "free"
                  ? "Unlock Claudio Pleno and Claudio Senior"
                  : managed()!.entitlement === "pleno"
                    ? "Unlock Claudio Senior"
                    : "Open Claudio billing",
              category: "Claudio",
              footer: "Open billing in browser",
              onSelect: () => {
                open(managed()!.upgrade_url!).catch(() => {})
                dialog.clear()
              },
            },
          ]
        : []

    function toOptions(items: typeof favorites, category: string) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const provider = sync.data.provider.find((x) => x.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        return [
          {
            key: item,
            value: { kind: "model" as const, providerID: provider.id, modelID: model.id },
            title: model.name ?? item.modelID,
            description: provider.name,
            category,
            disabled: provider.id === "opencode" && model.id.includes("-nano"),
            footer:
              provider.id === "claudio"
                ? footer()
                : model.cost?.input === 0 && provider.id === "opencode"
                  ? "Free"
                  : undefined,
            onSelect: () => {
              dialog.clear()
              local.model.set({ providerID: provider.id, modelID: model.id }, { recent: true })
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const providerOptions = pipe(
      sync.data.provider,
      sortBy(
        (provider) => !["claudio", "opencode"].includes(provider.id),
        (provider) => provider.name,
      ),
      flatMap((provider) =>
        pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)),
          map(([model, info]) => ({
            value: { kind: "model" as const, providerID: provider.id, modelID: model },
            title: info.name ?? model,
            description: favorites.some((item) => item.providerID === provider.id && item.modelID === model)
              ? "(Favorite)"
              : undefined,
            category: connected() ? provider.name : undefined,
            disabled: provider.id === "opencode" && model.includes("-nano"),
            footer:
              provider.id === "claudio"
                ? footer()
                : info.cost?.input === 0 && provider.id === "opencode"
                  ? "Free"
                  : undefined,
            onSelect() {
              dialog.clear()
              local.model.set({ providerID: provider.id, modelID: model }, { recent: true })
            },
          })),
          filter((x) => {
            if (!showSections) return true
            if (favorites.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            if (recents.some((item) => item.providerID === x.value.providerID && item.modelID === x.value.modelID))
              return false
            return true
          }),
          sortBy(
            (x) => x.footer !== "Free",
            (x) => x.title,
          ),
        ),
      ),
    )

    const popularProviders = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: "Popular providers",
          })),
          take(6),
        )
      : []

    if (needle) {
      return [
        ...fuzzysort.go(needle, upgrade, { keys: ["title", "description"] }).map((x) => x.obj),
        ...fuzzysort.go(needle, providerOptions, { keys: ["title", "category"] }).map((x) => x.obj),
        ...fuzzysort.go(needle, popularProviders, { keys: ["title"] }).map((x) => x.obj),
      ]
    }

    return [...upgrade, ...favoriteOptions, ...recentOptions, ...providerOptions, ...popularProviders]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((x) => x.id === props.providerID) : null,
  )

  const title = createMemo(() => provider()?.name ?? "Select model")

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      options={options()}
      keybind={[
        {
          keybind: keybind.all.model_provider_list?.[0],
          title: connected() ? "Connect provider" : "View all providers",
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          keybind: keybind.all.model_favorite_toggle?.[0],
          title: "Favorite",
          disabled: !connected(),
          onTrigger: (option) => {
            if (typeof option.value === "string") return
            if (option.value.kind !== "model") return
            local.model.toggleFavorite({ providerID: option.value.providerID, modelID: option.value.modelID })
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={current()}
    />
  )
}
