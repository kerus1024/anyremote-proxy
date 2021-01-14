const child_process = require('child_process');
const net = require('net');
const server = net.createServer();    

const geoip = require('./lib/GeoIP');
const geoconfig = require('./geoconfig.json');
const parseString = require('xml2js').parseString;
const ServerConstants = require('./config.json');

const Logger = (...log) => {
  //console.log(...log);
}

process.on("uncaughtException", function(error) {
  console.error(error);
});

server.on('connection', handleConnection);
server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
  console.log('server listening to %j', server.address());  
});

const getOriginDestinationTCP = (clientIP, clientPort) => {

  return new Promise((resolve, reject) => {

    const cmds = [];
    let cm1 = ['-p', 'tcp', '--src', ServerConstants.LISTENIP, '--reply-port-src', ServerConstants.LISTENPORT, '--orig-src', clientIP, '--sport', clientPort, '-L', '-o', 'xml'];
    cm1.forEach(x => cmds.push(x));

    const ch = child_process.execFile('conntrack', cmds);

    let chunks = '';

    ch.stdout.on('data', data => {
      chunks += data;
    });

    ch.stderr.on('data', data => {
      //chunks += data;
      console.error('ERR:', data);
    });

    ch.on('close', (code, signal) => {

      parseString(chunks, (err, result) => {
        //console.dir(result);

        if (err) {
          console.error('THROW: Could not parse conntrack data');
          throw err;
        }

        const metas = result.conntrack.flow[0].meta[0];
        
        const originIP = metas.layer3[0].dst[0];
        const originPort = metas.layer4[0].dport[0];

        console.log(`Resolve OriginDst: ${clientIP}:${clientPort} to ${originIP}:${originPort}`);

        resolve({
          originIP: originIP,
          originPort: originPort
        });

      });
    

      //console.log('GotData : ', chunks);
    });

  });

}

async function routeGeoRemote(ip) {

  const startTime = new Date().getTime();

  return new Promise(async  (resolve, reject) => {

    let country = 'ZZ';

    try {
      country = await geoip.lookup(ip);
    } catch (e) {
      country = 'ZZ';
      console.error(e);
    } finally {
      
      let selectRemote = geoconfig.gw;

      Object.keys(geoconfig.geoCountry).forEach(rproxyIP => {
        geoconfig.geoCountry[rproxyIP].forEach(countryCode => {
          if (country === countryCode) {
            selectRemote = rproxyIP;
          }
        });
      });

      //console.log(country, selectRemote);

      console.log('GeoIP Lookup Time : ' + (new Date().getTime() - startTime) + 'ms');

      resolve({
        country: country,
        remoteServer: selectRemote
      });

    }

  });

}

async function handleConnection(localsocket) {    

  localsocket.setNoDelay(true);

  const clientIP = localsocket.remoteAddress;
  const clientPort = localsocket.remotePort;

  try {

    const resolve = await getOriginDestinationTCP(clientIP, clientPort);
    //conn.end();

    //const country = await geoip.lookup(resolve.originIP);
    const getGeo = await routeGeoRemote(resolve.originIP);

    console.log(`CONNECT ${clientIP}:${clientPort} -> ${resolve.originIP}:${resolve.originPort} via ${getGeo.remoteServer}`);

    let remotesocket = new net.Socket();
    
    let initialProxy = false;
    let initBuffer = Buffer.alloc(0);

    const tcpConnectionOptions = {
      port: resolve.originPort,
      host: resolve.originIP,
      localAddress: ServerConstants.PROXYLOCAL,
      family: 4,
    }

    remotesocket.connect(geoconfig.rProxyPort, getGeo.remoteServer);
    remotesocket.write(`KERUSPROXY ${resolve.originIP} ${resolve.originPort} KERUSPROXYPAD\r\n`);

    localsocket.on('connect', (data) => {
      Logger(">>> connection #%d from %s:%d",
        server.connections,
        localsocket.remoteAddress,
        localsocket.remotePort
      );
    });

    remotesocket.on('connect', (data) => {
      remotesocket.setNoDelay(true);
      //remotesocket.write(`KERUSPROXY ${resolve.originIP} ${resolve.originPort} KERUSPROXYPAD\r\n`);
      if (Buffer.byteLength(initBuffer)) {
        remotesocket.write(initBuffer);
      }
      initialProxy = true;
    });

    localsocket.on('data', (data) => {

      if (!initialProxy) {
        initBuffer = Buffer.concat([initBuffer, data]);
        return;
      }

      Logger("%s:%d - writing data to remote",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      let flushed = remotesocket.write(data);
      if (!flushed) {
        Logger("  remote not flushed; pausing local");
        localsocket.pause();
      }
    });

    remotesocket.on('data', (data) => {
      Logger("%s:%d - writing data to local",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      let flushed = localsocket.write(data);
      if (!flushed) {
        Logger("  local not flushed; pausing remote");
        remotesocket.pause();
      }
    });

    localsocket.on('drain', () => {
      Logger("%s:%d - resuming remote",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      remotesocket.resume();
    });

    remotesocket.on('drain', () => {
      Logger("%s:%d - resuming local",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      localsocket.resume();
    });

    localsocket.on('close', (had_error) => {
      Logger("%s:%d - closing remote",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      remotesocket.end();
    });

    remotesocket.on('close', (had_error) => {
      Logger("%s:%d - closing local",
        localsocket.remoteAddress,
        localsocket.remotePort
      );
      localsocket.end();
    });

    localsocket.on('error', (err) => {
      remotesocket.destroy();
    });
    remotesocket.on('error', (err) => {
      localsocket.destroy();
    });

  } catch (e) {
    console.error('ERR: Could not resolve originDst data', e);
    localsocket.destroy();
    remotesocket.destroy();
  }

}