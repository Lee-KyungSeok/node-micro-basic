'use strict';

const http = require("http");
const url = require('url');
const querystring = require('querystring');
const tcpClient = require('./client');

var mapClients = {};
var mapUrls = {};
var mapResponse = {};
var mapRR = {};
var index = 0;

// http 서버 생성
var server = http.createServer((req, res) => {
    var method = req.method;
    var uri = url.parse(req.url, true);
    var pathname = uri.pathname;

    if(method === "POST" || method === "PUT") {
        var body = "";

        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {
            var params;

            // 헤더가 json 일 때는 JSON 으로 파싱
            if(req.headers['content-type'] == "application/json") {
                params = JSON.parse(body);
            } else {
                params = querystring.parse(body);
            }

            onRequest(res, method, pathname, params);

        });

    } else {
        onRequest(res, method, pathname, uri.query);
    }
}).listen(8000, () => {
    console.log('listen', server.address());

    // distributor 전달 패킷
    var packet = {
        uri: "/distributes",
        method: "POST",
        key: 0,
        params: {
            port: 8000,
            name: "gate",
            urls: []
        }
    };
    var isConnectedDistributor = false;

    // Distributor 접속
    this.clientDistributor = new tcpClient(
        "127.0.0.1",
        9000,
        (options) => {
            isConnectedDistributor = true;
            this.clientDistributor.write(packet);
        },
        (options, data) => { onDistribute(data) }, // 데이터 수신 이벤트(onRead)
        (options) => { isConnectedDistributor = false }, // 접속 종료 이벤트
        (options) => { isConnectedDistributor = false } // 에러 이벤트
    );

    // 주기적인 Distributor 접속 상태 확인
    setInterval(() => {
        if(isConnectedDistributor != true) {
            this.clientDistributor.connect();
        }
    }, 3000);

});

function onRequest(res, method, pathname, params) {
    var key = method + pathname;
    var client = mapUrls[key];
    if(client == null) {    // 처리 가능한 API 만 처리
        res.writeHead(404);
        res.end();
        return;
    } else {
        // API 호출에 대한 고유 키 값 설정
        params.key = index;
        var packet = {
            uri: pathname,
            method: method,
            params: params,
        };

        // 요청에 대한 응답 객체 저장
        mapResponse[index] = res;
        // 고유 값 증가
        index ++;
        // 라운드 로빈 처리
        if(mapRR[key] == null) {
            mapRR[key] = 0;
        }
        mapRR[key]++;

        // 마이크로서비스에 요청
        client[mapRR[key] % client.length].write(packet);
    }
}

// Distributor 데이터 수신 처리
function onDistribute(data) {
    for(var n in data.params) {
        var node = data.params[n];
        var key = node.host + ":" + node.port;
        if(mapClients[key] == null && node.name) {
            var client =  new tcpClient(node.host, node.port, onCreateClient, onReadClient, onEndClient, onErrorClient);

            // 마이크로서비스 연결 정보 저장
            mapClients[key] = {
                client: client,
                info: node
            };

            // 마이크로서비스 URL 정보 저장 (client 에 있는 모든 url 정보 저장)
            for(var m in node.urls) {
                var key = node.urls[m];
                if(mapUrls[key] == null) {
                    mapUrls[key] = [];
                }
                mapUrls[key].push(client);
            }

            client.connect();
        }
    }
}

// 마이크로서비스 접속 이벤트 처리
function onCreateClient() {
    console.log("onCreateClient");
}

// 마이크로 서비스 응답 처리
function onReadClient(options, packet) {
    console.log("onReadClient", packet);
    mapResponse[packet.key].writeHead(200, { 'Content-Type': 'application/json' });
    mapResponse[packet.key].end(JSON.stringify(packet));
    delete mapResponse[packet.key]; // http 응답 객체 삭제

}

// 마이크로서비스 접속 종료 처리
function onEndClient(options) { // options 에는 host, port 존재
    var key = options.host + ":" + options.port;
    console.log("onEndClient", mapClients[key]);
    for(var n in mapClients[key].info.urls) {
        var node = mapClients[key].info.urls[n];
        delete mapUrls[node];
    }
    delete mapClients[key];
}

// 마이크로서비스 접속 에러 처리
function onErrorClient(options) {
    console.log("onErrorClient");
}