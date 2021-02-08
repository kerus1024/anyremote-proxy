const ServerConstants = require(`${process.cwd()}/config.json`);
const CACHEPATH = ServerConstants.CACHEPATH;

const fs = require('fs');

const CACHE_EXPIRE_TIME = 604800000; // 7days (ms)

class Cache {

  static _store = {};

  static retrieveGeoIP(requestIP) {
    if (typeof Cache._store.geoIP[Cache.ipv4To24Prefix(requestIP)] !== 'undefined') {
      const thisCache = Cache._store.geoIP[Cache.ipv4To24Prefix(requestIP)];
      
      if (new Date().getTime() > thisCache.expire) {
        delete Cache._store.geoIP[Cache.ipv4To24Prefix(requestIP)];
        return false;
      }

      return Cache._store.geoIP[Cache.ipv4To24Prefix(requestIP)]['LO'];

    }
  }

  static addGeoIPCache(requestIP, geoLocation) {
    Cache._store.geoIP[Cache.ipv4To24Prefix(requestIP)] = {
      'LO': geoLocation,
      'expire': new Date().getTime() + CACHE_EXPIRE_TIME
    }
  }

  static ipv4To24Prefix(requestIP) {
    const ipArray = requestIP.split('.');
    ipArray[3] = '0';
    return ipArray.join('.');
  }

}

Cache._store.geoIP = {};
/*
// ........................
try {
  fs.readFileSync(CACHEPATH);
} catch (e) {
  fs.writeFileSync(CACHEPATH, JSON.stringify(Cache._store.geoIP));
}

try {
  Cache._store.geoIP = JSON.parse(fs.readFileSync(CACHEPATH));
} catch (e) {
  console.error('Could not write to ', CACHEPATH);
  process.exit(1); 
}


// https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
process.stdin.resume();//so the program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) {
      // 클러스터링하면 저장에 문제가 있다..
      // TODO: /tmp/tproxycache-[pid] 로 저장후 실행시 한번에 합치자?
      try {
        const js = JSON.parse(fs.readFileSync(CACHEPATH));
        const merged = Object.assign(js, Cache._store.geoIP);
        fs.writeFileSync(CACHEPATH, JSON.stringify(merged));
      } catch (e) {

      }

    } 
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) {
      process.exit();
    } 
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
*/
module.exports = Cache;