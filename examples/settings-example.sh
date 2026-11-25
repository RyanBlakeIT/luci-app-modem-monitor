#!/bin/sh
# Example: apply your own settings in one go (edit the values, then run on the router).
# Every option is also editable in LuCI under Status > Cable Modem > Settings.
uci batch <<'UCI'
set modem_monitor.main.isp_name='Example Cable'
set modem_monitor.main.report_title=''
set modem_monitor.main.report_note='Account 12345 · Complaint 67890'
set modem_monitor.main.password='YOUR-MODEM-PASSWORD'
set modem_monitor.main.data_dir='/mnt/usb/modem-monitor'
set modem_monitor.main.retention_days='365'
set modem_monitor.main.wan_device=''
set modem_monitor.main.modem_route='host'
set modem_monitor.main.modem_eee='0'
set modem_monitor.main.modem_led='1'
set modem_monitor.main.ping_targets='1.1.1.1 8.8.8.8'
UCI
uci commit modem_monitor
/etc/init.d/modem-monitor restart
