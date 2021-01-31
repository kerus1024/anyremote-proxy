process.title = 'tproxy-server-anyremote';

const ServerConstants = require(`${process.cwd()}/config.json`);
const HandleConnection = require('./lib/HandleConnection');

process.on('uncaughtException', (error) => {
  console.error(error);
});

const net = require('net');
const server = net.createServer();    
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

  server.on('connection', (localsocket) => {
    const connectionPipe = new HandleConnection(localsocket);
  });

  server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
    console.log('server listening to %j', server.address());  
  });

}