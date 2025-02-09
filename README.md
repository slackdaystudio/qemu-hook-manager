# QEMU Hook Manager

QEMU Hook Manager is a CLI tool designed to easily manage hardware passthrough for QEMU virtual machines. It allows users to easily configure and handle various hooks to automate tasks and enhance the functionality of their virtual environments.

For best results, make sure you have your virtualization CPU extensions enabled in your BIOS.  Feel free to use [my notes](https://github.com/slackdaystudio/qemu-gpu-passthrough) as a starting point to getting the prequisite hardware and configurations in place **before** running this tool.  You only need to follow the first three steps, then run this tool to cover the remaining steps.

## Features

- Manage pre-defined hooks for QEMU VMs
- Automate tasks such as automatic hardware binding
- Easy configuration and setup

## Requirements

 - Node 20+
 - virsh
 - qemu
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
    - You should be root in order to have proper acces rights to the hook directories
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

Both switches may be specified multiple times in a single command to specify 
more than one VM or piece of hardware.

For example, if you ran following command you would skip the guided experience.
```
qemu-hook-manager --iommuGroups=07:00.0 --iommuGroups=07:00.1 --domains=My-Awesome-VM --domains=My-Other-Awesome-VM
```

Assuming that all supplied paramaters are valid then the resulting hook 
structure in `/etc/libvirt/hooks` would look like this.

```
/etc/libvirt/hooks/
├── qemu
└── qemu.d
    ├── My-Awesome-VM -> /etc/libvirt/hooks/qemu.d/.qhm-passthrough
    │   ├── prepare
    │   │   └── begin
    │   │       ├── qhm_bind_vfio_00000700.0.sh
    │   │       └── qhm_bind_vfio_00000700.1.sh
    │   └── release
    │       └── end
    │           ├── qhm_unbind_vfio_00000700.0.sh
    │           └── qhm_unbind_vfio_00000700.1.sh
    ├── My-Other-Awesome-VM -> /etc/libvirt/hooks/qemu.d/.qhm-passthrough  [recursive, not followed]
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
Adding a custom hook consists of picking the correct hook name and state name 
and having a script.  Add your hook and state folders into the 
`qemu_hook_skeleton/hooks` directory and drop your script into your state 
folder.

>**Note:** More than one script may be added per state.

When qemu-hook-manager is ran, it will unpack any directory structure it finds 
in the `qemu_hook_skeleton/hooks` directory on the host.  The host directory 
structure may be found in `/etc/libvirt/hooks/qemu.d` on the host.

All scripts installed onto the host system go through a environment variable 
substiution program that replaces any occurrences of the variable 
`IOMMU_GROUP_ID` with the IOMMU group of the hardware being passed through.


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
