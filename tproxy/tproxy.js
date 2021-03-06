process.title = 'tproxy-server-anyremote';

const ServerConstants = require(`${process.cwd()}/config.json`);
const HandleConnection = require('./lib/HandleConnection');
const Nice = require('./lib/Nice');

process.on('uncaughtException', (error) => {
  console.error(error);
});

const net = require('net');
const server = net.createServer();    
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (!global.gc) {
  console.log('GC Required. Run as --expose-gc');
  process.exit(1);
}

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  Nice.Nice();

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('error', (error) => {
    console.error(error);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} dead`);
    cluster.fork();
  });

} else {

  Nice.Nice();

  server.on('connection', (localsocket) => {
    const connectionPipe = new HandleConnection(localsocket);
  });

  server.listen(ServerConstants.LISTENPORT, ServerConstants.LISTENIP, () => {    
    console.log('server listening to %j', server.address());  
  });

  server.on('error', (err) => console.error());
  
  setTimeout(()=> { global.gc(); }, 60000);

}