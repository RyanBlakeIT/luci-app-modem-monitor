# OpenWrt / LuCI feed Makefile, for building with the OpenWrt SDK or buildroot
# (produces .ipk or .apk depending on the SDK). Copy this directory into
# feeds/luci/applications/ (or a custom feed) and run:
#   make package/luci-app-modem-monitor/compile
# Not needed for build.sh, which builds an .apk directly with apk-tools v3.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-modem-monitor
PKG_VERSION:=1.6.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=RyanBlakeIT

LUCI_TITLE:=Cable modem signal monitor and evidence report
LUCI_DESCRIPTION:=Logs DOCSIS cable modem signal levels, error counters and event log \
	(tested with the Arris SURFboard S33), with a LuCI report, maintenance log, \
	modem reboot and data export.
LUCI_DEPENDS:=+python3 +luci-base +rpcd-mod-file +ca-bundle
LUCI_PKGARCH:=all

define Package/luci-app-modem-monitor/conffiles
/etc/config/modem_monitor
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
