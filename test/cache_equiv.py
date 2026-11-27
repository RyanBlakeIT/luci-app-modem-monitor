"""Checks that a report built with the in-memory row cache (full profile), including
after new lines are appended, is identical to one built from scratch (lite).
Usage: MODEM_MONITOR_CONF=... python3 test/cache_equiv.py"""
import os, re, sys, time
from importlib.machinery import SourceFileLoader

here = os.path.dirname(os.path.abspath(__file__))
m = SourceFileLoader("mm", os.path.join(here, "..", "root", "usr", "bin", "modem-monitor")).load_module()
cfg = m.load_config()
fix = int(time.time())
m.time.time = lambda: fix


def build(web):
    c = dict(cfg, web_dir=web)
    os.makedirs(web, exist_ok=True)
    m.build_report(c)
    return re.sub(r'"generated":"[^"]*"', "", open(os.path.join(web, "index.html")).read())


m.ROWCACHE = {}
build("/tmp/ce-warm")  # fill the cache
p = sorted(m.files_since(cfg, "summary", 0))[-1]
with open(p, "rb") as f:
    last = f.read().splitlines(True)[-1]
with open(p, "ab") as f:  # a new sample arrives
    f.write(last.replace(last.split(b",")[0], str(int(last.split(b",")[0]) + 60).encode(), 1))
cached = build("/tmp/ce-cached")
m.ROWCACHE = None
fresh = build("/tmp/ce-fresh")
if cached != fresh:
    sys.exit("row cache changed the report")
print("row cache: identical report")
