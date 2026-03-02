import { arch, platform } from 'node:os';

/** OS names used in shfmt release asset naming. */
type ShfmtOS = 'darwin' | 'linux' | 'windows';
/** Arch names used in shfmt release asset naming. */
type ShfmtArch = 'amd64' | 'arm64' | '386' | 'arm';

export type Platform = { readonly os: ShfmtOS; readonly arch: ShfmtArch };

const osMap: Record<string, ShfmtOS> = {
	darwin: 'darwin',
	linux: 'linux',
	win32: 'windows',
};

const archMap: Record<string, ShfmtArch> = {
	x64: 'amd64',
	arm64: 'arm64',
	ia32: '386',
	arm: 'arm',
};

/** Map Node.js platform/arch to shfmt release naming. */
export function getPlatform(): Platform {
	const os = osMap[platform()];
	if (!os) throw new Error(`Unsupported platform: ${platform()}`);

	const a = archMap[arch()];
	if (!a) throw new Error(`Unsupported architecture: ${arch()}`);

	return { os, arch: a };
}
