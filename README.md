# QEMU Hook Manager

QEMU Hook Manager is a CLI tool designed to manage hardware passthrough for QEMU virtual machines easily. It allows users to easily configure and handle various hooks to automate tasks and enhance the functionality of their virtual environments.

For best results, ensure your virtualization CPU extensions are enabled in your BIOS.  Feel free to use [my notes](https://github.com/slackdaystudio/qemu-gpu-passthrough) as a starting point to getting the prerequisite hardware and configurations in place **before** running this tool.  You only need to follow the first three steps and then run this tool to cover the remaining steps.

## Features

- Manage pre-defined hooks for QEMU VMs
- Automate tasks such as automatic hardware binding
- Easy configuration and setup

## Requirements

- Node 20+
- virsh
- QEMU
- Complete the requisite hardware configuration as described in steps 1-3 [here](https://github.com/slackdaystudio/qemu-gpu-passthrough).

## Installation

Install with `npm i -g @sentry0/qemu-hook-manager`.

### Local Checkout

To install QEMU Hook Manager, clone the repository and run the setup script:

```bash
git clone https://github.com/sentry0/qemu-hook-manager.git
cd qemu-hook-manager
npm install
npm run qemu-hook-manager
```

## Usage

To use QEMU Hook Manager, follow these steps:

1. Run `qemu-hook-manager` in your terminal
   - You should be root to have proper access rights to the hook directories
2. Select your hardware to passthrough
![Pick Hardware](https://github.com/slackdaystudio/qemu-hook-manager/blob/69a292a160eff09469fd7d9bbe1ecb71b629d991/pick-hardware.png?raw=true)
3. Select the VMs you want to pass the hardware through to
![Pick VMs](https://github.com/slackdaystudio/qemu-hook-manager/blob/69a292a160eff09469fd7d9bbe1ecb71b629d991/pick-vms.png?raw=true)

### CLI Switches

You may bypass parts of or the entire guided experience qemu-hook-manager
provides by invoking it with appropriate CLI switches.

| Switch         | Type    |     Examples/Notes                            |
|----------------|---------|-----------------------------------------------|
| iommuGroups    | string  | "00:00:0"                                     |
| domains        | string  | "VM1"                                         |
| useOwnHooks    | string  | "yes" or "no"                                 |
| hooksDir       | string  | "/home/me/hooks" (use an absolute path)      |

The `iommuGroups` and `domains` switches may be specified multiple times in a single command to specify more than one VM or piece of hardware.

For example, if you run the following command, you will skip the guided experience.
```
qemu-hook-manager --useOwnHooks=no --iommuGroups=07:00.0 --iommuGroups=07:00.1 --domains=My-Awesome-VM --domains=My-Other-Awesome-VM
```

Assuming that all supplied parameters are valid, the resulting hook structure in `/etc/libvirt/hooks` would look like this.

```
/etc/libvirt/hooks/
├── qemu
└── qemu.d
   ├── My-Awesome-VM -> /etc/libvirt/hooks/qemu.d/.qhm-passthrough
   ├── My-Other-Awesome-VM -> /etc/libvirt/hooks/qemu.d/.qhm-passthrough
   └── .qhm-passthrough
       ├── prepare
       │   └── begin
       │       ├── qhm_bind_vfio_00000700.0.sh
       │       └── qhm_bind_vfio_00000700.1.sh
       └── release
           └── end
               ├── qhm_unbind_vfio_00000700.0.sh
               └── qhm_unbind_vfio_00000700.1.sh
```

## Custom Hooks
Adding a custom hook involves creating a folder for your scripts with a specific directory structure and an appropriately named script. You also need to pick the correct QEMU hook and state names. Then, you add your hook and state folders to a directory of your choice and drop your scripts into your state folders. 

### Directory Structure
Let's examine the built-in hook folder structure. You can construct your hooks using a similar directory structure.

```
/hooks
├── prepare
│   └── begin
│       └── qhm_bind_vfio_device.sh
└── release
   └── end
       └── qhm_unbind_vfio_device.sh
```

This example shows that the `hooks` directory has two subfolders, each named after a QEMU hook name (prepare and release).  Each subfolder has a folder named after a QEMU hook state (begin for the prepare hook and end for the release hook).  Under the begin and end directories, we have the default scripts.

### Script Naming Conventions
You may create hooks for the states you care about by appropriately naming and organizing your folder structure.  For example, if you wanted to launch a script at the start of a migration hook, you would make the following directory structure for your script.

```
/hooks
└── migrate
   └── begin
       └── qhm_<SCRIPT_NAME>_device.sh
```

>**Note:** More than one script may be added per state. 

Replace <SCRIPT_NAME> with a name of your choosing, but keep the "qhr\_" prefix and "\_device" segment.  The "qhr\_" prefix is used by qemu-hook-manager to identify it as a script it may manage.  The "\_device" segment will be replaced with the name of the IOMMU group for your hardware.

All scripts installed on the host system are passed through an environment variable substitution program that replaces any `$IOMMU_GROUP_ID` occurrences with the IOMMU group of the hardware being passed through.  This is how you may reference the IOMMU group from within your scripts.

Available hook names and states include:

**Hook**|**State**
:-----:|:-----:
prepare|begin
start|begin
started|begin
stopped|end
release|end
migrate|begin
restore|begin
reconnect|begin
attach|begin

Further reading at https://www.libvirt.org/hooks.html#etc-libvirt-hooks-qemu

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the BSD 2-Clause License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or issues, please open an issue on the [GitHub repository](https://github.com/yourusername/qemu-hook-manager).


