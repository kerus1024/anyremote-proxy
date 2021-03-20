const Reader          = require('@maxmind/geoip2-node').Reader;
const geoconfig       = require(`${process.cwd()}/geoconfig.json`);
const CIDR            = require('./CIDR');

const fs = require('fs');
const redis = require('redis');
const util = require('util');
const promisify = util.promisify;
const client = redis.createClient(6379, '127.0.0.1');
const getAsync = promisify(client.get).bind(client);

const CACHE_EXPIRE_TIME = 604800000; // 7days (ms)
const REDISPREFIX = 'anyproxy:geoip4';


let _redisConnect = false;
const isRedisConnected = () => {
  return _redisConnect;
}

client.on('connect', () => {
  console.log('Redis Connected!');
});


class GeoIPReader {

  static async routeGeoRemote(ip) {

    const startTime = new Date().getTime();

    return new Promise(async (resolve, reject) => {

      let country = 'ZZ';

      try {
        country = await GeoIPReader.lookup(ip);
      } catch (e) {
        country = 'ZZ';
        console.error(e);
      } finally {

        let selectRemote = geoconfig.gw;

        Object.keys(geoconfig.geoCountry).forEach(rproxyIP => {
          geoconfig.geoCountry[rproxyIP].forEach(countryCode => {
            if (country === countryCode) {
              selectRemote = rproxyIP;
            }
          });
        });

        //console.log('GeoIP Lookup Time : ' + (new Date().getTime() - startTime) + 'ms');

        resolve({
          country: country,
          remoteServer: selectRemote
        });

      }

    });

  }

  static async lookup(ip) {
    return new Promise(async(resolve, reject) => {

      const retrieveGeoIP = await GeoIPReader.checkCache(ip);
      if (retrieveGeoIP) {
        return resolve(retrieveGeoIP);
      }

      const checkCustomRoutes = GeoIPReader.checkCustomRoutes(ip);
      if (checkCustomRoutes) {
        GeoIPReader.addCache(ip, checkCustomRoutes);
        return resolve(checkCustomRoutes);
      }

      const maxmind = await GeoIPReader.maxmind(ip);
      resolve(maxmind);
    });
  }

  static checkCustomRoutes(ip) {

    let ret = false;
    Object.keys(geoconfig.customRoutes).forEach(prefix => {
      const cidr = new CIDR(prefix);
      if (cidr.isInPrefix(ip)) {
        ret = geoconfig.customRoutes[prefix];
      }
    })

    return ret;

  }

  static async maxmind(ip) {

    return new Promise(async(resolve, reject) => {

      try {

        const dbBuffer = fs.readFileSync('/usr/share/GeoIP/GeoLite2-Country.mmdb');
        const reading = Reader.openBuffer(dbBuffer);
        const response = reading.country(ip);
        const country = response.country.isoCode;

        GeoIPReader.addCache(ip, country);
        resolve(country);

      } catch (e) {
        console.error('GEOIP: Couldnt resolve geoip', e);
        resolve('ZZ');
        GeoIPReader.addCache(ip, 'ZZ');
      } finally {
        //if (cacheKV.length > 5000000) cacheKV = {};
      }

    });

  }

  static async checkCache(ip) {
    return new Promise(async (resolve, reject) => {
      const convert24 = GeoIPReader.ipv4To24Prefix(ip);
      try {
        const _geoLocation = await getAsync(`${REDISPREFIX}:${convert24}`);
        const geoLocation = JSON.parse(_geoLocation);
        if (geoLocation) {
          if (geoLocation.EXPIRE > new Date().getTime()) {
            resolve(geoLocation.GEO);
          } else {
            GeoIPReader.removeCache(ip);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  static addCache(ip, geoLocation) {
    const convert24 = GeoIPReader.ipv4To24Prefix(ip);
    const j = {
      EXPIRE: new Date().getTime() + CACHE_EXPIRE_TIME,
      GEO: geoLocation
    }
    client.set(`${REDISPREFIX}:${convert24}`, JSON.stringify(j));
  }

  static removeCache(ip) {
    const convert24 = GeoIPReader.ipv4To24Prefix(ip);
    client.del(`${REDISPREFIX}:${convert24}`);
  }

  static ipv4To24Prefix(requestIP) {
    const ipArray = requestIP.split('.');
    ipArray[3] = '0';
    return ipArray.join('.');
  }

}



module.exports = GeoIPReader