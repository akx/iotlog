/* eslint-env jest */
const { makeApp } = require('./utils');
const request = require('supertest');

describe('the app', () => {
  let app = null;
  beforeEach(() => makeApp().then((a) => {
    app = a;
  }));
  afterEach(() => {
    app = null;
  });
  it('receives and stores items', () => (
    request(app)
      .get('/track?node=foo&temperature=100&humidity=172.6&spler=spurd')
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.text).toBe('ok 2');
      })
      .then(() => app.knex.select().from('request').then(([row]) => {
        expect(row.node).toBe('foo');
        expect(row.data).toContain('"ip"');
        expect(row.data).toContain('"query"');
        return row.req;
      }))
      .then(req => app.knex.select().from('measure').where({ req }).then((rows) => {
        expect(rows).toHaveLength(2);
        const temperatureRow = rows.find(r => r.key === 'temperature');
        const humidityRow = rows.find(r => r.key === 'humidity');
        expect(temperatureRow.value).toBe(100);
        expect(humidityRow.value).toBe(172.6);
      }))
  ));
  it('refuses nodeless communication', () => (
    request(app)
      .get('/track?temperature=100')
      .then((response) => {
        expect(response.statusCode).toBe(400);
      })
      .then(() => app.knex('request').count('* as c').then(([{ c }]) => expect(c).toBe(0)))
  ));
  it('refuses measureless communication', () => (
    request(app)
      .get('/track?node=henlo&henlo=greeting')
      .then((response) => {
        expect(response.statusCode).toBe(400);
      })
      .then(() => app.knex('request').count('* as c').then(([{ c }]) => expect(c).toBe(0)))
  ));
  it('can retrieve stats', () => (
    request(app).get('/track?node=foo&temperature=200&humidity=500')
      .then(() => request(app).get('/track?node=foo&temperature=500&humidity=300'))
      .then(() => request(app).get('/track?node=foo&temperature=900&humidity=100'))
      .then(() => request(app).get('/latest'))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.text)).toEqual({ 'foo:humidity': 100, 'foo:temperature': 900 });
      })
  ));
});
