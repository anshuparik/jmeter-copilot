# Prompt: Add Missing UI/Control Features To Existing JMeter VS Code Extension

You are editing an existing VS Code extension codebase. Do not rebuild from scratch.

Goal: Implement missing runtime/UI features that were omitted in a previous build:
- left sidebar (Activity Bar container + tree views)
- run controls: Start, Stop, Clear
- results panel behavior and command wiring

Do not ask questions. Use the IDs and behavior below exactly.

--------------------------------------------------------------------------------

## 1) Non-Negotiable Acceptance Criteria

The finished extension MUST have all of these:

1. Activity Bar icon named JMeter with two side views:
- Test Plans
- Recent Runs

2. Results panel with toolbar buttons:
- Start
- Stop
- Clear

3. Command wiring:
- Start runs current selected .jmx plan (or opens picker when none selected)
- Stop cancels active run
- Clear clears run history/panel UI

4. Plan selection behavior:
- single-clicking a .jmx in sidebar only selects/loads it
- it MUST NOT auto-run

5. Inline run icons:
- in Test Plans and Recent Runs, inline run button starts run

6. Status bar behavior:
- running state shows spinner + sample count, click stops run
- done state shows pass/fail summary, click opens results
- idle state shows JMeter and click starts run

7. Build checks pass:
- npm run check-types
- npm run compile

--------------------------------------------------------------------------------

## 2) IDs/Names You Must Use Exactly

Use these IDs exactly across code and package.json:

- Views container: `jmeterRunner`
- Test plans view: `jmeterTestPlans`
- Recent runs view: `jmeterRecentRuns`
- Chat participant: `jmeter.participant`

Commands:
- `jmeter.runTest`
- `jmeter.runTestPlan`
- `jmeter.selectTestPlan`
- `jmeter.stop`
- `jmeter.clearResults`
- `jmeter.refreshTestPlans`
- `jmeter.showResults`
- `jmeter.clearRecent`
- `jmeter.removeRecent`

Language model tools:
- `run_jmeter_test`
- `get_jmeter_failures`
- `get_jmeter_sample_detail`
- `list_jmeter_tests`

--------------------------------------------------------------------------------

## 3) Required package.json Contributions

Ensure `contributes` includes all of these:

1. viewsContainers.activitybar:
- id `jmeterRunner`
- title `JMeter`
- icon `media/jmeter.svg`

2. views.jmeterRunner:
- `jmeterTestPlans` with name `Test Plans`
- `jmeterRecentRuns` with name `Recent Runs`

3. viewsWelcome for both views (help text + refresh/run links for test plans)

4. commands list includes all command IDs above

5. menus:
- explorer/context: `jmeter.runTest` for `.jmx`
- view/title: showResults, stop, refreshTestPlans on test plans view; clearRecent on recent view
- view/item/context:
  - inline run for `jmeterTestPlan`
  - inline run for `jmeterRecentRun`
  - removeRecent for recent item context menu
- commandPalette: hide `jmeter.runTestPlan` and `jmeter.removeRecent` with `when: false`

6. activationEvents should include:
- `workspaceContains:**/*.jmx`

7. configuration keys (if missing) under `jmeter.*`:
- executablePath
- jmeterHome
- javaPath
- maxResponseBytes
- captureResponseData
- resultsDirectory
- extraProperties

--------------------------------------------------------------------------------

## 4) Files To Implement Or Fix

Create or update these files as needed:

- `src/extension.ts`
- `src/commands.ts`
- `src/runController.ts`
- `src/statusBar.ts`
- `src/view/testPlansTree.ts`
- `src/view/recentRunsTree.ts`
- `src/view/resultsPanel.ts`
- `src/model/runStore.ts`
- `src/model/recentRuns.ts`
- `src/util/jmxResolver.ts`

If they already exist, patch them; do not delete working functionality.

--------------------------------------------------------------------------------

## 5) Functional Implementation Details

### A) Sidebar / Tree Views

1. Test Plans tree:
- discover workspace `.jmx` files
- exclude `node_modules`, `.git`, `.jmeter-runs`, `dist`, `out`
- sorted list
- click item calls `jmeter.selectTestPlan` (load only)
- inline run calls `jmeter.runTestPlan`

2. Recent Runs tree:
- persist to `context.globalState`
- keep max 15 recent entries, dedupe by path
- show pass/fail summary + relative time
- if file missing, show warning icon and no-load command
- inline run and remove actions

### B) Results Panel (Webview)

Implement a panel similar to JMeter Results Tree:
- opens beside editor (`ViewColumn.Beside`)
- toolbar with Start / Stop / Clear + current file + live status
- left sample tree with success/failure markers
- right tabs:
  - Sampler result
  - Request
  - Response data

Message handling should support:
- `running`
- `live`
- `results`
- `plan`
- `current`
- `clear`

Buttons:
- Start -> run current selected plan; fallback to `jmeter.runTest`
- Stop -> `jmeter.stop`
- Clear -> clear store + panel

### C) Controller + Polling

Controller state machine:
- idle
- running(file, sampleCount)
- done(file, summary)

Required events:
- onDidChangeState
- onDidFinish
- onDidUpdateSamples

Live behavior:
- poll JTL every 1s while running
- update sample count
- parse partial JTL safely
- if JTL > 15MB, avoid full reparse each second and fallback to close-tag count mode

### D) Commands

`jmeter.runTest` resolution order:
1. explicit URI arg
2. active editor `.jmx`
3. single `.jmx` in workspace
4. quick pick from found `.jmx`
5. file-open dialog

`jmeter.runTestPlan`:
- runs selected TestPlanItem or RecentRunItem path

`jmeter.selectTestPlan`:
- updates current plan in panel
- does NOT run

Also implement:
- stop
- clearResults
- refreshTestPlans
- showResults
- clearRecent
- removeRecent

### E) Open Editor Behavior

When user opens a `.jmx` file in editor:
- set that file as current plan quietly
- do not reveal panel automatically
- do not run automatically

### F) Status Bar

Always visible item:
- running: spinner + sample count, click stop
- done pass/fail: summary, click show results
- idle: beaker label, click run

--------------------------------------------------------------------------------

## 6) Keep Existing Features Intact

Do not break these:
- non-GUI JMeter execution pipeline
- LM tools registration
- chat participant commands
- result parsing and detail formatting

--------------------------------------------------------------------------------

## 7) Verification Steps (Must Execute)

Run and fix until all pass:

1. `npm install`
2. `npm run check-types`
3. `npm run compile`

Manual behavior checklist (describe results in output):
1. JMeter icon appears in Activity Bar
2. Test Plans and Recent Runs views appear
3. Selecting plan does not auto-run
4. Inline run starts execution
5. Results panel shows Start/Stop/Clear buttons
6. Stop button cancels active run
7. Clear button clears UI/results
8. Status bar updates across idle/running/done

--------------------------------------------------------------------------------

## 8) Final Response Format

Return:
1. Summary of what was fixed
2. Exact files changed
3. Any key logic decisions
4. Build command outputs summary
5. Manual checklist pass/fail

Stop only when all required features above are implemented and checks pass.