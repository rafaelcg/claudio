import type { ModelsDev } from "./models"
import { Flag } from "@/flag/flag"

export namespace ClaudioProvider {
  export const providerID = "claudio"
  export const live = "https://opencode-production-consoleworkerscript-otkrdoex.rafaelcg-a0a.workers.dev"

  export type Tier = "junior" | "pleno" | "senior"

  function unique(input: (string | undefined)[]) {
    return [...new Set(input.filter((item): item is string => !!item))]
  }

  export function roots() {
    return unique([
      Flag.CLAUDIO_MANAGED_API_URL,
      live,
      ...[3000, 3001, 3002, 3003, 3004, 3005, 5173, 5174, 5175].flatMap((port) => [
        `http://127.0.0.1:${port}`,
        `http://localhost:${port}`,
      ]),
    ])
  }

  export function root() {
    return roots()[0]!
  }

  export function bootstrap() {
    return Flag.CLAUDIO_MANAGED_BOOTSTRAP_URL ?? `${root()}/api/claudio/bootstrap`
  }

  export function bootstraps() {
    return unique([Flag.CLAUDIO_MANAGED_BOOTSTRAP_URL, ...roots().map((item) => `${item}/api/claudio/bootstrap`)])
  }

  export async function request(
    path: string,
    init?: RequestInit,
    input?: { roots?: string[] },
  ) {
    let err: unknown
    const tried: string[] = []
    for (const root of unique([...(input?.roots ?? []), ...roots()])) {
      const url = new URL(path, root).toString()
      tried.push(url)
      try {
        return await fetch(url, init)
      } catch (cause) {
        err = cause
      }
    }
    throw new Error(
      `Claudio managed endpoint is unavailable. Set CLAUDIO_MANAGED_API_URL or run a local Claudio console. Tried: ${tried.join(", ")}.${err instanceof Error ? ` ${err.message}` : ""}`,
    )
  }

  function model(id: Tier, name: string, cost = 0): ModelsDev.Model {
    return {
      id,
      name,
      family: "claudio",
      release_date: "2026-03-23",
      attachment: false,
      reasoning: id === "senior",
      temperature: true,
      tool_call: true,
      interleaved: id === "senior" ? { field: "reasoning_content" } : undefined,
      cost: {
        input: cost,
        output: cost,
      },
      limit: {
        context: id === "senior" ? 256_000 : 128_000,
        output: id === "senior" ? 32_000 : 16_000,
      },
      modalities: {
        input: ["text"],
        output: ["text"],
      },
      options: {
        managed: true,
        tier: id,
      },
      headers: {
        "x-claudio-managed": "1",
      },
      provider: {
        npm: "@ai-sdk/openai-compatible",
        api: `${root()}/claudio/v1`,
      },
      variants:
        id === "senior"
          ? {
              deep: {
                name: "Deep think",
                thinking: "deep",
              },
            }
          : undefined,
    }
  }

  export function provider(): ModelsDev.Provider {
    return {
      id: providerID,
      name: "Claudio",
      env: ["CLAUDIO_API_KEY"],
      api: `${root()}/claudio/v1`,
      npm: "@ai-sdk/openai-compatible",
      models: {
        junior: model("junior", "Claudio Junior"),
        pleno: model("pleno", "Claudio Pleno", 0.01),
        senior: model("senior", "Claudio Senior", 0.02),
      },
    }
  }
}
