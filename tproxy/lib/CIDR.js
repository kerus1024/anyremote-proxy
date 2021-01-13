class CIDR {

  static subnetMaskMap = [
    '0.0.0.0',
    '128.0.0.0',
    '192.0.0.0',
    '224.0.0.0',
    '240.0.0.0',
    '248.0.0.0',
    '252.0.0.0',
    '254.0.0.0',
    '255.0.0.0',
    '255.128.0.0',
    '255.192.0.0',
    '255.224.0.0',
    '255.240.0.0',
    '255.248.0.0',
    '255.252.0.0',
    '255.254.0.0',
    '255.255.0.0',
    '255.255.128.0',
    '255.255.192.0',
    '255.255.224.0',
    '255.255.240.0',
    '255.255.248.0',
    '255.255.252.0',
    '255.255.254.0',
    '255.255.255.0',
    '255.255.255.128',
    '255.255.255.192',
    '255.255.255.224',
    '255.255.255.240',
    '255.255.255.248',
    '255.255.255.252',
    '255.255.255.254',
    '255.255.255.255'
  ];

  constructor(...args) {
      
    this._hostIP = null;
    this._cidr = null;
    this._network = null;
    this._prefix = null;
    this._subnetMask = null;
    this._long = null;
    this._masklong = null;

    try {

      // check parse 8.0.0.0/4
      if (args.length) {
        
        let parse = args[0].split('/');
        let pNetwork = parse[0];
        let pPrefix = parse[1];
        
        let long = CIDR.ip2long(pNetwork);
        let subnetMask = CIDR.prefix2masklong(pPrefix);
        let masklong = CIDR.ip2long(subnetMask);
        
        let networkMasking = (long & masklong) >>> 0;

        if (networkMasking != long) {
          if (args.length >= 2 && args[1] === true) {
            // 강제적용
            pNetwork = CIDR.long2ip(networkMasking);
            long = CIDR.ip2long(pNetwork);
          } else {
            throw new Error("WARN: 올바른 네트워크 마스크가 아닙니다");
          }
        }

        this._hostIP = pNetwork; // ?   
        this._cidr = pNetwork;
        this._network = pNetwork;
        this._prefix = pPrefix;
        this._subnetMask = subnetMask;
        this._long = long;
        this._masklong = masklong;
        
      } else {
        throw new Error('매개변수가 일치하지 않습니다.', e)
      }

    } catch (e) {
      console.error(e);
      throw new Error('CIDR parse error', e);
    }

  }

  get hostIP() {
    return this._hostIP;
  }

  get cidr() {
    return this._cidr;
  }

  get networkID() {
    return this._network;
  }

  get subnetMask() {
    return this._subnetMask;
  }

  get ip2long() {
    return this._long;
  }

  get masklong() {
    return this._masklong;
  }

  static prefix2masklong(prefixCount) {
    return CIDR.subnetMaskMap[prefixCount];
  }

  static ip2long(ip) {
    let parseIP = ip.split('.');

    if (parseIP.length !== 4)
      throw new Error('IP가 아님');

    try {

      let i = 0;

      let long = 0;

      parseIP.reverse().forEach(val => {
        long += val * Math.pow(0x100, i++);
      });

      return long;

    } catch (e) {
      throw new Error('Failed to parse ip');
    }

  }

  static long2ip(long) {
    // https://github.com/legend80s/long2ip/blob/master/index.js
    const MAX_IP_IN_LONG = 4294967295; // 255.255.255.255
    const MIN_IP_IN_LONG = 0; // 0.0.0.0

    if (typeof long !== 'number' || long > MAX_IP_IN_LONG || long < MIN_IP_IN_LONG) {
      throw new Error('long ip가 아닙니다');
    }

    const ip = [long >>> 24, long >>> 16 & 0xFF, long >>> 8 & 0xFF, long & 0xFF].join('.');

    return ip;
  }

  isInPrefix(ip) {
    return (CIDR.ip2long(ip) & this.masklong) >>> 0 === this._long;
  }

}

module.exports = CIDR;