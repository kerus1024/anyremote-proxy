const child_process = require('child_process');

class Nice {

  static NICEVALUE = -17;

  static Nice() {
    
    const cmds = [];
    cmds.push('-n');
    cmds.push(Nice.NICEVALUE);
    cmds.push('-p');
    cmds.push(process.pid);

    const ch = child_process.execFile('renice', cmds);

    let chunks = '';
    let chunks_err = '';
  
    ch.stdout.on('data', data => {
      chunks += data;
    });

    ch.stderr.on('data', data => {
      chunks_err += data;
    });

    ch.on('close', (code, signal) => {
      if (chunks) console.log(chunks);
      if (chunks_err) console.error(chunks_err);
    });

  }

}

module.exports = Nice;