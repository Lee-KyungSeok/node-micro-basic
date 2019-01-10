'use strict';

// 모놀로지 로직을 포함
const business = require('../mono/monolithic_goods');
// cluster 적용
const cluster = require("cluster");

class goods extends require("./server") {
    constructor() {
        super("goods",
            process.argv[2] ? Number(process.argv[2]) : 9010, // goods 의 기본 포트를 9010 으로 지정
            ["POST/goods", "GET/goods", "DELETE/goods"]
        );

        // distributor 접속
        this.connectToDistributor("127.0.0.1", 9000, (data) => { // onNoti 에 넘긴 콜백 함수 (host 와 port 는 설정파일에서 정의하는게 일반적)
            console.log("Distributor Notification", data)
        });
    }

    // 클라이언트 호출에 따른 business 로직 구축
    onRead(socket, data) {
        console.log("onRead", socket.remoteAddress, socket.remotePort, data);
        business.onRequest(socket, data.method, data.uri, data.params, (s, packet) => {
            socket.write(JSON.stringify(packet) + '¶'); // 응답 패킷 전송
        });
    }
}

if(cluster.isMaster) {
    // 자식 프로세스 실행
    cluster.fork();

    // exit 이벤트 발생 시 새로운 자식 프로세스 실행
    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    new goods();
}