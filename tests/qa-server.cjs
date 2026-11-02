'use strict';
// Isolated browser QA origin; it cannot overwrite the player's port-4177 save.
const server = require('../server.cjs').createServer();
const port=Number(process.env.ND_QA_PORT||4181);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid QA port');
server.listen(port, '127.0.0.1', () => console.log('Neon Drift QA: http://127.0.0.1:'+port+'/'));
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
