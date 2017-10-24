const config = require('./config');
const knex = require('knex')(config.knex);
const express = require('express');
const shortid = require('shortid');
const Promise = require('bluebird');
const makeSchema = require('./lib/makeSchema');

const app = express();

app.all('/track', ({ ip, query }, res) => {
  const ts = (+new Date());
  const req = shortid.generate();
  const node = (query.node || '').toLowerCase();
  if (!node) {
    res.status(400).send('need node param');
    return;
  }
  const measures = Object.keys(query).map((key) => {
    if (key === 'node') return null;
    const value = parseFloat(query[key]);
    if (!isNaN(value)) { // eslint-disable-line
      return { key, value };
    }
    return null;
  }).filter(m => !!m);
  if (!measures.length) {
    res.status(400).send('no valid measures');
    return;
  }
  knex.transaction(trx =>
    Promise.resolve(true)
      .then(() =>
        trx.insert({
          ts, node, req, data: JSON.stringify({ ts, ip, query })
        }).into('request'))
      .then(() => Promise.map(
        measures,
        ({ key, value }) => trx.insert({
          ts, node, req, key, value
        }).into('measure')
      ))
      .then((measureInserts) => {
        res.send(`ok ${measureInserts.length}`);
      })
      .catch((err) => {
        console.log(err);
        res.status(400).send(err);
        throw err;
      }));
});


makeSchema(knex).then(() => {
  app.listen(33333);
});

