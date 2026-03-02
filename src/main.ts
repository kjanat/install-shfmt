import { getInput, info, setFailed } from "./actions.ts";
import { installShfmt } from "./install.ts";

async function run(): Promise<void> {
	try {
		const versionInput = getInput("version") || "latest";
		const { version, location } = await installShfmt(versionInput);
		info(`shfmt ${version} ready at ${location}`);
	} catch (error) {
		setFailed(error instanceof Error ? error.message : String(error));
	}
}

void run();
