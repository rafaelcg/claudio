#!/usr/bin/env bun
import { $ } from "bun"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import pkg from "../package.json"
import { Script } from "@claudio-code/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const npmToken = process.env.NPM_TOKEN?.trim()
if (!npmToken) {
  throw new Error(
    "Set NPM_TOKEN to an npm granular automation token (publish + bypass 2FA). Example: export NPM_TOKEN=npm_… — never commit tokens. Revoke any token that was exposed.",
  )
}

/** npm often ignores parent .npmrc ${NPM_TOKEN} when cwd is dist/<platform>; pass explicit --userconfig. */
const npmUserconfigPath = path.join(os.tmpdir(), `claudio-npm-publish-${process.pid}.npmrc`)
await fs.writeFile(npmUserconfigPath, `//registry.npmjs.org/:_authToken=${npmToken}\n`, { mode: 0o600 })

/** Published npm package (scoped). Unscoped `claudio` is already taken on npm. */
const NPM_WRAPPER_NAME = "@claudio-code/cli"

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json()
  // Skip stale dist/claudio from a previous publish (name === NPM_WRAPPER_NAME); only native tarballs.
  if (pkg.name === NPM_WRAPPER_NAME) {
    continue
  }
  binaries[pkg.name] = pkg.version
}
console.log("binaries", binaries)
if (Object.keys(binaries).length === 0) {
  throw new Error("No platform packages in dist/. Run `bun run script/build.ts` first (clean dist is recommended).")
}
const version = Object.values(binaries)[0]

// Clear wrapper dir so `cp` never nests bin/ inside bin/ when dist/claudio/bin already exists.
await $`rm -rf ./dist/${pkg.name}`
await $`mkdir -p ./dist/${pkg.name}/bin`
await $`cp -r ./bin/. ./dist/${pkg.name}/bin/`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: NPM_WRAPPER_NAME,
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

try {
  const wrapperOnly = process.env.CLAUDIO_PUBLISH_WRAPPER_ONLY === "1"
  if (wrapperOnly) {
    console.log(
      "CLAUDIO_PUBLISH_WRAPPER_ONLY=1 — skipping native package publishes; publishing @claudio-code/cli only.",
    )
  } else {
    const tasks = Object.entries(binaries).map(async ([name]) => {
      if (process.platform !== "win32") {
        await $`chmod -R 755 .`.cwd(`./dist/${name}`)
      }
      await $`rm -f *.tgz`.cwd(`./dist/${name}`).nothrow()
      await $`bun pm pack`.cwd(`./dist/${name}`)
      await $`npm publish *.tgz --access public --tag ${Script.channel} --userconfig ${npmUserconfigPath}`.cwd(
        `./dist/${name}`,
      )
    })
    await Promise.all(tasks)
  }
  await $`rm -f *.tgz`.cwd(`./dist/${pkg.name}`).nothrow()
  await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel} --userconfig ${npmUserconfigPath}`
} finally {
  await fs.unlink(npmUserconfigPath).catch(() => {})
}

if (process.env.CLAUDIO_PUBLISH_WRAPPER_ONLY === "1") {
  console.log("Done. Try: npm i -g @claudio-code/cli@latest")
} else if (process.env.CLAUDIO_SKIP_DOCKER === "1") {
  console.log("Skipping Docker image (CLAUDIO_SKIP_DOCKER=1).")
} else {
  const image = "ghcr.io/rafaelcg/claudio"
  const platforms = "linux/amd64,linux/arm64"
  const tags = [`${image}:${version}`, `${image}:${Script.channel}`]
  const tagFlags = tags.flatMap((t) => ["-t", t])
  await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`
}

// registries (AUR / Homebrew) — optional; set CLAUDIO_PUBLISH_DISTRIBUTIONS=1 when you own those infra pieces
if (!Script.preview && process.env.CLAUDIO_PUBLISH_DISTRIBUTIONS === "1") {
  const arm64Sha = await $`sha256sum ./dist/claudio-linux-arm64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const x64Sha = await $`sha256sum ./dist/claudio-linux-x64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const macX64Sha = await $`sha256sum ./dist/claudio-darwin-x64.zip | cut -d' ' -f1`.text().then((x) => x.trim())
  const macArm64Sha = await $`sha256sum ./dist/claudio-darwin-arm64.zip | cut -d' ' -f1`.text().then((x) => x.trim())

  const [pkgver, _subver = ""] = Script.version.split(/(-.*)/, 2)

  const binaryPkgbuild = [
    "# Maintainer: Claudio Code",
    "",
    "pkgname='claudio-bin'",
    `pkgver=${pkgver}`,
    `_subver=${_subver}`,
    "options=('!debug' '!strip')",
    "pkgrel=1",
    "pkgdesc='Claudio Code — agente de código com IA para o terminal.'",
    "url='https://github.com/rafaelcg/claudio'",
    "arch=('aarch64' 'x86_64')",
    "license=('MIT')",
    "provides=('claudio')",
    "conflicts=('claudio')",
    "depends=('ripgrep')",
    "",
    `source_aarch64=("\${pkgname}_\${pkgver}_aarch64.tar.gz::https://github.com/rafaelcg/claudio/releases/download/v\${pkgver}\${_subver}/claudio-linux-arm64.tar.gz")`,
    `sha256sums_aarch64=('${arm64Sha}')`,

    `source_x86_64=("\${pkgname}_\${pkgver}_x86_64.tar.gz::https://github.com/rafaelcg/claudio/releases/download/v\${pkgver}\${_subver}/claudio-linux-x64.tar.gz")`,
    `sha256sums_x86_64=('${x64Sha}')`,
    "",
    "package() {",
    '  install -Dm755 ./claudio "${pkgdir}/usr/bin/claudio"',
    "}",
    "",
  ].join("\n")

  for (const [pkg, pkgbuild] of [["claudio-bin", binaryPkgbuild]]) {
    for (let i = 0; i < 30; i++) {
      try {
        await $`rm -rf ./dist/aur-${pkg}`
        await $`git clone ssh://aur@aur.archlinux.org/${pkg}.git ./dist/aur-${pkg}`
        await $`cd ./dist/aur-${pkg} && git checkout master`
        await Bun.file(`./dist/aur-${pkg}/PKGBUILD`).write(pkgbuild)
        await $`cd ./dist/aur-${pkg} && makepkg --printsrcinfo > .SRCINFO`
        await $`cd ./dist/aur-${pkg} && git add PKGBUILD .SRCINFO`
        await $`cd ./dist/aur-${pkg} && git commit -m "Update to v${Script.version}"`
        await $`cd ./dist/aur-${pkg} && git push`
        break
      } catch (e) {
        continue
      }
    }
  }

  const homebrewFormula = [
    "# typed: false",
    "# frozen_string_literal: true",
    "",
    "# This file was generated by GoReleaser. DO NOT EDIT.",
    "class Claudio < Formula",
    `  desc "Claudio Code — agente de código com IA para o terminal."`,
    `  homepage "https://github.com/rafaelcg/claudio"`,
    `  version "${Script.version.split("-")[0]}"`,
    "",
    `  depends_on "ripgrep"`,
    "",
    "  on_macos do",
    "    if Hardware::CPU.intel?",
    `      url "https://github.com/rafaelcg/claudio/releases/download/v${Script.version}/claudio-darwin-x64.zip"`,
    `      sha256 "${macX64Sha}"`,
    "",
    "      def install",
    '        bin.install "claudio"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm?",
    `      url "https://github.com/rafaelcg/claudio/releases/download/v${Script.version}/claudio-darwin-arm64.zip"`,
    `      sha256 "${macArm64Sha}"`,
    "",
    "      def install",
    '        bin.install "claudio"',
    "      end",
    "    end",
    "  end",
    "",
    "  on_linux do",
    "    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/rafaelcg/claudio/releases/download/v${Script.version}/claudio-linux-x64.tar.gz"`,
    `      sha256 "${x64Sha}"`,
    "      def install",
    '        bin.install "claudio"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/rafaelcg/claudio/releases/download/v${Script.version}/claudio-linux-arm64.tar.gz"`,
    `      sha256 "${arm64Sha}"`,
    "      def install",
    '        bin.install "claudio"',
    "      end",
    "    end",
    "  end",
    "end",
    "",
    "",
  ].join("\n")

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN is required to update homebrew tap")
    process.exit(1)
  }
  const tap = `https://x-access-token:${token}@github.com/rafaelcg/homebrew-claudio.git`
  await $`rm -rf ./dist/homebrew-tap`
  await $`git clone ${tap} ./dist/homebrew-tap`
  await Bun.file("./dist/homebrew-tap/claudio.rb").write(homebrewFormula)
  await $`cd ./dist/homebrew-tap && git add claudio.rb`
  await $`cd ./dist/homebrew-tap && git commit -m "Update to v${Script.version}"`
  await $`cd ./dist/homebrew-tap && git push`
}
