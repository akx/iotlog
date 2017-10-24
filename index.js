const Knex = require('knex');
const makeSchema = require('./lib/makeSchema');
const App = require('./lib/app');

const PORT = (parseInt(process.env.PORT, 10) || 33333);
const HOST = process.env.HOST || null;
const KNEX_CONFIG = JSON.parse(process.env.KNEX_CONFIG || `{
  "client": "sqlite3",
  "connection": {
    "filename": "./iotlog.sqlite"
  },
  "useNullAsDefault": true
}`);

const knex = Knex(KNEX_CONFIG);
const app = App({ knex });
app.disable('x-powered-by');

makeSchema(knex).then(() => {
  app.listen(PORT, HOST, (err) => {
    if (err) throw err;
    console.log(`Listening on ${HOST || '*'}:${PORT}`);
  });
});
