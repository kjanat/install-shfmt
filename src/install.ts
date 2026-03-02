import { execFileSync } from 'node:child_process';
import { chmodSync, createWriteStream, mkdirSync, unlinkSync } from 'node:fs';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addPath, info, setOutput } from './actions.ts';
import { cacheDir, findCached } from './cache.ts';
import { getPlatform } from './platform.ts';
import { resolveVersion } from './version.ts';

const MAX_RETRIES = 3;

/** Download a URL to a local file path. Follows redirects, retries on transient errors. */
async function download(url: string, dest: string): Promise<void> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			await downloadAttempt(url, dest);
			return;
		} catch (err) {
			// Clean up partial file
			try {
				unlinkSync(dest);
			} catch {
				/* may not exist */
			}

			if (attempt === MAX_RETRIES) throw err;

			const delaySec = attempt * 2;
			info(
				`Download attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delaySec}s...`,
			);
			await new Promise((r) => setTimeout(r, delaySec * 1000));
		}
	}
}

function downloadAttempt(url: string, dest: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = (href: string, redirects = 0) => {
			if (redirects > 10) {
				reject(new Error('Too many redirects'));
				return;
			}

			get(
				href,
				{ headers: { 'User-Agent': 'install-shfmt-action' } },
				(res) => {
					if (
						res.statusCode
						&& res.statusCode >= 300
						&& res.statusCode < 400
						&& res.headers.location
					) {
						res.resume();
						request(res.headers.location, redirects + 1);
						return;
					}

					if (res.statusCode !== 200) {
						res.resume();
						reject(
							new Error(
								`Download failed: HTTP ${res.statusCode} from ${href}`,
							),
						);
						return;
					}

					const file = createWriteStream(dest);
					res.on('error', reject);
					res.pipe(file);
					file.on('finish', () => file.close(() => resolve()));
					file.on('error', reject);
				},
			).on('error', reject);
		};

		request(url);
	});
}

/** Download and install the shfmt binary. */
export async function installShfmt(versionInput: string): Promise<{
	version: string;
	location: string;
	cacheHit: boolean;
}> {
	const version = await resolveVersion(versionInput);
	info(`Resolved shfmt version: ${version}`);

	const { os: osName, arch } = getPlatform();
	info(`Detected platform: ${osName}_${arch}`);

	const ext = osName === 'windows' ? '.exe' : '';
	const binaryName = `shfmt${ext}`;

	// Check tool-cache first
	const cachedDir = findCached('shfmt', version);
	if (cachedDir) {
		info(`Cache hit: shfmt ${version} from tool-cache`);
		return finalize(join(cachedDir, binaryName), version, true);
	}

	info('Cache miss: downloading shfmt');

	const assetName = `shfmt_${version}_${osName}_${arch}${ext}`;
	const url = `https://github.com/mvdan/sh/releases/download/${version}/${assetName}`;
	info(`Downloading: ${url}`);

	const tempDir = join(tmpdir(), `shfmt-${version}-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });

	const tempBinary = join(tempDir, binaryName);
	await download(url, tempBinary);

	if (osName !== 'windows') {
		chmodSync(tempBinary, 0o755);
	}

	const toolDir = cacheDir(tempDir, 'shfmt', version);
	return finalize(join(toolDir, binaryName), version, false);
}

/** Add to PATH, set outputs, verify binary works. */
function finalize(
	binaryPath: string,
	resolvedVersion: string,
	cacheHit: boolean,
): { version: string; location: string; cacheHit: boolean } {
	addPath(join(binaryPath, '..'));

	const actualVersion = execFileSync(binaryPath, ['--version'], {
		encoding: 'utf8',
	}).trim();

	setOutput('version', actualVersion);
	setOutput('location', binaryPath);
	setOutput('cache-hit', cacheHit);

	info(`shfmt ${actualVersion} ready at ${binaryPath}`);

	return { version: actualVersion, location: binaryPath, cacheHit };
}
