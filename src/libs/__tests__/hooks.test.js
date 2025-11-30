import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a mock env object that we can modify
const mockEnv = {};

// Mock dependencies before importing the module under test
vi.mock("node:process", () => ({
  env: mockEnv,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
  copyFile: vi.fn(),
  chown: vi.fn(),
  chmod: vi.fn(),
}));

vi.mock("envsub", () => ({
  default: vi.fn(),
}));

vi.mock("sanitize-filename", () => ({
  default: vi.fn((str) => str.replace(/:/g, "")),
}));

vi.mock("../general.js", () => ({
  dirExists: vi.fn(),
  ls: vi.fn(),
}));

// Import after mocks are set up
const { mkdir, readdir, rm, copyFile, chown, chmod } = await import(
  "node:fs/promises"
);
const envsub = (await import("envsub")).default;
const sanitize = (await import("sanitize-filename")).default;
const { dirExists, ls } = await import("../general.js");
const {
  cleanHooks,
  installHook,
  makeHookDirectories,
  QEMU_HOOK_DIR,
  HOOKS_ROOT,
} = await import("../hooks.js");

describe("hooks.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock env
    Object.keys(mockEnv).forEach((key) => delete mockEnv[key]);
  });

  describe("constants", () => {
    it("QEMU_HOOK_DIR should be /etc/libvirt/hooks", () => {
      expect(QEMU_HOOK_DIR).toBe("/etc/libvirt/hooks");
    });

    it("HOOKS_ROOT should be /etc/libvirt/hooks/qemu.d/.qhm-passthrough", () => {
      expect(HOOKS_ROOT).toBe("/etc/libvirt/hooks/qemu.d/.qhm-passthrough");
    });
  });

  describe("makeHookDirectories", () => {
    it("should create directory when it doesn't exist", async () => {
      dirExists.mockResolvedValue(false);
      mkdir.mockResolvedValue();

      await makeHookDirectories("/etc/libvirt/hooks/qemu.d/.qhm-passthrough/prepare/begin");

      expect(dirExists).toHaveBeenCalledWith(
        "/etc/libvirt/hooks/qemu.d/.qhm-passthrough/prepare/begin"
      );
      expect(mkdir).toHaveBeenCalledWith(
        "/etc/libvirt/hooks/qemu.d/.qhm-passthrough/prepare/begin",
        { recursive: true }
      );
    });

    it("should not create directory when it already exists", async () => {
      dirExists.mockResolvedValue(true);

      await makeHookDirectories("/existing/path");

      expect(dirExists).toHaveBeenCalledWith("/existing/path");
      expect(mkdir).not.toHaveBeenCalled();
    });
  });

  describe("installHook", () => {
    beforeEach(() => {
      mockEnv.QHM_HOOKS_DIR = "/app/qemu_hook_skeleton";
      copyFile.mockResolvedValue();
      chown.mockResolvedValue();
      chmod.mockResolvedValue();
      envsub.mockResolvedValue();
    });

    it("should copy hook template to correct location", async () => {
      await installHook(
        "0000:07:00.0",
        "prepare/begin",
        "qhm_bind_vfio_device.sh",
        false
      );

      expect(copyFile).toHaveBeenCalledWith(
        "/app/qemu_hook_skeleton/hooks/prepare/begin/qhm_bind_vfio_device.sh",
        "/etc/libvirt/hooks/qemu.d/.qhm-passthrough/prepare/begin/qhm_bind_vfio_00000700.0.sh"
      );
    });

    it("should use custom hooks path when useOwnHooks is true", async () => {
      mockEnv.QHM_HOOKS_DIR = "/custom/hooks";

      await installHook(
        "0000:07:00.0",
        "prepare/begin",
        "qhm_bind_vfio_device.sh",
        true
      );

      expect(copyFile).toHaveBeenCalledWith(
        "/custom/hooks/prepare/begin/qhm_bind_vfio_device.sh",
        expect.any(String)
      );
    });

    it("should set permissions to 755", async () => {
      await installHook(
        "0000:07:00.0",
        "prepare/begin",
        "qhm_bind_vfio_device.sh",
        false
      );

      expect(chmod).toHaveBeenCalledWith(expect.any(String), "755");
    });

    it("should set ownership to root:root (0:0)", async () => {
      await installHook(
        "0000:07:00.0",
        "prepare/begin",
        "qhm_bind_vfio_device.sh",
        false
      );

      expect(chown).toHaveBeenCalledWith(expect.any(String), 0, 0);
    });

    it("should call envsub to substitute IOMMU_GROUP_ID", async () => {
      await installHook(
        "0000:07:00.0",
        "prepare/begin",
        "qhm_bind_vfio_device.sh",
        false
      );

      expect(envsub).toHaveBeenCalledWith({
        templateFile:
          "/app/qemu_hook_skeleton/hooks/prepare/begin/qhm_bind_vfio_device.sh",
        outputFile: expect.stringContaining("qhm_bind_vfio_"),
        options: {
          envs: [
            {
              name: "IOMMU_GROUP_ID",
              value: "0000:07:00.0",
            },
          ],
        },
      });
    });

    it("should sanitize IOMMU group in filename", async () => {
      await installHook(
        "0000:07:00.0",
        "release/end",
        "qhm_unbind_vfio_device.sh",
        false
      );

      expect(sanitize).toHaveBeenCalledWith("0000:07:00.0");
    });
  });

  describe("cleanHooks", () => {
    beforeEach(() => {
      mockEnv.QHM_HOOKS_DIR = "/app/hooks";
    });

    it("should process .sh files from hooks directory", async () => {
      readdir.mockResolvedValue([
        "prepare/begin/qhm_bind_vfio_device.sh",
        "release/end/qhm_unbind_vfio_device.sh",
      ]);
      ls.mockResolvedValue([]);

      await cleanHooks();

      expect(readdir).toHaveBeenCalledWith("/app/hooks", { recursive: true });
    });

    it("should remove only files prefixed with qhm_", async () => {
      readdir.mockResolvedValue(["prepare/begin/qhm_test.sh"]);
      ls.mockResolvedValue([
        { name: "qhm_bind_vfio_0000.sh", path: "/hooks/path" },
        { name: "other_script.sh", path: "/hooks/path" },
        { name: "qhm_another.sh", path: "/hooks/path" },
      ]);
      rm.mockResolvedValue();

      await cleanHooks();

      expect(rm).toHaveBeenCalledTimes(2);
      expect(rm).toHaveBeenCalledWith("/hooks/path/qhm_bind_vfio_0000.sh");
      expect(rm).toHaveBeenCalledWith("/hooks/path/qhm_another.sh");
    });

    it("should handle empty directory listing", async () => {
      readdir.mockResolvedValue(["test.sh"]);
      ls.mockResolvedValue({});

      await cleanHooks();

      expect(rm).not.toHaveBeenCalled();
    });

    it("should skip non-.sh files", async () => {
      readdir.mockResolvedValue(["readme.md", "config.json"]);

      await cleanHooks();

      expect(ls).not.toHaveBeenCalled();
    });
  });
});
