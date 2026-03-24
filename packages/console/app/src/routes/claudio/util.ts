import { and, Database, eq, gte, isNull, lt, sql } from "@claudio-code/console-core/drizzle/index.js"
import { BillingTable, LiteTable, SubscriptionTable, UsageTable } from "@claudio-code/console-core/schema/billing.sql.js"
import { KeyTable } from "@claudio-code/console-core/schema/key.sql.js"
import { UserTable } from "@claudio-code/console-core/schema/user.sql.js"
import { Identifier } from "@claudio-code/console-core/identifier.js"
import { Claudio } from "@claudio-code/console-core/claudio.js"
import { LiteData } from "@claudio-code/console-core/lite.js"
import { BlackData } from "@claudio-code/console-core/black.js"
import { getMonthlyBounds, getWeekBounds } from "@claudio-code/console-core/util/date.js"
import { Resource } from "@claudio-code/console-resource"
import type { CommonRequest, CommonUsage } from "../zen/util/provider/provider"

function day(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function minute(now = new Date()) {
  return now.toISOString().slice(0, 16)
}

function read(raw?: string) {
  if (typeof raw !== "string" || raw === "") return undefined
  try {
    const json = JSON.parse(raw)
    if (typeof json === "string") return json
    if (typeof json?.value === "string") return json.value
    return raw
  } catch {
    return raw
  }
}

function safe(key: string) {
  const env = read(process.env[key])
  if (env) return env
  try {
    const val = Resource[key]
    return typeof val === "string" ? val : val?.value ?? val
  } catch {
    return undefined
  }
}

function launch() {
  const raw = String(safe("CLAUDIO_MANAGED_TIERS") ?? "junior")
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is Claudio.Tier => Claudio.Tier.safeParse(item).success)
  return list.length ? list : ["junior"]
}

function available(ent: Claudio.Entitlement) {
  const set = new Set(launch())
  const list = Claudio.aliases(ent).filter((item) => set.has(item.split("/").at(1) as Claudio.Tier))
  if (list.length) return list
  return [Claudio.alias("junior")]
}

async function kvGet(key: string) {
  const kv = safe("GatewayKv")
  if (!kv) return undefined
  return kv.get(key)
}

async function kvPut(key: string, value: string, ttl?: number) {
  const kv = safe("GatewayKv")
  if (!kv) return
  await kv.put(key, value, ttl ? { expirationTtl: ttl } : undefined)
}

export type Auth = {
  keyID: string
  workspaceID: string
  userID: string
  lite: {
    rollingUsage: number | null
    weeklyUsage: number | null
    monthlyUsage: number | null
    timeRollingUpdated: Date | null
    timeWeeklyUpdated: Date | null
    timeMonthlyUpdated: Date | null
    timeCreated: Date
  } | null
  sub: {
    rollingUsage: number | null
    fixedUsage: number | null
    timeRollingUpdated: Date | null
    timeFixedUpdated: Date | null
  } | null
  billing: {
    subscription: {
      status: "subscribed"
      plan: "20" | "100" | "200"
    } | null
    lite: {
      useBalance?: boolean
    } | null
  }
}

export async function auth(headers: Headers): Promise<Auth | undefined> {
  const token = headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return
  return Database.use((tx) =>
    tx
      .select({
        keyID: KeyTable.id,
        workspaceID: KeyTable.workspaceID,
        userID: KeyTable.userID,
        lite: {
          rollingUsage: LiteTable.rollingUsage,
          weeklyUsage: LiteTable.weeklyUsage,
          monthlyUsage: LiteTable.monthlyUsage,
          timeRollingUpdated: LiteTable.timeRollingUpdated,
          timeWeeklyUpdated: LiteTable.timeWeeklyUpdated,
          timeMonthlyUpdated: LiteTable.timeMonthlyUpdated,
          timeCreated: LiteTable.timeCreated,
        },
        sub: {
          rollingUsage: SubscriptionTable.rollingUsage,
          fixedUsage: SubscriptionTable.fixedUsage,
          timeRollingUpdated: SubscriptionTable.timeRollingUpdated,
          timeFixedUpdated: SubscriptionTable.timeFixedUpdated,
        },
        billing: {
          subscription: BillingTable.subscription,
          lite: BillingTable.lite,
        },
      })
      .from(KeyTable)
      .innerJoin(UserTable, and(eq(UserTable.workspaceID, KeyTable.workspaceID), eq(UserTable.id, KeyTable.userID)))
      .innerJoin(BillingTable, eq(BillingTable.workspaceID, KeyTable.workspaceID))
      .leftJoin(
        LiteTable,
        and(eq(LiteTable.workspaceID, KeyTable.workspaceID), eq(LiteTable.userID, KeyTable.userID), isNull(LiteTable.timeDeleted)),
      )
      .leftJoin(
        SubscriptionTable,
        and(
          eq(SubscriptionTable.workspaceID, KeyTable.workspaceID),
          eq(SubscriptionTable.userID, KeyTable.userID),
          isNull(SubscriptionTable.timeDeleted),
        ),
      )
      .where(and(eq(KeyTable.key, token), isNull(KeyTable.timeDeleted), isNull(UserTable.timeDeleted)))
      .then((rows) => rows[0]),
  )
}

export async function anonymous(input: { install: string; signed: boolean }) {
  const used = Number((await kvGet(`claudio:anon:day:${input.install}:${day()}`)) ?? "0")
  const burst = Number((await kvGet(`claudio:anon:min:${input.install}:${minute()}`)) ?? "0")
  return Claudio.juniorQuota({ signed: input.signed, used, burst })
}

export async function status(headers: Headers, origin: string) {
  const install = headers.get("x-claudio-install") ?? crypto.randomUUID()
  const signed = await auth(headers)
  if (!signed) {
    const alias = available("anonymous")
    const tier = alias.at(-1)?.split("/").at(1) as Claudio.Tier
    return Claudio.Status.parse({
      install_id: install,
      token: install,
      tier,
      alias,
      signed_in: false,
      entitlement: "anonymous",
      quota: await anonymous({ install, signed: false }),
      upgrade_url: `${origin}/go`,
      model: {
        alias: Claudio.alias(tier),
        label: Claudio.label(tier),
      },
    })
  }

  const ent = Claudio.entitlement({
    lite: signed.billing.lite,
    subscription: signed.billing.subscription,
  })
  const alias = available(ent)
  const tier = alias.at(-1)?.split("/").at(1) as Claudio.Tier
  const quota =
    ent === "pleno"
      ? Claudio.plenoQuota({
          rolling: signed.lite?.rollingUsage,
          weekly: signed.lite?.weeklyUsage,
          monthly: signed.lite?.monthlyUsage,
          timeRolling: signed.lite?.timeRollingUpdated,
          timeWeekly: signed.lite?.timeWeeklyUpdated,
          timeMonthly: signed.lite?.timeMonthlyUpdated,
        })
      : ent === "senior"
        ? Claudio.seniorQuota({
            plan: signed.billing.subscription?.plan ?? "20",
            rolling: signed.sub?.rollingUsage,
            fixed: signed.sub?.fixedUsage,
            timeRolling: signed.sub?.timeRollingUpdated,
            timeFixed: signed.sub?.timeFixedUpdated,
          })
        : await anonymous({ install, signed: true })

  return Claudio.Status.parse({
    install_id: install,
    token: install,
    tier,
    alias,
    signed_in: true,
    entitlement: ent,
    quota,
    upgrade_url: `${origin}/workspace/${signed.workspaceID}/billing`,
    model: {
      alias: Claudio.alias(tier),
      label: Claudio.label(tier),
    },
  })
}

export async function allowed(headers: Headers, alias: string, origin: string) {
  const info = await status(headers, origin)
  if (!info.alias.includes(alias)) {
    throw new Response(
      JSON.stringify({
        type: "error",
        error: { type: "forbidden", message: `${alias} is not available on your current Claudio tier.` },
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    )
  }
  if (info.entitlement !== "anonymous" && info.entitlement !== "free") return info
  if (info.quota.remaining <= 0 || (info.quota.burst_remaining ?? 1) <= 0) {
    throw new Response(
      JSON.stringify({
        type: "error",
        error: { type: "rate_limited", message: "Claudio Junior limit reached. Upgrade to keep going." },
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "60",
        },
      },
    )
  }
  return info
}

export function normalize(alias: string) {
  if (alias.startsWith("claudio/")) return alias
  return `claudio/${alias}`
}

export function body(input: CommonRequest, tier: Claudio.Tier) {
  const msgs = [...input.messages]
  const first = msgs[0]
  const sys = { role: "system" as const, content: Claudio.system(tier) }
  if (first?.role === "system") {
    msgs[0] = {
      ...first,
      content: `${Claudio.system(tier)}\n\n${typeof first.content === "string" ? first.content : ""}`,
    }
  } else {
    msgs.unshift(sys)
  }
  return {
    ...input,
    messages: msgs,
    stream_options: input.stream ? { include_usage: true } : undefined,
  }
}

export function usage(input: CommonUsage | undefined) {
  const details = input as CommonUsage & {
    prompt_tokens_details?: {
      cached_tokens?: number
    }
  }
  return {
    input: input?.input_tokens ?? input?.prompt_tokens ?? 0,
    output: input?.output_tokens ?? input?.completion_tokens ?? 0,
    reasoning: input?.output_tokens_details?.reasoning_tokens ?? 0,
    cache_read: input?.cache_read_input_tokens ?? input?.input_tokens_details?.cached_tokens ?? details?.prompt_tokens_details?.cached_tokens ?? 0,
  }
}

export function scrub(text: string, tier: Claudio.Tier) {
  return Claudio.scrub(text, tier)
}

export async function bump(input: { headers: Headers }) {
  const install = input.headers.get("x-claudio-install")
  if (!install) return
  const d = `claudio:anon:day:${install}:${day()}`
  const m = `claudio:anon:min:${install}:${minute()}`
  const dayValue = Number((await kvGet(d)) ?? "0") + 1
  const minuteValue = Number((await kvGet(m)) ?? "0") + 1
  await Promise.all([kvPut(d, String(dayValue), 60 * 60 * 25), kvPut(m, String(minuteValue), 60 * 2)])
}

export async function track(input: {
  hdr: Headers
  info: Claudio.Status
  route: { vendor: string; model: string; tier: Claudio.Tier }
  alias: string
  session: string
  request: string
  latency: number
  usage: ReturnType<typeof usage>
}) {
  const signed = await auth(input.hdr)
  if (!signed) {
    await bump({ headers: input.hdr })
    return
  }

  const cost = Claudio.cost({
    tier: input.route.tier,
    input: input.usage.input,
    output: input.usage.output,
    reasoning: input.usage.reasoning,
    cache_read: input.usage.cache_read,
  })

  await Database.use((db) =>
    Promise.all([
      db.insert(UsageTable).values({
        workspaceID: signed.workspaceID,
        id: Identifier.create("usage"),
        model: input.alias,
        provider: "claudio",
        inputTokens: input.usage.input,
        outputTokens: input.usage.output,
        reasoningTokens: input.usage.reasoning,
        cacheReadTokens: input.usage.cache_read,
        cost,
        keyID: signed.keyID,
        sessionID: input.session.substring(0, 30),
        alias: input.alias,
        tier: input.route.tier,
        vendor_model: input.route.model,
        route_id: `${input.route.vendor}:${input.route.model}`,
        install_id: input.info.install_id,
        latency_ms: input.latency,
        source: input.info.entitlement,
        enrichment:
          input.info.entitlement === "senior"
            ? { plan: "sub" }
            : input.info.entitlement === "pleno"
              ? { plan: "lite" }
              : undefined,
      }),
      db
        .update(KeyTable)
        .set({ timeUsed: sql`now()` })
        .where(and(eq(KeyTable.workspaceID, signed.workspaceID), eq(KeyTable.id, signed.keyID))),
      ...(() => {
        if (input.info.entitlement === "pleno" && signed.lite) {
          const data = LiteData.getLimits()
          const week = getWeekBounds(new Date())
          const month = getMonthlyBounds(new Date(), signed.lite.timeCreated)
          const secs = data.rollingWindow * 3600
          return [
            db
              .update(LiteTable)
              .set({
                monthlyUsage: sql`CASE WHEN ${LiteTable.timeMonthlyUpdated} >= ${month.start} THEN ${LiteTable.monthlyUsage} + ${cost} ELSE ${cost} END`,
                timeMonthlyUpdated: sql`now()`,
                weeklyUsage: sql`CASE WHEN ${LiteTable.timeWeeklyUpdated} >= ${week.start} THEN ${LiteTable.weeklyUsage} + ${cost} ELSE ${cost} END`,
                timeWeeklyUpdated: sql`now()`,
                rollingUsage: sql`CASE WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${secs} THEN ${LiteTable.rollingUsage} + ${cost} ELSE ${cost} END`,
                timeRollingUpdated: sql`CASE WHEN UNIX_TIMESTAMP(${LiteTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${secs} THEN ${LiteTable.timeRollingUpdated} ELSE now() END`,
              })
              .where(and(eq(LiteTable.workspaceID, signed.workspaceID), eq(LiteTable.userID, signed.userID))),
          ]
        }

        if (input.info.entitlement === "senior" && signed.sub) {
          const data = BlackData.getLimits({ plan: signed.billing.subscription?.plan ?? "20" })
          const week = getWeekBounds(new Date())
          const secs = data.rollingWindow * 3600
          return [
            db
              .update(SubscriptionTable)
              .set({
                fixedUsage: sql`CASE WHEN ${SubscriptionTable.timeFixedUpdated} >= ${week.start} THEN ${SubscriptionTable.fixedUsage} + ${cost} ELSE ${cost} END`,
                timeFixedUpdated: sql`now()`,
                rollingUsage: sql`CASE WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${secs} THEN ${SubscriptionTable.rollingUsage} + ${cost} ELSE ${cost} END`,
                timeRollingUpdated: sql`CASE WHEN UNIX_TIMESTAMP(${SubscriptionTable.timeRollingUpdated}) >= UNIX_TIMESTAMP(now()) - ${secs} THEN ${SubscriptionTable.timeRollingUpdated} ELSE now() END`,
              })
              .where(and(eq(SubscriptionTable.workspaceID, signed.workspaceID), eq(SubscriptionTable.userID, signed.userID))),
          ]
        }

        return []
      })(),
    ]),
  )
}

export function upstream(route: { vendor: string; model: string }, body: Record<string, unknown>, meta: Record<string, string>) {
  const gateway = safe("CLAUDIO_AIG_BASE_URL")
  if (gateway) {
    return {
      url: gateway,
      headers: {
        authorization: `Bearer ${safe("CLAUDIO_AIG_TOKEN") ?? ""}`,
        "cf-aig-metadata": JSON.stringify(meta),
        "content-type": "application/json",
      } as Record<string, string>,
      body: {
        ...body,
        model: route.vendor === "moonshot" ? `moonshot/${route.model}` : `minimax/${route.model}`,
      },
    }
  }

  if (route.vendor === "moonshot") {
    return {
      url: "https://api.moonshot.ai/v1/chat/completions",
      headers: {
        authorization: `Bearer ${safe("CLAUDIO_MOONSHOT_API_KEY") ?? ""}`,
        "content-type": "application/json",
        "x-claudio-route": route.model,
      } as Record<string, string>,
      body: {
        ...body,
        model: route.model,
      },
    }
  }

  return {
    url: "https://api.minimax.io/v1/text/chatcompletion_v2",
    headers: {
      authorization: `Bearer ${safe("CLAUDIO_MINIMAX_API_KEY") ?? ""}`,
      "content-type": "application/json",
      "x-claudio-route": route.model,
    } as Record<string, string>,
    body: {
      ...body,
      model: route.model,
    },
  }
}
