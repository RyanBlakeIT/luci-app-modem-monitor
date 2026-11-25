# Changelog

## 1.1.3
- Event log timestamps follow the modem's clock display. After a reboot the S33 can briefly show its log in UTC (startup entries as 1/1/1970 00:00 instead of 31/12/1969 19:00) before it gets its time zone. The monitor now reads `CustomerCurSystemTime` every sample to know which is in effect, and identifies log entries by their real time, so a re-rendered log is no longer stored a second time, hours late.
- One-time repair of `events.csv`: re-times startup entries and removes UTC copies of entries already stored.
- "Show data since" identifies entries by number, so two entries that settle at the same time no longer get mixed up in the dropdown.
- `system.txt` shows whether the modem clock displays local time or UTC.

## 1.1.2
- "Show data since" for entries without an end time now starts at the first two clean samples afterwards (modem reachable, no reboot or re-registration, no packet loss). For a modem reboot it starts after the sample that sees the reboot. The disruption of the work itself is no longer counted, and the banner shows the exact start time.
- Releases are created automatically by GitHub Actions when `VERSION` changes on `main`.

## 1.1.1
- First install picks the storage location and retention automatically (largest persistent mount with 512 MB or more free, else `/root`; 400, 180 or 90 days by free space). Existing configs and data are never changed.

## 1.1.0
- **Show data since** filter on the report: tiles, charts, daily summary, incidents and event log start after a chosen maintenance entry.
- **Maintenance Log** tab in LuCI with an inline form, plus confirm/edit/delete.
- Generic settings: `isp_name`, `report_title`, `report_note`; EEE/LED reboot fallbacks on the Settings page.

## 1.0.8
- Maintenance log (CLI), automatic suggestions, chart markers, 24 h before/after comparison.
- Reboot modem from the router (logged).
- Reboot vs re-registration told apart by modem uptime, including in older history.
- Host-route modem access by default; alias mode labelled `<dev>:mm`; DDNS conflict check.
- `rx_missed` (NIC overruns) separated from cable/port errors and flagged above 100 per sample.
- `system.txt`: IRQ affinity, RPS, netdev sysctls, modem model and firmware.

## 1.0.7
- Clearer report header (newest sample, build time, both schedules) and a stale-data warning.

## 1.0.6
- **Download all data**: one zip of CSVs, the report and diagnostics, with addresses masked.

## 1.0.5
- Router–modem Ethernet counters, link drops and speed changes; automatic re-login after a modem reboot.

## 1.0.4
- Setup errors (missing or wrong password) no longer counted as outages.

## 1.0.3
- Files are written world-readable when run from LuCI (uhttpd 403 fix).

## 1.0.2
- Event-log entries written before the modem's clock is set are placed at the real boot time; DRW warnings counted.

## 1.0.1
- Supports firmware that returns the event log without the `GetMultipleHNAPsResponse` wrapper.

## 1.0.0
- First release: S33 polling (HNAP login, SHA-256/MD5, HTTPS/HTTP), CSV history, LuCI report and settings.
