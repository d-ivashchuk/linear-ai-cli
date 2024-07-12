import { existsSync, promises as fs } from "fs";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import prompts from "prompts";
import os from "os";
import path from "path";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";

const homeDir = os.homedir();
const configFilePath = path.join(homeDir, ".linear-ai-cli", "api-keys.json");

export const processText = new Command()
  .name("process-text")
  .description("process text input with the OpenAI API")
  .action(async () => {
    try {
      const { openAiKey, linearKey } = await getApiKeys();
      if (!openAiKey || !linearKey) {
        console.error(
          chalk.red(
            "Error: API keys not found. Please run the init command first."
          )
        );
        process.exit(1);
      }

      const { textInput } = await prompts({
        type: "text",
        name: "textInput",
        message: "Please provide the text to process:",
      });

      if (!textInput) {
        console.error(chalk.red("Error: No text input provided."));
        process.exit(1);
      }

      await processTextWithAI(openAiKey, linearKey, textInput);
    } catch (error) {
      console.error(error);
    }
  });

async function getApiKeys() {
  if (!existsSync(configFilePath)) {
    return { openAiKey: null, linearKey: null };
  }

  const apiKeys = JSON.parse(await fs.readFile(configFilePath, "utf8"));
  return { openAiKey: apiKeys.openAiKey, linearKey: apiKeys.linearKey };
}

async function processTextWithAI(
  openAiKey: string,
  linearKey: string,
  text: string
) {
  const spinner = ora(`Processing text with AI...`).start();

  try {
    const openai = createOpenAI({
      // custom settings, e.g.
      compatibility: "strict", // strict mode, enable when using the OpenAI API
      apiKey: openAiKey,
    });

    const { object } = await generateObject({
      prompt: `Convert the following text to linear issues: ${text}`,
      model: openai("gpt-4o"),
      schema: z.object({
        issues: z.array(
          z.object({ title: z.string(), description: z.string() })
        ),
      }),
    });
    await spinner.succeed();

    const issues = object.issues;
    const selectedIssues = await promptUserToSelectIssues(issues);

    const selectedTeamId = await promptUserToSelectTeam(linearKey);

    const { confirmCreate } = await prompts({
      type: "confirm",
      name: "confirmCreate",
      message: "Do you want to create these issues?",
      initial: true,
    });

    if (confirmCreate) {
      await createIssues(linearKey, selectedTeamId, selectedIssues);
    }
  } catch (error) {
    spinner.fail();
    console.error(chalk.red("Error processing text with AI:"), error);
  }
}

async function promptUserToSelectIssues(
  issues: Array<{ title: string; description: string }>
) {
  const choices = issues.map((issue, index) => ({
    title: issue.title,
    description: issue.description,
    value: index,
    selected: true, // All issues are selected by default
  }));

  const { selectedIssues } = await prompts({
    type: "multiselect",
    name: "selectedIssues",
    message: "Select the issues you want to create:",
    choices,
    min: 1,
    hint: "- Space to select. Enter to submit",
  });

  return selectedIssues.map((index: number) => issues[index]);
}

async function promptUserToSelectTeam(linearKey: string) {
  const spinner = ora(`Fetching teams...`).start();

  try {
    const linearClient = new LinearClient({ apiKey: linearKey });
    const teams = await linearClient.teams();

    if (!teams.nodes.length) {
      spinner.fail(chalk.red("No teams found."));
      process.exit(1);
    }

    const teamChoices = teams.nodes.map((team) => ({
      title: team.name,
      value: team.id,
    }));

    spinner.succeed(chalk.green("Teams fetched successfully."));

    const { selectedTeam } = await prompts({
      type: "select",
      name: "selectedTeam",
      message: "Select the team to create the issues:",
      choices: teamChoices,
    });

    return selectedTeam;
  } catch (error) {
    spinner.fail(chalk.red("Error fetching teams:"));
    process.exit(1);
  }
}

async function createIssues(
  linearKey: string,
  teamId: string,
  issues: Array<{ title: string; description: string }>
) {
  const spinner = ora(`Creating issues in Linear...`).start();

  try {
    const linearClient = new LinearClient({ apiKey: linearKey });

    for (const issue of issues) {
      await linearClient.createIssue({
        teamId,
        title: issue.title,
        description: issue.description,
      });
    }

    spinner.succeed();
    console.log(chalk.green("Issues created successfully."));
  } catch (error) {
    spinner.fail();
    console.error(chalk.red("Error creating issues in Linear:"), error);
  }
}
