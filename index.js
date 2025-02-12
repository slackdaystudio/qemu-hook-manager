#!/usr/bin/env node
import { argv, env, exit } from "node:process";
import { join, sep } from "node:path";
import { exec } from "node:child_process";
import util from "node:util";
import { readdir } from "node:fs/promises";
import prompts from "prompts";
import Yargs from "yargs/yargs";
import { logger } from "./src/libs/logger.js";
import {
  enablePassthrough,
  disablePassthrough,
  fetchActiveDomains,
  installScript,
  filterAnswers,
  dirExists,
} from "./src/libs/general.js";
import { buildQuestions } from "./src/libs/questions.js";
import {
  installHook,
  QEMU_HOOK_DIR,
  makeHookDirectories,
} from "./src/libs/hooks.js";

/**
 * App entrypoint/main event loop.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

export const asyncExec = util.promisify(exec);

export const DEFAULT_HOOKS_DIR = join(
  import.meta.dirname,
  "qemu_hook_skeleton",
);

try {
  const activeDomains = await fetchActiveDomains();

  prompts.override(Yargs(argv.slice(2)).argv);

  const answers = await prompts(await buildQuestions(), {
    onCancel: () => {
      logger.info("User cancelled the installation");

      exit(0);
    },
  });

  const filteredAnswers = await filterAnswers(answers);

  if (filteredAnswers.useOwnHooks) {
    if (!(await dirExists(filteredAnswers.hooksDir))) {
      logger.error(
        `Hooks directory ${filteredAnswers.hooksDir} does not exist`,
      );

      exit(3);
    }

    env.QHM_HOOKS_DIR = filteredAnswers.hooksDir;
  } else {
    env.QHM_HOOKS_DIR = DEFAULT_HOOKS_DIR;
  }

  if (filteredAnswers.iommuGroups.length <= 0) {
    logger.info("No valid IOMMU groups specified, exiting");

    exit(2);
  }

  // Leave this one in the hands of users for now
  // logger.info("Cleaning up any existing hooks");
  // await cleanHooks();

  logger.info("Installing the script 'qemu' which calls our hooks");

  await installScript(
    join(DEFAULT_HOOKS_DIR, "qemu.sh"),
    QEMU_HOOK_DIR,
    "qemu",
  );

  logger.info("Installing hooks");

  for (const iommuGroup of filteredAnswers.iommuGroups) {
    const hooksRootDir = filteredAnswers.useOwnHooks
      ? env.QHM_HOOKS_DIR
      : join(env.QHM_HOOKS_DIR, "hooks");

    for (const dir of await readdir(hooksRootDir, { recursive: true })) {
      if (dir.endsWith(".sh")) {
        const dirPaths = dir.split(sep);
        const hook = dirPaths.pop();

        await makeHookDirectories(
          join(QEMU_HOOK_DIR, "qemu.d", ".qhm-passthrough", ...dirPaths),
        );

        await installHook(
          `0000:${iommuGroup}`,
          dirPaths.join(sep),
          hook,
          filteredAnswers.useOwnHooks,
        );
      }
    }
  }

  for (const activeDomain of activeDomains) {
    if (!filteredAnswers.domains.includes(activeDomain)) {
      logger.info(`Disabling hardware passthrough for domain: ${activeDomain}`);

      await disablePassthrough(activeDomain);
    }
  }

  for (const domain of filteredAnswers.domains) {
    if (!activeDomains.includes(domain)) {
      logger.info(`Enabling hardware passthrough for domain: ${domain}`);

      await enablePassthrough(domain);
    }
  }

  logger.info("qemu-hook-manager has completed.");
} catch (error) {
  logger.error(error.message);

  exit(1);
}

exit(0);
