'use strict';
'require view';
'require fs';
'require ui';

var BIN = '/usr/bin/modem-monitor';
var TYPES = [
	[ 'tech', _('Technician visit') ],
	[ 'isp-call', _('Call with ISP') ],
	[ 'outage', _('Outage') ],
	[ 'modem-reboot', _('Modem reboot') ],
	[ 'router-change', _('Router change') ],
	[ 'wiring', _('Wiring / attenuation change') ],
	[ 'power', _('Power outage (home)') ],
	[ 'other', _('Other') ]
];

function pad(n) { return (n < 10 ? '0' : '') + n; }

/* datetime-local value for a unix time (browser local time) */
function dtValue(ts) {
	var d = ts ? new Date(ts * 1000) : new Date();
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function typeSelect(value) {
	return E('select', { 'class': 'cbi-input-select' }, TYPES.map(function(t) {
		return E('option', { 'value': t[0], 'selected': t[0] === value ? '' : null }, t[1]);
	}));
}

function typeLabel(v) {
	for (var i = 0; i < TYPES.length; i++)
		if (TYPES[i][0] === v) return TYPES[i][1];
	return v;
}

function exec(args) {
	return fs.exec(BIN, args).then(function(res) {
		var out = ((res.stdout || '') + (res.stderr || '')).trim();
		if (res.code !== 0)
			throw new Error(out || _('Command failed'));
		return out;
	});
}

function field(label, input, help) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field' }, [ input, help ? E('div', { 'class': 'cbi-value-description' }, help) : '' ])
	]);
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.exec(BIN, [ 'maint-list', '--json' ]).then(function(res) {
			try { return JSON.parse(res.stdout || '[]'); } catch (e) { return []; }
		}), []);
	},

	fail: function(err) {
		ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, err.message || String(err)), 'danger');
	},

	addForm: function() {
		var self = this;
		var when = E('input', { 'type': 'datetime-local', 'class': 'cbi-input-text', 'value': dtValue(0) });
		var ended = E('input', { 'type': 'datetime-local', 'class': 'cbi-input-text' });
		var type = typeSelect('tech');
		var note = E('textarea', { 'class': 'cbi-input-textarea', 'rows': 3, 'style': 'width:100%;max-width:640px',
			'placeholder': _('What happened, e.g. "Technician replaced the outside splitter and drop connector, job #12345"') });

		var add = function() {
			if (!note.value.trim()) {
				note.focus();
				ui.addNotification(null, E('p', {}, _('Please describe what happened.')), 'warning');
				return;
			}
			var args = [ 'mark', '--note', note.value.trim(), '--type', type.value, '--time', when.value ];
			if (ended.value) args.push('--end', ended.value);
			return exec(args).then(function() { location.reload(); }).catch(self.fail);
		};

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Add an entry')),
			field(_('When'), when, _('Defaults to now. Use the time the work started.')),
			field(_('Ended'), ended, _('Optional. Shown as a shaded span on the charts; the "after" comparison starts here.')),
			field(_('Type'), type),
			field(_('What happened'), note),
			E('div', { 'class': 'cbi-page-actions', 'style': 'text-align:left' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-add', 'click': ui.createHandlerFn(this, add) }, _('Add entry')), ' ',
				E('button', { 'class': 'btn cbi-button', 'click': function() {
					when.value = dtValue(0); ended.value = ''; note.value = ''; } }, _('Clear'))
			])
		]);
	},

	editEntry: function(m) {
		var self = this;
		var when = E('input', { 'type': 'datetime-local', 'class': 'cbi-input-text', 'value': dtValue(+m.ts) });
		var ended = E('input', { 'type': 'datetime-local', 'class': 'cbi-input-text', 'value': m.end_ts ? dtValue(+m.end_ts) : '' });
		var type = typeSelect(m.type);
		var note = E('textarea', { 'class': 'cbi-input-textarea', 'rows': 4, 'style': 'width:100%' }, m.note || '');
		ui.showModal(_('Edit entry from %s').format(m.time.slice(0, 16)), [
			field(_('When'), when),
			field(_('Ended'), ended, _('Leave empty for a single point in time.')),
			field(_('Type'), type),
			field(_('What happened'), note),
			E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-positive', 'click': function() {
					if (!note.value.trim()) { note.focus(); return; }
					return exec([ 'maint-edit', String(m.id), '--note', note.value.trim(), '--type', type.value,
						'--time', when.value, '--end', ended.value ])
						.then(function() { ui.hideModal(); location.reload(); })
						.catch(function(e) { ui.hideModal(); self.fail(e); });
				} }, _('Save'))
			])
		]);
	},

	act: function(args, confirmText) {
		/* createHandlerFn appends the click event, so only a string is a prompt */
		if (typeof confirmText === 'string' && !window.confirm(confirmText)) return;
		return exec(args).then(function() { location.reload(); }).catch(this.fail);
	},

	list: function(entries) {
		var self = this;
		var nsug = entries.filter(function(m) { return m.status === 'suggested'; }).length;
		if (!entries.length)
			return E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Entries')), E('p', { 'style': 'opacity:.7' }, _('No entries yet.')) ]);

		/* number entries by time, the same way the report numbers its chart markers */
		var num = {};
		entries.slice().sort(function(a, b) { return (+a.ts) - (+b.ts); }).forEach(function(m, i) { num[m.id] = i + 1; });
		var rows = entries.map(function(m) {
			var sug = m.status === 'suggested';
			var end = m.end_time ? ' – ' + (m.end_time.slice(0, 10) === m.time.slice(0, 10) ? m.end_time.slice(11, 16) : m.end_time.slice(0, 16)) : '';
			return E('tr', { 'class': 'tr' + (sug ? ' mm-sug' : '') }, [
				E('td', { 'class': 'td', 'style': 'white-space:nowrap', 'title': _('Stored ID %s (used by the modem-monitor maint-* commands)').format(m.id) }, '#' + num[m.id]),
				E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, m.time.slice(0, 16) + end),
				E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, [ typeLabel(m.type),
					E('div', { 'style': 'font-size:11px;opacity:.7' }, sug ? _('suggested automatically') : m.source) ]),
				E('td', { 'class': 'td' }, m.note),
				E('td', { 'class': 'td', 'style': 'white-space:nowrap;text-align:right' }, [
					sug ? E('button', { 'class': 'btn cbi-button-positive', 'title': _('Keep this automatic entry'),
						'click': ui.createHandlerFn(self, 'act', [ 'maint-confirm', String(m.id) ]) }, _('Confirm')) : '', ' ',
					E('button', { 'class': 'btn cbi-button-edit', 'click': ui.createHandlerFn(self, 'editEntry', m) }, _('Edit')), ' ',
					E('button', { 'class': 'btn cbi-button-remove',
						'click': ui.createHandlerFn(self, 'act', [ 'maint-del', String(m.id) ], _('Delete entry #%s (%s)?').format(num[m.id], m.time.slice(0, 16))) }, _('Delete'))
				])
			]);
		});

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Entries (%d)').format(entries.length)),
			nsug ? E('div', { 'class': 'alert-message notice' },
				_('%d automatic suggestion(s) to review. Confirm the ones that are right, edit them to add detail, or delete false alarms.').format(nsug)) : '',
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, '#'), E('th', { 'class': 'th' }, _('When')), E('th', { 'class': 'th' }, _('Type')),
					E('th', { 'class': 'th' }, _('What happened')), E('th', { 'class': 'th' }, '') ])
			].concat(rows))
		]);
	},

	render: function(entries) {
		return E('div', { 'class': 'cbi-map' }, [
			E('style', {}, '.mm-sug td{background:rgba(255,193,7,.08)}'),
			E('h2', {}, _('Maintenance Log')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Record technician visits, calls with your ISP, reboots and router changes. Each entry shows up as a numbered marker on the Signal Report charts with a 24-hour before/after comparison, and you can filter the report to show only data after any entry. Modem reboots, loss-of-signal events, level shifts and router reboots are suggested automatically.')),
			this.addForm(),
			this.list(entries)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
