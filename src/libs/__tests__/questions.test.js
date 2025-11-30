import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../general.js", () => ({
  fetchIommuGroups: vi.fn(),
  fetchActiveDomains: vi.fn(),
}));

vi.mock("../virsh.js", () => ({
  fetchAllDomains: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    bold: {
      cyan: vi.fn((str) => `[cyan]${str}[/cyan]`),
    },
  },
}));

// Import after mocks are set up
const { fetchIommuGroups, fetchActiveDomains } = await import("../general.js");
const { fetchAllDomains } = await import("../virsh.js");
const { buildQuestions } = await import("../questions.js");

describe("questions.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildQuestions", () => {
    beforeEach(() => {
      // Default mocks for all tests
      fetchIommuGroups.mockResolvedValue(new Map());
      fetchAllDomains.mockResolvedValue([]);
      fetchActiveDomains.mockResolvedValue([]);
    });

    it("should return array with 4 questions", async () => {
      const questions = await buildQuestions();

      expect(questions).toHaveLength(4);
    });

    it("should have useOwnHooks toggle as first question", async () => {
      const questions = await buildQuestions();

      expect(questions[0]).toMatchObject({
        type: "toggle",
        name: "useOwnHooks",
        message: "Will you use your own hooks?",
        initial: false,
        active: "yes",
        inactive: "no",
      });
    });

    it("should have hooksDir text input as second question (conditional)", async () => {
      const questions = await buildQuestions();

      expect(questions[1].name).toBe("hooksDir");
      expect(questions[1].message).toBe("Enter the path to your hooks");
      // Type should be a function that returns 'text' when prev is truthy
      expect(typeof questions[1].type).toBe("function");
      expect(questions[1].type(true)).toBe("text");
      expect(questions[1].type(false)).toBeNull();
    });

    it("should have iommuGroups multiselect as third question with min:1", async () => {
      const questions = await buildQuestions();

      expect(questions[2]).toMatchObject({
        type: "multiselect",
        name: "iommuGroups",
        message: "Select the hardware to toggle passthrough for",
        min: 1,
      });
    });

    it("should have domains multiselect as fourth question", async () => {
      const questions = await buildQuestions();

      expect(questions[3]).toMatchObject({
        type: "multiselect",
        name: "domains",
        message:
          "Select a domain to toggle passthrough on or unselect to disable",
      });
    });

    it("should build IOMMU choices with group headers", async () => {
      const iommuGroups = new Map([
        [
          12,
          [
            {
              pciAddress: "0000:07:00.0",
              description: "07:00.0 VGA controller: NVIDIA",
            },
            {
              pciAddress: "0000:07:00.1",
              description: "07:00.1 Audio device: NVIDIA HD",
            },
          ],
        ],
      ]);
      fetchIommuGroups.mockResolvedValue(iommuGroups);

      const questions = await buildQuestions();
      const choices = questions[2].choices;

      // First item should be group header (disabled)
      expect(choices[0]).toMatchObject({
        title: expect.stringContaining("IOMMU Group 12"),
        disabled: true,
      });

      // Following items should be devices (selectable)
      expect(choices[1]).toMatchObject({
        title: expect.stringContaining("07:00.0 VGA controller"),
        value: "07:00.0",
        selected: false,
      });

      expect(choices[2]).toMatchObject({
        title: expect.stringContaining("07:00.1 Audio device"),
        value: "07:00.1",
        selected: false,
      });
    });

    it("should sort IOMMU groups by number", async () => {
      const iommuGroups = new Map([
        [15, [{ pciAddress: "0000:09:00.0", description: "Device C" }]],
        [5, [{ pciAddress: "0000:03:00.0", description: "Device A" }]],
        [10, [{ pciAddress: "0000:06:00.0", description: "Device B" }]],
      ]);
      fetchIommuGroups.mockResolvedValue(iommuGroups);

      const questions = await buildQuestions();
      const choices = questions[2].choices;

      // Groups should be sorted: 5, 10, 15
      expect(choices[0].title).toContain("IOMMU Group 5");
      expect(choices[2].title).toContain("IOMMU Group 10");
      expect(choices[4].title).toContain("IOMMU Group 15");
    });

    it("should strip 0000: prefix from PCI addresses in values", async () => {
      const iommuGroups = new Map([
        [1, [{ pciAddress: "0000:07:00.0", description: "Device" }]],
      ]);
      fetchIommuGroups.mockResolvedValue(iommuGroups);

      const questions = await buildQuestions();
      const deviceChoice = questions[2].choices[1];

      expect(deviceChoice.value).toBe("07:00.0");
    });

    it("should indent device titles", async () => {
      const iommuGroups = new Map([
        [1, [{ pciAddress: "0000:07:00.0", description: "Device" }]],
      ]);
      fetchIommuGroups.mockResolvedValue(iommuGroups);

      const questions = await buildQuestions();
      const deviceChoice = questions[2].choices[1];

      expect(deviceChoice.title).toMatch(/^\s{2}/); // Starts with 2 spaces
    });

    it("should build domain choices from fetchAllDomains", async () => {
      fetchAllDomains.mockResolvedValue(["vm1", "vm2", "vm3"]);
      fetchActiveDomains.mockResolvedValue([]);

      const questions = await buildQuestions();
      const choices = questions[3].choices;

      expect(choices).toHaveLength(3);
      expect(choices[0]).toMatchObject({
        title: "vm1",
        value: "vm1",
        selected: false,
      });
    });

    it("should pre-select active domains", async () => {
      fetchAllDomains.mockResolvedValue(["vm1", "vm2", "vm3"]);
      fetchActiveDomains.mockResolvedValue(["vm2"]);

      const questions = await buildQuestions();
      const choices = questions[3].choices;

      expect(choices[0].selected).toBe(false);
      expect(choices[1].selected).toBe(true);
      expect(choices[2].selected).toBe(false);
    });

    it("should handle empty IOMMU groups", async () => {
      fetchIommuGroups.mockResolvedValue(new Map());

      const questions = await buildQuestions();

      expect(questions[2].choices).toEqual([]);
    });

    it("should handle empty domain list", async () => {
      fetchAllDomains.mockResolvedValue([]);

      const questions = await buildQuestions();

      expect(questions[3].choices).toEqual([]);
    });
  });
});
