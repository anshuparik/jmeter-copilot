<p align="center">
  <img src="media/banner.png" alt="JMeter Copilot" width="100%" />
</p>

# ⚡ JMeter Copilot

A **Copilot-powered Apache JMeter assistant** for Visual Studio Code. Run JMeter test plans, inspect live and past results, review request/response details, and let Copilot **fix and verify your JMX scripts** — all from the Chat view, the sidebar, or the command palette.

![Version](https://img.shields.io/badge/version-0.1.3-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![VS Code](https://img.shields.io/badge/VS%20Code-1.95%2B-007ACC)

---

## Table of Contents

- [What is this project?](#-what-is-this-project)
- [What problem does it solve?](#-what-problem-does-it-solve)
- [What does it do?](#-what-does-it-do)
- [How we built it](#️-how-we-built-it)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [How it works](#️-how-it-works)
- [Examples](#examples)
- [Copilot Chat commands](#copilot-chat-commands)
- [Copilot tools](#copilot-tools)
- [Settings](#settings)
- [Project structure](#project-structure)
- [Development](#development)
- [License](#license)

---

## 🔍 What is this project?

**JMeter Copilot** is a Visual Studio Code extension that brings the power of Apache JMeter into your editor and connects it to GitHub Copilot. Instead of switching to the JMeter GUI, writing files by hand, and eyeballing `.jtl` result logs, you can:

- Run a `.jmx` test plan with one click or a chat prompt.
- Watch results stream into a dedicated Results panel **while the test runs**.
- Ask Copilot to list tests, run them, show failures, and inspect individual samples.
- Have Copilot **suggest fixes for failing assertions** in your JMX scripts, then re-run and verify.

It is built as a proper VS Code extension (`vscode.lm.registerTool` + `vscode.chat.createChatParticipant`), so Copilot Chat can drive it natively.

---

## 🎯 What problem does it solve?

Running and debugging JMeter performance tests from the command line or GUI is slow and tedious:

| Problem | Solution |
| --- | --- |
| Switching between JMeter GUI and your editor breaks flow | Run tests **right inside VS Code** via a sidebar view, context menu, or Chat |
| `.jtl` XML/CSV result files are hard to read | A dedicated **Results panel** renders samples, headers, bodies, and assertions |
| Failures are buried in logs | The **Failures** view/tool extracts exactly which assertions failed and why |
| Fixing a test means editing XML blindly | Copilot's **fix** flow analyzes failures and suggests concrete changes, then you re-run to verify |
| Remembering command-line flags (`-n -t -l -q`) | The extension handles JMeter invocation, auto-detection, and result parsing for you |
| Running tests repeatedly is manual | Recent Runs keeps a history of every execution with timestamps |

---

## ✨ What does it do?

- **Run JMeter test plans** — from the sidebar (Test Plans view), the explorer context menu, the command palette, or Copilot Chat (`@JMeter /run`).
- **Auto-detect JMeter** — finds `jmeter`/`jmeter.bat` via settings, `JMETER_HOME`, `PATH`, and common install locations.
- **Live results** — polls the JTL file while JMeter runs and streams sample counts into the Results panel.
- **Detailed inspection** — for each sample, view the URL, method, status, elapsed/latency, request & response headers, request body, response body, and assertion results.
- **Recent Runs history** — every execution is recorded with the plan name, timestamp, and pass/fail summary; click any entry to reopen its results.
- **Copilot tools** — `list_jmeter_tests`, `run_jmeter_test`, `get_jmeter_failures`, `get_jmeter_sample_detail` are registered so Copilot can act on your behalf.
- **Copilot Chat participant** — `@JMeter` with `/run`, `/failures`, and `/fix` commands.
- **Stop & Clear** — interrupt a running test, or clear the results and history.

---

## 🏗️ How we built it

- **TypeScript** — the entire extension is written in TypeScript.
- **VS Code Extension API** — webviews (`ResultsPanel`), tree views (`TestPlans`, `RecentRuns`), status bar, commands, and configuration.
- **VS Code Language Model API** — native Copilot integration via `vscode.lm.registerTool` and `vscode.chat.createChatParticipant` (Chat / Copilot Chat).
- **esbuild** — fast bundling for `dist/extension.js`.
- **fast-xml-parser** — robust parsing of JMeter `.jtl` XML result files (with a CSV fallback parser).
- **child_process** — spawns JMeter in non-GUI (`-n`) mode with a configurable properties file, and streams stdout/stderr to the output channel.
- **Apache JMeter 5.6.3** — the execution engine; the extension invokes `jmeter.bat` / `jmeter` in headless mode.

Key source files:

| File | Purpose |
| --- | --- |
| `src/extension.ts` | Activation, wiring of views, events, commands, and tools |
| `src/commands.ts` | All command handlers (`run`, `stop`, `clear`, `removeRecent`, `showRecentRun`, …) |
| `src/runController.ts` | Run state machine (idle / running / done) and JTL polling |
| `src/jmeter/runner.ts` | JMeter invocation, properties file, artifact cleanup, summaries |
| `src/jmeter/locator.ts` | JMeter executable auto-detection |
| `src/jmeter/jtlParser.ts` | XML/CSV `.jtl` parsing into `SampleResult[]` |
| `src/tools/*.ts` | Copilot language-model tools |
| `src/chat/participant.ts` | `@JMeter` chat participant |
| `src/view/resultsPanel.ts` | Webview UI for live results & sample details |

---

## Prerequisites

- **Visual Studio Code** `1.95.0` or later.
- **Apache JMeter 5.x** (e.g. 5.6.3) — the extension auto-detects it, or you can point it at yours (see [Settings](#settings)).
- **Java** (JRE/JDK) — required by JMeter.
- **GitHub Copilot Chat** (optional but recommended) — for the chat participant and tools.

---

## Installation

The extension is distributed as a VSIX. There is no marketplace listing yet — install it directly:

### Option A — From source (recommended for development)

```bash
# 1. Clone
git clone https://github.com/anshuparik/jmeter-copilot.git
cd jmeter-copilot

# 2. Install dependencies
npm install

# 3. Build & package
npm run vsix            # produces jmeter-vscode-copilot-<version>.vsix

# 4. Install the VSIX in VS Code
code --install-extension jmeter-vscode-copilot-0.1.3.vsix --force
```

### Option B — Using a pre-built VSIX

If you have a `.vsix` from a release, simply run:

```bash
code --install-extension jmeter-vscode-copilot-0.1.3.vsix
```

### Option C — From the Extensions view

1. Open the Extensions view (`Ctrl+Shift+X`).
2. Click **⋮ → Install from VSIX…**.
3. Select the `.vsix` file.

After installing, **reload the window** (`Ctrl+Shift+P` → `Developer: Reload Window`).

---

## Getting Started

1. Make sure JMeter is installed (or configure it in settings).
2. Open a workspace that contains your `.jmx` test plans (or open a `.jmx` file).
3. In the **Activity Bar**, click the **⚡ JMeter** icon (sidebar).
4. Under **Test Plans**, click the ▶ play icon next to a plan — or right-click a `.jmx` file in the Explorer and choose **JMeter: Run Test**.
5. The **Results** panel opens in a side editor and streams results live.
6. After completion, use the **Recent Runs** view to reopen any past result.

> If JMeter isn't found automatically, set `jmeter.jmeterHome` or `jmeter.executablePath` in Settings (see below), then reload.

---

## 🖥️ How it works

```
┌─────────────┐    command / chat    ┌──────────────────┐
│ VS Code UI  │ ───────────────────► │  runController   │
│ (sidebar /   │                      │  (state machine) │
│  results /   │ ◄─────────────────── │                  │
│  chat)       │   live updates      └────────┬─────────┘
└─────────────┘                               │ start / stop
                                              ▼
                                      ┌──────────────────┐
                                      │  JMeterRunner    │
                                      │  - locates jmeter │
                                      │  - spawns headless│
                                      │  - -n -t plan.jmx │
                                      │    -l out.jtl     │
                                      │    -q props       │
                                      └────────┬─────────┘
                                               │ writes
                                               ▼
                                      ┌──────────────────┐
                                      │  out.jtl (XML)   │  ◄── polled every 1s
                                      └────────┬─────────┘
                                               │ parse (fast-xml-parser)
                                               ▼
                                      ┌──────────────────┐
                                      │  JtlParser        │
                                      │  → SampleResult[] │
                                      │  → summary        │
                                      └──────────────────┘
```

1. **Resolve the plan** — `jmxResolver` picks the target from the active editor, current selection, or a quick-pick list.
2. **Run** — `JMeterRunner.run()` writes a `capture.properties` file (XML output, headers, assertions, response data) and spawns JMeter in non-GUI mode with `-n -t <plan> -l <jtl> -j <log> -q <props>`.
3. **Stream** — `RunController` polls the JTL every second, parses it, and pushes live summaries + samples to the Results webview.
4. **Complete** — JMeter exits, the final JTL is parsed, and a `TestRun` (summary + samples + paths) is stored and recorded in Recent Runs.
5. **Inspect** — click a sample in the Results panel to see request/response headers, bodies, and assertions.
6. **Fix & verify** — ask Copilot (or use `/fix`) to analyze failures, edit the JMX, then re-run to confirm zero errors.

---

## Examples

### Example 1 — Run a plan from the sidebar

```
Test Plans
└── PerformanceTestPlanMemoryThread.jmx   ▶  (click play)
```

Results panel shows:

```
⚡ Running... 4 samples (1 failed)
```
then after completion:

```
✅ 3/4 passed · 1 failed
```

### Example 2 — Run from the Explorer

Right-click `sample.jmx` → **JMeter: Run Test**. The run starts headlessly; open the **JMeter Copilot** output channel to see JMeter's own logs.

### Example 3 — Copilot Chat

Open **Copilot Chat** and use the `@JMeter` participant:

```
@JMeter /run PerformanceTestPlanMemoryThread.jmx
```

```
🚀 Starting execution of ...\PerformanceTestPlanMemoryThread.jmx...

✅ Run Completed!
- Total Samples: 4
- Passed: 3
- Failed: 1

Use /failures to inspect errors.
```

### Example 4 — Inspect failures and fix

```
@JMeter /failures
```

```
### 🔍 JMeter Failure Details

Sample: /kitchen-sink/http-methods/put
Status: 200 OK
...
Assertions:
  - Assertion (Response Assertion code): Test failed: code expected to contain /211/
```

Then edit the JMX assertion (`211` → `200`), re-run, and the failures tool reports *"No failing samples found."* — the fix is verified.

---

## Copilot Chat commands

The `@JMeter` chat participant understands:

| Command | Description |
| --- | --- |
| `/run [plan.jmx]` | Run a JMeter test plan (optionally by name) |
| `/failures` | Show detailed list of failing samples from the latest run |
| `/fix` | Analyze the latest run's failures and suggest a fix plan |

---

## Copilot tools

Registered via `vscode.lm.registerTool`, so Copilot can call them automatically:

| Tool | Input | Returns |
| --- | --- | --- |
| `list_jmeter_tests` | — | All `.jmx` files discovered in the workspace |
| `run_jmeter_test` | `planPath` | Run summary (total / passed / failed) + run id |
| `get_jmeter_failures` | `runId?` | Detailed failures (assertions, URLs, response snippets) |
| `get_jmeter_sample_detail` | `label`, `runId?` | Full JSON detail for a sample |

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `jmeter.executablePath` | `""` | Absolute path to the JMeter executable |
| `jmeter.jmeterHome` | `""` | JMeter home directory (auto-detected if empty) |
| `jmeter.javaPath` | `""` | Java executable path |
| `jmeter.maxResponseBytes` | `100000` | Maximum response bytes kept per sample |
| `jmeter.captureResponseData` | `true` | Capture response/request headers, bodies & assertions |
| `jmeter.resultsDirectory` | `""` | Directory for run artifacts (defaults to `<workspace>/.jmeter-runs`) |
| `jmeter.extraProperties` | `{}` | Extra JMeter properties passed to the run |

> When empty, JMeter is located via (in order): `jmeter.executablePath` → `jmeter.jmeterHome` → `JMETER_HOME` env var → `PATH` → common install directories.

---

## Project structure

```
jmeter-copilot/
├── media/                  # Extension icons (SVG + PNG)
├── src/
│   ├── chat/               # @JMeter chat participant
│   ├── jmeter/             # Runner, locator, spawn, JTL parser
│   ├── model/              # Types, run store, recent-runs store
│   ├── tools/              # Copilot language-model tools
│   ├── util/               # jmx resolver
│   ├── view/               # Tree views + Results webview panel
│   ├── commands.ts         # Command handlers
│   ├── extension.ts        # Activation entry point
│   └── runController.ts    # Run state machine + polling
├── esbuild.js              # Bundler config
├── package.json            # Manifest (commands, tools, menus, settings)
├── tsconfig.json
└── README.md
```

---

## Development

```bash
npm install
npm run compile       # type-check + bundle (dist/extension.js)
npm run check-types   # tsc --noEmit only
npm run package       # production bundle
npm run vsix          # package into a .vsix
```

Run the extension in the Extension Development Host:

```bash
# From VS Code: Run → Start Debugging (F5)
```

### Building blocks used

- TypeScript 5.x
- VS Code 1.95+ extension API
- esbuild 0.24.x
- fast-xml-parser 4.x

---

## License

MIT — see [LICENSE](LICENSE).

---

Built with ❤️ for Apache JMeter users who want performance testing inside VS Code with Copilot at their side.
