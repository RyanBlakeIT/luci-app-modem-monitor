"""Minimal stand-in for a Cloudflare-style speed test server (/__down?bytes=N, POST /__up). Usage: mock_speed.py PORT"""
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
class H(BaseHTTPRequestHandler):
    protocol_version="HTTP/1.1"
    def log_message(self,*a): pass
    def do_GET(self):
        n=int(parse_qs(urlparse(self.path).query).get("bytes",["0"])[0])
        self.send_response(200); self.send_header("Content-Length",str(n)); self.end_headers()
        chunk=b"\0"*65536; sent=0
        try:
            while sent<n:
                k=min(len(chunk),n-sent); self.wfile.write(chunk[:k]); sent+=k
        except Exception: pass
    def do_POST(self):
        n=int(self.headers.get("Content-Length","0")); got=0
        while got<n:
            b=self.rfile.read(min(65536,n-got))
            if not b: break
            got+=len(b)
        self.send_response(200); self.send_header("Content-Length","2"); self.end_headers(); self.wfile.write(b"ok")
ThreadingHTTPServer(("127.0.0.1",int(sys.argv[1])),H).serve_forever()
