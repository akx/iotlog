const config = require('./config');
const knex = require('knex')(config.knex);
const makeSchema = require('./lib/makeSchema');
const app = require('./lib/app')({ knex });

const PORT = (parseInt(process.env.PORT, 10) || 33333);


makeSchema(knex).then(() => {
  app.listen(PORT, null, (err) => {
    if (err) throw err;
    console.log(`Listening on ${PORT}`);
  });
});
