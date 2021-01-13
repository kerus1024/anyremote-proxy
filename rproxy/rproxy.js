const ServerConstants = require('./config.json');

const net = require('net');
const server = net.createServer();

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

async function handleConnection(localsocket) {    

  const PAD = 'KERUSPROXYPAD\r\n';

  const clientIP = localsocket.remoteAddress;
  const clientPort = localsocket.remotePort;

  let remotesocket = new net.Socket();

  let initialParseProxy = false;
  let initialProxy = false;
  let initBuffer = Buffer.alloc(0);

  localsocket.on('connect', (data) => {
    Logger(">>> connection #%d from %s:%d",
      server.connections,
      localsocket.remoteAddress,
      localsocket.remotePort
    );
  });

  remotesocket.on('connect', (data) => {
    Logger('ProxyConnection generated!');
    initialProxy = true;
    //remotesocket.write(initBuffer);

    Logger(`initBufferSize : `, Buffer.byteLength(initBuffer));

  });

  localsocket.on('data', (data) => {

    if (!initialProxy && !initialParseProxy) {

      Logger('proxyConnection이 생성되지 않았습니다.');
      Logger('New BuferSize : ' + Buffer.byteLength(data));

      // first proxyrequest는 무조건 있어야한다.
      // 근데 중복으로 보내는경우도 있는거같다?? 
      const firstCRLF = data.indexOf('0D0A', 0, 'hex');
      if (firstCRLF === -1) {
        throw new Error('Request Buffer Error!');
      }

      const requestLeft = data.slice(0, firstCRLF + 2);
      const requestRight = data.slice(Buffer.byteLength(requestLeft));

      // TODO: 아이피 정규식을 대~충 했기 때문에 문제가 발생할 수 있다
      const regexProxyHead = /^KERUSPROXY\s([0-9\.]+)\s([0-9]{1,5})\sKERUSPROXYPAD\r\n/;
      const rTest = regexProxyHead.exec(requestLeft.toString());

      if (!rTest) {
        throw new Error('Buffer Error!!!!!!!?');
      }

      const requestIP = rTest[1];
      const requestPort = rTest[2];

      const tcpConnectionOptions = {
        port: requestPort,
        host: requestIP,
        localAddress: ServerConstants.PROXYLOCAL,
        family: 4,
      }

      Logger(`NEW PROXY CONNECT! -> ${requestIP}:${requestPort}`)

      remotesocket.connect(tcpConnectionOptions);

      //initBuffer = Buffer.concat([initBuffer, requestRight]);
      remotesocket.write(requestRight);

      initialParseProxy = true;
      return;
    } else if (!initialProxy) {
      Logger('proxyConnection이 생성되지 않았습니다.');
      Logger('New BufferData : ', data.toString());
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
    Logger('local socket Error', err);
    remotesocket.destroy();
  });
  remotesocket.on('error', (err) => {
    Logger('remote socket Error', err);
    localsocket.destroy();
  });

}
