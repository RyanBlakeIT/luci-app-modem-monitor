# Testing without a modem

`mock_s33.py` emulates the S33's HNAP API (challenge/response login, HNAP_AUTH
signatures, session cookies, channel data, event log, reboot command).

```sh
python3 test/mock_s33.py 18080 md5 Secret123 &      # or sha256
cat > /tmp/mm.conf <<CONF
host=127.0.0.1:18080
password=Secret123
data_dir=/tmp/mm-data
web_dir=/tmp/mm-www
ping_targets=127.0.0.1
ping_count=1
CONF
MODEM_MONITOR_CONF=/tmp/mm.conf python3 root/usr/bin/modem-monitor test
MODEM_MONITOR_CONF=/tmp/mm.conf python3 root/usr/bin/modem-monitor poll
curl http://127.0.0.1:18080/_relock     # simulate loss of signal without a reboot
```

`MODEM_MONITOR_CONF` points the monitor at a key=value file instead of UCI, so
it runs on any machine with Python 3.

`mock_html.py` serves HTML status pages in the style of the Arris SB8200
(`sb8200`, or `sb8200login` for firmware that requires a login) and Netgear CM
modems (`netgear`), for the `arris_html` and `netgear` drivers:

```sh
python3 test/mock_html.py 18101 sb8200login Secret1 &
printf 'host=127.0.0.1:18101\npassword=Secret1\ndata_dir=/tmp/h\nweb_dir=/tmp/hw\n' > /tmp/h.conf
MODEM_MONITOR_CONF=/tmp/h.conf python3 root/usr/bin/modem-monitor test
```
