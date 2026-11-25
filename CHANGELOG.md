# Changelog

## 1.6.3
- **No more stale pages after an update.** LuCI's page scripts are installed in a folder named after the release (`view/modem-monitor/v1_6_3/`), and the menu points there. The browser can't keep running an old cached script after an upgrade; previously this could take a cache-clearing reload, as with the 1.6.2 Settings tabs.

## 1.6.2
- **Settings in tabs:** one tab per area (Modem, Alerts, Line quality, Network & weather, Outage credits, Speed tests, Backup, Integrations, Storage & pings, Guideline ranges, Updates) instead of one long page. The page reopens on the tab you last used, and Save & Apply covers all tabs.
- The installed version and update status are shown at the top of the page on every tab. **Test connection** moved into the Modem tab.

## 1.6.1
- **Latency probe target falls back automatically.** With the target set to `gateway` (the default), the probe checks that the ISP gateway answers pings. If it doesn't, the probe uses the next hop along the path that does, found by traceroute, and only then the first ping target. The report shows which target is in use and why.
- **The probe re-checks its target while running.** If the target stops answering while ordinary pings to the internet get through, that window is discarded rather than counted as dropouts, and a new target is chosen. A target that keeps dropping 20% or more for three samples while the internet is clean is replaced too. Every 6 hours the probe checks whether the gateway itself answers again.
- **Settings → Alerts is split into tabs:** General (on/off, what to alert on, thresholds, test), ntfy, Pushover, Telegram, Webhook, Email and Daily summary, each with setup notes.

## 1.6.0
Each of these can be turned on or off under Settings.
- **Outage credits** (on by default): an **Outages by month** card on the report shows outages, minutes, re-registrations, short dropouts, days affected and an estimated credit (prorated, and per affected day, if you enter your monthly price). The new **Credit letter** button drafts a request letter for a month from your name, account and address under Settings → Outage credits. You can edit the letter before printing or copying it. Planned work is left out, and outages you logged for times before monitoring began are listed as your own notes, not added to the measured total.
- **Off-router backup** (off by default): a nightly copy of all data files to a mounted folder (NAS/USB) or `user@host:/path` over SSH (rsync, else scp). It only copies changed files, never deletes at the destination and never copies the session state. **Back up now** button, `modem-monitor backup`, failure alerts, and the last result shown on the report.
- **Speed tests** (off by default): a daily test at a random minute in the chosen hour, against Cloudflare by default or any server with the same endpoints. It uses 4 streams per direction with a time and data limit (10 s / 250 MB), and measures latency idle and under load. Results go to a report chart, with dashed lines for your plan speeds, and the complaint summary notes tests below 80% of the plan. **Run a speed test now** button, `modem-monitor speedtest`.
- **More accurate outages:** a sample counts as an outage only when pings failed too. A modem status page that times out while the internet works (seen most mornings around 08:47 on the S33) is listed as information, not an outage, in the report, complaint summary and credit letter.

## 1.5.1
- New maintenance type **Wiring / attenuation change** (`wiring`) for splitters, pads, cables and connectors. Like tech visits and planned reboots, these count as planned work, so the complaint summary leaves out the disruption they cause.
- The Maintenance Log tab numbers entries by time, matching the numbers on the report's chart markers. A back-dated entry no longer shows up out of sequence. The stored ID that the `maint-*` commands use is shown on hover.

## 1.5.0
Each of these can be turned on or off under Settings.
- **1-second latency probe** (Settings → Line quality; off by default): one small ping per second to the ISP gateway, or an address you choose, run inside the monitor. Each sample records jitter, p95 and worst latency, the share of pings lost, **short dropouts** (2+ seconds without a reply, adjustable) and the longest one. It shows up in:
  - report tiles and charts, plus incidents
  - alerts (new **Short dropouts** type)
  - the daily summary and the complaint summary
  - Prometheus metrics and Home Assistant sensors
- **Channel watch** (on by default): flags samples where the modem holds fewer bonded channels than its most in the last 24 hours (partial service). Shown as a report tile and incidents, alerted as **Modem lost channels** (and when they come back), and counted in the complaint summary.
- **Daily summary** (Settings → Alerts; off by default): one notification each morning at a time you choose, summarizing yesterday as a "Clean day" or "Problems" line. It's also published to MQTT. **Send yesterday's summary now** button, and `modem-monitor digest [--day] [--send]`.
- **Status → Overview tile** (on by default): modem state, levels, channel counts, today's T3/T4 and uncorrectables, packet loss, jitter and dropouts, and the age of the last sample, with a link to the report.

## 1.4.1
- The install-update dialog leads with a plain result ("Version X is installed", and whether the package signature was required) in normal-size text. The raw log is in a collapsible section in larger type, opened automatically if something failed.
- Upgrades no longer leave `/etc/config/modem_monitor.apk-new` behind. Your settings are kept as before; new options take their defaults from the program.

## 1.4.0
- **Signed releases:** packages are signed in CI with the project key, and the public key ships in the package (`/etc/apk/keys/luci-app-modem-monitor.pem`) and with each release. Once 1.4.0 is installed, in-browser updates install without `--allow-untrusted`, and apk refuses any update without a valid signature from that key, on top of the SHA-256 check.
- **More modems:** a driver layer with auto-detection, set under **Settings → Modem type**:
  - S33/S34 (HNAP)
  - Arris SB8200, SB6183 and SB6190 (HTML status pages, including the SB8200 login)
  - Netgear CM600 to CM3000

  The new drivers follow published page layouts and are tested against mock pages; reports from real hardware are welcome. Rebooting from the router remains S33/S34-only.
- **Compressed history:** monthly data files older than last month are gzip-compressed daily, about 10–17x smaller. Reports, summaries, downloads and exports read them as before. Turn this off under Settings → Storage, or run it now with `modem-monitor compress`.
- **Complaint summary leaves out planned work:** the time covered by confirmed tech-visit, modem-reboot and router-change entries is not counted, from the start of the work until the line settles (the first two clean samples within an hour, otherwise 15 minutes after it ends). A **Left out of the counts** section lists each window and what it contained. Turn this off with the checkbox in the dialog or `summary --all`.
- Traceroute logs are included in exports, with public IP addresses masked like everything else.
- ntfy alerts show proper icons (📡, ⚠️, ✅) instead of a text tag.

## 1.3.0
- **ISP gateway ping:** every sample also pings the first hop past the modem (the WAN default gateway). The packet loss and latency charts show the internet and the gateway side by side. The complaint summary notes when the loss starts on the local cable segment.
- **Traceroute during packet loss:** saved automatically, at most every 15 minutes, to `traces-YYYY-MM.log`. Shown on the report and counted in the complaint summary.
- **Weather:** optional outdoor temperature and precipitation from Open-Meteo, with a temperature chart. The report and complaint summary note when upstream or downstream power follow temperature (correlation ±0.5 or stronger), or when errors are much higher during rain.
- **Prometheus:** `metrics.txt` in the web directory: per-channel downstream power, SNR and codeword counters; upstream power; uptime; event log counts by type; ping and gateway loss and latency; temperature. Optional extra copy for a node-exporter textfile collector.
- **MQTT / Home Assistant:** state published to `<topic>/state` every sample, alerts to `<topic>/alert`, and Home Assistant discovery for 12 sensors and an online binary sensor. Needs `mosquitto-client-ssl` or `-nossl`.
- **Zabbix:** template `examples/zabbix/modem_monitor_by_http.yaml` (HTTP agent on `latest.json`; triggers for modem unreachable, reboot, upstream power, SNR, uncorrectables, gateway loss and stalled sampling).
- New Settings sections: **Network path & weather** and **Integrations**.

## 1.2.2
- Settings shows the installed version at the top, with the update status (up to date, or a newer version with a link to install it) and when GitHub was last checked. The Updates section moved to the top of the page.
- Updates are checked every 6 hours instead of once a day, so a new release shows up sooner. **Check now** refreshes the status in place.

## 1.2.1
- **What's new** dialog shows the release notes as formatted text (bullets, bold) at normal size, instead of a small fixed-width block.

## 1.2.0
- **Alerts:** ntfy (just enter a topic name), Pushover, Telegram, JSON webhook or email. They cover:
  - modem unreachable, and back online
  - reboots you didn't start
  - re-registrations
  - T3/T4 bursts
  - uncorrectable spikes, naming the affected channels when the errors are concentrated
  - upstream power above the guideline
  - packet loss
  Thresholds and a per-type cooldown are on the new Settings → Alerts section, along with **Send a test alert**. Alerts raised while the internet is down are kept and delivered once it is back.
- **Downstream errors by channel:** a heatmap of uncorrectables per channel over time on the report, for each time range.
- **Ingress detection:** days with 1,000+ uncorrectables are classed as concentrated on 3 adjacent channels (typical of RF ingress, with the frequency range given) or spread across the band.
- **Complaint summary:** a printable page for any date range, opened from the new **Complaint summary** button or `modem-monitor summary --from --to`. It contains plain-language findings, key counts, daily charts and table, repairs and calls, outages, and the modem's timeout messages (with MAC addresses removed). Reboots covered by a planned-reboot or tech-visit entry are not counted as unexplained.
- CLI: `summary`, `alert-test [--json]`.
- UCI list options (such as `alert_on`) are read correctly.

## 1.1.4
- **Updates from GitHub:** checks the repository's latest release once a day, and when the Signal Report page opens if the last check is over a day old. When a newer version exists, the page shows a banner with **What's new** and **Install update**.
- Installing downloads the release `.apk` (or `.ipk` on opkg systems), verifies its size and SHA-256 against the checksum GitHub publishes, and installs it with the package manager in the background while the page shows progress. Nothing is installed without a click.
- Settings → Updates: turn the daily check on or off, set the repository (for forks), and **Check now**.
- CLI: `update-check [--json]`, `update-install`, `update-status`.
- New dependency: `ca-bundle` (certificates for HTTPS; normally already installed).

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
