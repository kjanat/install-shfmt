/**
 * @typedef {{ version: string, subject: string, body: string }} ParsedCommit
 * @typedef {{ tagExact: string, tagMinor: string, tagMajor: string, tagMessage: string }} TagInfo
 */

/**
 * Parse a commit message for release metadata.
 * Expects a `Release: X.Y.Z` trailer in the body.
 *
 * @param {string} message
 * @returns {ParsedCommit}
 */
export function parseCommitMessage(message) {
	const lines = message.split('\n');

	const trailer = lines.find(
		/** @param {string} l */ (l) => l.startsWith('Release: '),
	);
	if (!trailer) throw new Error('No Release: trailer in commit message');
	const version = trailer.slice('Release: '.length).trim();
	if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid semver: ${version}`);

	const subject = lines[0] ?? '';

	const blankIdx = lines.indexOf('');
	const bodyLines = (blankIdx >= 0 ? lines.slice(blankIdx + 1) : []).filter(
		/** @param {string} l */ (l) => !l.startsWith('Release: ') && l.trim() !== '',
	);
	const body = bodyLines.length > 0 ? bodyLines.join('\n') : subject;

	return { version, subject, body };
}

/**
 * Build and validate tag metadata from parsed commit info.
 * Throws if title exceeds 50 chars or any body line exceeds 72 chars.
 *
 * @param {string} version — bare semver, e.g. `1.2.3`
 * @param {string} subject — first line of commit message
 * @param {string} body    — commit body (excluding Release: trailer)
 * @returns {TagInfo}
 */
export function buildTagInfo(version, subject, body) {
	const [major, minor, patch] = version.split('.');
	const tagExact = `v${major}.${minor}.${patch}`;
	const tagMinor = `v${major}.${minor}`;
	const tagMajor = `v${major}`;

	const title = `${tagExact} \u2014 ${subject}`;
	if (title.length > 50) {
		throw new Error(`Tag title is ${title.length} chars (max 50): ${title}`);
	}

	for (const [i, line] of body.split('\n').entries()) {
		if (line.length > 72) {
			throw new Error(`Body line ${i + 1} is ${line.length} chars (max 72): ${line}`);
		}
	}

	return { tagExact, tagMinor, tagMajor, tagMessage: `${title}\n\n${body}` };
}
