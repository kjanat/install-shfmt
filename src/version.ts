import { get } from 'node:https';

/**
 * Resolve a version input to an actual shfmt release tag.
 *
 * - "latest" queries GitHub for the latest release tag via redirect.
 * - Otherwise returns input as-is, adding "v" prefix if missing.
 */
export async function resolveVersion(input: string): Promise<string> {
	const trimmed = input.trim();
	if (trimmed !== '' && trimmed.toLowerCase() !== 'latest') {
		return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
	}

	const location = await new Promise<string>((resolve, reject) => {
		get(
			'https://github.com/mvdan/sh/releases/latest',
			{ headers: { 'User-Agent': 'install-shfmt-action' } },
			(res) => {
				// Consume body to free socket
				res.resume();

				const loc = res.headers.location;
				if (typeof loc === 'string' && loc.length > 0) {
					resolve(loc);
				} else {
					reject(
						new Error(
							'Failed to resolve latest shfmt version: no redirect from GitHub releases',
						),
					);
				}
			},
		).on('error', reject);
	});

	// Location: https://github.com/mvdan/sh/releases/tag/v3.12.0
	const tag = location.split('/').pop();
	if (!tag) {
		throw new Error(
			`Failed to parse version tag from redirect: ${location}`,
		);
	}

	return tag;
}
