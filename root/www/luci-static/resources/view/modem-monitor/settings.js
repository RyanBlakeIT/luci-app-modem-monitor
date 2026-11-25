'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';

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

	render: function() {
		var m, s, o;

		m = new form.Map('modem_monitor', _('Cable Modem Monitor'),
			_('Polls the cable modem (tested with the Arris SURFboard S33) for signal levels, error counters and its event log, and pings the internet, every few minutes. Save & Apply, then use "Test connection".'));

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Modem'));

		o = s.option(form.Flag, 'enabled', _('Enable monitoring'));
		o.rmempty = false;

		o = s.option(form.Value, 'isp_name', _('ISP name'),
			_('Optional. Shown in the report title and text, e.g. "Comcast" or "Spectrum".'));
		o.placeholder = _('your ISP');

		o = s.option(form.Value, 'report_title', _('Report title'),
			_('Optional. Replaces "Cable modem signal report".'));
		o.optional = true;

		o = s.option(form.Value, 'report_note', _('Report note'),
			_('Optional line shown under the report title, e.g. "Account 12345 \u00b7 Complaint 67890 \u00b7 123 Main St".'));
		o.optional = true;

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

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Storage & pings'));

		o = s.option(form.Value, 'data_dir', _('Data directory'),
			_('CSV history is kept here (a few MB per month). Chosen automatically on first install: the largest persistent mount with 512 MB or more free (/data, /mnt/*, /srv/*, /opt/*), otherwise /root. /tmp is lost on reboot.'));
		o.placeholder = '/root/modem-monitor';

		o = s.option(form.Value, 'retention_days', _('Keep history (days)'));
		o.datatype = 'range(7,3650)';
		o.placeholder = '90';

		o = s.option(form.Value, 'wan_device', _('Modem-facing network port'),
			_('Error and link-drop counters are recorded for this port. Leave empty to use the device of the "wan" interface.'));
		o.placeholder = _('auto (wan interface)');
		o.optional = true;

		o = s.option(form.Value, 'ping_targets', _('Ping targets'), _('Space-separated.'));
		o.placeholder = '1.1.1.1 8.8.8.8';

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Alerts'),
			_('Get a phone notification when the line misbehaves. Easiest: install the free <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy</a> app, subscribe to a hard-to-guess topic name, and enter that name below. Alerts raised while the internet is down are sent once it is back.'));

		o = s.option(form.Flag, 'alert_enabled', _('Send alerts'));
		o.rmempty = false;

		o = s.option(form.MultiValue, 'alert_on', _('Alert on'));
		o.value('outage', _('Modem unreachable / back online'));
		o.value('reboot', _('Modem rebooted on its own'));
		o.value('relock', _('Modem re-registered (lost signal)'));
		o.value('t3t4', _('T3/T4 timeouts'));
		o.value('uncorr', _('Uncorrectable error spike'));
		o.value('us_power', _('Upstream power above the guideline'));
		o.value('loss', _('Packet loss'));
		o.default = 'outage reboot relock t3t4 uncorr us_power loss';
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_ntfy_url', _('ntfy topic or URL'),
			_('A topic name (sent to ntfy.sh), or a full URL such as https://ntfy.example.com/modem for a self-hosted server. Anyone who knows a public topic name can read it, so pick something long and random.'));
		o.placeholder = 'modem-' + Math.random().toString(36).slice(2, 12);
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_ntfy_token', _('ntfy access token'), _('Only for protected topics.'));
		o.password = true;
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_pushover_user', _('Pushover user key'));
		o.depends('alert_enabled', '1');
		o = s.option(form.Value, 'alert_pushover_token', _('Pushover app token'));
		o.password = true;
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_telegram_token', _('Telegram bot token'));
		o.password = true;
		o.depends('alert_enabled', '1');
		o = s.option(form.Value, 'alert_telegram_chat', _('Telegram chat ID'));
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_webhook_url', _('Webhook URL'),
			_('Receives a JSON POST: {"title", "message", "kind", "priority", "ts", "host"}. Works with Home Assistant, Discord-style relays, n8n and similar.'));
		o.depends('alert_enabled', '1');

		o = s.option(form.Value, 'alert_email_to', _('Email to'),
			_('Needs a working sendmail on the router (for example the msmtp package, configured with your mail provider).'));
		o.datatype = 'string';
		o.depends('alert_enabled', '1');

		[ [ 'alert_t3t4_count', _('T3/T4 timeouts within an hour'), '3', 'range(1,100)' ],
		  [ 'alert_uncorr', _('Uncorrectables in one sample'), '5000', 'uinteger' ],
		  [ 'alert_loss', _('Packet loss in one sample (%)'), '20', 'range(1,100)' ],
		  [ 'alert_outage_polls', _('Failed samples in a row before "unreachable"'), '2', 'range(1,12)' ],
		  [ 'alert_cooldown_min', _('Repeat the same alert at most every (minutes)'), '60', 'range(0,1440)' ] ].forEach(function(f) {
			o = s.option(form.Value, f[0], f[1]);
			o.placeholder = f[2];
			o.datatype = f[3];
			o.depends('alert_enabled', '1');
		});

		o = s.option(form.Button, '_alert_test', _('Test'));
		o.inputtitle = _('Send a test alert');
		o.inputstyle = 'action';
		o.depends('alert_enabled', '1');
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'alert-test' ]).then(function(res) {
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' },
					(((res.stdout || '') + (res.stderr || '')).trim() || _('No answer.')) + '\n\n' + _('Uses the saved settings, so Save & Apply first.')),
					res.code === 0 ? 'info' : 'warning');
			});
		};

		s = m.section(form.NamedSection, 'main', 'modem_monitor', _('Updates'),
			_('Checks the GitHub repository for a newer release once a day. When one exists, the Signal Report page offers to install it; nothing is installed without your click.'));

		o = s.option(form.Flag, 'update_check', _('Check for updates'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'update_repo', _('GitHub repository'), _('owner/name; change this if you use a fork.'));
		o.placeholder = 'RyanBlakeIT/luci-app-modem-monitor';

		o = s.option(form.Button, '_check', _('Check now'));
		o.inputtitle = _('Check now');
		o.inputstyle = 'action';
		o.onclick = function() {
			return fs.exec('/usr/bin/modem-monitor', [ 'update-check' ]).then(function(res) {
				ui.addNotification(null, E('p', {}, ((res.stdout || '') + (res.stderr || '')).trim() || _('No answer.')),
					res.code === 0 ? 'info' : 'warning');
			});
		};

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

		var self = this;
		return m.render().then(function(node) {
			node.appendChild(E('div', { 'class': 'cbi-section' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(self, 'testConnection')
				}, _('Test connection')),
				E('span', { 'style': 'margin-left:8px;color:#888' }, _('Uses the saved settings, so Save & Apply first.'))
			]));
			return node;
		});
	}
});
