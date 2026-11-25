"""Mock Arris S33 HNAP endpoint for testing. Enforces challenge/response login,
HNAP_AUTH signature and session cookies. Usage: mock_s33.py PORT ALGO PASSWORD"""
import hashlib, hmac, json, random, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT, ALGO, PASSWORD = int(sys.argv[1]), sys.argv[2], sys.argv[3]
H = lambda k, m: hmac.new(k.encode(), m.encode(), getattr(hashlib, ALGO)).hexdigest().upper()
S = {"offset": 3 * 86400, "challenge": None, "pub": None, "uid": None, "pk": None, "boot": time.time(), "unc": 0, "t3": 0}
LOG = []


def ds():
    rows = []
    for i in range(1, 33):
        S["unc"] += random.choice([0, 0, 0, 3, 12])
        rows.append("%d^Locked^QAM256^%d^%d^%.1f^%.1f^%d^%d^" % (
            i, i + 4, 489000000 + i * 6000000, random.uniform(-2, 4), random.uniform(37, 41),
            random.randint(100, 9000), S["unc"] // 32 + i))
    rows.append("33^Locked^OFDM PLC^193^957000000^2.1^40.0^123456^42^")
    return "|+|".join(rows)


def us():
    return "|+|".join("%d^Locked^SC-QAM^%d^6400000^%d^%.1f^" % (
        i, i, 16400000 + i * 6400000, random.uniform(44, 52)) for i in range(1, 5))


def log_list():
    if random.random() < 0.5:
        t = time.localtime()
        S["t3"] += 1
        LOG.insert(0, "0^%s^%s^3^No Ranging Response received - T3 time-out;CM-MAC=xx;CMTS-MAC=yy;CM-QOS=1.1;CM-VER=3.1;" % (
            time.strftime("%H:%M:%S", t), "%d/%d/%d" % (t.tm_mday, t.tm_mon, t.tm_year)))
    return "}-{".join(LOG + ["0^10:16:17^7/11/2026^3^CMSTATUS:DS_Diplexer_Mode_Change_Ignored:TLV-21.3, 1002MHz.",
        "0^10:19:32^7/11/2026^3^DHCP FAILED - Discover sent, no offer received;CM-MAC=aa:bb:cc:dd:ee:ff;CMTS-MAC=11:22:33:44:55:66;CM-QOS=1.1;CM-VER=3.1;"])


class Hd(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):  # test hooks: /_relock resets counters (no reboot), /_lastset shows last Set
        if self.path == "/_relock":
            S["unc"] = 0
            return self.send({"ok": 1})
        if self.path == "/_lastset":
            return self.send(S.get("last_set") or {})
        self.send({}, 404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        action = self.headers["SOAPACTION"].strip('"').rsplit("/", 1)[1]
        sig, ts = self.headers["HNAP_AUTH"].split()
        key = S["pk"] if action != "Login" or body["Login"]["Action"] == "login" else "withoutloginkey"
        if body.get("Login", {}).get("Action") == "request":
            key = "withoutloginkey"
        if H(key or "withoutloginkey", ts + '"http://purenetworks.com/HNAP1/%s"' % action) != sig:
            return self.send({"error": "bad HNAP_AUTH"}, 404)
        if action == "Login":
            L = body["Login"]
            if L["Action"] == "request":
                S["challenge"] = "%016X" % random.getrandbits(64)
                S["pub"] = "%016X" % random.getrandbits(64)
                S["uid"] = "%08x" % random.getrandbits(32)
                S["pk"] = H(S["pub"] + PASSWORD, S["challenge"])
                return self.send({"LoginResponse": {"Challenge": S["challenge"], "Cookie": S["uid"],
                                                    "PublicKey": S["pub"], "LoginResult": "OK"}})
            ok = L["LoginPassword"] == H(S["pk"], S["challenge"]) and \
                "uid=%s" % S["uid"] in (self.headers.get("Cookie") or "")
            return self.send({"LoginResponse": {"LoginResult": "OK" if ok else "FAILED"}})
        if "uid=%s" % S["uid"] not in (self.headers.get("Cookie") or ""):
            return self.send({"GetMultipleHNAPsResponse": {"GetMultipleHNAPsResult": "UN-AUTH"}})
        if action == "SetArrisConfigurationInfo":
            a = body["SetArrisConfigurationInfo"]
            S["last_set"] = a
            if a.get("Action") == "reboot":
                S["boot"] = time.time(); S["unc"] = 0; S["offset"] = 0
            return self.send({"SetArrisConfigurationInfoResponse": {"SetArrisConfigurationInfoResult": "OK"}})
        out = {"GetMultipleHNAPsResult": "OK"}
        for a in body["GetMultipleHNAPs"]:
            if a == "GetCustomerStatusDownstreamChannelInfo":
                out[a + "Response"] = {"CustomerConnDownstreamChannel": ds(), a + "Result": "OK"}
            elif a == "GetCustomerStatusUpstreamChannelInfo":
                out[a + "Response"] = {"CustomerConnUpstreamChannel": us(), a + "Result": "OK"}
            elif a == "GetCustomerStatusConnectionInfo":
                up = int(time.time() - S["boot"]) + S["offset"]
                out[a + "Response"] = {"CustomerCurSystemTime": time.ctime(),
                                       "CustomerConnSystemUpTime": "%d days %02dh:%02dm:%02ds" % (
                                           up // 86400, up % 86400 // 3600, up % 3600 // 60, up % 60),
                                       "CustomerConnNetworkAccess": "Allowed"}
            elif a == "GetCustomerStatusSoftware":
                out[a + "Response"] = {"StatusSoftwareModelName": "S33", "StatusSoftwareSfVer": "AT01.01.010.042324_S3.04.735"}
            elif a == "GetArrisConfigurationInfo":
                out[a + "Response"] = {"SetEEEEnable": "0", "LED_Status": "1", "GetArrisConfigurationInfoResult": "OK"}
            elif a == "GetCustomerStatusLog":
                out[a + "Response"] = {"CustomerStatusLogList": log_list(), a + "Result": "OK"}
        self.send(out if len(body["GetMultipleHNAPs"]) == 1 else {"GetMultipleHNAPsResponse": out})


HTTPServer(("127.0.0.1", PORT), Hd).serve_forever()
