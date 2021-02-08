const Reader          = require('@maxmind/geoip2-node').Reader;
const geoconfig       = require(`${process.cwd()}/geoconfig.json`);
const CIDR            = require('./CIDR');
const Cache           = require('./Cache');
const fs = require('fs');

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
      
      if (Cache.retrieveGeoIP(ip)) {
        return resolve(Cache.retrieveGeoIP(ip));
      }

      const checkCustomRoutes = GeoIPReader.checkCustomRoutes(ip);
      if (checkCustomRoutes) {
        Cache.addGeoIPCache(ip, checkCustomRoutes);
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
            
        Cache.addGeoIPCache(ip, country);
        resolve(country);

      } catch (e) {
        console.error('GEOIP: Couldnt resolve geoip', e);
        resolve('ZZ');
        Cache.addGeoIPCache(ip, 'ZZ');
      } finally {
        //if (cacheKV.length > 5000000) cacheKV = {};
      }
            
    });
      
  }

}



module.exports = GeoIPReader