<div align="center">

<img src="../../docs/assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Niveles](https://img.shields.io/badge/niveles-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../USAGE.md) &nbsp;|&nbsp; 🇺🇸 [**English**](USAGE.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](USAGE.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](USAGE.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](USAGE.de.md)

</div>

---

# Gru Harness — Benutzerhandbuch (Referenz)

Vollständige Referenz für die `gru`-CLI (Paket `@adrichdev/gru-harness`, privates Repo —
wird aus Git installiert, nicht aus dem öffentlichen Registry). Für die Projektübersicht
siehe [README.md](../../README.md). Für das strikte Provider-Runtime siehe
[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

---

## Wo läuft das Harness und was muss kopiert werden?

Es gibt **zwei Wege**, Gru zu nutzen, und die Antwort hängt davon ab, welchen du wählst.
Vermische sie nicht.

### A) Die `gru`-CLI (standalone)

- Wird **einmalig, global** installiert (`pnpm add -g github:AdrichDev/gru_orchestrator`).
  Sie stellt den Befehl `gru` systemweit bereit.
- Du musst **nicht** im gru_orchestrator-Ordner sein. Dieses Repo dient nur der
  *Entwicklung* des Harness. Zum *Verwenden* führst du `gru` im **Wurzelverzeichnis DEINES
  Projekts** aus (an dem du arbeitest).
- Das `cwd` definiert: den Config-Scope (`<cwd>/.gru/`), das Ziel des Filesystem-Scans und
  die Logs (`runs/run_*.json`). Deshalb wird es im Wurzelverzeichnis deines Projekts
  ausgeführt, nicht in dem von gru.
- **Kanonische Dateien kopieren?** Damit die CLI *startet*, nein: `postinstall` legt
  `~/.gru/*` an, und das genügt. Du brauchst `gru init` in deinem Projekt nur, wenn du eine
  projektgebundene Config, Verträge oder eine lokale `.mcp.json` willst.

### B) Die Persona innerhalb eines LLM-Harness (Claude Code, Codex, Gemini, Cursor…)

- Diese Tools laden ihre kanonische Datei automatisch **aus dem `cwd`-Baum**: Claude Code
  liest `CLAUDE.md`; Codex/Cursor/Antigravity lesen `AGENTS.md`; Gemini liest `GEMINI.md`.
- **Hier MUSST du die kanonischen Dateien im Wurzelverzeichnis DEINES Projekts haben.** Die
  Dateien des gru-Repos **genügen nicht**: Sie werden nur geladen, wenn du *innerhalb von*
  `gru_orchestrator` arbeitest. Ein anderes Projekt liest die `CLAUDE.md`/`AGENTS.md` eines
  fremden Repos nicht.
- Zum Anlegen in deinem Projekt: `gru init --runtime <tool>` (siehe
  [`gru init`](#gru-init--vollständige-referenz)). Es schreibt die kanonische Datei des
  gewählten Runtimes plus die gemeinsamen Dateien (`.gru/*`, Verträge, `.mcp.json`).

### Zusammenfassung

| Frage | Antwort |
| :--- | :--- |
| Im gru-Ordner sein? | **Nein.** Nur zur Entwicklung des Harness. Zum Verwenden im Wurzelverzeichnis deines Projekts ausführen. |
| Wo führe ich `gru` aus? | Im **Wurzelverzeichnis des Projekts, an dem du arbeitest** (das `cwd` definiert Config/Scan/Logs). |
| Genügen die Dateien des gru-Repos? | **CLI:** ja (global + `~/.gru/`). **LLM-Persona:** nein — jedes Tool liest nur die kanonische Datei aus seinem eigenen `cwd`-Baum. |
| Muss ich kanonische Dateien ins Projekt-Wurzelverzeichnis kopieren? | **Nur für die LLM-Persona.** Nutze `gru init --runtime <tool>`. Die CLI braucht es zum Starten nicht. |

---

## Installation

```bash
# Privates Repo → direkt aus Git installieren (kein manuelles Clone; stellt den Befehl `gru` bereit).
pnpm add -g github:AdrichDev/gru_orchestrator
# oder per SSH:
pnpm add -g git+ssh://git@github.com/AdrichDev/gru_orchestrator.git
```

Erfordert Zugriff auf das private Repo, **git** und **Node.js 20+**. Die Installation
kompiliert das Bundle auf deinem Rechner (`prepare`-Skript → tsup). Es wird nicht im
öffentlichen npm-Registry veröffentlicht.

### Was `postinstall` macht

Nach der globalen Installation lässt der Bootstrap (`scripts/postinstall.mjs`) **die
Installation nie fehlschlagen** (er beendet sich immer mit Code 0) und:

1. Erstellt `~/.gru/` (idempotent).
2. Legt die Standard-YAML aus `templates/.gru/` an (config, providers, skills), ohne
   Vorhandenes zu überschreiben.
3. Gibt einen Hinweis aus: Der **awesome-copilot-Katalog ist opt-in** — er wird hier NICHT
   heruntergeladen. Zum Herunterladen nutze `gru init --awesome-copilot`.

Im Monorepo-Kontext (Source-Checkout) delegiert er an die Verifikation des Cybersec-Harness
statt an den globalen Bootstrap.

---

## Befehle

```bash
gru "<prompt>"                       # orchestriert eine Aufgabe: klassifizieren → routen → ausführen
gru status                           # echter Provider-Status (Alias: doctor, /status)
gru --agentic "<prompt>"             # agentische Pipeline: executor → reviewer → tester + Gates
gru --agentic "<prompt>" --phase apply --sdd meine-aenderung
gru init [Optionen]                  # Multi-Runtime-Scaffolding (siehe unten)
```

`gru` ohne Argumente auszuführen zeigt die Nutzungshilfe an.

### `gru "<prompt>"`

Orchestriert eine Aufgabe von Anfang bis Ende:

```text
1. classifyTask()      → Level 0-4 + Risikosignale (zweisprachig ES/EN)
2. Freigabe-Gate       → bei Risiko: „Ausführung freigeben? (ja/NEIN)"
3. routeTask()         → wählt den Provider per Keywords (gentlePi, ecc, engram...)
4. Devil's Advocate    → Pre-Flight-Veto (Provider fehlt, Katalog als Executor)
5. Echter Health-Check → wenn der Provider nicht installiert ist: BLOCKED + wie installieren
6. Echte Ausführung    → Ergebnis + auditierbares Log in runs/run_*.json
```

**Menschliches Freigabe-Gate**

- In einem interaktiven Terminal: Gru fragt `Ausführung dieser Aufgabe freigeben? (ja/NEIN)`
  und fährt nur mit einem expliziten `ja` fort.
- In CI / non-TTY: Die Aufgabe wird **nicht ausgeführt** und der Prozess endet mit
  **Exit-Code 2**.
- „ist schon freigegeben" oder „ist nur ein Test" im Prompt zu schreiben **zählt nicht als
  Freigabe** — das Gate akzeptiert nur den expliziten Kanal.
- Jede Ausführung wird in `runs/run_*.json` protokolliert mit Klassifizierung, Level,
  Provider, Befehl, Exit-Code und ob eine menschliche Freigabe vorlag.

**Provider-Fallback**: Wenn der gewählte Provider nicht verfügbar ist, aber installierte
Alternativen existieren, bietet Gru in TTY an, eine zu wählen. In non-TTY: Exit-Code 2,
nichts wird simuliert.

### `gru status`

Gibt eine Tabelle mit dem ECHTEN Status jedes Connectors aus (Alias: `doctor`, `/status`,
`/doctor`). Jede Zeile zeigt Provider, kind, Status, Executable, Version und Grund.

| Status | Bedeutung |
| :--- | :--- |
| `READY` | Provider verfügbar und verifiziert |
| `CONFIGURADO` | verfügbar über Konfiguration (`status: configured`) |
| `MISSING` | erforderlich, aber nicht installiert → erscheint unter „Erforderliche Aktionen" |
| `INCOMPATIBLE` | installiert, aber inkompatible Version |
| `DISABLED (opcional)` | `enabled: false` in `providers.yaml` (informativ) |
| `HOST-MANAGED (PENDIENTE)` | SDK-Provider, dessen Host-Adapter noch nicht aktiv ist |
| `OPCIONAL (no configurado)` | optionaler SDK-Provider, nicht konfiguriert |
| `CATÁLOGO AUSENTE` | Katalog (awesomeCopilot) nicht geklont |

Nur wirklich erforderlich-aber-fehlende Provider erscheinen unter „Erforderliche Aktionen".
Die `DISABLED`, `HOST-MANAGED (PENDIENTE)` und `OPCIONAL` sind informativ und werden ausgeschlossen.

```bash
gru status --strict     # CI: Exit-Code 2, wenn ein erforderlicher Provider fehlt
```

### `gru --agentic`

Agentische Pipeline mit Gates: executor → reviewer → tester. Gibt `APROBADO ✓` oder
`RECHAZADO ✗`, die Blocker und den Status jedes Gates aus. Wird nicht freigegeben → Exit-Code 2.

```bash
gru --agentic "<prompt>"
gru --agentic "<prompt>" --phase apply --sdd meine-aenderung
```

- `--phase <phase>`: SDD-Phase (Standard `apply`).
- `--sdd <id>`: ID der SDD-Änderung (Standard `current`).

---

## `gru init` — vollständige Referenz

Scaffoldet die Harness-Dateien in ein Projekt. Multi-Runtime: schreibt **nur** die Dateien
des/der gewählten Runtime(s), plus die gemeinsamen Dateien.

```bash
gru init                                   # interaktives Menü: Runtime(s) + Scope
gru init --runtime claude,cursor           # ohne nach Runtime zu fragen
gru init --runtime all --scope project     # alle Runtimes in diesem Repo
gru init --awesome-copilot                 # lädt zusätzlich den Skills-Katalog herunter
```

### Flags

| Flag | Werte | Wirkung |
| :--- | :--- | :--- |
| `--runtime` | `claude,codex,gemini,opencode,cursor,antigravity` (CSV) oder `all` | Zu scaffoldende Runtimes. Standard non-TTY: `claude`. Standard TTY: Multi-Select-Menü. |
| `--scope` | `project` \| `global` | `project` schreibt nach `<cwd>/.gru/` und `<cwd>/`; `global` nur nach `~/.gru/`. Standard non-TTY: `project`. Wenn `<cwd>/.gru/` bereits existiert, wird `project` abgeleitet. |
| `--force` | — | Überschreibt vorhandene Dateien. Speichert vorher ein `.bak`. In TTY listet es die Dateien auf und verlangt eine Bestätigung durch Tippen von `yes`. |
| `--awesome-copilot` / `--skills` | — | Lädt den awesome-copilot-Katalog (~100MB) nach `~/.gru/awesome-copilot`. Opt-in. |

`gru init` erneut auszuführen ist idempotent: vorhandene Dateien werden übersprungen, außer
mit `--force`. Wird `--awesome-copilot` nicht übergeben und gibt es ein TTY, fragt es nach
(Standard Nein).

### Was jedes Runtime scaffoldet

| Runtime | Dateien |
| :--- | :--- |
| **claude** | `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/agents/cybersec/*`, `.claude/skills/*` (cybersec-audit, redteam-attack, blueteam-defense, threat-modeling, purple-loop), `.atl/skill-registry.md` |
| **codex** | `.codex/AGENTS.md`, `AGENTS.md` (Wurzel), `.codex/agents/cybersec/*.toml` |
| **gemini** | `.gemini/GEMINI.md`, `.gemini/agents/cybersec/*.md` |
| **opencode** | `.config/opencode/AGENTS.md`, `.config/opencode/opencode.json` |
| **cursor** | `.cursor/rules/gru.mdc`, `AGENTS.md` (Wurzel) |
| **antigravity** | `AGENTS.md` (Wurzel) |
| **Gemeinsam (immer)** | `.gru/config.yaml`, `.gru/providers.yaml`, `.gru/skills.yaml`, `minion-contract.md`, `cybersec-minion-contract.md`, `.mcp.json` |

Die `AGENTS.md` in der Wurzel teilen sich codex/cursor/antigravity: sie wird pro Ziel
dedupliziert (nur einmal geschrieben). Mit `--scope global` werden die als project-only
markierten Dateien (Verträge, `.mcp.json`, Runtime-Dateien) nicht geschrieben; nur die
gemeinsamen `.gru/*` werden nach `~/.gru/` angelegt.

`.mcp.json` registriert die MCP-Server für **context7** und
**engram**. Passe `ENGRAM_BIN` an deinen lokalen Pfad an.

---

## Providers / Connectors

Gru produziert keine Artefakte: es delegiert an spezialisierte Provider. Der Katalog:

| Provider ID | Executable / Befehl | Rolle | Extern | Installationshinweis |
| :--- | :--- | :--- | :--- | :--- |
| **local** | direkter Befehl | Lokale Workspace-Aufgaben (filesystem, git, npm, tests). | nein | — |
| **gentlePi** | `gentle-ai`/`pi` | SDD/OpenSpec-Spezifikation und diszipliniertes TDD. | ja | `pi install npm:gentle-pi` (benötigt `pi`) |
| **gentlemanCli** | `gentle-ai` | Umgebungsdiagnose, Skill-Updates und Sync. | ja | offizieller Installer (macOS/Linux); Windows: manuell oder WSL |
| **ecc** | `ecc` | Sicherheitsaudit, Policies und CVE-Erkennung. | ja | `pnpm add -D ecc-universal` |
| **deepagents** | eigener Adapter | Langlaufende persistente Workflows mit Checkpoints. | ja | setze `GRU_DEEPAGENTS_ENTRY` auf deinen Adapter |
| **engram** | `engram` | Persistente Memory für Entscheidungen und Kontext. | ja | `pi install npm:gentle-engram` oder setze `ENGRAM_BIN` |
| **awesomeCopilot** | lokaler Katalog | Suche nach Community-Skills (`SKILL.md`). **Nur Katalog: führt nie aus.** | ja | `gru init --awesome-copilot` oder setze `GRU_AWESOME_COPILOT_PATH` |

**Striktes Runtime**: Gru **simuliert nie Antworten**. Wenn ein benötigter Provider nicht
installiert ist, blockiert es die Aufgabe (`[BLOCKED]`) und zeigt den genauen Hinweis zur
Installation. Siehe [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

**awesome-copilot ist search-only**: Das Harness durchsucht den Katalog und **liest nur die
passende `SKILL.md`** — es führt den Katalog nie als Provider aus.

### Echte Routing-Beispiele

| Prompt | Level | Fragt? | Provider |
| :--- | :--- | :--- | :--- |
| `generiere das openspec-sdd für die neue API` | 0 | nein | gentlePi |
| `merke dir, dass wir JWT ohne Sessions verwenden` | 0 | nein | engram |
| `suche im Katalog eine Code-Review-Skill` | 0 | nein | awesomeCopilot |
| `auditiere die Sicherheit und prüfe CVEs` | 2 | **ja** | ecc |
| `lösche die Produktionsdatenbank` | 4 | **ja** | blockiert ohne Freigabe |

---

## Devil's Advocate — Strenge-Stufen

Der Devil's Advocate prüft jede Delegation, bevor der Provider läuft. Er hat **harte Regeln**
(blockieren immer) und eine **weiche Regel** (Routing-Konfidenz, konfigurierbar).

### Harte Regeln — immer aktiv, unabhängig vom Level

| Regel | Wirkung |
| :--- | :--- |
| Provider nicht verfügbar | BLOCKED — Gru simuliert nie Ausführungen. |
| Provider vom Typ `catalog` mit Ausführungsabsicht | BLOCKED — Kataloge sind search-only. |

### Weiche Regel — gesteuert durch `devil.rigidity`

| Stufe | Verhalten |
| :--- | :--- |
| `advisory` | Warnt oder blockiert nie bei niedriger Konfidenz. Nur harte Regeln aktiv. |
| `strict` | **(STANDARD)** Warnt, wenn Konfidenz < `minConfidence` (Standard 30%). Blockiert nie wegen Konfidenz. Reproduziert das bisherige Verhalten exakt — eine fehlende Config ist identisch. |
| `paranoid` | Warnt, wenn Konfidenz < `max(minConfidence, 60)`; **BLOCKIERT**, wenn Konfidenz < `minConfidence`. Die Nachricht verlangt, den Provider explizit zu bestätigen. |

### Konfiguration in `.gru/config.yaml`

```yaml
devil:
  rigidity: strict        # advisory | strict | paranoid (Standard: strict)
  minConfidence: 30       # Konfidenzschwelle % (Standard: 30)
```

Fehlende Config oder fehlender `devil`-Abschnitt = `strict`-Verhalten mit `minConfidence 30`
(volle Rückwärtskompatibilität).

---

## Umgebungsvariablen

| Variable | Wofür |
| :--- | :--- |
| `GRU_CONFIG_DIR` | alternativer Pfad zum Konfigurationsverzeichnis (Standard `~/.gru` oder `<cwd>/.gru`) |
| `GRU_RUNS_DIR` | alternativer Pfad für die Ausführungs-Logs (`runs/run_*.json`) |
| `ENGRAM_BIN` | Pfad zum Engram-Binary, falls nicht im `PATH` |
| `GRU_AWESOME_COPILOT_PATH` | alternativer Pfad zum awesome-copilot-Katalog |
| `GRU_DEEPAGENTS_ENTRY` | Pfad zum ausführbaren deepagents-Adapter (`node adapter.mjs run "prompt"`) |
| `GRU_POSTINSTALL_CONTEXT` | `dev` \| `global` — erzwingt den postinstall-Kontext (Testing) |

---

## Harness-Abstraktion

Gru läuft in verschiedenen Umgebungen, ohne Modelle oder Provider hart zu codieren:

- **`host-managed`**: Das aktive Harness (Claude Code, Codex, Gemini, Pi) verwaltet das
  Modell und die Tools nativ.
- **`sdk-managed`**: Standalone-Modus; verbindet sich über Umgebungsvariablen mit einer LLM-API.

Jede Umgebung deklariert ihre Fähigkeiten (`native-subagents`, `file-tools`, `web-search`,
`code-execution`, `memory`, `approval-flow`) über den `HarnessAdapter`-Vertrag. Aufgaben ab
Level ≥ 3 erfordern `native-subagents`; wenn das Harness es nicht unterstützt, werden sie blockiert.

---

## Workflows nach Level

Aufgaben werden von Level 0 (trivial) bis Level 4 (kritisch) nach Komplexität + Risiko
klassifiziert. Jedes Level definiert, welche Provider/Rollen beteiligt sind:

```text
Level 0  local
Level 1  local → leichte Validierung
Level 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
Level 3  scan → gentlePi (SDD) → devil → local → tests → ecc → engram
Level 4  alles oben + doppelte menschliche Freigabe
```

Regeln, die das Harness von selbst anwendet:

- **Pflicht-Skill-Check**: vor jeder Aufgabe sucht es eine lokale Skill; existiert keine,
  fragt es den awesome-copilot-Katalog ab (search-only).
- **Pflicht-Delegation**: 4+ Dateien lesen, in 2+ Dateien schreiben oder lange Sessions →
  Sub-Agent, keine monolithische Arbeit.
- **Pflicht-Reviewer** vor commit/push.
- **Personas**: `caveman` komprimiert die Konversation (nie die Artefakte: JSON/YAML/Code
  bleiben intakt) und `devilsAdvocate` hinterfragt und kann Delegationen mit Veto belegen.

---

## Tests

```bash
pnpm test                                          # vollständige Suite
pnpm vitest run tests/guardrails.stress.test.ts    # nur Guardrail-Stress-Tests
```

Die Guardrails-Suite prüft, dass der Orchestrator nicht aus der Reihe tanzt: destruktive
ES/EN-Prompts, adversariale Prompts (Injection, Dringlichkeit, „mein Chef hat schon
freigegeben"), in langen Prompts vergrabenes Risiko, False Positives und der Vertrag des
`StrictHarnessController`.

---

## Fehlerbehebung

| Symptom | Ursache | Lösung |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | das Binary ist nicht installiert | folge dem Hinweis in der Nachricht (siehe Provider-Tabelle) |
| `[APROBACIÓN REQUERIDA] Nivel N` | die Aufgabe berührt echtes Risiko | antworte `si` zum Freigeben, oder brich ab |
| Exit-Code 2 in CI | Freigabe-Gate oder fehlender Provider im strikten Modus | korrektes Verhalten: das strikte Runtime simuliert nie |
| `gru status` markiert engram als `MISSING` | Binary außerhalb des `PATH` | setze `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | der Katalog-Clone fehlt | `gru init --awesome-copilot` (oder setze `GRU_AWESOME_COPILOT_PATH`) |

Mehr Details: [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md) ·
[docs/harness-reference.md](../../docs/harness-reference.md)

---

## Entwicklung / Beitragen

Das Paket `@adrichdev/gru-harness` liegt in einem pnpm-Monorepo und ist **privat** (nicht im
öffentlichen npm-Registry veröffentlicht; per Git-Install verteilt). Um am Code zu arbeiten,
klone das Repo, `pnpm install`, und nutze `pnpm gru ...` (via `tsx`). Details im privaten
Repository: <https://github.com/AdrichDev/gru_orchestrator>.
