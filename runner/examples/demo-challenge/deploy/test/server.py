"""Small, dependency-free TCP echo service for runner build tests."""

import os
import socketserver


class EchoHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        self.request.sendall(b"CTF TCP demo OK\n")
        while True:
            data = self.request.recv(4096)
            if not data:
                break
            self.request.sendall(data)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"TCP demo listening on 0.0.0.0:{port}", flush=True)
    with Server(("0.0.0.0", port), EchoHandler) as server:
        server.serve_forever()
