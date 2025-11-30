import chalk from "chalk";
import { fetchIommuGroups, fetchActiveDomains } from "./general.js";
import { fetchAllDomains } from "./virsh.js";

/**
 * Questions the app asks the user.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

/**
 * Builds choices for the IOMMU group multiselect, grouped by IOMMU group number.
 *
 * @param {Map<number, Array<{pciAddress: string, description: string}>>} iommuGroups
 * @returns {Array<Object>} Choices array with group separators
 */
const buildIommuChoices = (iommuGroups) => {
  const choices = [];
  const sortedGroups = [...iommuGroups.entries()].sort((a, b) => a[0] - b[0]);

  for (const [groupNum, devices] of sortedGroups) {
    // Add a separator/heading for each IOMMU group
    choices.push({
      title: chalk.bold.cyan(`── IOMMU Group ${groupNum} ──`),
      disabled: true,
    });

    // Add each device in the group
    for (const device of devices) {
      // Extract the short PCI address (e.g., "07:00.0" from "0000:07:00.0")
      const shortAddress = device.pciAddress.replace(/^0000:/, "");
      choices.push({
        title: `  ${device.description}`,
        value: shortAddress,
        selected: false,
      });
    }
  }

  return choices;
};

/**
 * Constructs the questions to ask the user.
 *
 * @returns {Promise<Array<Object>>} The questions to ask the user
 */
const buildQuestions = async () => {
  const iommuGroups = await fetchIommuGroups();

  const allDomains = await fetchAllDomains();

  const activeDomains = await fetchActiveDomains();

  return [
    {
      type: "toggle",
      name: "useOwnHooks",
      message: "Will you use your own hooks?",
      initial: false,
      active: "yes",
      inactive: "no",
    },
    {
      type: (prev) => (prev ? "text" : null),
      name: "hooksDir",
      message: "Enter the path to your hooks",
    },
    {
      type: "multiselect",
      name: "iommuGroups",
      message: "Select the hardware to toggle passthrough for",
      choices: buildIommuChoices(iommuGroups),
      min: 1,
    },
    {
      type: "multiselect",
      name: "domains",
      message:
        "Select a domain to toggle passthrough on or unselect to disable",
      choices: allDomains.map((d) => ({
        title: d,
        value: d,
        selected: activeDomains.includes(d),
      })),
    },
  ];
};

export { buildQuestions };
