# Public Rebuild Prompt Pack (Clean-Room)

Use this file to rebuild the extension as a standalone clean-room project.

--------------------------------------------------------------------------------

## 0) Operating Rules For The Coding Agent

Copy these rules at the top of every prompt you send:

1. Build from scratch in a new folder. Do not copy from any existing repo.
2. No interactive questions. Choose sane defaults automatically.
3. Keep content organization-neutral: no organization-specific URLs, private registries, or company names.
4. Must compile on Node 20+ with TypeScript strict mode.
5. Must package as VS Code extension (.vsix) using vsce.
6. Keep behavior deterministic and match requirements exactly.
7. If a command fails, auto-fix and continue until all checks pass.

Default assumptions if not provided by user:
- extension id prefix: jmeter
- package name: jmeter-copilot
- publisher: replace-me
- version: 0.1.0
- license: MIT

--------------------------------------------------------------------------------

## 1) Recommended: Staged Prompt Flow (Lower Token Per Run)

Run these prompts in order. They are designed to avoid large context windows.

### Stage 1 Prompt (Scaffold + Manifest)

You are creating a VS Code extension project from scratch.

Create this structure:
- package.json
- tsconfig.json
- esbuild.js
- .gitignore
- .vscodeignore
- README.md
- media/jmeter.svg
- examples/sample.jmx
- src/extension.ts
- src/commands.ts
- src/runController.ts
- src/statusBar.ts
- src/chat/participant.ts
- src/jmeter/locator.ts
- src/jmeter/spawnJmeter.ts
- src/jmeter/runner.ts
- src/jmeter/jtlParser.ts
- src/model/types.ts
- src/model/runStore.ts
- src/model/recentRuns.ts
- src/tools/index.ts
- src/tools/runJmeterTest.ts
- src/tools/getJmeterFailures.ts
- src/tools/getJmeterSampleDetail.ts
- src/tools/listJmeterTests.ts
- src/tools/format.ts
- src/util/jmxResolver.ts
- src/view/testPlansTree.ts
- src/view/recentRunsTree.ts
- src/view/resultsPanel.ts

Use these package settings:
- engines.vscode: ^1.95.0
- main: ./dist/extension.js
- scripts:
  - check-types: tsc --noEmit
  - compile: npm run check-types && node esbuild.js
  - watch:esbuild: node esbuild.js --watch
  - watch:tsc: tsc --noEmit --watch --project tsconfig.json
  - package: npm run check-types && node esbuild.js --production
  - vscode:prepublish: npm run package
  - vsix: vsce package --no-dependencies
- dependencies: fast-xml-parser ^4.5.1
- devDependencies:
  - @types/node ^20.19.0
  - @types/vscode ^1.95.0
  - @vscode/vsce ^3.2.1
  - esbuild ^0.24.2
  - typescript ^5.6.3

Contributes section must include:
- languageModelTools:
  - run_jmeter_test
  - get_jmeter_failures
  - get_jmeter_sample_detail
  - list_jmeter_tests
- chat participant id: jmeter.participant with commands run/failures/fix
- activity bar container id: jmeterRunner (title JMeter)
- views:
  - jmeterTestPlans
  - jmeterRecentRuns
- commands:
  - jmeter.runTest
  - jmeter.runTestPlan
  - jmeter.selectTestPlan
  - jmeter.stop
  - jmeter.clearResults
  - jmeter.refreshTestPlans
  - jmeter.showResults
  - jmeter.clearRecent
  - jmeter.removeRecent
- configuration keys:
  - jmeter.executablePath
  - jmeter.jmeterHome
  - jmeter.javaPath
  - jmeter.maxResponseBytes (100000)
  - jmeter.captureResponseData (true)
  - jmeter.resultsDirectory
  - jmeter.extraProperties ({})

Important menu behavior:
- run command visible on .jmx explorer context
- run/removeRecent hidden in command palette via when:false
- inline run action in both tree views

tsconfig:
- module Node16
- target ES2022
- strict true
- noUnusedLocals true
- noUnusedParameters true
- noImplicitReturns true
- include src
- exclude node_modules, .vscode-test, dist, out

esbuild:
- bundle src/extension.ts to dist/extension.js
- cjs format, platform node, and treat vscode as a non-bundled dependency
- supports --watch and --production
- include build start/finish logs + error location output

Also create:
- .gitignore with node_modules, dist, out, *.vsix, .jmeter-runs, .vscode-test, *.log
- .vscodeignore excluding source/config/dev files from vsix
- MIT-friendly README (short placeholder, will be expanded later)
- simple monochrome beaker/gauge svg icon in media/jmeter.svg
- examples/sample.jmx: offline JSR223 sampler that returns response body containing status=active while assertion expects inactive, so it fails intentionally

Do not run tests yet. Stop after writing files.


### Stage 2 Prompt (Core Runtime + Parser)

Implement core runtime exactly with these behaviors:

A) Data model
- types.ts defines:
  - AssertionResult
  - SampleResult (includes request/response headers + bodies + subResults)
  - RunSummary
  - TestRun

B) Stores
- runStore.ts:
  - in-memory history max 20
  - newest first
  - getRun(runId?) and latest
  - event emitter on change
- recentRuns.ts:
  - persisted in globalState key jmeter.recentRuns
  - max 15 unique by jmxPath
  - fields: jmxPath, lastRunAt, passed, failed, total
  - remove and clear methods

C) JMeter locator
- lookup order:
  1) settings jmeter.executablePath
  2) settings jmeter.jmeterHome/bin/(jmeter.bat or jmeter)
  3) env JMETER_HOME/bin/(launcher)
  4) PATH using where (windows) or which (unix)
- throws clear error if not found
- detectVersion by running launcher with -v

D) Windows spawn hardening (critical)
- On windows, .bat/.cmd must run via shell:true
- Build single command string and quote args that contain spaces/metacharacters
- Provide both async and sync helpers for launcher calls

E) Runner behavior
- run non-gui:
  - -n -t <jmx> -l results.jtl -j jmeter.log -q capture.properties
- one active run at a time
- supports cancellation token and stop()
- stop() uses taskkill /PID /T /F on windows
- result dir:
  - jmeter.resultsDirectory if set
  - else <workspace>/.jmeter-runs
  - else <os.tmpdir>/jmeter-runs

F) Capture properties (critical)
- Never pass save-service options as many -J flags
- Write them to capture.properties and pass with -q
- Two modes:
  - full capture (bodies/headers/assertions/url etc)
  - light capture (assertions only, no large bodies)
- always set output_format=xml and autoflush=true

G) XML parser behavior (critical)
- Use fast-xml-parser with:
  - processEntities:false
  - preserve text nodes
  - arrays for sample/httpSample/assertionResult
- manually decode entities:
  - &lt; &gt; &quot; &apos; numeric decimal/hex and &amp; (amp last)
- parse full JTL and partial JTL
- partial parser must:
  - accept file missing closing testResults tag
  - detect last complete depth-0 sample close
  - append closing testResults
  - never throw during live parsing
- map fields:
  - label from lb
  - responseCode rc
  - responseMessage rm
  - success s
  - elapsed t
  - latency lt
  - timestamp ts
  - thread tn
  - url from java.net.URL first, fallback url
  - method/queryString/cookies/requestHeader/samplerData/responseHeader/responseData
  - assertions list and nested subResults
- truncate bodies to maxResponseBytes and mark bodyTruncated

H) Controller behavior
- states:
  - idle
  - running(file, sampleCount)
  - done(file, summary)
- events:
  - onDidChangeState
  - onDidFinish
  - onDidUpdateSamples
- run() uses vscode progress notification and supports cancellation
- live poll every 1s after onStart(jtlPath)
- for files >15 MB during live mode, do not full-parse each second; fallback to closing tag count

After implementation run:
- npm install
- npm run check-types
Fix all TypeScript errors before stopping.


### Stage 3 Prompt (Views + Commands + LM Tools + Chat)

Implement UI and Copilot integration.

A) Test Plans tree
- list all workspace .jmx files
- exclude: node_modules, .git, .jmeter-runs, dist, out
- sorted path order
- click item should load plan only (command jmeter.selectTestPlan)
- inline run icon triggers jmeter.runTestPlan

B) Recent Runs tree
- source from persisted recent store
- item description:
  - pass/fail summary + relative time
  - show file-not-found if missing on disk
- click loads plan only
- inline run and remove context action

C) Results panel webview
- open beside editor (ViewColumn.Beside)
- layout:
  - toolbar: Start, Stop, Clear, current file, status
  - left tree: pass/fail markers and response code
  - right tabs: Sampler result, Request, Response data
- message protocol:
  - running
  - live
  - results
  - plan
  - current
  - clear
- Start button:
  - run current selected plan if present
  - otherwise trigger jmeter.runTest picker
- Stop button: jmeter.stop
- Clear button: clear run store and panel
- selecting a tree row updates detail tabs

D) Open behavior
- Opening a .jmx file in editor must NOT auto-run
- It should only set current plan quietly for Start target

E) Status bar
- running: spinner + sample count + click to stop
- done pass: pass summary + click show results
- done fail: failed count + click show results + error background
- idle: beaker + click run

F) Commands
Implement and register:
- jmeter.runTest
- jmeter.runTestPlan
- jmeter.selectTestPlan
- jmeter.stop
- jmeter.clearResults
- jmeter.refreshTestPlans
- jmeter.showResults
- jmeter.clearRecent
- jmeter.removeRecent

runTest behavior:
- use explicit URI if provided
- else pick resolver flow:
  1) active .jmx
  2) only file in workspace
  3) quickpick from found .jmx
  4) open-file dialog
- all errors go to output channel and showErrorMessage

G) LM tools
- register in tools/index.ts:
  - run_jmeter_test
  - get_jmeter_failures
  - get_jmeter_sample_detail
  - list_jmeter_tests
- run tool:
  - prepareInvocation with plan name and confirmation message
  - execute controller.run and return summary text
- failures tool:
  - run lookup by runId or latest
  - return formatted details for failing samples only
- sample detail tool:
  - exact label match
  - include available labels in error if not found
- list tool:
  - list absolute .jmx paths sorted

H) @jmeter chat participant
- commands:
  - /run
  - /failures
  - /fix
- /run resolves jmx from prompt token ending in .jmx or default resolver
- /failures prints full detail blocks for each failed sample
- /fix sends compact failure context to current model and streams suggestions

I) Activation wiring in extension.ts
- create output channel
- create runner, store, controller
- create tree views
- create recent store/provider
- create results panel
- create status bar
- register commands, tools, chat participant
- filesystem watcher on **/*.jmx create/delete refreshes plans
- on active editor change: if .jmx then setCurrentPlanQuiet

After implementation run:
- npm run compile
- fix all issues


### Stage 4 Prompt (Public Packaging + Verification)

Finalize for public-safe release.

1) Ensure there is no organization-specific string in any source/config:
- organization-specific hostnames
- private registry domains
- company or team identifiers
- user-specific machine paths
- environment-specific secrets or tokens

2) package.json must be public-ready:
- publisher: replace-me (or passed value)
- private: false or removed
- license: MIT
- keep extension contributions intact

3) Remove private registry config:
- do not include a custom .npmrc registry unless explicitly intended

4) README must include:
- problem solved
- key features
- prerequisites (JMeter + Java + VS Code)
- install from vsix
- usage steps
- settings table
- architecture summary
- known gotchas section (windows batch spawn, -q properties, entity decoding)

5) Run final checks:
- npm install
- npm run check-types
- npm run compile
- npm run vsix

6) Provide final output summary with:
- list of created files
- commands run
- vsix filename
- any assumptions made

Stop only after all checks pass.