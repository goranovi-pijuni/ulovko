"""Small, dependency-free HTTP service for runner build/deployment tests."""

import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            body = b"ok\n"
        elif self.path == "/":
            # "test" is the Kubernetes Service name in this challenge namespace.
            try:
                with (
                    socket.create_connection(("test", 5000), timeout=3) as connection,
                    connection.makefile("rb") as stream,
                ):
                    greeting = stream.readline().decode("utf-8").strip()
                    connection.sendall(b"hello from web1\n")
                    echo = stream.readline().decode("utf-8").strip()
            except OSError:
                self.send_error(502, "Cannot reach private service test:5000")
                return
            body = (
                "CTF HTTP demo OK\n"
                f"web1 -> test:5000: {greeting}\n"
                f"test echoed: {echo}\n"
            ).encode()
        else:
            self.send_error(404, "Not found")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    print(f"HTTP demo listening on 0.0.0.0:{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
