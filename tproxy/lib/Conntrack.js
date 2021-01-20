const ServerConstants = require('../config.json');
const parseString = require('xml2js').parseString;
const child_process = require('child_process');

class Conntrack {

  static getOriginDestinationTCP(clientIP, clientPort) {

    return new Promise((resolve, reject) => {
  
      const cmds = [];
      let cm1 = ['-p', 'tcp', '--src', ServerConstants.LISTENIP, '--reply-port-src', ServerConstants.LISTENPORT, '--orig-src', clientIP, '--sport', clientPort, '-L', '-o', 'xml'];
      cm1.forEach(x => cmds.push(x));
  
      const ch = child_process.execFile('conntrack', cmds);
  
      let chunks = '';
      let chunks_err = '';
  
      ch.stdout.on('data', data => {
        chunks += data;
      });
  
      ch.stderr.on('data', data => {
        chunks_err + data;
      });
  
      ch.on('close', (code, signal) => {
  
        parseString(chunks, (err, result) => {
  
          if (err) {
            console.error('THROW: Could not parse conntrack data');
            console.error(chunks);
            console.error('STDERR:', chunks_err);
            reject();
            throw err;
          }
  
          try {

            const metas = result.conntrack.flow[0].meta[0];
          
            const originIP = metas.layer3[0].dst[0];
            const originPort = metas.layer4[0].dport[0];
    
            //console.log(`GetOriginDestination: ${clientIP}:${clientPort} -> ${originIP}:${originPort}`);
    
            resolve({
              originIP: originIP,
              originPort: originPort
            });

          } catch (e) {
            console.error('ERROR: unknown conntrack data');
            console.error('STDERR:', chunks_err);
            reject();
          }

        });
      
      });
  
    });
  
  }


}

module.exports = Conntrack