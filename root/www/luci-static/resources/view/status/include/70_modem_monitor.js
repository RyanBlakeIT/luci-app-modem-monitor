'use strict';
'require baseclass';

/* Status > Overview tile for luci-app-modem-monitor (turn off under Cable Modem > Settings > Modem). */

var CSS = '\
.mm-tile{--mm-ok:#1a9f5b;--mm-warn:#c98500;--mm-bad:#d64545;--mm-line:rgba(128,128,128,.22);--mm-card:rgba(128,128,128,.07);font-variant-numeric:tabular-nums}\
.mm-tile .mm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 12px}\
.mm-tile .mm-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-weight:600;font-size:13px;border:1px solid currentColor}\
.mm-tile .mm-pill i{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block}\
.mm-tile .mm-ok{color:var(--mm-ok)}.mm-tile .mm-warn{color:var(--mm-warn)}.mm-tile .mm-bad{color:var(--mm-bad)}\
.mm-tile .mm-sub{opacity:.7;font-size:12.5px}\
.mm-tile .mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}\
.mm-tile .mm-card{background:var(--mm-card);border:1px solid var(--mm-line);border-left:3px solid var(--mm-line);border-radius:8px;padding:9px 12px;min-width:0}\
.mm-tile .mm-card.ok{border-left-color:var(--mm-ok)}.mm-tile .mm-card.bad{border-left-color:var(--mm-bad)}.mm-tile .mm-card.warn{border-left-color:var(--mm-warn)}\
.mm-tile .mm-k{font-size:12px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.mm-tile .mm-v{font-size:20px;font-weight:600;line-height:1.3;white-space:nowrap}\
.mm-tile .mm-v small{font-size:12.5px;font-weight:500;opacity:.75;margin-left:3px}\
.mm-tile .mm-n{font-size:12px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.mm-tile .mm-foot{display:flex;justify-content:flex-end;margin-top:12px}\
.mm-tile .mm-btn{display:inline-block;padding:5px 12px;border-radius:6px;border:1px solid var(--mm-line);text-decoration:none;font-size:13px}\
.mm-tile .mm-btn:hover{background:var(--mm-card)}';

function num(v) { return (v === '' || v == null || isNaN(+v)) ? null : +v; }

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

		var G = d.limits || {}, T = d.today || {}, ok = d.ok == 1;
		var age = Math.max(0, Math.round(Date.now() / 1000 - (+d.ts || 0)));
		var ago = age < 90 ? _('%d s ago').format(age) : age < 5400 ? _('%d min ago').format(Math.round(age / 60)) : _('%d h ago').format(Math.round(age / 3600));
		var stale = age > 1800;

		var within = function(lo, hi, min, max) {
			if (lo == null || hi == null) return '';
			return (min != null && lo < min) || (max != null && hi > max) ? 'bad' : 'ok';
		};
		var range = function(a, b) { return a == null ? '–' : (a === b ? String(a) : a + ' … ' + b); };

		var dsMin = num(d.ds_power_min), dsMax = num(d.ds_power_max), usMin = num(d.us_power_min), usMax = num(d.us_power_max);
		var snr = num(d.ds_snr_min), loss = num(d.ping_loss), gw = num(d.gw_loss), jit = num(d.hr_jitter);
		var t34 = (T.T3 || 0) + (T.T4 || 0), unc = T.uncorr || 0, drops = T.drops || 0;

		var card = function(cls, k, v, unit, note, tip) {
			return E('div', { 'class': 'mm-card ' + (cls || ''), 'title': tip || note || '' }, [
				E('div', { 'class': 'mm-k' }, k),
				E('div', { 'class': 'mm-v' }, [ v, unit ? E('small', {}, unit) : '' ]),
				note ? E('div', { 'class': 'mm-n' }, note) : ''
			]);
		};

		var cards = ok ? [
			card(within(dsMin, dsMax, num(G.ds_power_min), num(G.ds_power_max)), _('Downstream power'), range(dsMin, dsMax), 'dBmV',
				(d.ds_locked ? _('%s ch').format(d.ds_locked) : '') + (G.ds_power_max != null ? ' · ' + _('guide %s…%s').format(G.ds_power_min, G.ds_power_max) : ''),
				_('%s channels locked; guideline range %s to %s dBmV').format(d.ds_locked || '?', G.ds_power_min, G.ds_power_max)),
			card(snr == null ? '' : (snr < num(G.ds_snr_min) ? 'bad' : 'ok'), _('Downstream SNR'), snr == null ? '–' : String(snr), 'dB',
				_('lowest channel') + (G.ds_snr_min != null ? ' · ' + _('min %s').format(G.ds_snr_min) : '')),
			card(within(usMin, usMax, num(G.us_power_min), num(G.us_power_max)), _('Upstream power'), range(usMin, usMax), 'dBmV',
				(d.us_locked ? _('%s ch').format(d.us_locked) : '') + (G.us_power_max != null ? ' · ' + _('guide %s…%s').format(G.us_power_min, G.us_power_max) : ''),
				_('%s channels locked; guideline range %s to %s dBmV').format(d.us_locked || '?', G.us_power_min, G.us_power_max))
		] : [];

		cards.push(
			card(t34 ? 'bad' : 'ok', _('Timeouts today'), String(t34), '', _('T3 %d · T4 %d').format(T.T3 || 0, T.T4 || 0)),
			card(unc >= 1000 ? 'bad' : unc > 0 ? 'warn' : 'ok', _('Uncorrectables today'), unc.toLocaleString(), '', _('damaged data'), _('Downstream codewords too damaged to repair, since midnight')),
			card((loss || 0) > 0 || (gw || 0) > 0 ? 'bad' : 'ok', _('Packet loss'), loss == null ? '–' : String(loss), '%',
				gw != null ? _('ISP gateway %s%%').format(gw) : _('last sample'))
		);
		var sp = d.speed_last;
		if (sp) {
			var spFail = sp.down == null && sp.up == null;
			cards.push(card(spFail || sp.error ? 'bad' : 'ok', _('Speed test'),
				spFail ? _('failed') : (sp.down == null ? '\u2013' : Math.round(sp.down)) + ' / ' + (sp.up == null ? '\u2013' : sp.up), spFail ? '' : 'Mb/s',
				(sp.idle != null ? _('%s\u2192%s ms').format(sp.idle, sp.loaded) + ' \u00b7 ' : '') +
					new Date(sp.ts * 1000).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
				(spFail || sp.error ? sp.error + ' \u00b7 ' : _('Download / upload; latency idle \u2192 under load') + ' \u00b7 ') +
					new Date(sp.ts * 1000).toLocaleString()));
		}
		if (d.hr_sent)
			cards.push(card(drops > 0 ? 'bad' : 'ok', _('Jitter / dropouts'), jit == null ? '–' : String(jit), 'ms',
				_('%d short dropouts today').format(drops)));

		var state, cls;
		if (!ok) { state = _('Modem unreachable'); cls = 'mm-bad'; }
		else if (d.lost_ch) { state = _('Online – channels missing'); cls = 'mm-warn'; }
		else if (t34 || unc >= 1000 || (loss || 0) > 0) { state = _('Online – problems today'); cls = 'mm-warn'; }
		else { state = _('Online'); cls = 'mm-ok'; }

		return E('div', { 'class': 'mm-tile' }, [
			E('style', {}, CSS),
			E('div', { 'class': 'mm-head' }, [
				E('span', { 'class': 'mm-pill ' + cls }, [ E('i'), state ]),
				d.lost_ch ? E('span', { 'class': 'mm-sub mm-warn' }, _('missing: %s').format(d.lost_ch)) : '',
				!ok && d.error ? E('span', { 'class': 'mm-sub' }, d.error) : '',
				E('span', { 'class': 'mm-sub' + (stale ? ' mm-bad' : ''), 'style': 'margin-left:auto' },
					(stale ? '▲ ' : '') + _('Last sample %s').format(ago) + (d.isp ? ' · ' + d.isp : ''))
			]),
			E('div', { 'class': 'mm-grid' }, cards),
			E('div', { 'class': 'mm-foot' },
				E('a', { 'class': 'mm-btn', 'href': L.url ? L.url('admin/status/modem-monitor/report') : '#' }, _('Open the signal report') + ' →'))
		]);
	}
});
