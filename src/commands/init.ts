import { existsSync, promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import prompts from "prompts";
import ora from "ora";
import chalk from "chalk";
import { z } from "zod";
import os from "os";

const initOptionsSchema = z.object({
  cwd: z.string(),
  yes: z.boolean(),
});

export const init = new Command()
  .name("init")
  .description("initialize your project by storing API keys")
  .option("-y, --yes", "skip confirmation prompt.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts) => {
    try {
      const options = initOptionsSchema.parse(opts);

      const config = await promptForConfig(options.yes);

      await runInit(config);

      console.log("");
      console.log(
        `${chalk.green(
          "Success!"
        )} Project initialization completed. Your API keys have been stored.`
      );
      console.log("");
    } catch (error) {
      console.error(error);
    }
  });

async function promptForConfig(skip: boolean) {
  const options = await prompts([
    {
      type: "password",
      name: "openAiKey",
      message: "Please provide your OpenAI API key:",
    },
    {
      type: "password",
      name: "linearKey",
      message: "Please provide your Linear API key:",
    },
  ]);

  if (!skip) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Proceed with storing the provided keys?",
      initial: true,
    });

    if (!proceed) {
      process.exit(0);
    }
  }

  return options;
}

async function runInit(config: { openAiKey: string; linearKey: string }) {
  const spinner = ora(`Storing API keys...`).start();

  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".linear-ai-cli");
  const configFilePath = path.join(configDir, "api-keys.json");

  if (!existsSync(configDir)) {
    await fs.mkdir(configDir, { recursive: true });
  }

  const apiKeys = {
    openAiKey: config.openAiKey,
    linearKey: config.linearKey,
  };

  await fs.writeFile(configFilePath, JSON.stringify(apiKeys, null, 2), "utf8");
  spinner.succeed();
}
