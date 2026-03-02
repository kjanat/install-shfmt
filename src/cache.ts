import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { arch } from 'node:os';
import { join } from 'node:path';

/**
 * Minimal tool-cache compatible with @actions/tool-cache layout.
 *
 * Layout: $RUNNER_TOOL_CACHE/<tool>/<semver>/<arch>/
 * A sibling `.complete` marker signals the entry is valid.
 *
 * Version strings are cleaned (strip leading "v") to match semver convention
 * used by the official tool-cache.
 */

function cacheRoot(): string {
	const dir = process.env['RUNNER_TOOL_CACHE'];
	if (!dir) throw new Error('RUNNER_TOOL_CACHE is not set');
	return dir;
}

/** Strip leading "v" to match semver-clean behavior. */
function cleanVersion(version: string): string {
	return version.startsWith('v') ? version.slice(1) : version;
}

/**
 * Find a cached tool directory. Returns empty string on miss.
 * Compatible with `@actions/tool-cache.find()`.
 */
export function findCached(tool: string, version: string): string {
	const cleaned = cleanVersion(version);
	const cachePath = join(cacheRoot(), tool, cleaned, arch());

	if (existsSync(cachePath) && existsSync(`${cachePath}.complete`)) {
		return cachePath;
	}
	return '';
}

/**
 * Copy a directory into the tool-cache and mark it complete.
 * Compatible with `@actions/tool-cache.cacheDir()`.
 */
export function cacheDir(
	sourceDir: string,
	tool: string,
	version: string,
): string {
	const cleaned = cleanVersion(version);
	const destPath = join(cacheRoot(), tool, cleaned, arch());

	mkdirSync(destPath, { recursive: true });
	cpSync(sourceDir, destPath, { recursive: true });
	writeFileSync(`${destPath}.complete`, '');

	return destPath;
}
