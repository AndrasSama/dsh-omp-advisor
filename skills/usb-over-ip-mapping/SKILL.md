---
name: usb-over-ip-mapping
description: Equips the advisor to evaluate USB-over-IP setups (usbip/vhci) for device stability, security exposure, and reconnect handling.
---

# USB Over IP Mapping

Reviews exporting USB devices across the network (USB/IP, usbipd-win, vendor extenders) — common in homelabs for Zigbee/Z-Wave dongles, license keys, and serial devices. The protocol is unauthenticated and the mapping is fragile across reboots; both need explicit handling.

## Watch for
- USB/IP port (3240) reachable beyond the trusted LAN — the protocol has no authentication or encryption; anyone can attach devices.
- Whole hubs exported instead of a single device — everything downstream becomes attachable.
- No auto-rebind on reboot: the device was exported once by hand and is gone after every host restart.
- Device identity by `/dev/bus/usb/...` path that changes across reboots instead of stable udev symlinks.
- Latency-sensitive devices (audio, HID) routed over Wi-Fi paths — dropouts.
- Client and server kernel module versions mismatched (vhci-hcd vs usbip-host).
- No monitoring: the device silently detached for days (a Zigbee network degrades with no alarm).
- USB autosuspend suspending the exported device mid-use.

## Best practices
- Firewall port 3240 to specific client IPs; never expose it to the WAN; prefer carrying it over a WireGuard tunnel.
- Export exactly one device by busid; document the busid → function mapping.
- Stable naming: udev rules matching vendor/product/serial to a symlink; bind scripts keyed on the symlink.
- Automate bind/export at boot (systemd unit running `usbip bind` + attach) with retry/backoff.
- Disable USB autosuspend for exported devices (`usbcore.autosuspend=-1` or per-device quirks).
- Monitor attachment state: poll `usbip port` / device-node presence; alert on detach.
- Pin kernel/module versions on both ends; test the upgrade procedure.
- For Zigbee/Z-Wave: keep the extender host close to the dongle and verify network health metrics after moves.

## Quick checklist
- [ ] Port 3240 firewalled to known clients or tunneled
- [ ] Single device exported, not a hub
- [ ] udev stable symlink in use
- [ ] Boot-time auto bind/attach with retry
- [ ] Autosuspend disabled for the device
- [ ] Detach monitoring and alerting
- [ ] Client/server module versions matched
- [ ] Latency path appropriate for the device class
