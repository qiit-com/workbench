#!/usr/bin/env python3
# 开发预览服务器：禁止客户端缓存，手机刷新必拿最新文件
import http.server, functools

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    http.server.test(HandlerClass=functools.partial(NoCacheHandler, directory='.'), port=8788, bind='0.0.0.0')
