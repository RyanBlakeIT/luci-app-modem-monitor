#!/bin/sh
# Build an OpenWrt apk package (OpenWrt 25.x+) with apk-tools v3 ("apk mkpkg").
#   ./build.sh                      -> out/luci-app-modem-monitor-<version>-r<release>.apk
#   APK=/path/to/apk RELEASE=2 MAINTAINER="Name <mail>" URL=https://github.com/you/repo ./build.sh
set -e
cd "$(dirname "$0")"
APK=${APK:-apk}
RELEASE=${RELEASE:-1}
VERSION=$(sed -n 's/^VERSION = "\(.*\)"/\1/p' root/usr/bin/modem-monitor)
VER="$VERSION-r$RELEASE"
find root -name __pycache__ -prune -exec rm -rf {} +
mkdir -p root/lib/apk/packages
echo /etc/config/modem_monitor > root/lib/apk/packages/luci-app-modem-monitor.conffiles
(cd root && find . -type f -o -type l | sed 's#^\.##' | grep -v '^/lib/apk/' | sort) > root/lib/apk/packages/luci-app-modem-monitor.list
mkdir -p out
$APK mkpkg \
 --info "name:luci-app-modem-monitor" --info "version:$VER" \
 --info "description:Cable modem signal monitor with LuCI report, maintenance log and data export" \
 --info "arch:noarch" --info "license:MIT" --info "origin:luci-app-modem-monitor" \
 --info "maintainer:${MAINTAINER:-}" --info "url:${URL:-}" \
 --info "depends:python3 luci-base rpcd-mod-file" \
 --script "post-install:scripts/post-install" --script "post-upgrade:scripts/post-upgrade" \
 --script "pre-deinstall:scripts/pre-deinstall" --script "post-deinstall:scripts/post-deinstall" \
 --files root --output "out/luci-app-modem-monitor-$VER.apk"
echo "built out/luci-app-modem-monitor-$VER.apk"
