import type { APIEvent } from "@solidjs/start/server"
import { Claudio } from "@claudio-code/console-core/claudio.js"
import type { CommonMessage, CommonRequest, CommonUsage } from "../../../zen/util/provider/provider"
import { allowed, auth, body as wrap, normalize, scrub, status, track, upstream, usage } from "../../util"

function text(msgs: CommonRequest["messages"]) {
  return msgs
    .map((item: CommonMessage) => {
      if (typeof item.content === "string") return item.content
      if (!Array.isArray(item.content)) return ""
      return item.content
        .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
        .join("\n")
    })
    .join("\n")
}

function headers(info: Awaited<ReturnType<typeof status>>, req: string) {
  return {
    "x-claudio-request-id": req,
    "x-claudio-tier": info.tier,
    "x-claudio-remaining": String(info.quota.remaining),
    "x-claudio-reset-at": info.quota.reset_at,
  }
}

function clean(json: Record<string, any>, tier: Claudio.Tier, alias: string) {
  json.model = alias
  for (const item of json.choices ?? []) {
    if (typeof item?.message?.content === "string") item.message.content = scrub(item.message.content, tier)
    if (typeof item?.message?.reasoning_content === "string") {
      item.message.reasoning_content = scrub(item.message.reasoning_content, tier)
    }
    if (typeof item?.message?.name === "string") item.message.name = Claudio.label(tier)
    if (typeof item?.delta?.content === "string") item.delta.content = scrub(item.delta.content, tier)
    if (typeof item?.delta?.reasoning_content === "string") {
      item.delta.reasoning_content = scrub(item.delta.reasoning_content, tier)
    }
  }
  if (typeof json.error?.message === "string") {
    json.error.message = scrub(json.error.message, tier)
  }
  return json
}

function fail(json: Record<string, any>) {
  const base = json.base_resp
  if (base && typeof base === "object" && base.status_code && base.status_code !== 0) {
    return String(base.status_msg ?? `Upstream error (${base.status_code})`)
  }
  if (json.error && typeof json.error === "object" && typeof json.error.message === "string") {
    return json.error.message
  }
  return undefined
}

function meta(info: Awaited<ReturnType<typeof status>>, req: string) {
  return `data: ${JSON.stringify({
    id: req,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: info.model?.alias ?? Claudio.alias(info.tier),
    choices: [],
    claudio: {
      request_id: req,
      tier: info.tier,
      remaining: info.quota.remaining,
      reset_at: info.quota.reset_at,
    },
  })}\n\n`
}

function chunk(input: {
  id: string
  model: string
  delta?: Record<string, unknown>
  finish?: "stop" | "tool_calls" | "length" | "content_filter" | null
}) {
  return `data: ${JSON.stringify({
    id: input.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: input.model,
    choices: [
      {
        index: 0,
        delta: input.delta ?? {},
        finish_reason: input.finish ?? null,
      },
    ],
  })}\n\n`
}

export async function POST(input: APIEvent) {
  const origin = new URL(input.request.url).origin
  const raw = (await input.request.json()) as CommonRequest
  const alias = normalize(raw.model)
  const info = await allowed(input.request.headers, alias, origin).catch((err: unknown) => {
    if (err instanceof Response) return err
    throw err
  })
  if (info instanceof Response) return info

  const req = input.request.headers.get("x-opencode-request") ?? crypto.randomUUID()
  const sess = input.request.headers.get("x-opencode-session") ?? req
  const signed = await auth(input.request.headers)
  const route = Claudio.route({
    alias,
    tools: raw.tools,
    text: text(raw.messages),
    deep: raw.tool_choice === "required",
  })
  const body = wrap(
    {
      ...raw,
      model: alias,
    },
    route.tier,
  )
  const up = upstream(route, body, {
    install_id: info.install_id,
    account_id: signed?.userID ?? "",
    workspace_id: signed?.workspaceID ?? "",
    tier: route.tier,
    alias,
    session_id: sess,
    request_id: req,
    route_id: `${route.vendor}:${route.model}`,
  })
  const start = Date.now()
  const res = await fetch(up.url, {
    method: "POST",
    headers: up.headers,
    body: JSON.stringify(raw.stream ? { ...up.body, stream: false, stream_options: undefined } : up.body),
  })

  if (!res.ok) {
    const txt = await res.text()
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: scrub(txt || `Claudio upstream error (${res.status})`, route.tier),
        },
      }),
      {
        status: res.status,
        headers: {
          "content-type": "application/json",
          ...headers(info, req),
        },
      },
    )
  }

  if (!raw.stream) {
    const json = clean(await res.json(), route.tier, alias)
    const err = fail(json)
    if (err) {
      return new Response(
        JSON.stringify({
          type: "error",
          error: {
            type: "upstream_error",
            message: scrub(err, route.tier),
          },
        }),
        {
          status: 502,
          headers: {
            "content-type": "application/json",
            ...headers(info, req),
          },
        },
      )
    }
    const stats = usage(json.usage as CommonUsage | undefined)
    await track({
      hdr: input.request.headers,
      info,
      route,
      alias,
      session: sess,
      request: req,
      latency: Date.now() - start,
      usage: stats,
    })
    const next = await status(input.request.headers, origin)
    return new Response(JSON.stringify(json), {
      headers: {
        "content-type": "application/json",
        ...headers(next, req),
      },
    })
  }

  const json = clean(await res.json(), route.tier, alias)
  const err = fail(json)
  if (err) {
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "upstream_error",
          message: scrub(err, route.tier),
        },
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          ...headers(info, req),
        },
      },
    )
  }
  const stats = usage(json.usage as CommonUsage | undefined)
  await track({
    hdr: input.request.headers,
    info,
    route,
    alias,
    session: sess,
    request: req,
    latency: Date.now() - start,
    usage: stats,
  })
  const next = await status(input.request.headers, origin)
  const msg = json.choices?.[0]?.message
  const model = json.model ?? alias
  const finish = msg?.tool_calls?.length ? "tool_calls" : (json.choices?.[0]?.finish_reason ?? "stop")
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(enc.encode(chunk({ id: req, model, delta: { role: "assistant" } })))
      if (typeof msg?.content === "string" && msg.content.length > 0) {
        ctrl.enqueue(enc.encode(chunk({ id: req, model, delta: { content: msg.content } })))
      }
      for (const [index, item] of (msg?.tool_calls ?? []).entries()) {
        ctrl.enqueue(
          enc.encode(
            chunk({
              id: req,
              model,
              delta: {
                tool_calls: [
                  {
                    index,
                    id: item.id,
                    type: item.type,
                    function: item.function,
                  },
                ],
              },
            }),
          ),
        )
      }
      ctrl.enqueue(enc.encode(chunk({ id: req, model, finish })))
      ctrl.enqueue(enc.encode(meta(next, req)))
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"))
      ctrl.close()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      ...headers(info, req),
    },
  })
}
