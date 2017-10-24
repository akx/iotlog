const express = require('express');
const shortid = require('shortid');
const Promise = require('bluebird');
const fromPairs = require('./fromPairs');

function getMeasuresFromQuery(query) {
  return Object.keys(query).map((key) => {
    if (key === 'node') return null;
    const value = parseFloat(query[key]);
    if (!isNaN(value)) { // eslint-disable-line
      return { key, value };
    }
    return null;
  }).filter(m => !!m);
}

function getPayloadFromRequest({ ip, query }) {
  return new Promise((res) => {
    const ts = (+new Date());
    const req = shortid.generate();
    const node = (query.node || '').toLowerCase();
    if (!node) {
      throw new Error('Need node parameter');
    }
    const measures = getMeasuresFromQuery(query);
    if (!measures.length) {
      throw new Error('No valid measures received');
    }
    const payload = {
      ts, req, ip, measures, node, query
    };
    res(payload);
  });
}

function savePayload(knex, payload) {
  const {
    ts, ip, query, node, req, measures
  } = payload;
  return knex.transaction(trx => Promise.resolve(true)
    .then(() =>
      trx.insert({
        ts, node, req, data: JSON.stringify({ ts, ip, query })
      }).into('request'))
    .then(() => Promise.map(
      measures,
      ({ key, value }) => trx.insert({
        ts, node, req, key, value
      }).into('measure')
    )));
}


module.exports = ({ knex, cors }) => {
  const app = express();
  app.disable('x-powered-by');
  if (cors) {
    // eslint-disable-next-line global-require
    app.use(require('cors')());
  }
  app.knex = knex;
  app.all('/track', (req, res) => (
    getPayloadFromRequest(req)
      .then(payload => savePayload(knex, payload))
      .then((measureInserts) => {
        res.send(`ok ${measureInserts.length}`);
      })
      .catch((err) => {
        res.status(400).send(err);
      })
  ));
  app.get('/latest', (req, res) => (
    knex.raw(`
    SELECT m.node, m.key, m.ts, m.value
    FROM measure AS m
    WHERE m.ts = (SELECT MAX(ts) FROM measure AS m2 WHERE m.node = m2.node AND m.key = m2.key)
    GROUP BY m.node, m.key
    `).then(rs => res.json(fromPairs(rs.map(({
      node, key, value, ts
    }) => [`${node}:${key}`, (req.query.extended ? { value, ts } : value)]))))
  ));
  return app;
};
