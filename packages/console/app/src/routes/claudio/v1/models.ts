import type { APIEvent } from "@solidjs/start/server"
import { status } from "../../claudio/util"

export async function GET(input: APIEvent) {
  const origin = new URL(input.request.url).origin
  const info = await status(input.request.headers, origin)
  return new Response(
    JSON.stringify({
      object: "list",
      data: info.alias.map((id) => ({
        id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "claudio",
      })),
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    },
  )
}
