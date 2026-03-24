import { Global } from "@/global"
import { Hash } from "@/util/hash"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import z from "zod"
import { ClaudioProvider } from "@/provider/claudio"
import { Auth } from "@/auth"
import { Installation } from "@/installation"

export namespace ClaudioStatus {
  const file = path.join(Global.Path.state, "claudio.json")

  export const Info = z.object({
    install_id: z.string(),
    token: z.string(),
    tier: z.enum(["junior", "pleno", "senior"]),
    alias: z.array(z.string()),
    signed_in: z.boolean(),
    entitlement: z.enum(["anonymous", "free", "pleno", "senior"]),
    quota: z.object({
      limit: z.number().int(),
      used: z.number().int(),
      remaining: z.number().int(),
      unit: z.enum(["prompts", "usd_micro"]),
      reset_at: z.string(),
      burst_remaining: z.number().int().optional(),
    }),
    upgrade_url: z.string().optional(),
    model: z
      .object({
        alias: z.string(),
        label: z.string(),
      })
      .optional(),
  })

  export type Info = z.infer<typeof Info>

  async function state() {
    const saved = await Filesystem.readJson<{ install_id?: string }>(file).catch(() => undefined)
    if (saved?.install_id) return saved.install_id
    const install_id = Hash.fast(`${Installation.USER_AGENT}:${Global.Path.data}:${Date.now()}`)
    await Filesystem.writeJson(file, { install_id }, 0o600)
    return install_id
  }

  export async function install() {
    return state()
  }

  export async function headers() {
    const auth = await Auth.get("claudio")
    return {
      "x-claudio-install": await install(),
      "x-claudio-client": Installation.USER_AGENT,
      ...(auth?.type === "api" ? { Authorization: `Bearer ${auth.key}` } : {}),
    }
  }

  export async function get() {
    const hdr = await headers()
    const res = await ClaudioProvider.request("/api/claudio/bootstrap", {
      headers: hdr,
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`managed bootstrap failed: ${res.status} ${res.statusText}`)
    return Info.parse(await res.json())
  }
}
