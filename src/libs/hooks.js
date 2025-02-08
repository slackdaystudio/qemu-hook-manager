import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { copyFile, chown, chmod } from "node:fs/promises";
import envsub from "envsub";
import sanitize from "sanitize-filename";
import { SKELETON_DIR } from "../../index.js";

/**
 * Functions for interacting with our hooks.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

// The directory where the hooks are stored on the host system
export const QEMU_HOOK_DIR = "/etc/libvirt/hooks";

// The root directory for our hooks on the host system
export const HOOKS_ROOT = join(QEMU_HOOK_DIR, "qemu.d", ".gpu-passthrough");

// The path to the prepare hook on the host system
export const PREPARE_HOOK_PATH = join(HOOKS_ROOT, "prepare");

// The path to the release hook on the host system
export const RELEASE_HOOK_PATH = join(HOOKS_ROOT, "release");

/**
 * Cleans up the hooks directory by removing any hooks found in the prepare and 
 * release directories and recreating the begin and end directories.
 */
const cleanHooks = async () => {
  await rm(PREPARE_HOOK_PATH, {
    force: true,
    recursive: true,
  });

  await rm(RELEASE_HOOK_PATH, {
    force: true,
    recursive: true,
  });

  await mkdir(join(PREPARE_HOOK_PATH, "begin"), {
    recursive: true,
  });

  await mkdir(join(RELEASE_HOOK_PATH, "end"), {
    recursive: true,
  });
};

/**
 * Installs a hook to the host system.
 * 
 * @param {string} iommuGroup the IOMMU group the hook is for
 * @param {string} hookName the name of the hook
 * @param {string} fileName the name of the file to install from the qemu_hook_skeleton directory
 */
const installHook = async (iommuGroup, hookName, fileName) => {
  let hookPath, hookTemplatePath, envSubOpts;

  envSubOpts = {
    envs: [
      {
        name: "IOMMU_GROUP_ID",
        value: iommuGroup,
      },
    ],
  };

  hookTemplatePath = join(SKELETON_DIR, fileName);

  hookPath = join(
    HOOKS_ROOT,
    hookName,
    fileName.replace("device", sanitize(iommuGroup))
  );

  await copyFile(hookTemplatePath, hookPath);

  await chown(hookPath, 0, 0);

  await chmod(hookPath, "755");

  await envsub({
    templateFile: hookTemplatePath,
    outputFile: hookPath,
    options: envSubOpts,
  });
};

export { cleanHooks, installHook };
