import { env } from "cloudflare:workers"
export { waitUntil } from "cloudflare:workers"

export const Resource = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === "App") {
        // @ts-expect-error
        return JSON.parse(env.SST_RESOURCE_App)
      }
      const key = prop in env ? prop : `SST_RESOURCE_${prop}`
      if (key in env) {
        // @ts-expect-error
        const value = env[key]
        if (typeof value !== "string") return value
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      throw new Error(`"${prop}" is not linked in your sst.config.ts (cloudflare)`)
    },
  },
) as Record<string, any>
