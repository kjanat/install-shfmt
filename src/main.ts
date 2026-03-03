import { getInput, setFailed } from './actions.ts';
import { installShfmt } from './install.ts';

async function run(): Promise<void> {
	try {
		const versionInput = getInput('version') || 'latest';
		await installShfmt(versionInput);
	} catch (error) {
		setFailed(error instanceof Error ? error.message : String(error));
	}
}

void run();
