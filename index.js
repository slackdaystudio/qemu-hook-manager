#!/usr/bin/env node
import { exit } from "node:process";
import { join } from "node:path";
import { exec } from "node:child_process";
import util from "node:util";
import prompts from "prompts";
import { logger } from "./src/libs/logger.js";
import {
  enablePassthrough,
  disablePassthrough,
  fetchActiveDomains,
  installScript,
} from "./src/libs/general.js";
import { buildQuestions } from "./src/libs/questions.js";
import { installHook, cleanHooks, QEMU_HOOK_DIR } from "./src/libs/hooks.js";

/**
 * App entrypoint/main event loop.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

export const asyncExec = util.promisify(exec);

export const SKELETON_DIR = join(import.meta.dirname, "qemu_hook_skeleton");

try {
  const activeDomains = await fetchActiveDomains();

  const answers = await prompts(await buildQuestions(), {
    onCancel: () => {
      logger.info("User cancelled the installation");

      exit(0);
    },
  });

  const conf = {
    iommuGroups: answers.iommuGroups,
  };

  logger.info("Installing the script 'qemu' which calls our hooks");

  await installScript("qemu.sh", QEMU_HOOK_DIR, "qemu");

  logger.info("Cleaning up any existing hooks");

  await cleanHooks();

  if (!conf.iommuGroups) {
    logger.info("No IOMMU groups selected, skipping installation of hooks");

    exit(0);
  }

  logger.info("Installing hooks");

  for (const iommuGroup of conf.iommuGroups) {
    await installHook(
      iommuGroup,
      join("prepare", "begin"),
      "qhm_bind_vfio_device.sh",
    );

    await installHook(
      iommuGroup,
      join("release", "end"),
      "qhm_unbind_vfio_device.sh",
    );
  }

  for (const activeDomain of activeDomains) {
    if (!answers.domains.includes(activeDomain)) {
      logger.info(`Disabling hardware passthrough for domain: ${activeDomain}`);

      await disablePassthrough(activeDomain);
    }
  }

  for (const domain of answers.domains) {
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
