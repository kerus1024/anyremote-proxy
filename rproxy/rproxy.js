process.title = 'rproxy-server-anyremote';

const ServerConstants = require('./config.json');
const Connection = require('./lib/Connection');

const net = require('net');
const server = net.createServer();

process.on('uncaughtException', (error) => {
  console.error(error);
});
  
const ConnectionList = {};
let connectionID = 0;

server.on('connection', (localsocket) => {
  ConnectionList[connectionID] = new Connection(localsocket, ConnectionList, connectionID);
  connectionID++;
});

server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
  console.log('server listening to %j', server.address());  
});