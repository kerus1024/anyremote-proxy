const geoconfig       = require(`${process.cwd()}/geoconfig.json`);

class SNIFilter {

  //
  // ['hostnameRegex': GEOCOUNTRY]
  //
  static filters = {};

  static filter(initBuffer) {

    return new Promise((resolve, reject) => {
      const serverName = SNIFilter.readSNIHostname(initBuffer);
      if (!serverName) {
        resolve({sni:false, filter: false});
      } else {

        let ret = false;

        Object.keys(SNIFilter.filters).forEach((regexKey) => {

          const reg = new RegExp(regexKey);

          if (serverName.match(reg)) {

            const location = SNIFilter.filters[regexKey];
            const geoRemote = {};

            Object.keys(geoconfig.geoCountry).forEach(rproxyIP => {
              geoconfig.geoCountry[rproxyIP].forEach(countryCode => {
                if (location === countryCode) {
                  geoRemote.country = countryCode;
                  geoRemote.remoteServer = rproxyIP;
                  resolve({sni: true, filter: true, serverName: serverName, geoRemote: geoRemote }); 
                  ret = true;
                }
              });
            });

          }

        });

        if (!ret) {
          resolve({sni:true, filter: false, serverName: serverName});
        }

      }
    });
  }

  static readSNIHostname(buffer) {
    
    let pos = 0;

    if (buffer[pos] !== 0x16) {
      // SNI: Handshake
      return;
    }

    if (buffer[pos = pos + 5] !== 0x01) {
      // SNI: ClientHello
      return;
    }

    // Skip Length
    pos += 3;

    // Skip TLS Version 
    pos += 2;

    // Skip Random 32 bytes
    pos += 32;

    // Session ID Length
    const sessionIDLength = buffer[++pos];
    pos += sessionIDLength;

    // Cipher Suites Length
    pos++;
    const cipherLength = buffer[++pos];
    pos += cipherLength;

    // Compression Mode Length
    const compressionModeLength = buffer[++pos];
    pos += compressionModeLength;

    // Extension Length
    const extensionLength = buffer[++pos] * 0x100 + buffer[++pos];

    for (let i = pos; (i || pos) < Buffer.byteLength(buffer); i++) {

      // Extension ServerName
      // Server Name
      if (buffer[pos + 1] === 0x00 && buffer[pos + 2] === 0x00) {
        pos += 2;        

        // ServerName Extension Length
        pos += 2;

        // Server Name List Length
        pos += 2;

        
        if (buffer[++pos] !== 0x00) {
          // SNI: Hostname
          continue;
        }

        pos += 2;

        const serverNameLength = buffer[pos];
        const serverName = buffer.slice(++pos, pos + serverNameLength);
        console.log('SNI:Server-Name:', serverName.toString());
        return serverName.toString();

      } else {
        pos += 2;

        // Skip Extension 
        const skipLength = buffer[++pos] * 0x1FF + buffer[++pos];

        pos += skipLength;

      }

    }

    return null;

  }

  static init() {

    const f = SNIFilter.filters;

    // Twitter, Facebook
    f['^([^]+\.)?twitter.com$'] = 'JP';
    f['^([^]+\.)?t.co$'] = 'JP';
    f['^([^]+\.)?twimg.com$'] = 'JP';
    f['^([^]+\.)?facebook.com$'] = 'JP';
    f['^([^]+\.)?fbcdn.net$'] = 'JP';
    
    // 네이버
    f['^([^]+\.)?pstatic.net$'] = 'KR';

    // 넷플릭스
    const netflixCountry = 'JP';
    f['^([^]+\.)?netflix.com$'] = netflixCountry;
    f['^([^]+\.)?fast.com$'] =  netflixCountry;
    f['^([^]+\.)?nflxvideo.net$'] =  netflixCountry;
    f['^([^]+\.)?nflximg.net$'] =  netflixCountry;
    f['^([^]+\.)?nflxext.com$'] =  netflixCountry;
    f['^([^]+\.)?nflxvideo.net$'] =  netflixCountry;
    f['^([^]+\.)?nflxso.net$'] = netflixCountry;
    
    // 유튜브
    f['^([^]+\.)?ytimg.com$'] = 'KR';
    f['^([^]+\.)?youtube.com$'] = 'KR';
    f['^([^]+\.)?googlevideo.com$'] = 'KR';

    // ..
    f['^([^]+\.)?microsoft.com$'] = 'US';
    f['^play.googleapis.com$'] = 'JP';
    f['^([^]+).kr$'] = 'KR';
    f['^([^]+).jp$'] = 'KR';

  }

}

SNIFilter.init();

module.exports = SNIFilter;