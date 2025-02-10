import { fetchIommuGroups, fetchActiveDomains } from "./general.js";
import { fetchAllDomains } from "./virsh.js";

/**
 * Questions the app asks the user.
 *
 * @author: Philip J. Guinchard <phil.guinchard@slackdaystudio.ca>
 */

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
      type: 'toggle',
      name: 'useOwnHooks',
      message: 'Will you use your own hooks?',
      initial: false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: prev => prev ? 'text' : null,
      name: 'hooksDir',
      message: 'Enter the path to your hooks',
    },
    {
      type: "multiselect",
      name: "iommuGroups",
      message: "Select the hardware to toggle passthrough for",
      choices: iommuGroups.map((d) => ({
        title: d,
        value: d.substring(0, 7),
        selected: false,
      })),
      min: 1
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
