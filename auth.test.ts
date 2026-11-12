import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, registerOwner } from './helpers.js';

describe('authentication', () => {
  it('registers a user and creates a store', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: 'Password123!', storeName: 'Ada Store' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('ada@example.com');
    expect(res.body.data.user.role).toBe('owner');
    expect(res.body.data.store.name).toBe('Ada Store');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
  });

  it('rejects duplicate email', async () => {
    await registerOwner('dup@example.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'dup@example.com', password: 'Password123!', storeName: 'Dup' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('validates the registration payload', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'short', storeName: 'S' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  it('logs in, reads /me, and logs out', async () => {
    await registerOwner('login@example.com');
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123!' });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('login@example.com');

    await agent.post('/api/auth/logout');
    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  it('rejects wrong password and unknown user', async () => {
    await registerOwner('wrong@example.com');
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'WrongPassword1!' });
    expect(bad.status).toBe(401);

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(unknown.status).toBe(401);
  });

  it('blocks protected routes without a session', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'paypilot_token=eyJhbGciOiJIUzI1NiJ9.fake.sig');
    expect(res.status).toBe(401);
  });

  it('completes the password reset flow and invalidates the old password', async () => {
    await registerOwner('reset@example.com');
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@example.com' });
    expect(forgot.status).toBe(200);
    const token = forgot.body.data.resetToken as string;
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'NewPassword456!' });
    expect(reset.status).toBe(200);

    const old = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'Password123!' });
    expect(old.status).toBe(401);

    const fresh = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'NewPassword456!' });
    expect(fresh.status).toBe(200);
  });

  it('does not reveal whether an email exists on forgot-password', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.resetToken).toBeNull();
  });
});
