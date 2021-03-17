const net = require('net');

const geoconfig = require(`${process.cwd()}/geoconfig.json`);
const ServerConstants = require(`${process.cwd()}/config.json`);
const GeoIP = require('./GeoIP');
const Conntrack = require('./Conntrack');
const SNIFilter = require('./SNIFilter');
const { filter } = require('./SNIFilter');

const wait = (mills) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => { resolve(); }, mills);
  });
}

class HandleConnection {

  constructor(localsocket) {


    if (localsocket.destroyed || typeof localsocket.remoteAddress === 'undefined') {
      return;
    }

    this.clientIP           = localsocket.remoteAddress;
    this.clientPort         = localsocket.remotePort;
    this.targetIP           = null;
    this.targetPort         = null;
  
    this.localsocket        = localsocket;
    //this.remotesocket       = new net.Socket();
    this.remotesocket       = null;

    this.targetGeoCountry   = 'ZZ';
    this.targetGeoRemoteServer    = geoconfig.gw;
    this.targetGeoRemotePort      = geoconfig.rProxyPort;
  
    this.initialParseProxy  = false;
    this.initialProxy       = false;
    this.initBuffer         = Buffer.alloc(0);
  
    //this.localsocket.setNoDelay(true);

    this.readyConnect = false;

    (async() => {
      this.initConnection();
      this.buildLocalEvent();      
    })();

  }

  async initConnection() {

    try {

      const resolve   = await Conntrack.getOriginDestinationTCP(this.clientIP, this.clientPort);
      this.targetIP   = resolve.originIP;
      this.targetPort = resolve.originPort;

      const getGeoRemoteIP = await GeoIP.routeGeoRemote(resolve.originIP);
      this.targetGeoCountry      = getGeoRemoteIP.country;
      this.targetGeoRemoteServer = getGeoRemoteIP.remoteServer;

      this.remotesocket = new net.Socket();

      // 데이터가 조금 모여야함
      await wait(1);

      // initBuffer가 없으면 동작하지 않는다..
      if (this.targetPort === 443 && ServerConstants.SNIFILTER && Buffer.byteLength(this.initBuffer)) {

        const filterResult = await SNIFilter.filter(this.initBuffer);

        if (filterResult.filter) {
          this.targetGeoCountry = filterResult.geoRemote.country;
          this.targetGeoRemoteServer = filterResult.geoRemote.remoteServer;
          console.log(`SNIFilter>${filterResult.serverName} ---> [${this.targetGeoCountry}]`);
        }

      }

      const tcpConnectionOptions = {
        port: this.targetGeoRemotePort,
        host: this.targetGeoRemoteServer,
        localAddress: ServerConstants.PROXYLOCAL,
        family: 4,
      }

      console.log(`NEW PROXY CONNECT - ${this.clientIP}:${this.clientPort} -> ${this.targetIP}:${this.targetPort} [${this.targetGeoRemoteServer} (${this.targetGeoCountry})]`);

      this.remotesocket.connect(tcpConnectionOptions);
      this.remotesocket.write(`KERUSPROXY ${this.targetIP} ${this.targetPort} KERUSPROXYPAD\r\n`);
      this.readyConnect = true;

      this.buildRemoteEvent();

    } catch (e) {
      console.error(e);
      this.localsocket.end();
    }

  }

  async buildLocalEvent() {

    this.localsocket.on('data', (data) => {

      if (!this.readyConnect || !this.initialProxy) {
        this.initBuffer = Buffer.concat([this.initBuffer, data]);
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
    });

    this.localsocket.on('error', (err) => {
      console.error(err);
      if (this.remotesocket) {
        this.remotesocket.end();
      }
    });

  }

  async buildRemoteEvent() {

    this.remotesocket.on('connect', () => {
      this.remotesocket.setNoDelay(true);

      if (Buffer.byteLength(this.initBuffer)) {
        this.remotesocket.write(this.initBuffer);
        this.initBuffer = Buffer.alloc(0);
      }

      this.initialProxy = true;
    });

    this.remotesocket.on('data', (data) => {
      let flushed = this.localsocket.write(data);
      if (!flushed) {
        this.remotesocket.pause();
      }
    });

    this.remotesocket.on('drain', () => {
      this.localsocket.resume();
    });

    this.remotesocket.on('close', (had_error) => {
      this.localsocket.end();
      this.remotesocket.end();
    });

    this.remotesocket.on('error', (err) => {
      console.error(err);
      this.localsocket.end();
      this.remotesocket.end();
    });

  }

}

module.exports = HandleConnection