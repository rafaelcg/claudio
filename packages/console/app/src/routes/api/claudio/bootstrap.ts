import type { APIEvent } from "@solidjs/start/server"
import { status } from "~/routes/claudio/util"

export async function GET(input: APIEvent) {
  const origin = new URL(input.request.url).origin
  return new Response(JSON.stringify(await status(input.request.headers, origin)), {
    headers: {
      "content-type": "application/json",
    },
  })
}
