process.title = 'rproxy-server-anyremote';

const ServerConstants = require('./config.json');
const Connection = require('./lib/Connection');

const net = require('net');
const server = net.createServer();

process.on('uncaughtException', (error) => {
  console.error(error);
});
  
server.on('connection', (localsocket) => {
  const connectionPipe = new Connection(localsocket);
});

server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
  console.log('server listening to %j', server.address());  
});