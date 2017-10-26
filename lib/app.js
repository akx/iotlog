const express = require('express');
const shortid = require('shortid');
const Promise = require('bluebird');
const fromPairs = require('./fromPairs');
const dfnFormatDate = require('date-fns/format');

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

function getDateFormatter(dateFormat) {
  if (dateFormat === 'unix') return ts => ts;
  if (dateFormat === 'iso') return ts => new Date(ts).toISOString();
  return ts => dfnFormatDate(ts, dateFormat);
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
    SELECT m1.*
    FROM measure m1
    INNER JOIN (
        SELECT node, key, max(ts) as maxts from measure group by node, key
    ) as m2 on m1.node = m2.node and m1.key = m2.key AND m1.ts = m2.maxts
    `).then(rs => res.json(fromPairs(rs.map(({
      node, key, value, ts
    }) => [`${node}:${key}`, (req.query.extended ? { value, ts } : value)]))))
  ));
  app.get('/values', (req, res) => {
    const {
      node, key, cutoffDays, format, dateFormat
    } = Object.assign({ format: 'json', cutoffDays: 7, dateFormat: 'iso' }, req.query);
    const cutoffMilliseconds = parseFloat(cutoffDays) * 86400 * 1000;
    const since = (+new Date()) - cutoffMilliseconds;
    if (!(node && key)) {
      res.status(404).send('missing node and key parameters');
    }
    const formatDate = getDateFormatter(dateFormat);
    knex
      .select('ts', 'value')
      .from('measure')
      .where({ node, key })
      .andWhere('ts', '>=', since)
      .orderBy('ts')
      .then(rows => rows.map(({ ts, value }) => [formatDate(ts), value]))
      .then((values) => {
        if (format === 'tsv') {
          res.send(values.map(r => r.join('\t')).join('\n'));
        } else {
          res.json({ node, key, values });
        }
      });
  });
  return app;
};
