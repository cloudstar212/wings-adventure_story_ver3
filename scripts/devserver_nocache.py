"""캐시 없는 개발용 정적 서버 (동시 요청도 안전하게 처리하도록 스레드 기반)."""
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
