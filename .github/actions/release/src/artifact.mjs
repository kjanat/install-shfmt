/** @typedef {import('@actions/github-script').AsyncFunctionArguments} Args */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Download and extract the dist artifact built by the CI job.
 *
 * @param {Args["github"]} github
 * @param {Args["context"]} context
 * @param {Args["exec"]} exec
 * @param {number} artifactId
 */
export async function downloadArtifact(github, context, exec, artifactId) {
	const zip = await github.rest.actions.downloadArtifact({
		owner: context.repo.owner,
		repo: context.repo.repo,
		artifact_id: artifactId,
		archive_format: 'zip',
	});
	const zipPath = join(process.cwd(), 'dist-artifact.zip');
	writeFileSync(zipPath, Buffer.from(/** @type {ArrayBuffer} */ (zip.data)));
	await exec.exec('unzip', ['-o', zipPath, '-d', 'dist']);
	unlinkSync(zipPath);
}

/**
 * Read the build entrypoint from the root `action.yml` (`runs.main`).
 * Throws if not found or if the referenced file doesn't exist on disk.
 *
 * @returns {string}
 */
export function resolveEntrypoint() {
	const actionYml = readFileSync('action.yml', 'utf8');
	const mainMatch = actionYml.match(/^\s*main:\s*(.+)$/m);
	const entrypoint = mainMatch?.[1]?.trim();
	if (!entrypoint) throw new Error('No runs.main in action.yml');
	if (!existsSync(entrypoint)) throw new Error(`Build artifact missing: ${entrypoint}`);
	return entrypoint;
}
