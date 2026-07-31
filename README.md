# JMeter Copilot

A VS Code extension for running JMeter test plans from the editor and inspecting recent outcomes from the workspace.

## Key features
- Run a selected .jmx plan from the command palette or explorer context menu
- Inspect recent runs and failures from the dedicated views
- Use Copilot-facing tools to list tests, run plans, and inspect sample failures

## Prerequisites
- JMeter installed and available on PATH or configured through the extension settings
- Java installed
- VS Code 1.95+

## Installation
1. Build or package the extension into a VSIX.
2. Install the VSIX in VS Code.
3. Open a .jmx file and run the JMeter commands.

## Settings
- jmeter.executablePath: explicit JMeter executable path
- jmeter.jmeterHome: JMeter home directory
- jmeter.javaPath: Java executable path
- jmeter.maxResponseBytes: cap for response capture
- jmeter.captureResponseData: enable or disable full response capture
- jmeter.resultsDirectory: directory for run artifacts

## Notes
- The extension writes JMeter run artifacts under a results directory and captures basic properties for execution.
- On Windows, batch launchers may require a shell-compatible execution path.
