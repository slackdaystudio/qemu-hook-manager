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

vi.mock("../hooks.js", () => ({
  QEMU_HOOK_DIR: "/etc/libvirt/hooks",
}));

vi.mock("../virsh.js", () => ({
  domainExists: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  rm: vi.fn(),
  copyFile: vi.fn(),
  chown: vi.fn(),
  chmod: vi.fn(),
  opendir: vi.fn(),
  access: vi.fn(),
}));

// Import after mocks are set up
const { asyncExec } = await import("../../../index.js");
const { logger } = await import("../logger.js");
const { domainExists } = await import("../virsh.js");
const { rm, copyFile, chown, chmod, opendir, access } = await import(
  "node:fs/promises"
);
const {
  fetchIommuGroups,
  fetchActiveDomains,
  enablePassthrough,
  disablePassthrough,
  installScript,
  fileExists,
  dirExists,
  ls,
  filterAnswers,
} = await import("../general.js");

describe("general.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchIommuGroups", () => {
    it("should return Map with grouped devices when IOMMU groups exist", async () => {
      asyncExec
        .mockResolvedValueOnce({
          stdout: `/sys/kernel/iommu_groups/12/devices/0000:07:00.0${EOL}/sys/kernel/iommu_groups/12/devices/0000:07:00.1${EOL}/sys/kernel/iommu_groups/13/devices/0000:08:00.0${EOL}`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "07:00.0 VGA compatible controller [0300]: NVIDIA",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "07:00.1 Audio device [0403]: NVIDIA HD Audio",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "08:00.0 USB controller [0c03]: AMD USB",
          stderr: "",
        });

      const result = await fetchIommuGroups();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get(12)).toHaveLength(2);
      expect(result.get(13)).toHaveLength(1);
      expect(result.get(12)[0]).toEqual({
        pciAddress: "0000:07:00.0",
        description: "07:00.0 VGA compatible controller [0300]: NVIDIA",
      });
    });

    it("should return empty Map when no IOMMU groups found", async () => {
      asyncExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      const result = await fetchIommuGroups();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("should skip malformed device paths", async () => {
      asyncExec
        .mockResolvedValueOnce({
          stdout: `/sys/kernel/iommu_groups/12/devices/0000:07:00.0${EOL}/some/invalid/path${EOL}`,
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "07:00.0 VGA compatible controller",
          stderr: "",
        });

      const result = await fetchIommuGroups();

      expect(result.size).toBe(1);
      expect(result.get(12)).toHaveLength(1);
    });
  });

  describe("fetchActiveDomains", () => {
    it("should return array of domain names from hooks directory", async () => {
      asyncExec.mockResolvedValue({
        stdout: `vm1${EOL}vm2${EOL}.qhm-passthrough${EOL}`,
        stderr: "",
      });

      const result = await fetchActiveDomains();

      expect(result).toEqual(["vm1", "vm2", ".qhm-passthrough"]);
      expect(asyncExec).toHaveBeenCalledWith("ls /etc/libvirt/hooks/qemu.d");
    });

    it("should return empty array when directory doesn't exist", async () => {
      asyncExec.mockRejectedValue(new Error("No such file or directory"));

      const result = await fetchActiveDomains();

      expect(result).toEqual([]);
    });

    it("should filter out empty lines", async () => {
      asyncExec.mockResolvedValue({
        stdout: `vm1${EOL}${EOL}vm2${EOL}`,
        stderr: "",
      });

      const result = await fetchActiveDomains();

      expect(result).toEqual(["vm1", "vm2"]);
    });
  });

  describe("enablePassthrough", () => {
    it("should create symlink with correct source and destination", async () => {
      asyncExec.mockResolvedValue({ stdout: "", stderr: "" });

      await enablePassthrough("my-vm");

      expect(asyncExec).toHaveBeenCalledWith(
        "ln -s /etc/libvirt/hooks/qemu.d/.qhm-passthrough /etc/libvirt/hooks/qemu.d/my-vm"
      );
    });

    it("should throw on stderr from ln command", async () => {
      asyncExec.mockResolvedValue({
        stdout: "",
        stderr: "ln: failed to create symbolic link",
      });

      await expect(enablePassthrough("my-vm")).rejects.toThrow(
        "ln: failed to create symbolic link"
      );
    });

    it("should return stdout on success", async () => {
      asyncExec.mockResolvedValue({ stdout: "success", stderr: "" });

      const result = await enablePassthrough("my-vm");

      expect(result).toBe("success");
    });
  });

  describe("disablePassthrough", () => {
    it("should remove symlink for domain", async () => {
      asyncExec.mockResolvedValue({ stdout: "", stderr: "" });

      await disablePassthrough("my-vm");

      expect(asyncExec).toHaveBeenCalledWith(
        "unlink /etc/libvirt/hooks/qemu.d/my-vm"
      );
    });

    it("should throw on stderr from unlink command", async () => {
      asyncExec.mockResolvedValue({
        stdout: "",
        stderr: "unlink: cannot unlink",
      });

      await expect(disablePassthrough("my-vm")).rejects.toThrow(
        "unlink: cannot unlink"
      );
    });
  });

  describe("installScript", () => {
    it("should copy file to destination with correct permissions", async () => {
      access.mockRejectedValue(new Error("ENOENT")); // File doesn't exist
      copyFile.mockResolvedValue();
      chown.mockResolvedValue();
      chmod.mockResolvedValue();

      await installScript("/source/script.sh", "/dest");

      expect(copyFile).toHaveBeenCalledWith("/source/script.sh", "/dest/script.sh");
      expect(chown).toHaveBeenCalledWith("/dest/script.sh", 0, 0);
      expect(chmod).toHaveBeenCalledWith("/dest/script.sh", "755");
    });

    it("should use custom destination script name when provided", async () => {
      access.mockRejectedValue(new Error("ENOENT"));
      copyFile.mockResolvedValue();
      chown.mockResolvedValue();
      chmod.mockResolvedValue();

      await installScript("/source/script.sh", "/dest", "qemu");

      expect(copyFile).toHaveBeenCalledWith("/source/script.sh", "/dest/qemu");
    });

    it("should remove existing file before copying", async () => {
      access.mockResolvedValue(); // File exists
      rm.mockResolvedValue();
      copyFile.mockResolvedValue();
      chown.mockResolvedValue();
      chmod.mockResolvedValue();

      await installScript("/source/script.sh", "/dest");

      expect(logger.info).toHaveBeenCalledWith(
        "Removing existing script: /dest/script.sh"
      );
      expect(rm).toHaveBeenCalledWith("/dest/script.sh", {
        force: true,
        recursive: true,
      });
    });
  });

  describe("fileExists", () => {
    it("should return true when file exists", async () => {
      access.mockResolvedValue();

      const result = await fileExists("/path/to/file");

      expect(result).toBe(true);
      expect(access).toHaveBeenCalledWith("/path/to/file");
    });

    it("should return false when file doesn't exist", async () => {
      access.mockRejectedValue(new Error("ENOENT"));

      const result = await fileExists("/path/to/nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("dirExists", () => {
    it("should return true when directory exists", async () => {
      access.mockResolvedValue();

      const result = await dirExists("/path/to/dir");

      expect(result).toBe(true);
    });

    it("should return false when directory doesn't exist", async () => {
      access.mockRejectedValue(new Error("ENOENT"));

      const result = await dirExists("/path/to/nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("ls", () => {
    it("should return directory contents", async () => {
      const mockDir = { path: "/test" };
      opendir.mockResolvedValue(mockDir);

      const result = await ls("/test");

      expect(result).toBe(mockDir);
      expect(opendir).toHaveBeenCalledWith("/test");
    });

    it("should return empty object when directory doesn't exist", async () => {
      opendir.mockRejectedValue(new Error("ENOENT"));

      const result = await ls("/nonexistent");

      expect(result).toEqual({});
    });
  });

  describe("filterAnswers", () => {
    it("should filter valid IOMMU groups", async () => {
      const result = await filterAnswers({
        iommuGroups: ["07:00.0", "08:00.1"],
      });

      expect(result.iommuGroups).toEqual(["07:00.0", "08:00.1"]);
    });

    it("should reject invalid IOMMU group formats", async () => {
      const result = await filterAnswers({
        iommuGroups: ["invalid", "07:00.0", "0000:07:00.0", "7:0.0"],
      });

      expect(result.iommuGroups).toEqual(["07:00.0"]);
      expect(logger.warn).toHaveBeenCalledWith("Invalid IOMMU group: invalid");
      expect(logger.warn).toHaveBeenCalledWith(
        "Invalid IOMMU group: 0000:07:00.0"
      );
    });

    it("should handle single IOMMU group value (not array)", async () => {
      const result = await filterAnswers({
        iommuGroups: "07:00.0",
      });

      expect(result.iommuGroups).toEqual(["07:00.0"]);
    });

    it("should validate domains exist via domainExists", async () => {
      domainExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await filterAnswers({
        domains: ["existing-vm", "nonexistent-vm"],
      });

      expect(result.domains).toEqual(["existing-vm"]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Domain nonexistent-vm does not exist"
      );
    });

    it("should handle single domain value (not array)", async () => {
      domainExists.mockResolvedValue(true);

      const result = await filterAnswers({
        domains: "my-vm",
      });

      expect(result.domains).toEqual(["my-vm"]);
    });

    it("should convert useOwnHooks 'yes' to true", async () => {
      const result = await filterAnswers({
        useOwnHooks: "yes",
      });

      expect(result.useOwnHooks).toBe(true);
    });

    it("should convert useOwnHooks 'no' to false", async () => {
      const result = await filterAnswers({
        useOwnHooks: "no",
      });

      expect(result.useOwnHooks).toBe(false);
    });

    it("should pass through other properties unchanged", async () => {
      const result = await filterAnswers({
        hooksDir: "/custom/hooks",
        someOther: "value",
      });

      expect(result.hooksDir).toBe("/custom/hooks");
      expect(result.someOther).toBe("value");
    });

    it("should handle empty answers", async () => {
      const result = await filterAnswers({});

      expect(result.iommuGroups).toEqual([]);
      expect(result.domains).toEqual([]);
    });
  });
});
