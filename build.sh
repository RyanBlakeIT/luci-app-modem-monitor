#!/bin/sh
# Build an OpenWrt apk package (OpenWrt 25.x+) with apk-tools v3 ("apk mkpkg").
#   ./build.sh                      -> out/luci-app-modem-monitor-<version>-r<release>.apk
#   APK=/path/to/apk RELEASE=2 MAINTAINER="Name <mail>" URL=https://github.com/you/repo ./build.sh
#   SIGN_KEY=/path/to/private.pem ./build.sh   -> signed package (ECDSA prime256v1 key)
set -e
# Releases from CI must be signed from 1.4.0 on (checked by the workflow).
SIGNED_RELEASES=1
cd "$(dirname "$0")"
APK=${APK:-apk}
RELEASE=${RELEASE:-1}
VERSION=$(sed -n 's/^VERSION = "\(.*\)"/\1/p' root/usr/bin/modem-monitor)
VER="$VERSION-r$RELEASE"
find root -name __pycache__ -prune -exec rm -rf {} +
# Stage a copy of root/. The LuCI views go into a folder named after the
# version and the menu points there, so browsers can never run a cached page
# script from an older release (LuCI's own cache key doesn't change with ours).
VT="v$(echo "$VERSION" | tr '.' '_')"
STAGE=build/root
rm -rf build && mkdir -p build && cp -a root "$STAGE"
VIEWS="$STAGE/www/luci-static/resources/view/modem-monitor"
mkdir -p "$VIEWS/$VT"
for f in "$VIEWS"/*.js; do mv "$f" "$VIEWS/$VT/"; done
# the Status > Overview tile is found by file name, so version that too
INC="$STAGE/www/luci-static/resources/view/status/include"
[ -f "$INC/70_modem_monitor.js" ] && mv "$INC/70_modem_monitor.js" "$INC/70_modem_monitor_$VT.js"
sed -i "s#\"modem-monitor/\(report\|maintenance\|settings\)\"#\"modem-monitor/$VT/\1\"#" \
	"$STAGE/usr/share/luci/menu.d/luci-app-modem-monitor.json"
grep -q "modem-monitor/$VT/report" "$STAGE/usr/share/luci/menu.d/luci-app-modem-monitor.json"
rm -rf "$STAGE/lib/apk"
mkdir -p "$STAGE/lib/apk/packages"
echo /etc/config/modem_monitor > "$STAGE/lib/apk/packages/luci-app-modem-monitor.conffiles"
(cd "$STAGE" && find . -type f -o -type l | sed 's#^\.##' | grep -v '^/lib/apk/' | sort) > "$STAGE/lib/apk/packages/luci-app-modem-monitor.list"
mkdir -p out
SIGN=""
[ -n "$SIGN_KEY" ] && SIGN="--sign-key $SIGN_KEY"
# shellcheck disable=SC2086
$APK mkpkg $SIGN \
 --info "name:luci-app-modem-monitor" --info "version:$VER" \
 --info "description:Cable modem signal monitor with LuCI report, maintenance log and data export" \
 --info "arch:noarch" --info "license:MIT" --info "origin:luci-app-modem-monitor" \
 --info "maintainer:${MAINTAINER:-}" --info "url:${URL:-}" \
 --info "depends:python3 luci-base rpcd-mod-file ca-bundle" \
 --script "post-install:scripts/post-install" --script "post-upgrade:scripts/post-upgrade" \
 --script "pre-deinstall:scripts/pre-deinstall" --script "post-deinstall:scripts/post-deinstall" \
 --files "$STAGE" --output "out/luci-app-modem-monitor-$VER.apk"
echo "built out/luci-app-modem-monitor-$VER.apk"
