# Simulates OpenWrt's split Python: only python3-light, python3-urllib (urllib,
# email) and python3-openssl (ssl, _hashlib) are installed. Importing any module
# from another python3-* subpackage fails, as it would on the router.
import sys

BLOCKED = {
    "asyncio", "ctypes", "_ctypes", "dbm", "_dbm", "_gdbm", "decimal", "_decimal",
    "logging", "lzma", "_lzma", "multiprocessing", "_multiprocessing", "curses",
    "_curses", "pydoc", "pydoc_data", "readline", "sqlite3", "_sqlite3", "unittest",
    "uuid", "_uuid", "venv", "ensurepip", "xml", "xmlrpc", "pyexpat", "_elementtree",
    "unicodedata", "_codecs_cn", "_codecs_hk", "_codecs_iso2022", "_codecs_jp",
    "_codecs_kr", "_codecs_tw", "tkinter", "idlelib",
}


class _Block:
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in BLOCKED:
            raise ImportError("%s is not in python3-light/urllib/openssl" % name, name=name)
        return None


sys.meta_path.insert(0, _Block())
