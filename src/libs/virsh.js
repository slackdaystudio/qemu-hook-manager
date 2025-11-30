import { EOL } from "os";
import { asyncExec } from "../../index.js";
import { logger } from "./logger.js";

/**
 * The virsh command functions.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

export const VIRSH = "virsh";

/**
 * Check if a domain exists on the host system.
 *
 * @param {string} domain the name of the domain
 * @returns {Promise<boolean>} True if domain exists, false otherwise
 */
const domainExists = async (domain) => {
  // Check if domain name contains invalid characters
  // https://bugs.launchpad.net/ubuntu/+source/libvirt/+bug/672948
  if (/^[A-Za-z0-9_\.\+\-&:/]*$/.test(domain) === false) {
    logger.error(`Domain ${domain} contains invalid characters`);

    return false;
  }

  const command = [VIRSH, 'domstate', domain];

  try {
    await asyncExec(command.join(' '));

    return true;
  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }
};

/**
 * List all domains on the host system.
 *
 * @returns {Promise<Array<string>>} List of all domains
 */
const fetchAllDomains = async () => {
  const command = [VIRSH, "list", "--all", "--name"];

  const { stdout, stderr } = await asyncExec(command.join(" "));

  if (stderr) {
    throw new Error(stderr);
  }

  return stdout.split(EOL).filter((d) => d.length > 0);
};

export { domainExists, fetchAllDomains };
