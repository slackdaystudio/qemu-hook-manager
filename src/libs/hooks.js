import { mkdir, readdir, rm } from "node:fs/promises";
import { join, sep } from "node:path";
import { copyFile, chown, chmod } from "node:fs/promises";
import envsub from "envsub";
import sanitize from "sanitize-filename";
import { SKELETON_DIR } from "../../index.js";
import { dirExists, ls } from "./general.js";

/**
 * Functions for interacting with our hooks.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

// The directory where the hooks are stored on the host system
export const QEMU_HOOK_DIR = "/etc/libvirt/hooks";

// The root directory for our hooks on the host system
export const HOOKS_ROOT = join(QEMU_HOOK_DIR, "qemu.d", ".gpu-passthrough");

/**
 * Cleans up the hooks directory by removing any hooks found matching hooks 
 * directories and removing any scripts prefixed with "qhm_".
 */
const cleanHooks = async () => {
  const hooksRootDir = join(SKELETON_DIR, "hooks");

  for (const dir of await readdir(hooksRootDir, { recursive: true })) {
    if (dir.endsWith(".sh")) {
      const dirPaths = dir.split(sep).slice(-1);

      await cleanOwnedHooks(join(HOOKS_ROOT, ...dirPaths));
    }
  }
};

/**
 * Creates the hook directories if they don't exist.
 *
 * @param {PathLike} hookPath the hook path to create
 */
const makeHookDirectories = async (hookPath) => {
  if (!(await dirExists(hookPath))) {
    await mkdir(join(hookPath), {
      recursive: true,
    });
  }
};

/**
 * Cleans up hooks that are owned by the app for a given hook path.  Only cleans
 * hooks that start with "qhm_".
 *
 * @param {PathLike} hooksPath the path to the hooks to clean up
 */
const cleanOwnedHooks = async (hooksPath) => {
  const releaseHooks = await ls(hooksPath);

  if (Array.isArray(releaseHooks)) {
    for (const file of releaseHooks) {
      if (file && file.name.startsWith("qhm_")) {
        await rm(join(file.path, file.name));
      }
    }
  }
};

/**
 * Installs a hook to the host system.
 *
 * @param {string} iommuGroup the IOMMU group the hook is for
 * @param {string} hookName the name of the hook
 * @param {string} fileName the name of the file to install from the qemu_hook_skeleton directory
 */
const installHook = async (iommuGroup, hookName, fileName) => {
  const envSubOpts = {
    envs: [
      {
        name: "IOMMU_GROUP_ID",
        value: iommuGroup,
      },
    ],
  };

  const hookTemplatePath = join(
    SKELETON_DIR,
    join("hooks", hookName),
    fileName
  );

  const hookPath = join(
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

export { cleanHooks, installHook, makeHookDirectories };
