'use strict';
'require view';
'require fs';
'require ui';

var REPORT = '/modem-monitor/index.html';
var BIN = '/usr/bin/modem-monitor';

function reloadFrame() {
	var f = document.getElementById('mm-frame');
	if (f)
		f.src = REPORT + '?t=' + Date.now();
	else
		location.reload();
}





function exec(args) {
	return fs.exec(BIN, args).then(function(res) {
		var out = ((res.stdout || '') + (res.stderr || '')).trim();
		if (res.code !== 0)
			throw new Error(out || _('Command failed'));
		return out;
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			fetch(REPORT, { method: 'HEAD', cache: 'no-store' })
				.then(function(r) { return r.ok; })
				.catch(function() { return false; }),
			L.resolveDefault(fs.exec(BIN, [ 'maint-list', '--json' ]).then(function(res) {
				try { return JSON.parse(res.stdout || '[]'); } catch (e) { return []; }
			}), [])
		]);
	},

	run: function(cmd, label) {
		ui.showModal(label, [ E('p', { 'class': 'spinning' }, _('Working… this can take up to a minute.')) ]);
		return fs.exec(BIN, [ cmd ]).then(function(res) {
			ui.hideModal();
			var out = ((res.stdout || '') + (res.stderr || '')).trim();
			ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, out || _('Done.')),
				res.code === 0 ? 'info' : 'warning');
			reloadFrame();
		}).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('Command failed: ') + e.message), 'danger');
		});
	},

	download: function() {
		ui.showModal(_('Preparing download'), [ E('p', { 'class': 'spinning' }, _('Packaging all data…')) ]);
		return fs.exec(BIN, [ 'export' ]).then(function(res) {
			ui.hideModal();
			var lines = (res.stdout || '').trim().split('\n');
			var name = (lines[lines.length - 1] || '').split('/').pop();
			if (res.code !== 0 || !/^modem-monitor-export-[\w-]+\.zip$/.test(name)) {
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' },
					((res.stdout || '') + (res.stderr || '')).trim() || _('Export failed.')), 'danger');
				return;
			}
			var a = E('a', { 'href': '/modem-monitor/' + name, 'download': name, 'style': 'display:none' });
			document.body.appendChild(a);
			a.click();
			a.remove();
			ui.addNotification(null, E('p', {}, _('Downloaded %s (%s). MAC and public IP addresses are masked.').format(name, lines[0].replace(/^.*\(|\)$/g, ''))), 'info');
		}).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('Export failed: ') + e.message), 'danger');
		});
	},

	rebootModem: function() {
		var note = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%',
			'placeholder': _('Optional: why (e.g. fresh baseline after tech visit)') });
		ui.showModal(_('Reboot the cable modem?'), [
			E('p', {}, _('Internet access drops for about 2 to 4 minutes while the modem restarts and re-registers. The reboot is recorded in the maintenance log with the exact time.')),
			note,
			E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-negative', 'click': function() {
					var args = [ 'reboot-modem' ];
					if (note.value.trim()) args.push('--note', note.value.trim());
					ui.showModal(_('Rebooting modem'), [ E('p', { 'class': 'spinning' }, _('Sending the reboot command…')) ]);
					return exec(args).then(function(out) {
						ui.hideModal();
						ui.addNotification(null, E('p', {}, _('Reboot sent: %s. Samples will fail for a few minutes while the modem restarts.').format(out)), 'info');
						setTimeout(function() { location.reload(); }, 1500);
					}).catch(function(e) {
						ui.hideModal();
						ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, e.message), 'danger');
					});
				} }, _('Reboot modem'))
			])
		]);
	},

	maintNotice: function(entries) {
		var nsug = entries.filter(function(m) { return m.status === 'suggested'; }).length;
		var link = E('a', { 'href': L.url('admin/status/modem-monitor/maintenance') }, _('Maintenance Log'));
		return E('div', { 'class': nsug ? 'alert-message notice' : '', 'style': nsug ? '' : 'margin:4px 0 10px;opacity:.85' }, nsug
			? [ _('%d automatic maintenance suggestion(s) to review on the ').format(nsug), link, _(' tab.') ]
			: [ _('%d maintenance log entr%s. Add or edit them on the ').format(entries.length, entries.length === 1 ? 'y' : 'ies'), link,
				_(' tab; the report can show only data after any entry ("Show data since").') ]);
	},

	render: function(data) {
		var hasReport = data[0], entries = data[1] || [];
		var self = this;
		var buttons = E('div', { 'style': 'margin:8px 0 12px' }, [
			E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function() { return self.run('poll', _('Taking a sample')); })
			}, _('Take a sample now')), ' ',
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, function() { return self.run('report', _('Rebuilding report')); })
			}, _('Rebuild report')), ' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(this, 'download')
			}, _('Download all data')), ' ',
			E('a', { 'class': 'btn cbi-button', 'href': REPORT, 'target': '_blank' }, _('Open in new tab')), ' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-negative', 'style': 'float:right',
				'click': ui.createHandlerFn(this, 'rebootModem')
			}, _('Reboot modem'))
		]);

		var body;
		if (hasReport) {
			body = E('iframe', {
				'id': 'mm-frame', 'src': REPORT, 'title': _('Cable modem signal report'),
				'style': 'width:100%;height:1800px;border:0;border-radius:8px;',
				'load': function(ev) {
					try {
						var d = ev.target.contentDocument;
						ev.target.style.height = (d.documentElement.scrollHeight + 20) + 'px';
					} catch (e) {}
				}
			});
		} else {
			body = E('div', { 'class': 'alert-message notice' }, [
				E('p', {}, _('No report yet. Set the modem password under Settings, then click "Take a sample now". The report fills in as samples accumulate (one every 5 minutes by default).'))
			]);
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Cable Modem')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Signal levels, error counters and event log from the cable modem, sampled by this router. Use "Download all data" or the CSV files at the bottom of the report as evidence for your ISP or a regulator.')),
			buttons,
			this.maintNotice(entries),
			body
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
