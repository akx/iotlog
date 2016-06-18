const Promise = require('bluebird');
module.exports = (knex) => {
  const tables = [
    knex.schema.hasTable('measure').then((exists) => {
      if (exists) return true;
      return knex.schema.createTable('measure', (table) => {
        table.increments();
        table.biginteger('ts').index();
        table.string('node').index();
        table.string('req').index();
        table.string('key').index();
        table.decimal('value');
      });
    }),
    knex.schema.hasTable('request').then((exists) => {
      if (exists) return true;
      return knex.schema.createTable('request', (table) => {
        table.increments();
        table.biginteger('ts').index();
        table.string('node').index();
        table.string('req').index();
        table.json('data');
      });
    }),
  ];
  return Promise.all(tables);
};
