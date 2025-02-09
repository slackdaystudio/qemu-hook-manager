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

## Custom Hooks
Adding a custom hook consists of picking the correct hook name and state name 
and having a script.  Add your hook and state folders into the 
`qemu_hook_skeleton` directory and drop your script into the state folder.

More than one script may be added per state.

When qemu-hook-manager installs the the hooks it will look for `hooks` under
the `qemu_hook_skeleton` directory.  Any directory file structure found will be
copied to `/etc/libvirt/hooks` on the host.

All scripts installed onto the host system go through a environment variable 
substiution program that replace any occurrences of the variable 
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

For example, if you wanted to perform 

Further reading at https://www.libvirt.org/hooks.html#etc-libvirt-hooks-qemu

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the BSD 2-Clause License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or issues, please open an issue on the [GitHub repository](https://github.com/yourusername/qemu-hook-manager).
