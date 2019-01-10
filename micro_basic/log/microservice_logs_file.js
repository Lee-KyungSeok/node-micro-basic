'use strict';

const cluster = require('cluster');
const fs = require('fs');

class logs extends require('../server'){
    constructor() {
        super(
            "logs",
            process.argv[2] ? Number(process.argv[2]) : 9040,
            ["POST/logs"]
        );

        // write stream 생성
        this.writestream = fs.createWriteStream('./log.txt', {flags: 'a'});

        this.connectToDistributor("127.0.0.1", 9000, (data) => {
            console.log("Distributor Notification", data);
        })
    }

    onRead(socket, data) {
        // 현재 로그는 같은 파일에 계속 저장하지만
        // 날짜별, 시간별로 다른파일에 저장하거나 일정한 간격으로 로그를 모아서 파일에 저장하는 방식을 사용할 수 있다.
        const sz = new Date().toLocaleString() + '\t' + socket.remoteAddress + '\t' + socket.remotePort + '\t' + JSON.stringify(data) + '\n';
        console.log(sz);
        this.writestream.write(sz);
    }
}

if(cluster.isMaster) {
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    new logs();
}