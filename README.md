<p align="center">
  <strong>Claudio Code</strong>
</p>
<p align="center">Agente de código com IA, feito para desenvolvedores brasileiros.<br/>Fork do projeto <a href="https://github.com/anomalyco/opencode">OpenCode</a> (MIT).</p>
<p align="center">
  <a href="README.en.md">English</a> |
  <a href="https://github.com/rafaelcg/claudio/actions/workflows/publish.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/rafaelcg/claudio/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://www.npmjs.com/package/@claudio-code/cli"><img alt="npm" src="https://img.shields.io/npm/v/@claudio-code/cli?style=flat-square" /></a>
</p>

---

### Instalação (recomendado)

O nome **`claudio`** (sem escopo) no npm já pertence a [outro pacote](https://www.npmjs.com/package/claudio). Este projeto publica o CLI como **`@claudio-code/cli`** (escopo da org no npm **claudio-code**; comando global ainda: **`claudio`**).

```bash
npm i -g @claudio-code/cli@latest
```

Ou, com o script deste repositório:

```bash
curl -fsSL https://raw.githubusercontent.com/rafaelcg/claudio/main/install.sh | bash
```

Verifique com:

```bash
claudio --version
```

Variáveis úteis:

- `CLAUDIO_BIN_PATH` — caminho explícito do binário nativo
- `CLAUDIO_CONFIG_DIR` — diretório de configuração global
- Dados em XDG: app `claudio` (antes `opencode`)

Imagem Docker: `ghcr.io/rafaelcg/claudio`.

---

### Documentação

- Documentação em inglês do upstream: veja [README.en.md](README.en.md) e o site original do projeto base.
- Configuração local do projeto: diretório **`.claudio/`** (inclui agente com tom **pt-BR** em [.claudio/agent/pt-br.md](.claudio/agent/pt-br.md)).

---

### Créditos e licença

Claudio Code é um fork do [OpenCode](https://github.com/anomalyco/opencode). Consulte [NOTICE](NOTICE) e [LICENSE](LICENSE).

---

### Comunidade

Defina o link da sua comunidade (Discord, Telegram ou GitHub Discussions) ao publicar o fork.
