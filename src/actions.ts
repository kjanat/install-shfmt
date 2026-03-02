/**
 * Minimal GitHub Actions runtime helpers.
 *
 * Replaces @actions/core to avoid pulling in @actions/http-client + undici
 * (~400KB) as transitive dependencies.
 *
 * Protocol: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions
 */

import { appendFileSync, existsSync } from "node:fs";
import { EOL } from "node:os";
import { delimiter } from "node:path";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

/** Read an action input from the environment. */
export function getInput(name: string): string {
	return (
		process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? ""
	).trim();
}

/** Write an action output via $GITHUB_OUTPUT. */
export function setOutput(name: string, value: unknown): void {
	const str = typeof value === "string" ? value : JSON.stringify(value);
	const filePath = process.env["GITHUB_OUTPUT"];

	if (filePath && existsSync(filePath)) {
		const delim = `ghadelimiter_${randomUUID()}`;
		appendFileSync(filePath, `${name}<<${delim}${EOL}${str}${EOL}${delim}${EOL}`, "utf8");
	} else {
		// Fallback: workflow command (deprecated but works in all runners)
		process.stdout.write(`::set-output name=${name}::${str}${EOL}`);
	}
}

// ---------------------------------------------------------------------------
// PATH
// ---------------------------------------------------------------------------

/** Prepend a directory to $PATH for this and subsequent steps. */
export function addPath(inputPath: string): void {
	const filePath = process.env["GITHUB_PATH"];

	if (filePath && existsSync(filePath)) {
		appendFileSync(filePath, `${inputPath}${EOL}`, "utf8");
	} else {
		process.stdout.write(`::add-path::${inputPath}${EOL}`);
	}

	process.env["PATH"] = `${inputPath}${delimiter}${process.env["PATH"] ?? ""}`;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function escapeData(s: string): string {
	return s
		.replace(/%/g, "%25")
		.replace(/\r/g, "%0D")
		.replace(/\n/g, "%0A");
}

/** Write an info message to the log. */
export function info(message: string): void {
	process.stdout.write(`${message}${EOL}`);
}

/** Set the action status to failed (exit code 1) and emit an error annotation. */
export function setFailed(message: string): void {
	process.exitCode = 1;
	process.stdout.write(`::error::${escapeData(message)}${EOL}`);
}
