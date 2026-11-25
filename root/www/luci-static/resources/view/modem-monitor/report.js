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





/* Release notes are Markdown: render bullets, bold and `code` as readable text. */
function notesNode(md) {
	var box = E('div', { 'style': 'max-height:50vh;overflow:auto;font-size:14px;line-height:1.5;padding:4px 8px;border:1px solid rgba(128,128,128,.3);border-radius:6px' });
	if (!md) { box.appendChild(E('p', {}, _('No release notes.'))); return box; }
	var inline = function(t) {
		var esc = t.replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
		return esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
	};
	var top = null, sub = null, lastLi = null;
	String(md).replace(/\r/g, '').split('\n').forEach(function(line) {
		var m = line.match(/^(\s*)[-*] (.*)$/);
		if (m && m[1].length >= 2) {
			if (!lastLi) { top = top || box.appendChild(E('ul', { 'style': 'margin:4px 0;padding-left:20px' })); lastLi = top.appendChild(E('li', {})); }
			if (!sub) sub = lastLi.appendChild(E('ul', { 'style': 'margin:2px 0;padding-left:18px' }));
			sub.appendChild(E('li', {})).innerHTML = inline(m[2]);
		} else if (m) {
			top = top || box.appendChild(E('ul', { 'style': 'margin:4px 0;padding-left:20px' }));
			lastLi = top.appendChild(E('li', { 'style': 'margin:4px 0' }));
			lastLi.innerHTML = inline(m[2]);
			sub = null;
		} else if (/^\s+\S/.test(line) && lastLi) {
			lastLi.appendChild(E('div', {})).innerHTML = inline(line.trim());
			sub = null;
		} else if (/^#+\s/.test(line)) {
			box.appendChild(E('h4', {})).innerHTML = inline(line.replace(/^#+\s/, ''));
			top = sub = lastLi = null;
		} else if (line.trim()) {
			box.appendChild(E('p', { 'style': 'margin:4px 0' })).innerHTML = inline(line.trim());
			top = sub = lastLi = null;
		}
	});
	return box;
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
			}), []),
			L.resolveDefault(fs.exec(BIN, [ 'update-check', '--json', '--cached' ]).then(function(res) {
				try { return JSON.parse(res.stdout || 'null'); } catch (e) { return null; }
			}), null)
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

	complaintSummary: function() {
		var pad = function(n) { return (n < 10 ? '0' : '') + n; };
		var iso = function(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
		var now = new Date(), from = E('input', { 'type': 'date', 'class': 'cbi-input-text', 'value': iso(new Date(now.getTime() - 29 * 86400000)) }),
			to = E('input', { 'type': 'date', 'class': 'cbi-input-text', 'value': iso(now) }),
			excl = E('input', { 'type': 'checkbox', 'checked': 'checked' });
		ui.showModal(_('Complaint summary'), [
			E('p', {}, _('A one-page, printable summary for a date range: findings in plain language, day-by-day counts, repairs and calls from the maintenance log, outages and the timeouts the modem logged. Print it or save it as a PDF for your ISP or a regulator.')),
			E('div', { 'style': 'display:flex;gap:12px;align-items:center;flex-wrap:wrap' }, [
				E('label', {}, [ _('From') + ' ', from ]), E('label', {}, [ _('To') + ' ', to ])
			]),
			E('label', { 'style': 'display:block;margin-top:10px' }, [ excl, ' ',
				_('Leave out disruption caused by planned work (tech visits, reboots I started, router and wiring changes). The summary lists what was left out.') ]),
			E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-positive', 'click': function() {
					if (!from.value || !to.value) return;
					ui.showModal(_('Complaint summary'), [ E('p', { 'class': 'spinning' }, _('Building the summary…')) ]);
					var args = [ 'summary', '--from', from.value, '--to', to.value ];
					if (!excl.checked) args.push('--all');
					return exec(args).then(function() {
						var url = '/modem-monitor/summary.html?t=' + Date.now();
						ui.showModal(_('Complaint summary ready'), [
							E('p', {}, _('%s to %s. It opens in a new tab; use its "Print / Save as PDF" button.').format(from.value, to.value)),
							E('div', { 'class': 'right' }, [
								E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')), ' ',
								E('a', { 'class': 'btn cbi-button-positive', 'href': url, 'target': '_blank', 'rel': 'noopener', 'click': ui.hideModal }, _('Open summary'))
							])
						]);
					}).catch(function(e) {
						ui.hideModal();
						ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, e.message), 'danger');
					});
				} }, _('Build summary'))
			])
		]);
	},

	creditLetter: function() {
		var d = new Date(), pad = function(n) { return (n < 10 ? '0' : '') + n; };
		/* early in a month, the month that just ended is the likelier one */
		if (d.getDate() <= 7) d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
		var month = E('input', { 'type': 'month', 'class': 'cbi-input-text', 'value': d.getFullYear() + '-' + pad(d.getMonth() + 1) });
		ui.showModal(_('Credit request letter'), [
			E('p', {}, _('Drafts a letter asking your ISP for a credit for the outages recorded in a month, leaving out planned work. Your name, account number, address and monthly price come from Settings → Outage credits. You can edit the letter before printing or copying it.')),
			E('label', {}, [ _('Month') + ' ', month ]),
			E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-positive', 'click': function() {
					if (!month.value) return;
					return exec([ 'credit', '--month', month.value ]).then(function() {
						ui.showModal(_('Credit letter ready'), [
							E('p', {}, _('Opens in a new tab. Click the text to edit it, then use Print / Save as PDF or Copy text.')),
							E('div', { 'class': 'right' }, [
								E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')), ' ',
								E('a', { 'class': 'btn cbi-button-positive', 'href': '/modem-monitor/credit.html?t=' + Date.now(), 'target': '_blank', 'rel': 'noopener', 'click': ui.hideModal }, _('Open letter'))
							])
						]);
					}).catch(function(e) { ui.addNotification(null, E('pre', {}, e.message), 'danger'); });
				} }, _('Draft letter'))
			])
		]);
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

	updateBanner: function(u) {
		if (!u || !u.newer) return '';
		var self = this;
		return E('div', { 'class': 'alert-message notice', 'style': 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' }, [
			E('div', { 'style': 'flex:1;min-width:240px' }, [
				E('strong', {}, _('Update available: version %s').format(u.latest)), ' ',
				E('span', {}, _('(installed: %s)').format(u.current))
			]),
			E('button', { 'class': 'btn cbi-button', 'click': function() { self.showNotes(u, false); } }, _("What's new")),
			E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': function() { self.showNotes(u, true); } }, _('Install update'))
		]);
	},

	showNotes: function(u, install) {
		var self = this;
		var body = [
			E('p', {}, (u.releases && u.releases.length > 1)
				? _('Version %s (installed: %s). This update includes %d releases; changes in each are listed below, newest first.').format(u.latest, u.current, u.releases.length)
				: _('Version %s (installed: %s). ').format(u.latest, u.current)),
			notesNode(u.notes),
			E('p', {}, E('a', { 'href': u.url, 'target': '_blank', 'rel': 'noopener' }, _('Open the release on GitHub')))
		];
		if (install)
			body.push(E('p', {}, _('The package is downloaded from GitHub, checked against the size and SHA-256 checksum GitHub publishes, then installed with the package manager. Your settings and data are kept. Monitoring pauses for a few seconds while the service restarts.')));
		body.push(E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, install ? _('Cancel') : _('Close')), ' ',
			install ? E('button', { 'class': 'btn cbi-button-positive', 'click': function() { self.installUpdate(u); } }, _('Install %s').format(u.latest)) : ''
		]));
		ui.showModal(install ? _('Install update') : ((u.releases && u.releases.length > 1)
			? _("What's new since %s").format(u.current) : _("What's new in %s").format(u.latest)), body);
	},

	installUpdate: function(u) {
		var LOG = 'white-space:pre-wrap;max-height:40vh;overflow:auto;font-size:13.5px;line-height:1.5';
		var logEl = E('pre', { 'style': LOG }, _('Downloading…'));
		ui.showModal(_('Installing version %s').format(u.latest), [
			E('p', { 'class': 'spinning', 'style': 'font-size:15px' }, _('Downloading, verifying and installing. Please keep this page open; it takes about half a minute.')),
			E('details', {}, [ E('summary', { 'style': 'cursor:pointer;font-size:14px' }, _('Show progress')), logEl ])
		]);
		var finish = function(ok, text) {
			ui.showModal(ok ? _('Update installed') : _('Update failed'), [
				E('p', { 'style': 'font-size:16px;margin:4px 0 10px' }, ok
					? E('strong', {}, _('Version %s is installed.').format(u.latest))
					: E('strong', {}, _('The update was not installed.'))),
				E('p', { 'style': 'font-size:14px' }, ok
					? (/signature required/.test(text) ? _('The download matched GitHub\'s published checksum and carried a valid project signature. ') : _('The download matched GitHub\'s published checksum. ')) +
					  _('Your settings and data are unchanged. Reload the page to use the new version; if a tab looks out of date, log out of LuCI and back in.')
					: _('Nothing was changed if the download or signature check failed. The log below says why. You can also install manually from the release page.')),
				E('details', ok ? {} : { 'open': 'open' }, [
					E('summary', { 'style': 'cursor:pointer;font-size:14px' }, _('Installation log')),
					E('pre', { 'style': LOG }, text)
				]),
				E('div', { 'class': 'right' }, ok
					? E('button', { 'class': 'btn cbi-button-positive', 'click': function() { location.reload(); } }, _('Reload'))
					: E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')))
			]);
		};
		return fs.exec(BIN, [ 'update-install' ]).then(function(res) {
			var out = ((res.stdout || '') + (res.stderr || '')).trim();
			if (res.code !== 0) return finish(false, out);
			logEl.textContent = out;
			var tries = 0;
			var poll = function() {
				tries++;
				/* rpcd restarts during the upgrade, so failed polls are expected for a moment */
				return L.resolveDefault(fs.exec(BIN, [ 'update-status' ]), null).then(function(r) {
					var st = null;
					try { st = r ? JSON.parse(r.stdout || 'null') : null; } catch (e) {}
					if (st && st.log) logEl.textContent = st.log;
					if (st && st.state === 'done') return finish(st.ok, st.log);
					if (tries > 90) return finish(false, (st && st.log) || _('No result after 3 minutes; check System → Software or run: logread -e modem-monitor'));
					return new Promise(function(res) { setTimeout(res, 2000); }).then(poll);
				});
			};
			return poll();
		}).catch(function(e) { finish(false, e.message || String(e)); });
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
		var hasReport = data[0], entries = data[1] || [], upd = data[2];
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
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, 'complaintSummary')
			}, _('Complaint summary')), ' ',
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, 'creditLetter')
			}, _('Credit letter')), ' ',
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
			this.updateBanner(upd),
			this.maintNotice(entries),
			body
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
