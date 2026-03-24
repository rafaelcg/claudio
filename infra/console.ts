import { domain } from "./stage"

const junior = (process.env.CLAUDIO_MANAGED_TIERS ?? "junior")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .every((item) => item === "junior")

function value(name: string, value: string) {
  return new sst.Linkable(name, {
    properties: { value },
  })
}

////////////////
// DATABASE
////////////////

const cluster = !junior
  ? planetscale.getDatabaseOutput({
      name: "opencode",
      organization: "anomalyco",
    })
  : undefined

const branch = cluster
  ? $app.stage === "production"
    ? planetscale.getBranchOutput({
        name: "production",
        organization: cluster.organization,
        database: cluster.name,
      })
    : new planetscale.Branch("DatabaseBranch", {
        database: cluster.name,
        organization: cluster.organization,
        name: $app.stage,
        parentBranch: "production",
      })
  : undefined
const password = cluster && branch
  ? new planetscale.Password("DatabasePassword", {
      name: $app.stage,
      database: cluster.name,
      organization: cluster.organization,
      branch: branch.name,
    })
  : undefined

export const database = !junior && cluster && password
  ? new sst.Linkable("Database", {
      properties: {
        host: password.accessHostUrl,
        database: cluster.name,
        username: password.username,
        password: password.plaintext,
        port: 3306,
      },
    })
  : new sst.Linkable("Database", {
      properties: {
        host: "",
        database: "",
        username: "",
        password: "",
        port: 3306,
      },
    })

if (!junior) {
  new sst.x.DevCommand("Studio", {
    link: [database],
    dev: {
      command: "bun db studio",
      directory: "packages/console/core",
      autostart: true,
    },
  })
}

////////////////
// AUTH
////////////////

const GITHUB_CLIENT_ID_CONSOLE = junior ? value("GITHUB_CLIENT_ID_CONSOLE", "") : new sst.Secret("GITHUB_CLIENT_ID_CONSOLE")
const GITHUB_CLIENT_SECRET_CONSOLE = junior
  ? value("GITHUB_CLIENT_SECRET_CONSOLE", "")
  : new sst.Secret("GITHUB_CLIENT_SECRET_CONSOLE")
const GOOGLE_CLIENT_ID = junior ? value("GOOGLE_CLIENT_ID", "") : new sst.Secret("GOOGLE_CLIENT_ID")
const authStorage = new sst.cloudflare.Kv("AuthStorage")
export const auth = new sst.cloudflare.Worker("AuthApi", {
  ...(domain ? { domain: `auth.${domain}` } : {}),
  handler: "packages/console/function/src/auth.ts",
  url: true,
  link: [database, authStorage, GITHUB_CLIENT_ID_CONSOLE, GITHUB_CLIENT_SECRET_CONSOLE, GOOGLE_CLIENT_ID],
})

////////////////
// GATEWAY
////////////////

export const stripeWebhook = !junior && domain
  ? new stripe.WebhookEndpoint("StripeWebhookEndpoint", {
      url: $interpolate`https://${domain}/stripe/webhook`,
      enabledEvents: [
        "checkout.session.async_payment_failed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.completed",
        "checkout.session.expired",
        "charge.refunded",
        "invoice.payment_succeeded",
        "invoice.payment_failed",
        "invoice.payment_action_required",
        "customer.created",
        "customer.deleted",
        "customer.updated",
        "customer.discount.created",
        "customer.discount.deleted",
        "customer.discount.updated",
        "customer.source.created",
        "customer.source.deleted",
        "customer.source.expiring",
        "customer.source.updated",
        "customer.subscription.created",
        "customer.subscription.deleted",
        "customer.subscription.paused",
        "customer.subscription.pending_update_applied",
        "customer.subscription.pending_update_expired",
        "customer.subscription.resumed",
        "customer.subscription.trial_will_end",
        "customer.subscription.updated",
      ],
    })
  : undefined

const ZEN_LITE_PRICE = !junior
  ? (() => {
      const zenLiteProduct = new stripe.Product("ZenLite", {
        name: "OpenCode Go",
      })
      const zenLiteCouponFirstMonth50 = new stripe.Coupon("ZenLiteCouponFirstMonth50", {
        name: "First month 50% off",
        percentOff: 50,
        appliesToProducts: [zenLiteProduct.id],
        duration: "once",
      })
      const zenLitePrice = new stripe.Price("ZenLitePrice", {
        product: zenLiteProduct.id,
        currency: "usd",
        recurring: {
          interval: "month",
          intervalCount: 1,
        },
        unitAmount: 1000,
      })
      return new sst.Linkable("ZEN_LITE_PRICE", {
        properties: {
          product: zenLiteProduct.id,
          price: zenLitePrice.id,
          priceInr: 92900,
          firstMonth50Coupon: zenLiteCouponFirstMonth50.id,
        },
      })
    })()
  : new sst.Linkable("ZEN_LITE_PRICE", {
      properties: {
        product: "",
        price: "",
        priceInr: 92900,
        firstMonth50Coupon: "",
      },
    })

const ZEN_BLACK_PRICE = !junior
  ? (() => {
      const zenBlackProduct = new stripe.Product("ZenBlack", {
        name: "OpenCode Black",
      })
      const zenBlackPriceProps = {
        product: zenBlackProduct.id,
        currency: "usd",
        recurring: {
          interval: "month",
          intervalCount: 1,
        },
      }
      const zenBlackPrice200 = new stripe.Price("ZenBlackPrice", { ...zenBlackPriceProps, unitAmount: 20000 })
      const zenBlackPrice100 = new stripe.Price("ZenBlack100Price", { ...zenBlackPriceProps, unitAmount: 10000 })
      const zenBlackPrice20 = new stripe.Price("ZenBlack20Price", { ...zenBlackPriceProps, unitAmount: 2000 })
      return new sst.Linkable("ZEN_BLACK_PRICE", {
        properties: {
          product: zenBlackProduct.id,
          plan200: zenBlackPrice200.id,
          plan100: zenBlackPrice100.id,
          plan20: zenBlackPrice20.id,
        },
      })
    })()
  : new sst.Linkable("ZEN_BLACK_PRICE", {
      properties: {
        product: "",
        plan200: "",
        plan100: "",
        plan20: "",
      },
    })

const ZEN_MODELS = junior
  ? Array.from({ length: 30 }, (_, index) => value(`ZEN_MODELS${index + 1}`, ""))
  : Array.from({ length: 30 }, (_, index) => new sst.Secret(`ZEN_MODELS${index + 1}`))
const STRIPE_SECRET_KEY = junior ? value("STRIPE_SECRET_KEY", "") : new sst.Secret("STRIPE_SECRET_KEY")
const STRIPE_PUBLISHABLE_KEY = junior ? value("STRIPE_PUBLISHABLE_KEY", "junior-only") : new sst.Secret("STRIPE_PUBLISHABLE_KEY")
const AUTH_API_URL = new sst.Linkable("AUTH_API_URL", {
  properties: { value: auth.url.apply((url) => url!) },
})
const STRIPE_WEBHOOK_SECRET = new sst.Linkable("STRIPE_WEBHOOK_SECRET", {
  properties: { value: stripeWebhook?.secret ?? "" },
})
const gatewayKv = new sst.cloudflare.Kv("GatewayKv")

////////////////
// CONSOLE
////////////////

const EMAILOCTOPUS_API_KEY = junior ? value("EMAILOCTOPUS_API_KEY", "") : new sst.Secret("EMAILOCTOPUS_API_KEY")

const bucket = new sst.cloudflare.Bucket("ZenData")
const bucketNew = new sst.cloudflare.Bucket("ZenDataNew")

const AWS_SES_ACCESS_KEY_ID = junior ? value("AWS_SES_ACCESS_KEY_ID", "") : new sst.Secret("AWS_SES_ACCESS_KEY_ID")
const AWS_SES_SECRET_ACCESS_KEY = junior
  ? value("AWS_SES_SECRET_ACCESS_KEY", "")
  : new sst.Secret("AWS_SES_SECRET_ACCESS_KEY")

const SALESFORCE_CLIENT_ID = junior ? value("SALESFORCE_CLIENT_ID", "") : new sst.Secret("SALESFORCE_CLIENT_ID")
const SALESFORCE_CLIENT_SECRET = junior
  ? value("SALESFORCE_CLIENT_SECRET", "")
  : new sst.Secret("SALESFORCE_CLIENT_SECRET")
const SALESFORCE_INSTANCE_URL = junior
  ? value("SALESFORCE_INSTANCE_URL", "")
  : new sst.Secret("SALESFORCE_INSTANCE_URL")
const CLAUDIO_MINIMAX_API_KEY = new sst.Secret("CLAUDIO_MINIMAX_API_KEY")
const CLAUDIO_MANAGED_TIERS = new sst.Linkable("CLAUDIO_MANAGED_TIERS", {
  properties: {
    value: process.env.CLAUDIO_MANAGED_TIERS ?? "junior",
  },
})

const logProcessor = new sst.cloudflare.Worker("LogProcessor", {
  handler: "packages/console/function/src/log-processor.ts",
  link: [junior ? value("HONEYCOMB_API_KEY", "") : new sst.Secret("HONEYCOMB_API_KEY")],
})

new sst.cloudflare.x.SolidStart("Console", {
  ...(domain ? { domain } : {}),
  path: "packages/console/app",
  link: [
    bucket,
    bucketNew,
    database,
    AUTH_API_URL,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY,
    EMAILOCTOPUS_API_KEY,
    AWS_SES_ACCESS_KEY_ID,
    AWS_SES_SECRET_ACCESS_KEY,
    SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET,
    SALESFORCE_INSTANCE_URL,
    CLAUDIO_MINIMAX_API_KEY,
    CLAUDIO_MANAGED_TIERS,
    ZEN_BLACK_PRICE,
    ZEN_LITE_PRICE,
    ...(junior ? [value("ZEN_LIMITS", "{}"), value("ZEN_SESSION_SECRET", "junior-only")] : [
      new sst.Secret("ZEN_LIMITS"),
      new sst.Secret("ZEN_SESSION_SECRET"),
    ]),
    ...ZEN_MODELS,
    ...($dev
      ? [
          new sst.Secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID", process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID!),
          new sst.Secret("CLOUDFLARE_API_TOKEN", process.env.CLOUDFLARE_API_TOKEN!),
        ]
      : []),
    gatewayKv,
  ],
  environment: {
    //VITE_DOCS_URL: web.url.apply((url) => url!),
    //VITE_API_URL: gateway.url.apply((url) => url!),
    VITE_AUTH_URL: auth.url.apply((url) => url!),
    VITE_STRIPE_PUBLISHABLE_KEY: junior ? "junior-only" : STRIPE_PUBLISHABLE_KEY.value,
  },
  transform: {
    server: {
      placement: { region: "aws:us-east-1" },
      transform: {
        worker: {
          tailConsumers: [{ service: logProcessor.nodes.worker.scriptName }],
        },
      },
    },
  },
})
