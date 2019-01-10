'use strict';

const cluster = require('cluster');
const fs = requier('fs');
// elasticsearch 인스턴스 생성
const elasticsearch = new require('elasticsearch').Client({
    host: '127.0.0.1',
    log: 'trace'
});

class logs extends require('../server') {
    constructor() {
        super("logs"
            , process.argv[2] ? Number(process.argv[2]) : 9040
            , ["POST/logs"]
        );

        this.writestream = fs.createWriteStream('./log.txt', {flags: 'a'});

        this.connectToDistributor("127.0.0.1", 9000, (data) => {
            console.log("Distributor Notification", data);
        });
    }

    onRead(socket, data) {
        const sz = new Date().toLocaleString() + '\t' + socket.remoteAddress + '\t' + socket.remotePort + '\t' + JSON.stringify(data) + '\n';
        console.log(sz);
        this.writestream.write(sz);

        // timestamp 설정
        data.timestamp = new Date().toISOString();
        // JSON 포멧 변환
        data.params = JSON.parse(data.params);
        // 로그 저장 (microservice 란 index 에 logs 라는 타입으로 저장)
        elasticsearch.index({
            index: 'microservice',
            type: 'logs',
            body: data
        });
    }
}

if (cluster.isMaster) {                                     // 자식 프로세스 실행
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {          // Exit 이벤트 발생시 새로운 자식프로세스 실행
        console.log(`worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    new logs();
}