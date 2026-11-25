'use strict';
'require baseclass';

/* Status > Overview tile for luci-app-modem-monitor (turn off under Cable Modem > Settings). */
return baseclass.extend({
	title: _('Cable Modem'),

	load: function() {
		return fetch('/modem-monitor/latest.json?t=' + Date.now(), { cache: 'no-store' })
			.then(function(r) { return r.ok ? r.json() : null; })
			.catch(function() { return null; });
	},

	render: function(d) {
		if (!d || d.tile === '0')
			return null;

		var n = function(v) { return (v === '' || v == null) ? '\u2013' : v; };
		var T = d.today || {};
		var age = Math.max(0, Math.round(Date.now() / 1000 - (+d.ts || 0)));
		var ago = age < 90 ? _('%d s ago').format(age) : age < 5400 ? _('%d min ago').format(Math.round(age / 60)) : _('%d h ago').format(Math.round(age / 3600));
		var bad = function(cond, text) { return cond ? E('span', { 'style': 'color:#d03b3b;font-weight:600' }, '\u25b2 ' + text) : text; };
		var ok = d.ok == 1;
		var rows = [
			[ _('Modem'), ok ? (d.lost_ch ? bad(true, _('online, channels missing: %s').format(d.lost_ch)) : _('online')) : bad(true, _('unreachable: %s').format(d.error || '?')) ],
			[ _('Downstream power'), ok ? '%s \u2026 %s dBmV'.format(n(d.ds_power_min), n(d.ds_power_max)) + (d.ds_locked ? ' \u00b7 ' + _('%s channels').format(d.ds_locked) : '') : '\u2013' ],
			[ _('Downstream SNR (lowest)'), ok ? n(d.ds_snr_min) + ' dB' : '\u2013' ],
			[ _('Upstream power'), ok ? '%s \u2026 %s dBmV'.format(n(d.us_power_min), n(d.us_power_max)) + (d.us_locked ? ' \u00b7 ' + _('%s channels').format(d.us_locked) : '') : '\u2013' ],
			[ _('Today'), bad((T.T3 || 0) + (T.T4 || 0) > 0, _('T3 %d \u00b7 T4 %d').format(T.T3 || 0, T.T4 || 0)) ],
			[ _('Uncorrectables today'), bad((T.uncorr || 0) >= 1000, (T.uncorr || 0).toLocaleString()) ],
			[ _('Packet loss (last sample)'), bad((+d.ping_loss || 0) > 0, n(d.ping_loss) + ' %') + (d.gw_loss !== '' && d.gw_loss != null ? ' \u00b7 ' + _('gateway %s %%').format(d.gw_loss) : '') ]
		];
		if (d.hr_sent)
			rows.push([ _('Jitter / dropouts'), '%s ms \u00b7 '.format(n(d.hr_jitter)) + _('%d short dropouts today').format(T.drops || 0) ]);
		rows.push([ _('Last sample'), age > 1800 ? bad(true, ago) : ago ]);

		return E('div', {}, [
			E('table', { 'class': 'table' }, rows.map(function(r) {
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', 'width': '33%' }, r[0]),
					E('td', { 'class': 'td left' }, r[1])
				]);
			})),
			E('div', { 'style': 'margin-top:6px' }, E('a', { 'href': L.url('admin/status/modem-monitor/report') }, _('Open the signal report') + ' \u2192'))
		]);
	}
});
