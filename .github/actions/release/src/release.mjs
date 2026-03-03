// @ts-check
/** @typedef {import('@actions/github-script').AsyncFunctionArguments} Args */

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
	const fs = await import('node:fs');
	const path = await import('node:path');

	/**
	 * @param {string} message
	 * @returns {never}
	 */
	function fail(message) {
		core.setFailed(message);
		throw new Error(message);
	}

	// ── Download dist artifact built by ci job ───────────────────────
	const artifactId = Number(process.env.ARTIFACT_ID);
	const zip = await github.rest.actions.downloadArtifact({
		owner: context.repo.owner,
		repo: context.repo.repo,
		artifact_id: artifactId,
		archive_format: 'zip',
	});
	const zipPath = path.join(process.cwd(), 'dist-artifact.zip');
	fs.writeFileSync(zipPath, Buffer.from(/** @type {ArrayBuffer} */ (zip.data)));
	await exec.exec('unzip', ['-o', zipPath, '-d', 'dist']);
	fs.unlinkSync(zipPath);

	// ── Resolve build entrypoint from action.yml ─────────────────────
	const actionYml = fs.readFileSync('action.yml', 'utf8');
	const mainMatch = actionYml.match(/^\s*main:\s*(.+)$/m);
	const entrypoint = mainMatch?.[1]?.trim();
	if (!entrypoint) fail('No runs.main in action.yml');
	if (!fs.existsSync(entrypoint)) fail(`Build artifact missing: ${entrypoint}`);

	// ── Parse commit message ─────────────────────────────────────────
	const msg = context.payload.head_commit?.message ?? '';
	const lines = msg.split('\n');

	const trailer = lines.find(
		/** @param {string} l */ (l) => l.startsWith('Release: '),
	);
	if (!trailer) fail('No Release: trailer in commit message');
	const version = trailer.slice('Release: '.length).trim();
	if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Invalid semver: ${version}`);

	const subject = lines[0] ?? '';

	const blankIdx = lines.indexOf('');
	const bodyLines = (blankIdx >= 0 ? lines.slice(blankIdx + 1) : []).filter(
		/** @param {string} l */ (l) => !l.startsWith('Release: ') && l.trim() !== '',
	);
	const body = bodyLines.length > 0 ? bodyLines.join('\n') : subject;

	// ── Validate tag message before any mutations ────────────────────
	const [major, minor, patch] = version.split('.');
	const tagExact = `v${major}.${minor}.${patch}`;
	const tagMinor = `v${major}.${minor}`;
	const tagMajor = `v${major}`;

	const title = `${tagExact} \u2014 ${subject}`;
	if (title.length > 50) fail(`Tag title is ${title.length} chars (max 50): ${title}`);

	for (const [i, line] of body.split('\n').entries()) {
		if (line.length > 72) {
			fail(`Body line ${i + 1} is ${line.length} chars (max 72): ${line}`);
		}
	}

	const tagMessage = `${title}\n\n${body}`;

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
