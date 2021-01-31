process.title = 'rproxy-server-anyremote';

const ServerConstants = require('./config.json');
const Connection = require('./lib/Connection');

const net = require('net');
const server = net.createServer();

process.on('uncaughtException', (error) => {
  console.error(error);
});
  
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });

} else {
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