process.title = 'tproxy-server-anyremote';

const net = require('net');
const server = net.createServer();    

const ServerConstants = require(`${process.cwd()}/config.json`);
const HandleConnection = require('./lib/HandleConnection');

process.on('uncaughtException', (error) => {
  console.error(error);
});

server.on('connection', (localsocket) => {
  const connectionPipe = new HandleConnection(localsocket);
});

server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
  console.log('server listening to %j', server.address());  
});