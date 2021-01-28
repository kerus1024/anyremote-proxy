const net = require('net');

const geoconfig = require(`${process.cwd()}/geoconfig.json`);
const ServerConstants = require(`${process.cwd()}/config.json`);
const GeoIP = require('./GeoIP');
const Conntrack = require('./Conntrack');

class HandleConnection {

  constructor(localsocket) {

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
  
    this.localsocket.setNoDelay(true);

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

      const tcpConnectionOptions = {
        port: this.targetGeoRemotePort,
        host: this.targetGeoRemoteServer,
        localAddress: ServerConstants.PROXYLOCAL,
        family: 4,
      }

      console.log(`NEW PROXY CONNECT - ${this.clientIP}:${this.clientPort} -> ${this.targetIP}:${this.targetPort} [${this.targetGeoRemoteServer} (${this.targetGeoCountry})]`);

      this.remotesocket.connect(tcpConnectionOptions);
      this.remotesocket.write(`KERUSPROXY ${resolve.originIP} ${resolve.originPort} KERUSPROXYPAD\r\n`);

      this.buildRemoteEvent();

    } catch (e) {
      console.error(e);
      this.localsocket.destroy();
    }

  }

  async buildLocalEvent() {

    this.localsocket.on('data', (data) => {

      if (!this.initialProxy) {
        this.initBuffer = Buffer.concat([this.initBuffer, data]);
        return;
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

    this.localsocket.on('close', (had_error) => {
      this.remotesocket.end();
    });

    this.localsocket.on('error', (err) => {
      console.error(err);
      this.remotesocket.destroy();
    });

  }

  async buildRemoteEvent() {

    this.remotesocket.on('connect', (data) => {
      this.remotesocket.setNoDelay(true);

      if (Buffer.byteLength(this.initBuffer)) {
        this.remotesocket.write(this.initBuffer);
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
      this.localsocket.destroy();
    });

    this.remotesocket.on('error', (err) => {
      console.error(err);
      this.localsocket.destroy();
    });

  }

}

module.exports = HandleConnection