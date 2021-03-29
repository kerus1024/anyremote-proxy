const ServerConstants = require(`${process.cwd()}/config.json`);

const net = require('net');

const BASELENGTH = 21;

class Connection {

  constructor(localsocket, connectionList, connectionID) {

    // client가 tproxy서버이기 때문
    this.proxyIP            = localsocket.remoteAddress;
    this.proxyPort          = localsocket.remotePort;
    this.targetIP           = null;
    this.targetPort         = null;

    this.localsocket        = localsocket;
    //this.remotesocket       = new net.Socket();
    this.remotesocket       = null;

    this.initialParseProxy  = false;
    this.initialProxy       = false;
    this.initBuffer         = Buffer.alloc(0);

    this.connectionList = connectionList;
    this.connectionID = connectionID;

    //this.localsocket.setNoDelay(true);

    this.buildLocalEvent();

  }

  buildLocalEvent() {

    this.localsocket.on('data', (data) => {

      if (!this.initialProxy && !this.initialParseProxy) {

        // first proxyrequest는 무조건 있어야한다.
        // 근데 중복으로 보내는경우도 있는거같다??  -> SYN여러번 보내는 경우인듯
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
          this.localsocket.end();
          if (this.remotesocket) {
            this.remotesocket.end();
          }
          delete this.connectionList[this.connectionID];
          throw new Error('Buffer Error!!!!!!!?');
        }
  
        this.targetIP = rTest[1];
        this.targetPort = rTest[2];
  
        const tcpConnectionOptions = {
          port: this.targetPort,
          host: this.targetIP,
          //localAddress: ServerConstants.PROXYLOCAL,
          family: 4,
        }
  
        console.log(`NEW PROXY CONNECT! -> ${this.targetIP}:${this.targetPort}`)
  
        this.remotesocket = new net.Socket();
        this.remotesocket.connect(tcpConnectionOptions);

        this.initBuffer = Buffer.concat([this.initBuffer, requestRight]);

        this.initialParseProxy = true;

        this.buildRemoteEvent();

      } else if (!this.initialProxy && !ServerConstants.BYPASSDPI) {
        this.initBuffer = Buffer.concat([this.initBuffer, data]);
      } else if (ServerConstants.BYPASSDPI && Buffer.byteLength(data) >= BASELENGTH) {
        
        if (this.targetPort == 80) {

          if (/^([A-Z]{3,6})\s([^\s]+)\s([^\s]+)(\r)?\nHost\:/.exec(data.toString())) {
            const currentBufferSize = Buffer.byteLength(data);
            const sliceLeft = data.slice(0, BASELENGTH);
            const sliceRight = data.slice(BASELENGTH, currentBufferSize);
            this.remotesocket.write(sliceLeft);
            this.remotesocket.write(sliceRight);
          } else {
            let flushed = this.remotesocket.write(data);
            if (!flushed) {
              this.localsocket.pause();
            }
          }

        } else {
          let flushed = this.remotesocket.write(data);
          if (!flushed) {
            this.localsocket.pause();
          }
        }

      } else {
        let flushed = this.remotesocket.write(data);
        if (!flushed) {
          this.localsocket.pause();
        }
      }
  
    });

    this.localsocket.on('drain', () => {
      this.remotesocket.resume();
    });

    this.localsocket.on('close', () => {
      this.localsocket.end();
      if (this.remotesocket) {
        this.remotesocket.end();
      }
      if (typeof this.connectionList[this.connectionID] !== "undefined") {
        delete this.connectionList[this.connectionID];
      }
    });

    this.localsocket.on('error', (err) => {
      console.error(err);
      this.localsocket.end();
      if (this.remotesocket) {
        this.remotesocket.end();
      }

      if (typeof this.connectionList[this.connectionID] !== "undefined") {
        delete this.connectionList[this.connectionID];
      }
    });

  }

  buildRemoteEvent() {

    this.remotesocket.on('connect', (data) => {

      if (ServerConstants.BYPASSDPI || ServerConstants.NODELAY) {
        this.remotesocket.setNoDelay(true);
      }

      if (Buffer.byteLength(this.initBuffer)) {

        const currentBufferSize = Buffer.byteLength(this.initBuffer); 

        // TCP bypass DPI

        if (ServerConstants.BYPASSDPI){ 
          
          if (currentBufferSize >= BASELENGTH) {
            
            const sliceLeft = this.initBuffer.slice(0, BASELENGTH);
            const sliceRight = this.initBuffer.slice(BASELENGTH, currentBufferSize);
            
            this.remotesocket.write(sliceLeft);
            this.remotesocket.write(sliceRight);

          } else {

            this.remotesocket.write(this.initBuffer);

          }

        } else {

          this.remotesocket.write(this.initBuffer);
          
        }

        this.initBuffer = null;

      }

      this.initialProxy = true;

    });

    this.remotesocket.on('data', (data) => {
      let flushed = this.localsocket.write(data);
      if (!flushed && this.initialProxy) {
        this.remotesocket.pause();
      }
    });

    this.remotesocket.on('drain', () => {
      this.localsocket.resume();
    });

    this.remotesocket.on('close', (had_error) => {
      if (had_error) console.error('closed connection - transmission error');
      this.localsocket.end();
      this.remotesocket.end();
      if (typeof this.connectionList[this.connectionID] !== "undefined") {
        delete this.connectionList[this.connectionID];
      }
    });

    this.remotesocket.on('error', (err) => {
      console.error(err);
      this.localsocket.end();
      this.remotesocket.end();
      if (typeof this.connectionList[this.connectionID] !== "undefined") {
        delete this.connectionList[this.connectionID];
      }
    });

  }

}

module.exports = Connection;