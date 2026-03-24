const base = process.env.CLAUDIO_BASE_DOMAIN
const short = process.env.CLAUDIO_SHORT_DOMAIN
const zone = process.env.CLAUDIO_ZONE_ID

export const domain = (() => {
  if (!base) return
  if ($app.stage === "production") return base
  if ($app.stage === "dev") return `dev.${base}`
  return `${$app.stage}.dev.${base}`
})()

if (domain && zone) {
  new cloudflare.RegionalHostname("RegionalHostname", {
    hostname: domain,
    regionKey: "us",
    zoneId: zone,
  })
}

export const shortDomain = (() => {
  if (!short) return
  if ($app.stage === "production") return short
  if ($app.stage === "dev") return `dev.${short}`
  return `${$app.stage}.dev.${short}`
})()
