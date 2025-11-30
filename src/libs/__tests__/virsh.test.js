import { describe, it, expect, vi, beforeEach } from "vitest";
import { EOL } from "os";

// Mock dependencies before importing the module under test
vi.mock("../../../index.js", () => ({
  asyncExec: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
const { asyncExec } = await import("../../../index.js");
const { logger } = await import("../logger.js");
const { domainExists, fetchAllDomains, VIRSH } = await import("../virsh.js");

describe("virsh.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("VIRSH constant", () => {
    it("should equal 'virsh'", () => {
      expect(VIRSH).toBe("virsh");
    });
  });

  describe("domainExists", () => {
    it("should return true when virsh domstate succeeds", async () => {
      asyncExec.mockResolvedValue({ stdout: "running", stderr: "" });

      const result = await domainExists("my-vm");

      expect(result).toBe(true);
      expect(asyncExec).toHaveBeenCalledWith("virsh domstate my-vm");
    });

    it("should return false when virsh domstate fails", async () => {
      asyncExec.mockRejectedValue(new Error("Domain not found"));

      const result = await domainExists("nonexistent-vm");

      expect(result).toBe(false);
    });

    it("should return false for domain names with invalid characters", async () => {
      const result = await domainExists("invalid;domain");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Domain invalid;domain contains invalid characters"
      );
      expect(asyncExec).not.toHaveBeenCalled();
    });

    it("should accept valid domain name characters", async () => {
      asyncExec.mockResolvedValue({ stdout: "shut off", stderr: "" });

      // Valid characters: A-Za-z0-9_.\+-&:/
      const result = await domainExists("My_VM-1.0+test&more:path/name");

      expect(result).toBe(true);
      expect(asyncExec).toHaveBeenCalled();
    });

    it("should reject domain names with spaces", async () => {
      const result = await domainExists("my vm");

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should reject domain names with shell metacharacters", async () => {
      const testCases = ["vm$(whoami)", "vm`id`", "vm|cat", "vm>file"];

      for (const domain of testCases) {
        vi.clearAllMocks();
        const result = await domainExists(domain);
        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });

  describe("fetchAllDomains", () => {
    it("should return array of domain names", async () => {
      asyncExec.mockResolvedValue({
        stdout: `vm1${EOL}vm2${EOL}vm3${EOL}`,
        stderr: "",
      });

      const result = await fetchAllDomains();

      expect(result).toEqual(["vm1", "vm2", "vm3"]);
      expect(asyncExec).toHaveBeenCalledWith("virsh list --all --name");
    });

    it("should filter out empty lines", async () => {
      asyncExec.mockResolvedValue({
        stdout: `vm1${EOL}${EOL}vm2${EOL}${EOL}`,
        stderr: "",
      });

      const result = await fetchAllDomains();

      expect(result).toEqual(["vm1", "vm2"]);
    });

    it("should return empty array when no domains exist", async () => {
      asyncExec.mockResolvedValue({
        stdout: `${EOL}`,
        stderr: "",
      });

      const result = await fetchAllDomains();

      expect(result).toEqual([]);
    });

    it("should throw error on virsh stderr", async () => {
      asyncExec.mockResolvedValue({
        stdout: "",
        stderr: "error: failed to connect to the hypervisor",
      });

      await expect(fetchAllDomains()).rejects.toThrow(
        "error: failed to connect to the hypervisor"
      );
    });

    it("should propagate asyncExec errors", async () => {
      asyncExec.mockRejectedValue(new Error("virsh not found"));

      await expect(fetchAllDomains()).rejects.toThrow("virsh not found");
    });
  });
});
