import os from "os"
import path from "path"

function auth() {
  const files = [
    path.join(os.homedir(), "Library/Preferences/.wrangler/config/default.toml"),
    path.join(os.homedir(), ".wrangler/config/default.toml"),
    path.join(os.homedir(), ".config/.wrangler/config/default.toml"),
  ]
  return Promise.all(files.map((item) => Bun.file(item).exists())).then((list) => {
    const file = files[list.findIndex(Boolean)]
    if (!file) throw new Error("Wrangler OAuth config not found. Run `wrangler login` first.")
    return Bun.file(file).text()
  }).then((item) => {
    const token = item.match(/^oauth_token = "([^"]+)"/m)?.[1]
    if (!token) throw new Error("Wrangler OAuth token not found. Run `wrangler login` again.")
    return token
  })
}

async function account() {
  const proc = Bun.spawn([Bun.which("wrangler") ?? "wrangler", "whoami", "--json"], {
    stdout: "pipe",
    stderr: "inherit",
  })
  const text = await new Response(proc.stdout).text()
  const json = JSON.parse(text) as {
    accounts?: { id: string }[]
  }
  const id = json.accounts?.[0]?.id
  if (!id) throw new Error("Cloudflare account id not found from `wrangler whoami --json`.")
  return id
}

const cmd = process.argv.slice(2)
if (!cmd.length) throw new Error("Usage: bun ./script/cloudflare.ts <command...>")

const token = await auth()
const id = process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID ?? (await account())
const proc = Bun.spawn(cmd, {
  stdio: ["inherit", "inherit", "inherit"],
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_DEFAULT_ACCOUNT_ID: id,
  },
})

process.exit(await proc.exited)
