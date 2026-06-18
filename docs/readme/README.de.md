<div align="center">

```text
                 .-"""""-.
                /  _   _  \
               |  (O) (O)  |
               |     >     |        G R U   H A R N E S S
               |   \___/   |   ─────────────────────────────
                \  '---'  /     orchestrator · globally installable
            .----'._____.'----.        gru init → pick your runtime
           /   _             _  \
          |   | |  G R U    | |  |
```

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

<div align="center">

🇪🇸 [**Español**](../../README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](README.de.md)

</div>

---

## 🚀 Installation & Setup

Befolgen Sie diese Schritte, um die Entwicklungsumgebung von **Gru Harness** zu klonen und zu installieren:

### 1. Repository klonen
```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. Projekt-Abhängigkeiten installieren
Dieses Projekt ist ein Monorepo, das mit **pnpm** verwaltet wird:
```bash
pnpm install
```

### 3. Erforderliche globale Providers installieren
Wenn Sie nicht über die für die Orchestrierung erforderlichen externen Binärdateien verfügen, installieren Sie diese durch Ausführen von:

* **ruflo** (Multi-Agenten-Erstellung und -Orchestrierung):
  ```bash
  npm install -g ruflo
  ```
* **gentlePi / gentlemanCli** (Spezifikation, SDD und Umgebung):
  ```bash
  npm install -g @gentle-ai/pi
  ```
* **engram** (Semantischer und persistenter Speicher):
  Installieren Sie die Binärdatei aus ihrem offiziellen Kanal und stellen Sie sicher, dass sie in Ihrer `PATH`-Umgebungsvariable verfügbar oder in `ENGRAM_BIN` konfiguriert ist.

---

## 🧠 Was ist Gru Harness?

Gru ist ein Orchestrator und Architekt, der entwickelt wurde, um die Entscheidungsfindung zu zentralisieren, Risiken zu bewerten und Sub-Agenten (Minions) für die Softwareentwicklung zu koordinieren.

### Kernprinzipien
* **Gru codiert nicht direkt**: Gru analysiert die Struktur, entwirft Pläne in `implementation_plan.md` und delegiert das Schreiben des Produkts an spezialisierte Minions.
* **Dateisystem-Scan**: Vor jeder Design-Entscheidung oder Klassifizierung einer Aufgabe wird eine Repository-Analyse durchgeführt, um Abhängigkeiten und Risiken abzubilden.
* **Stufenbasierte Workflows**: Aufgaben werden von Stufe 0 (trivial) bis Stufe 4 (kritisch) klassifiziert, wobei je nach Risikostufe spezifische Genehmigungsprozesse angewendet werden.

---

## 🎛️ Abstraktion der Harness-Laufzeit (Harness Runtime Abstraction)

Gru verwendet eine Abstraktionsschicht, um in verschiedenen Ausführungsumgebungen (*Harnesses*) ausgeführt zu werden, ohne LLM-Modelle oder -Anbieter fest in seinem Kern zu verdrahten.

### Ausführungsmodi
* **`host-managed`** (Vom Host verwaltet): Das aktive Harness (Claude Code, Codex, Gemini, Pi) verwaltet das native Modell und die Ausführung der Tools direkt. Für das LLM wird keine sekundäre SDK-Verbindung geöffnet.
* **`sdk-managed`** (Vom SDK verwaltet): Autonomer Ausführungsmodus (`standalone`). Stellt über konfigurierte Umgebungsvariablen (`GRU_DEEPAGENTS_PROVIDER`, `GRU_DEEPAGENTS_API_KEY_ENV` usw.) eine direkte Verbindung zur API eines LLM-Anbieters her.

### Ausführungsablauf
```text
pnpm gru "prompt"
        ↓
HarnessDetector.detect()            ← Identifiziert die aktive Laufzeitumgebung
        ↓
AdapterRegistry.get(harnessId)      ← Löst den entsprechenden HarnessAdapter auf
        ↓
adapter.supports(requiredCapability)?
   ├── Ja  → adapter.execute(task)     ← Für die Umgebung optimierte native Ausführung
   └── Nein → fallbackSequentially()    ← Sequenzieller Ausweichmodus von Gru Core
        ↓
GruResult → Systemkonsole
```

### Kapazitätsmatrix (`GruCapability`)
Jede Ausführungsumgebung deklariert über den `HarnessAdapter`-Vertrag dynamisch, welche Funktionen sie unterstützt:
* **`native-subagents`**: Die Fähigkeit der Umgebung, Sub-Agenten nativ zu starten, ohne Token-Kapazität aus dem Hauptprozess zu verbrauchen (z. B. Claude Code).
* **`file-tools`**: Integrierte Werkzeuge zum Lesen und Schreiben von Dateien.
* **`web-search`**: Vom Host bereitgestellte Internetsuche oder Web-Navigation.
* **`code-execution`**: Code-Ausführungs-Sandbox oder sichere Laufzeitumgebung.
* **`memory`**: Langfristige Kontext- und Speicherpersistenz.
* **`approval-flow`**: Interaktive Abfrage-Abläufe zum Anfordern und Erteilen von Berechtigungen.

### Kanonische Synchronisation (`pnpm gru sync`)
Gru verwaltet Regeln, Workflows und Skills zentral in seiner nativen Struktur. Beim Ausführen des Synchronisationsbefehls:
1. Liest das System aus `gru/skills/`, `gru/workflows/` und `gru/policies/`.
2. Kompiliert und verteilt es diese idempotent in die Harness-spezifischen Verzeichnisse: `.claude/`, `.codex/`, `.gemini/` und `.pi/`.
3. Das System zeigt ein Diff der vorgeschlagenen Änderungen an, bevor es Dateien überschreibt, und schützt manuelle Bearbeitungen, sofern nicht das Flag `--force` verwendet wird.

---

## 🔌 Providers-Katalog

Gru verwendet eine modulare Architektur basierend auf **Providers**, um mit der Umgebung zu interagieren und delegierte Aufgaben auszuführen:

| Provider-ID | Ausführbare Datei / Befehl | Rolle & Verantwortung |
| :--- | :--- | :--- |
| **`local`** | Direkter Befehl | Ausführung lokaler Aufgaben im Arbeitsbereich (Dateisystem, Git, npm, Tests). |
| **`ruflo`** | `ruflo` | Multi-Agenten-Orchestrator für komplexe Aufgaben und parallele Minion-Swarms. |
| **`gentlePi`** | `gentle-ai/pi` | Unterstützung und Tools für die Systemspezifikation unter der SDD/OpenSpec-Methodik. |
| **`gentlemanCli`** | `gentle-ai` | Umgebungsdiagnose, Skill-Updates und Statussynchronisation. |
| **`ecc`** | `ecc` | Sicherheitsrichtlinien-Audit, Codeanalyse und CVE-Schwachstellen-Erkennung. |
| **`deepagents`** | `deepagents` | Langfristige Workflows und persistente Aufgaben-Threads. |
| **`engram`** | `engram` | Zugriff auf den persistenten Speicher von Entscheidungen und den historischen Kontext des Projekts. |
| **`awesomeCopilot`** | Lokaler Katalog | Suche nach Skills (`SKILL.md`) und Vorlagen im Community-Repository. |
