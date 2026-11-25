"""Mock HTML-page cable modems for testing the arris_html and netgear drivers.
Usage: mock_html.py PORT sb8200|sb8200login|netgear [PASSWORD]
Page layouts follow the public status pages of these models; counters grow on
every request."""
import base64, random, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT, KIND = int(sys.argv[1]), sys.argv[2]
PASSWORD = sys.argv[3] if len(sys.argv) > 3 else "password"
S = {"n": 0, "boot": time.time() - 2 * 86400, "token": None}


def sb8200_status():
    S["n"] += 1
    ds = "".join("<tr align='left'><td>%d</td><td>Locked</td><td>QAM256</td><td>%d Hz</td><td>%.1f dBmV</td>"
                 "<td>%.1f dB</td><td>%d</td><td>%d</td></tr>" % (i, 423000000 + i * 6000000, random.uniform(-2, 4),
                                                                  random.uniform(37, 41), S["n"] * i, S["n"] * (50 if i in (3, 4, 5) else 1))
                 for i in range(1, 25))
    ds += "<tr align='left'><td>159</td><td>Locked</td><td>Other</td><td>645000000 Hz</td><td>2.1 dBmV</td><td>40.0 dB</td><td>99</td><td>0</td></tr>"
    us = "".join("<tr align='left'><td>%d</td><td>%d</td><td>Locked</td><td>SC-QAM Upstream</td><td>%d Hz</td>"
                 "<td>6400000 Hz</td><td>%.1f dBmV</td></tr>" % (i, i, 17600000 + i * 6400000, random.uniform(40, 46))
                 for i in range(1, 5))
    t = time.strftime("%a %b %d %H:%M:%S %Y")
    return """<html><head><title>SB8200</title></head><body>
<table class='simpleTable'><tr><th colspan=3><strong>Startup Procedure</strong></th></tr>
<tr><td><strong>Procedure</strong></td><td><strong>Status</strong></td><td><strong>Comment</strong></td></tr>
<tr><td>Acquire Downstream Channel</td><td>423000000 Hz</td><td>Locked</td></tr></table>
<table class='simpleTable'><tr><th colspan=8><strong>Downstream Bonded Channels</strong></th></tr>
<tr><td><strong>Channel ID</strong></td><td><strong>Lock Status</strong></td><td><strong>Modulation</strong></td>
<td><strong>Frequency</strong></td><td><strong>Power</strong></td><td><strong>SNR/MER</strong></td>
<td><strong>Corrected</strong></td><td><strong>Uncorrectables</strong></td></tr>%s</table>
<table class='simpleTable'><tr><th colspan=7><strong>Upstream Bonded Channels</strong></th></tr>
<tr><td><strong>Channel</strong></td><td><strong>Channel ID</strong></td><td><strong>Lock Status</strong></td>
<td><strong>US Channel Type</strong></td><td><strong>Frequency</strong></td><td><strong>Width</strong></td>
<td><strong>Power</strong></td></tr>%s</table>
<p id="systime" align="center"><strong>Current System Time:</strong> %s</p></body></html>""" % (ds, us, t)


def sb8200_info():
    up = int(time.time() - S["boot"])
    return """<html><body><table class='simpleTable'><tr><th colspan=2>Information</th></tr>
<tr><td>Standard Specification Compliant</td><td>Docsis 3.1</td></tr>
<tr><td>Hardware Version</td><td>6</td></tr><tr><td>Software Version</td><td>AB01.02.053.05_051921_193.0A.NSH</td></tr>
</table><table class='simpleTable'><tr><th colspan=2>Status</th></tr>
<tr><td>Up Time</td><td>%d days %02dh:%02dm:%02ds.00</td></tr></table><p>Model SB8200</p></body></html>""" % (
        up // 86400, up % 86400 // 3600, up % 3600 // 60, up % 60)


def sb8200_log():
    rows = ["<tr><td>Time Not Established</td><td>68010300</td><td>4</td><td>DHCP RENEW WARNING - Field invalid in response v4 option;CM-MAC=aa:bb:cc:dd:ee:ff;</td></tr>",
            "<tr><td>11/24/2026 21:05</td><td>82000200</td><td>3</td><td>No Ranging Response received - T3 time-out;CM-MAC=aa:bb:cc:dd:ee:ff;CMTS-MAC=11:22:33:44:55:66;CM-QOS=1.1;CM-VER=3.1;</td></tr>",
            "<tr><td>%s</td><td>82000300</td><td>3</td><td>Ranging Request Retries exhausted;CM-MAC=aa:bb:cc:dd:ee:ff;</td></tr>" % time.strftime("%m/%d/%Y %H:%M")]
    return """<html><body><table class='simpleTable'><tr><th colspan=4>Event Log</th></tr>
<tr><td><strong>Date Time</strong></td><td><strong>Event ID</strong></td><td><strong>Event Level</strong></td>
<td><strong>Description</strong></td></tr>%s</table></body></html>""" % "".join(rows)


def netgear_status():
    S["n"] += 1
    ds = ["24"] + sum([["%d" % i, "Locked", "QAM256", "%d" % i, "%d Hz" % (423000000 + i * 6000000), "%.1f dBmV" % random.uniform(-2, 4),
                        "%.1f dB" % random.uniform(37, 41), "%d" % (S["n"] * i), "%d" % (S["n"] * (40 if i in (7, 8, 9) else 1))]
                       for i in range(1, 25)], [])
    us = ["4"] + sum([["%d" % i, "Locked", "ATDMA", "%d" % i, "5120 Ksym/sec", "%d Hz" % (17600000 + i * 6400000),
                       "%.1f dBmV" % random.uniform(40, 46)] for i in range(1, 5)], [])
    ofdm = ["2", "1", "Locked", "0 ,1", "33", "645000000 Hz", "2.6 dBmV", "41.1 dB", "1108 ~ 2987", "12345", "88", "0",
            "2", "Not Locked", "0", "0", "0 Hz", "0 dBmV", "0 dB", "0 ~ 4095", "0", "0", "0"]
    up = int(time.time() - S["boot"])
    tag = ["", "", time.strftime("%a %b %d %H:%M:%S %Y"), "%d days %02d:%02d:%02d" % (up // 86400, up % 86400 // 3600, up % 3600 // 60, up % 60)]
    return """<html><head><title>NETGEAR Gateway CM1000</title><script>
function InitTagValue() { var tagValueList = '%s'; return tagValueList.split("|"); }
function InitUsTableTagValue() { var tagValueList = '%s|'; return tagValueList.split("|"); }
function InitDsTableTagValue() { var tagValueList = '%s|'; return tagValueList.split("|"); }
function InitDsOfdmTableTagValue() { var tagValueList = '%s|'; return tagValueList.split("|"); }
</script></head><body>Firmware Version V7.01.01.30 CM1000</body></html>""" % ("|".join(tag), "|".join(us), "|".join(ds), "|".join(ofdm))


class Hd(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def out(self, body, code=200, ctype="text/html"):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path, _, q = self.path.partition("?")
        if KIND == "netgear":
            cred = base64.b64encode(("admin:%s" % PASSWORD).encode()).decode()
            if path == "/":
                return self.out("<html><title>NETGEAR CM1000</title></html>")
            if path == "/DocsisStatus.htm":
                if self.headers.get("Authorization") != "Basic " + cred:
                    return self.out("unauthorized", 401)
                return self.out(netgear_status())
            return self.out("not found", 404)
        pages = {"/cmconnectionstatus.html": sb8200_status, "/cmswinfo.html": sb8200_info, "/cmeventlog.html": sb8200_log}
        if path == "/":
            return self.out("<html><script>location='cmconnectionstatus.html'</script>SB8200</html>")
        if path not in pages:
            return self.out("not found", 404)
        if KIND == "sb8200login":
            if q.startswith("login_"):
                if base64.b64decode(q[6:]).decode() != "admin:%s" % PASSWORD:
                    return self.out("<html>Login failed</html>", 401)
                S["token"] = "%016x" % random.getrandbits(64)
                return self.out(S["token"], ctype="text/plain")
            if not (q == "ct_%s" % S["token"] and "credential=%s" % S["token"] in (self.headers.get("Cookie") or "")):
                return self.out("<html><form>Login Username Password</form></html>")
        return self.out(pages[path]())


HTTPServer(("127.0.0.1", PORT), Hd).serve_forever()
