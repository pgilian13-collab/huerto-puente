"""
Cliente HTTP para MicroPython en Wokwi
Usa urequests (maneja SSL internamente, funciona en Wokwi)
"""

import json
import time

try:
    import urequests
    HAS_UREQUESTS = True
except ImportError:
    HAS_UREQUESTS = False


class HttpClient:
    def __init__(self, host, port=443, use_ssl=True, timeout=15):
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.timeout = timeout
        self.base_url = 'https://{}:{}'.format(host, port) if use_ssl else 'http://{}:{}'.format(host, port)

    def request(self, method, path, headers=None, data=None):
        if headers is None:
            headers = {}

        url = self.base_url + path
        body = None
        if data:
            body = json.dumps(data)
            headers['Content-Type'] = 'application/json'

        headers['Accept'] = 'application/json'

        for intento in range(2):
            try:
                resp = urequests.request(
                    method, url,
                    data=body,
                    headers=headers
                )
                status = resp.status_code
                text = resp.text
                resp.close()
                return status, text, {}

            except Exception as e:
                if intento < 1:
                    time.sleep(1)

        return 0, 'connection_failed', {}

    def get(self, path, headers=None):
        return self.request('GET', path, headers)

    def post(self, path, headers=None, data=None):
        return self.request('POST', path, headers, data)

    def patch(self, path, headers=None, data=None):
        return self.request('PATCH', path, headers, data)
