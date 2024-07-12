#!/usr/bin/env node

import { init } from "@/commands/init";
import { Command } from "commander";
import { processText } from "@/commands/process-text";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
  const program = new Command()
    .name("linear-ai-cli")
    .description("convert text to linear issue from terminal")
    .version("1.0.0", "-v, --version", "display the version number");

  program.addCommand(init).addCommand(processText);

  program.parse();
}

main();
