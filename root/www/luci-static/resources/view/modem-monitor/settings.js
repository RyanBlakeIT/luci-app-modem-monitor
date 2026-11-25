'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';

function versionLine(ver, upd) {
	var cur = (upd && upd.current) || ver || '?';
	if (upd && upd.newer)
		return _('Version %s; version %s is available (see the Updates tab).').format(cur, upd.latest);
	return _('Version %s.').format(cur) + ((upd && upd.latest && !upd.error) ? ' ' + _('Up to date.') : '');
}

/* One tab per settings section (all options live in one UCI section, so
   LuCI's own tabbed-map mode can't be used). The last tab is remembered. */
function pageTabs(node) {
	var secs = Array.prototype.filter.call(node.querySelectorAll('.cbi-section'), function(el) {
		return !el.parentNode.closest('.cbi-section') && el.querySelector('h3');
	});
	if (secs.length < 2) return node;
	var key = 'mm-settings-tab', cur = 0;
	try { cur = Math.min(secs.length - 1, +(sessionStorage.getItem(key) || 0)); } catch (e) {}
	var items = [];
	var show = function(i) {
		secs.forEach(function(el, k) { el.style.display = (k === i) ? '' : 'none'; });
		items.forEach(function(li, k) { li.className = (k === i) ? 'cbi-tab' : 'cbi-tab-disabled'; });
		try { sessionStorage.setItem(key, String(i)); } catch (e) {}
	};
	secs.forEach(function(el, i) {
		var h = el.querySelector('h3');
		items.push(E('li', { 'class': 'cbi-tab-disabled' }, E('a', { 'href': '#', 'click': function(ev) { ev.preventDefault(); show(i); } }, h.textContent)));
		h.style.display = 'none';  /* the tab already says it */
	});
	secs[0].parentNode.insertBefore(E('ul', { 'class': 'cbi-tabmenu', 'style': 'margin-bottom:10px' }, items), secs[0]);
	show(cur);
	return node;
}

return view.extend({
	testConnection: function() {
		ui.showModal(_('Testing modem connection'), [
			E('p', { 'class': 'spinning' }, _('Logging in to the modem…'))
		]);
		return fs.exec('/usr/bin/modem-monitor', [ 'test' ]).then(function(res) {
			var out = ((res.stdout || '') + (res.stderr || '')).trim();
			ui.showModal(_('Modem connection test'), [
				E('pre', { 'style': 'max-height:60vh;overflow:auto;white-space:pre-wrap;font-size:12px' }, out),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')))
			]);
		}).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('Test failed to run: ') + e.message), 'danger');
		});
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec('/usr/bin/modem-monitor', [ 'version' ]).then(function(r) { return (r.stdout || '').trim(); }), ''),
			L.resolveDefault(fs.exec('/usr/bin/modem-monitor', [ 'update-check', '--json', '--cached' ]).then(function(r) {
				try { return JSON.parse(r.stdout || 'null'); } catch (e) { return null; }
			}), null)
		]);
	},

	render: function(data) {
		var m, s, o, ver = data[0], upd = data[1], self = this;

		m = new form.Map('modem_monitor', _('Cable Modem Monitor'),
			_('Polls the cable modem (tested with the Arris SURFboard S33) for signal levels, error counters and its event log, and pings the internet, every few minutes. Save & Apply, then use "Test connection" on the Modem tab.') + ' ' + versionLine(ver, upd));

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Modem'));

		o = s.option(form.Button, '_test', _('Test connection'), _('Logs in to the modem with the saved settings and shows what it returns. Save & Apply first.'));
		o.inputtitle = _('Test connection');
		o.inputstyle = 'action';
		o.onclick = function() { return self.testConnection(); };

		o = s.option(form.Flag, 'enabled', _('Enable monitoring'));
		o.rmempty = false;

		o = s.option(form.Value, 'isp_name', _('ISP name'),
			_('Optional. Shown in the report title and text, e.g. "Comcast" or "Spectrum".'));
		o.placeholder = _('your ISP');

		o = s.option(form.Flag, 'overview_tile', _('Tile on Status → Overview'),
			_('Shows current levels and today\'s errors on the router\'s main status page.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'report_title', _('Report title'),
			_('Optional. Replaces "Cable modem signal report".'));
		o.optional = true;

		o = s.option(form.Value, 'report_note', _('Report note'),
			_('Optional line shown under the report title, e.g. "Account 12345 \u00b7 Complaint 67890 \u00b7 123 Main St".'));
		o.optional = true;

		o = s.option(form.ListValue, 'modem_type', _('Modem type'),
			_('Auto-detect works for most modems. Tested: Arris S33. Also supported, from published page layouts (please report how it goes): S34, SB8200, SB6183, SB6190 and Netgear CM600 to CM3000. Rebooting from the router works on S33/S34 only; the Netgear event log isn\'t read yet.'));
		o.value('auto', _('Auto-detect'));
		o.value('s33', _('Arris S33 / S34 (HNAP)'));
		o.value('arris_html', _('Arris SB8200 / SB6183 / SB6190 (HTML pages)'));
		o.value('netgear', _('Netgear CM series'));
		o.default = 'auto';

		o = s.option(form.Value, 'host', _('Modem address'));
		o.datatype = 'host';
		o.placeholder = '192.168.100.1';

		o = s.option(form.Value, 'username', _('Username'));
		o.placeholder = 'admin';

		o = s.option(form.Value, 'password', _('Password'),
			_('The modem web UI password. On the S33 the default is usually the last 8 characters of the serial number on the label (case-sensitive), unless you changed it.'));
		o.password = true;

		o = s.option(form.Value, 'interval', _('Sample every (seconds)'));
		o.datatype = 'range(60,3600)';
		o.placeholder = '300';

		o = s.option(form.Value, 'report_interval', _('Rebuild report every (seconds)'),
			_('How often the report page is refreshed with new samples. Samples are recorded either way.'));
		o.datatype = 'range(60,3600)';
		o.placeholder = '900';

		o = s.option(form.ListValue, 'modem_route', _('How the router reaches the modem'),
			_('Host route (recommended): adds a route to the modem address over the WAN port and no extra address. Alias: adds a 192.168.100.x address to the WAN port (labelled <em>wan-device</em>:mm); DDNS clients set to read the WAN interface (ip_source=interface) can mistake it for your public IP. Off: you set up access yourself.'));
		o.value('host', _('Host route (recommended)'));
		o.value('alias', _('Alias address on the WAN port'));
		o.value('off', _('Off'));
		o.default = 'host';
		o.cfgvalue = function(sid) {
			var v = uci.get('modem_monitor', sid, 'modem_route');
			if (v) return v;
			return uci.get('modem_monitor', sid, 'add_modem_route') === '0' ? 'off' : 'host';
		};

		o = s.option(form.Value, 'modem_alias_ip', _('Alias address'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.100.10';
		o.depends('modem_route', 'alias');

		o = s.option(form.ListValue, 'modem_eee', _('Reboot: EEE setting to keep'),
			_('The modem\'s reboot command also re-sends its Energy-Efficient Ethernet and LED settings. They are read live from the modem first; these are only used if that read fails. Match what the modem\'s Configuration page shows.'));
		o.value('0', _('0 (EEE off)'));
		o.value('1', _('1 (EEE on)'));
		o.default = '0';

		o = s.option(form.ListValue, 'modem_led', _('Reboot: LED setting to keep'));
		o.value('1', _('1 (LEDs on)'));
		o.value('0', _('0 (LEDs off)'));
		o.default = '1';

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Alerts'),
			_('Phone or email notifications when the line misbehaves. Turn alerts on under General, pick what to be told about, then fill in one or more services (ntfy is the easiest: free, no account). Alerts raised while the internet is down are sent once it is back.'));
		s.tab('general', _('General'));
		s.tab('ntfy', _('ntfy'));
		s.tab('pushover', _('Pushover'));
		s.tab('telegram', _('Telegram'));
		s.tab('webhook', _('Webhook'));
		s.tab('email', _('Email'));
		s.tab('digest', _('Daily summary'));

		/* General: on/off, what to alert on, thresholds, test */
		o = s.taboption('general', form.Flag, 'alert_enabled', _('Send alerts'));
		o.rmempty = false;

		o = s.taboption('general', form.MultiValue, 'alert_on', _('Alert on'));
		o.value('outage', _('Modem unreachable / back online'));
		o.value('reboot', _('Modem rebooted on its own'));
		o.value('relock', _('Modem re-registered (lost signal)'));
		o.value('t3t4', _('T3/T4 timeouts'));
		o.value('uncorr', _('Uncorrectable error spike'));
		o.value('us_power', _('Upstream power above the guideline'));
		o.value('loss', _('Packet loss'));
		o.value('channels', _('Modem lost bonded channels'));
		o.value('dropouts', _('Short dropouts (needs the 1-second probe)'));
		o.default = 'outage reboot relock t3t4 uncorr us_power loss channels dropouts';

		[ [ 'alert_t3t4_count', _('T3/T4 timeouts within an hour'), '3', 'range(1,100)' ],
		  [ 'alert_uncorr', _('Uncorrectables in one sample'), '5000', 'uinteger' ],
		  [ 'alert_loss', _('Packet loss in one sample (%)'), '20', 'range(1,100)' ],
		  [ 'alert_outage_polls', _('Failed samples in a row before "unreachable"'), '2', 'range(1,12)' ],
		  [ 'alert_dropouts', _('Short dropouts in one sample'), '3', 'range(1,300)' ],
		  [ 'alert_cooldown_min', _('Repeat the same alert at most every (minutes)'), '60', 'range(0,1440)' ] ].forEach(function(f) {
			o = s.taboption('general', form.Value, f[0], f[1]);
			o.placeholder = f[2];
			o.datatype = f[3];
		});

		o = s.taboption('general', form.Button, '_alert_test', _('Test'),
			_('Sends a test to every service that is filled in and shows which worked. Uses the saved settings, so Save & Apply first.'));
		o.inputtitle = _('Send a test alert');
		o.inputstyle = 'action';
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'alert-test' ]).then(function(res) {
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' },
					((res.stdout || '') + (res.stderr || '')).trim() || _('No answer.')), res.code === 0 ? 'info' : 'warning');
			});
		};

		/* ntfy */
		o = s.taboption('ntfy', form.Value, 'alert_ntfy_url', _('Topic or URL'),
			_('Install the free <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a> app and subscribe to a topic name. Enter the same name here (sent to ntfy.sh), or a full URL such as https://ntfy.example.com/modem for a self-hosted server. Anyone who knows a public topic name can read it, so pick something long and random.'));
		o.placeholder = 'modem-' + Math.random().toString(36).slice(2, 12);

		o = s.taboption('ntfy', form.Value, 'alert_ntfy_token', _('Access token'), _('Only for protected topics.'));
		o.password = true;

		/* Pushover */
		o = s.taboption('pushover', form.Value, 'alert_pushover_user', _('User key'),
			_('From your <a href="https://pushover.net" target="_blank" rel="noopener">Pushover</a> dashboard.'));
		o = s.taboption('pushover', form.Value, 'alert_pushover_token', _('App token'),
			_('Create an application in Pushover and paste its API token.'));
		o.password = true;

		/* Telegram */
		o = s.taboption('telegram', form.Value, 'alert_telegram_token', _('Bot token'),
			_('Create a bot by messaging @BotFather in Telegram; it replies with the token.'));
		o.password = true;
		o = s.taboption('telegram', form.Value, 'alert_telegram_chat', _('Chat ID'),
			_('Send your bot a message, then open https://api.telegram.org/bot&lt;token&gt;/getUpdates and copy the number after "chat":{"id":'));

		/* Webhook */
		o = s.taboption('webhook', form.Value, 'alert_webhook_url', _('Webhook URL'),
			_('Receives a JSON POST: {"title", "message", "kind", "priority", "ts", "host"}. Works with Home Assistant automations, n8n, Node-RED and similar.'));
		o.placeholder = 'https://homeassistant.local:8123/api/webhook/modem-alerts';

		/* Email */
		o = s.taboption('email', form.Value, 'alert_email_to', _('Send to'),
			_('Needs a working sendmail on the router: install the msmtp package and set it up with your mail provider (for Gmail, use an app password).'));
		o.placeholder = 'you@example.com';
		o = s.taboption('email', form.Value, 'alert_email_from', _('From address'), _('Optional.'));
		o.placeholder = 'modem-monitor@router';

		/* Daily summary */
		o = s.taboption('digest', form.Flag, 'daily_digest', _('Send a daily summary'),
			_('Each morning, one notification summarizing yesterday (timeouts, errors, levels, outages, dropouts), sent to the services on the other tabs. Quiet days are worth having on record too.'));
		o.rmempty = false;

		o = s.taboption('digest', form.ListValue, 'digest_hour', _('Send at'));
		for (var h = 0; h < 24; h++)
			o.value(String(h), '%02d:00'.format(h));
		o.default = '8';
		o.depends('daily_digest', '1');

		o = s.taboption('digest', form.Button, '_digest_test', _('Try it'));
		o.inputtitle = _('Send yesterday\'s summary now');
		o.inputstyle = 'action';
		o.depends('daily_digest', '1');
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'digest', '--send' ]).then(function(res) {
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, ((res.stdout || '') + (res.stderr || '')).trim()), 'info');
			});
		};

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Line quality'));

		o = s.option(form.Flag, 'hires_ping', _('1-second latency probe'),
			_('Sends one small ping per second (about 1 KB/s) to catch jitter and short dropouts of a few seconds that the regular samples miss. Shown on the report, in alerts, the daily summary and the complaint summary.'));
		o.rmempty = false;

		o = s.option(form.Value, 'hires_target', _('Probe target'),
			_('"gateway" = the ISP\'s first hop past the modem (recommended: it measures your cable segment). Or an address such as 1.1.1.1. Some ISP gateways answer pings at low priority, which can add occasional latency spikes of their own.'));
		o.placeholder = 'gateway';
		o.depends('hires_ping', '1');

		o = s.option(form.Value, 'hires_drop_min', _('Seconds without reply that count as a dropout'));
		o.datatype = 'range(1,30)';
		o.placeholder = '2';
		o.depends('hires_ping', '1');

		o = s.option(form.Flag, 'channel_watch', _('Watch for missing channels'),
			_('Flags samples where the modem holds fewer bonded channels than it did in the last 24 hours (partial service), on the report and in alerts.'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Network & weather'));

		o = s.option(form.Flag, 'gw_ping', _('Ping the ISP gateway'),
			_('Also pings the first hop past the modem (the WAN default gateway). If it loses packets too, the problem is on the local cable segment rather than further out on the internet.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'gw_target', _('Gateway address'), _('Leave empty to use the WAN default gateway.'));
		o.datatype = 'host';
		o.placeholder = _('auto');
		o.depends('gw_ping', '1');

		o = s.option(form.Flag, 'trace_on_loss', _('Traceroute during packet loss'),
			_('Saves a traceroute to the first ping target when packets are lost (at most every 15 minutes). Shown on the report.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'weather_lat', _('Weather: latitude'),
			_('Optional. Records outdoor temperature and precipitation from <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (free, no account) so the report can show whether levels or errors follow the weather. Two decimals (about 1 km) is plenty. Find yours by right-clicking a spot in Google Maps.'));
		o.datatype = 'range(-90,90)';
		o.placeholder = '37.08';

		o = s.option(form.Value, 'weather_lon', _('Weather: longitude'));
		o.datatype = 'range(-180,180)';
		o.placeholder = '-76.47';

		o = s.option(form.ListValue, 'weather_unit', _('Temperature unit'));
		o.value('C', '°C');
		o.value('F', '°F');
		o.default = 'C';

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Outage credits'),
			_('Totals outages per month on the report (leaving out planned work) and drafts a credit-request letter from the Cable Modem page.'));

		o = s.option(form.Flag, 'credit_enabled', _('Track outage credits'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'credit_monthly_price', _('Monthly price ($)'), _('Optional. Used to estimate the credit.'));
		o.datatype = 'ufloat';
		o.depends('credit_enabled', '1');
		o = s.option(form.Value, 'credit_name', _('Your name'));
		o.depends('credit_enabled', '1');
		o = s.option(form.Value, 'credit_account', _('Account number'));
		o.depends('credit_enabled', '1');
		o = s.option(form.TextValue, 'credit_address', _('Service address'));
		o.rows = 2;
		o.depends('credit_enabled', '1');

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Speed tests'),
			_('Optional daily download and upload test from the router (default server: Cloudflare), with latency measured while idle and under load. Each test uses up to the data limit below in each direction, so mind any data cap. Traffic shaping (SQM) on the router caps the results.'));

		o = s.option(form.Flag, 'speedtest_enabled', _('Daily speed test'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'speedtest_hour', _('Run at (hour)'), _('A random minute within the hour is used.'));
		for (var sh = 0; sh < 24; sh++)
			o.value(String(sh), '%02d:xx'.format(sh));
		o.default = '3';
		o.depends('speedtest_enabled', '1');

		o = s.option(form.Value, 'speedtest_seconds', _('Seconds per direction'));
		o.datatype = 'range(3,30)';
		o.placeholder = '10';
		o.depends('speedtest_enabled', '1');

		o = s.option(form.Value, 'speedtest_max_mb', _('Data limit per direction (MB)'));
		o.datatype = 'range(10,5000)';
		o.placeholder = '250';
		o.depends('speedtest_enabled', '1');

		o = s.option(form.Value, 'plan_down', _('Plan download (Mb/s)'), _('Optional. Shown on the chart; the complaint summary counts tests below 80% of it.'));
		o.datatype = 'ufloat';
		o = s.option(form.Value, 'plan_up', _('Plan upload (Mb/s)'));
		o.datatype = 'ufloat';

		o = s.option(form.Value, 'speedtest_url', _('Server'), _('Any server with Cloudflare-style /__down and /__up endpoints.'));
		o.placeholder = 'https://speed.cloudflare.com';
		o.depends('speedtest_enabled', '1');

		o = s.option(form.Button, '_speed_now', _('Test'));
		o.inputtitle = _('Run a speed test now');
		o.inputstyle = 'action';
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'speedtest', '--background' ]).then(function(res) {
				ui.addNotification(null, E('p', {}, ((res.stdout || '') + (res.stderr || '')).trim()), 'info');
			});
		};

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Backup'),
			_('Copies the data files off the router once a night, so a failed SD card or USB drive doesn\'t take your history with it. Nothing is deleted at the destination.'));

		o = s.option(form.Flag, 'backup_enabled', _('Nightly backup'));
		o.rmempty = false;

		o = s.option(form.Value, 'backup_dest', _('Destination'),
			_('A mounted folder (for example a NAS share at /mnt/nas/modem-monitor), or <code>user@host:/path</code> over SSH. For SSH, install <code>rsync</code> (or <code>openssh-client</code>) and add this router\'s public key (<code>dropbearkey -y -f /root/.ssh/id_dropbear</code>) to the other machine\'s authorized_keys.'));
		o.placeholder = '/mnt/nas/modem-monitor';
		o.depends('backup_enabled', '1');

		o = s.option(form.Value, 'backup_ssh_key', _('SSH key'), _('Only for user@host destinations.'));
		o.placeholder = '/root/.ssh/id_dropbear';
		o.depends('backup_enabled', '1');

		o = s.option(form.ListValue, 'backup_hour', _('Back up at'));
		for (var bh = 0; bh < 24; bh++)
			o.value(String(bh), '%02d:00'.format(bh));
		o.default = '3';
		o.depends('backup_enabled', '1');

		o = s.option(form.Button, '_backup_now', _('Test'));
		o.inputtitle = _('Back up now');
		o.inputstyle = 'action';
		o.depends('backup_enabled', '1');
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'backup' ]).then(function(res) {
				ui.addNotification(null, E('p', {}, ((res.stdout || '') + (res.stderr || '')).trim() + ' ' + _('(uses the saved settings)')), res.code === 0 ? 'info' : 'warning');
			});
		};

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Integrations'),
			_('<b>Prometheus:</b> scrape <code>http://&lt;router&gt;/modem-monitor/metrics.txt</code> (updated every sample). <b>Zabbix:</b> import <code>examples/zabbix/modem_monitor_by_http.yaml</code> from the GitHub repository and link it to the router host; it reads <code>/modem-monitor/latest.json</code>. <b>Home Assistant:</b> fill in MQTT below; sensors appear automatically through MQTT discovery.'));

		o = s.option(form.Value, 'prom_textfile', _('Extra metrics file'),
			_('Optional: also write the Prometheus metrics to this path, for a node-exporter textfile collector.'));
		o.placeholder = '/var/prometheus/modem.prom';

		o = s.option(form.Value, 'mqtt_host', _('MQTT broker'),
			_('Host name or IP. Needs the <code>mosquitto-client-ssl</code> (or <code>-nossl</code>) package. Leave empty to turn MQTT off. Alerts are also published to <em>topic</em>/alert.'));
		o.datatype = 'host';

		o = s.option(form.Value, 'mqtt_port', _('MQTT port'));
		o.datatype = 'port';
		o.placeholder = '1883';
		o = s.option(form.Value, 'mqtt_user', _('MQTT user'));
		o = s.option(form.Value, 'mqtt_pass', _('MQTT password'));
		o.password = true;
		o = s.option(form.Flag, 'mqtt_tls', _('Use TLS'), _('Usually port 8883; needs mosquitto-client-ssl.'));
		o = s.option(form.Value, 'mqtt_topic', _('MQTT base topic'));
		o.placeholder = 'modem_monitor';
		o = s.option(form.Flag, 'mqtt_discovery', _('Home Assistant discovery'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Storage & pings'));

		o = s.option(form.Value, 'data_dir', _('Data directory'),
			_('CSV history is kept here (a few MB per month). Chosen automatically on first install: the largest persistent mount with 512 MB or more free (/data, /mnt/*, /srv/*, /opt/*), otherwise /root. /tmp is lost on reboot.'));
		o.placeholder = '/root/modem-monitor';

		o = s.option(form.Value, 'retention_days', _('Keep history (days)'));
		o.datatype = 'range(7,3650)';
		o.placeholder = '90';

		o = s.option(form.Flag, 'compress_old', _('Compress old months'),
			_('gzip monthly data files older than last month (about 10x smaller). Reports, summaries and exports read them as usual.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'wan_device', _('Modem-facing network port'),
			_('Error and link-drop counters are recorded for this port. Leave empty to use the device of the "wan" interface.'));
		o.placeholder = _('auto (wan interface)');
		o.optional = true;

		o = s.option(form.Value, 'ping_targets', _('Ping targets'), _('Space-separated.'));
		o.placeholder = '1.1.1.1 8.8.8.8';

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Guideline ranges'),
			_('Shaded "healthy" bands on the charts. These are common DOCSIS 3.1 guidelines, not your ISP\'s official specs.'));

		[ [ 'us_power_min', _('Upstream power min (dBmV)'), '35' ],
		  [ 'us_power_max', _('Upstream power max (dBmV)'), '51' ],
		  [ 'ds_power_min', _('Downstream power min (dBmV)'), '-7' ],
		  [ 'ds_power_max', _('Downstream power max (dBmV)'), '7' ],
		  [ 'ds_snr_min', _('Downstream SNR min (dB)'), '33' ] ].forEach(function(f) {
			o = s.option(form.Value, f[0], f[1]);
			o.datatype = 'float';
			o.placeholder = f[2];
		});

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Updates'),
			_('Checks the GitHub repository for a newer release every 6 hours. When one exists, the Signal Report page offers to install it; nothing is installed without your click.'));

		o = s.option(form.DummyValue, '_version', _('Version'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var cur = (upd && upd.current) || ver || '?';
			var html = '<strong>' + cur + '</strong>';
			if (upd && upd.newer)
				html += ' &middot; <span style="color:#c48a00">' + _('version %s is available').format(upd.latest) + '</span> &middot; <a href="' + L.url('admin/status/modem-monitor/report') + '">' + _('install it from the Signal Report page') + '</a>';
			else if (upd && upd.latest && !upd.error)
				html += ' &middot; ' + _('up to date');
			if (upd && upd.checked)
				html += ' <span style="opacity:.7">(' + _('last checked %s').format(new Date(upd.checked * 1000).toLocaleString()) + ')</span>';
			return html;
		};

		o = s.option(form.Flag, 'update_check', _('Check for updates automatically'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'update_repo', _('GitHub repository'), _('owner/name; change this if you use a fork.'));
		o.placeholder = 'RyanBlakeIT/luci-app-modem-monitor';

		o = s.option(form.Button, '_check', _('Check now'));
		o.inputtitle = _('Check now');
		o.inputstyle = 'action';
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'update-check' ]).then(function(res) {
				if (res.code === 0) return location.reload();
				ui.addNotification(null, E('p', {}, ((res.stdout || '') + (res.stderr || '')).trim() || _('No answer.')), 'warning');
			});
		};

		return m.render().then(function(node) { return pageTabs(node); });
	}
});
