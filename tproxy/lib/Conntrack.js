const ServerConstants = require('../config.json');
const parseString = require('xml2js').parseString;
const child_process = require('child_process');
const fs = require('fs');

const CONNTRACK_PATH = '/proc/net/nf_conntrack';

const wait = (time_milliseconds) => { return new Promise((resolve) => { setTimeout(() => { resolve(); }, time_milliseconds) }) };

class Conntrack {

  /*
    https://stackoverflow.com/questions/16034698/details-of-proc-net-ip-conntrack-and-proc-net-nf-conntrack
    conntrack tools를 실행하면 출력되지 않는 데이터가 있어서 conntrack 파싱으로 결정함

    return: Promise ( originIP: <originIP>, originPort: <originPort> )
  */

  static getOriginDestinationTCP(clientIP, clientPort) {

    return new Promise(async (resolve, reject) => {
        
      try {

        const data = fs.readFileSync(CONNTRACK_PATH);

        let findRegex = `([a-z0-9]+)[\\s\\t]+([0-4]+)[\\s\\t]+([a-z0-9]+)[\\s\\t]+([0-9]+)[\\s\\t]+([0-9]+)[\\s\\t]+[^\\n]+src\=${clientIP}\\sdst=([0-9\.]+)\\ssport\\=[0-9]+\\sdport\\=([0-9]+)\\ssrc\\=[0-9\.]+\\sdst\\=${clientIP}\\ssport\\=${ServerConstants.LISTENPORT}\\sdport\\=${clientPort}[^\\n]+`;

        const regexRun = new RegExp(findRegex).exec(data);

        let layer3protoStr = '';
        let layer3proto = -1;
        let layer4protoStr = '';
        let layer4proto = -1;
        let conntrackDeadtime = -1;
        let originIP = '';
        let originPort = -1;

        if (regexRun) {
          layer3protoStr      = regexRun[1];
          layer3proto         = parseInt(regexRun[2]);
          layer4protoStr      = regexRun[3];
          layer4proto         = parseInt(regexRun[4]);
          conntrackDeadtime   = parseInt(regexRun[5]);
          originIP            = regexRun[6];
          originPort          = parseInt(regexRun[7]);

          resolve({
            originIP: originIP,
            originPort: originPort
          });

        } else {

          console.error(`Couldn't retrieve conntrack data. ${clientIP}:${clientPort}`);

          await wait(1);

          child_process.exec(`cat ${CONNTRACK_PATH}`, (error, stdout, stderr) => {
            
            const regexRun2 = new RegExp(findRegex).exec(stdout);

            if (regexRun2) {

              layer3protoStr      = regexRun2[1];
              layer3proto         = parseInt(regexRun2[2]);
              layer4protoStr      = regexRun2[3];
              layer4proto         = parseInt(regexRun2[4]);
              conntrackDeadtime   = parseInt(regexRun2[5]);
              originIP            = regexRun2[6];
              originPort          = parseInt(regexRun2[7]);

              console.log(`Retry SUCCESS! ${clientIP}:${clientPort} -> ${originIP}:${originPort}`);

              resolve({
                originIP: originIP,
                originPort: originPort
              });

            } else {
              console.error(`Conntrack: Retry Failed. ${clientIP}:${clientPort} -> ????`)
              reject();
              if (error) {
                console.error(error);
                console.error(stderr);
              }
            }

            
          });

        }

      } catch (e) {
        console.error(`Couldn't retrieve conntrack data. ${clientIP}:${clientPort}`);
        console.error('Conntrack ERR: ', e);
        reject();
      }

    });
  
  }


}

child_process.exec('echo 262144 > /proc/sys/net/nf_conntrack_max; sysctl -w net.netfilter.nf_conntrack_tcp_loose=0', (error, stdout, stderr) => {
  if (error) {
    console.error('ERR: ', error);
    console.error('STDERR: ', stderr);
  }
});

module.exports = Conntrack