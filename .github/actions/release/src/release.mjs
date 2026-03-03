/** @typedef {import('@actions/github-script').AsyncFunctionArguments} Args */

import { downloadArtifact, resolveEntrypoint } from './artifact.mjs';
import { buildTagInfo, parseCommitMessage } from './parse.mjs';

/**
 * Release pipeline: download dist artifact, commit it, create semver
 * tags (vX.Y.Z annotated + vX.Y / vX lightweight), and push.
 *
 * Reads the Release: trailer from the push-event commit message and
 * the build entrypoint from action.yml in the repo root.
 *
 * @param {Args} args
 */
export default async ({ github, context, core, exec }) => {
	// ── Download dist artifact built by ci job ───────────────────────
	const artifactId = Number(process.env.ARTIFACT_ID);
	await downloadArtifact(github, context, exec, artifactId);
	const entrypoint = resolveEntrypoint();

	// ── Parse and validate before any mutations ──────────────────────
	const msg = context.payload.head_commit?.message ?? '';
	const { version, subject, body } = parseCommitMessage(msg);
	const { tagExact, tagMinor, tagMajor, tagMessage } = buildTagInfo(version, subject, body);

	// ── Commit dist ──────────────────────────────────────────────────
	await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
	await exec.exec('git', [
		'config',
		'user.email',
		'41898282+github-actions[bot]@users.noreply.github.com',
	]);

	await exec.exec('git', ['add', '-f', entrypoint]);
	const { exitCode } = await exec.getExecOutput('git', ['diff', '--cached', '--quiet'], {
		ignoreReturnCode: true,
	});
	if (exitCode !== 0) {
		await exec.exec('git', ['commit', '-m', 'chore(release): rebuild dist']);
	}

	await exec.exec('git', ['pull', '--ff-only', 'origin', 'master']);
	await exec.exec('git', ['push', 'origin', 'master']);

	// ── Create and push tags ─────────────────────────────────────────
	await exec.exec('git', ['tag', '-a', '-m', tagMessage, tagExact]);
	core.info(`Created ${tagExact} (annotated, unsigned)`);

	await exec.exec('git', ['tag', '-f', tagMinor]);
	core.info(`Created ${tagMinor} (lightweight)`);

	await exec.exec('git', ['tag', '-f', tagMajor]);
	core.info(`Created ${tagMajor} (lightweight)`);

	await exec.exec('git', ['push', 'origin', `refs/tags/${tagExact}`]);
	await exec.exec('git', [
		'push',
		'origin',
		'-f',
		`refs/tags/${tagMinor}`,
		`refs/tags/${tagMajor}`,
	]);
};
