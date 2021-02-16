process.title = 'rproxy-server-anyremote';

const ServerConstants = require('./config.json');
const Connection = require('./lib/Connection');
const Nice = require('./lib/Nice');

process.on('uncaughtException', (error) => {
  console.error(error);
});
  
const net = require('net');
const server = net.createServer();
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  Nice.Nice();

  // Fork workers.
  for (let i = 0; i < numCPUs * 2; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
    cluster.fork();
  });

} else {

  Nice.Nice();

  const ConnectionList = {};
  let connectionID = 0;

  server.on('connection', (localsocket) => {
    ConnectionList[connectionID] = new Connection(localsocket, ConnectionList, connectionID);
    connectionID++;
  });

  server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
    console.log('server listening to %j', server.address());  
  });
}