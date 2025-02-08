import { EOL } from "os";
import { asyncExec } from "../../index.js";

/**
 * The virsh command functions.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

export const VIRSH = "virsh";

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

export { fetchAllDomains };
