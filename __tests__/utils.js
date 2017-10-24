const app = require('../lib/app');
const makeSchema = require('../lib/makeSchema');
const Knex = require('knex');


const CONFIG = {
  knex: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true
  }
};

module.exports.makeApp = () => new Promise((res) => {
  const knex = Knex(CONFIG.knex);
  makeSchema(knex).then(() => res(app({ knex })));
});
