import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

export namespace Flag {
  export const CLAUDIO_AUTO_SHARE = truthy("CLAUDIO_AUTO_SHARE")
  export const CLAUDIO_GIT_BASH_PATH = process.env["CLAUDIO_GIT_BASH_PATH"]
  export const CLAUDIO_CONFIG = process.env["CLAUDIO_CONFIG"]
  export declare const CLAUDIO_TUI_CONFIG: string | undefined
  export declare const CLAUDIO_CONFIG_DIR: string | undefined
  export const CLAUDIO_CONFIG_CONTENT = process.env["CLAUDIO_CONFIG_CONTENT"]
  export const CLAUDIO_DISABLE_AUTOUPDATE = truthy("CLAUDIO_DISABLE_AUTOUPDATE")
  export const CLAUDIO_DISABLE_PRUNE = truthy("CLAUDIO_DISABLE_PRUNE")
  export const CLAUDIO_DISABLE_TERMINAL_TITLE = truthy("CLAUDIO_DISABLE_TERMINAL_TITLE")
  export const CLAUDIO_PERMISSION = process.env["CLAUDIO_PERMISSION"]
  export const CLAUDIO_DISABLE_DEFAULT_PLUGINS = truthy("CLAUDIO_DISABLE_DEFAULT_PLUGINS")
  export const CLAUDIO_DISABLE_LSP_DOWNLOAD = truthy("CLAUDIO_DISABLE_LSP_DOWNLOAD")
  export const CLAUDIO_ENABLE_EXPERIMENTAL_MODELS = truthy("CLAUDIO_ENABLE_EXPERIMENTAL_MODELS")
  export const CLAUDIO_DISABLE_AUTOCOMPACT = truthy("CLAUDIO_DISABLE_AUTOCOMPACT")
  export const CLAUDIO_DISABLE_MODELS_FETCH = truthy("CLAUDIO_DISABLE_MODELS_FETCH")
  export const CLAUDIO_DISABLE_CLAUDE_CODE = truthy("CLAUDIO_DISABLE_CLAUDE_CODE")
  export const CLAUDIO_DISABLE_CLAUDE_CODE_PROMPT =
    CLAUDIO_DISABLE_CLAUDE_CODE || truthy("CLAUDIO_DISABLE_CLAUDE_CODE_PROMPT")
  export const CLAUDIO_DISABLE_CLAUDE_CODE_SKILLS =
    CLAUDIO_DISABLE_CLAUDE_CODE || truthy("CLAUDIO_DISABLE_CLAUDE_CODE_SKILLS")
  export const CLAUDIO_DISABLE_EXTERNAL_SKILLS =
    CLAUDIO_DISABLE_CLAUDE_CODE_SKILLS || truthy("CLAUDIO_DISABLE_EXTERNAL_SKILLS")
  export declare const CLAUDIO_DISABLE_PROJECT_CONFIG: boolean
  export const CLAUDIO_FAKE_VCS = process.env["CLAUDIO_FAKE_VCS"]
  export declare const CLAUDIO_CLIENT: string
  export const CLAUDIO_SERVER_PASSWORD = process.env["CLAUDIO_SERVER_PASSWORD"]
  export const CLAUDIO_SERVER_USERNAME = process.env["CLAUDIO_SERVER_USERNAME"]
  export const CLAUDIO_ENABLE_QUESTION_TOOL = truthy("CLAUDIO_ENABLE_QUESTION_TOOL")

  // Experimental
  export const CLAUDIO_EXPERIMENTAL = truthy("CLAUDIO_EXPERIMENTAL")
  export const CLAUDIO_EXPERIMENTAL_FILEWATCHER = Config.boolean("CLAUDIO_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  )
  export const CLAUDIO_EXPERIMENTAL_DISABLE_FILEWATCHER = Config.boolean(
    "CLAUDIO_EXPERIMENTAL_DISABLE_FILEWATCHER",
  ).pipe(Config.withDefault(false))
  export const CLAUDIO_EXPERIMENTAL_ICON_DISCOVERY =
    CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["CLAUDIO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const CLAUDIO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("CLAUDIO_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const CLAUDIO_ENABLE_EXA =
    truthy("CLAUDIO_ENABLE_EXA") || CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_EXA")
  export const CLAUDIO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("CLAUDIO_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const CLAUDIO_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("CLAUDIO_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const CLAUDIO_EXPERIMENTAL_OXFMT = CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_OXFMT")
  export const CLAUDIO_EXPERIMENTAL_LSP_TY = truthy("CLAUDIO_EXPERIMENTAL_LSP_TY")
  export const CLAUDIO_EXPERIMENTAL_LSP_TOOL = CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_LSP_TOOL")
  export const CLAUDIO_DISABLE_FILETIME_CHECK = Config.boolean("CLAUDIO_DISABLE_FILETIME_CHECK").pipe(
    Config.withDefault(false),
  )
  export const CLAUDIO_EXPERIMENTAL_PLAN_MODE = CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_PLAN_MODE")
  export const CLAUDIO_EXPERIMENTAL_WORKSPACES = CLAUDIO_EXPERIMENTAL || truthy("CLAUDIO_EXPERIMENTAL_WORKSPACES")
  export const CLAUDIO_EXPERIMENTAL_MARKDOWN = !falsy("CLAUDIO_EXPERIMENTAL_MARKDOWN")
  export const CLAUDIO_MODELS_URL = process.env["CLAUDIO_MODELS_URL"]
  export const CLAUDIO_MODELS_PATH = process.env["CLAUDIO_MODELS_PATH"]
  export const CLAUDIO_MANAGED_API_URL = process.env["CLAUDIO_MANAGED_API_URL"]
  export const CLAUDIO_MANAGED_BOOTSTRAP_URL = process.env["CLAUDIO_MANAGED_BOOTSTRAP_URL"]
  export const CLAUDIO_DB = process.env["CLAUDIO_DB"]
  export const CLAUDIO_DISABLE_CHANNEL_DB = truthy("CLAUDIO_DISABLE_CHANNEL_DB")
  export const CLAUDIO_SKIP_MIGRATIONS = truthy("CLAUDIO_SKIP_MIGRATIONS")
  export const CLAUDIO_STRICT_CONFIG_DEPS = truthy("CLAUDIO_STRICT_CONFIG_DEPS")

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for CLAUDIO_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CLAUDIO_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("CLAUDIO_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CLAUDIO_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "CLAUDIO_TUI_CONFIG", {
  get() {
    return process.env["CLAUDIO_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CLAUDIO_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CLAUDIO_CONFIG_DIR", {
  get() {
    return process.env["CLAUDIO_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CLAUDIO_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "CLAUDIO_CLIENT", {
  get() {
    return process.env["CLAUDIO_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
