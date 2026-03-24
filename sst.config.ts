/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const junior = (process.env.CLAUDIO_MANAGED_TIERS ?? "junior")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .every((item) => item === "junior")
    return {
      name: "opencode",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: {
        ...(junior ? {} : {
          stripe: {
            apiKey: process.env.STRIPE_SECRET_KEY!,
          },
        }),
        ...(junior ? {} : {
          planetscale: "0.4.1",
        }),
      },
    }
  },
  async run() {
    const target = process.env.CLAUDIO_DEPLOY_TARGET ?? "all"
    if (target === "console") {
      await import("./infra/console.js")
      return
    }
    await import("./infra/app.js")
    await import("./infra/console.js")
    await import("./infra/enterprise.js")
  },
})
