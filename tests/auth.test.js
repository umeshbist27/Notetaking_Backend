import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from './testApp.js';
import { jest } from '@jest/globals';
jest.setTimeout(240000);
const request = supertest(app);
let mongoServer;
beforeAll(async () => {
    process.env.JWT_SECRET = 'testsecret';
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});
describe('Authentication -User Signup', () => {
    it('should register a user successfully', async () => {
        const res = await request.post('/api/auth/signup').send({
            name: 'Umesh',
            email: 'umesh@example.com',
            password: '12345678',
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message', 'User registered successfully');
        expect(res.body).toHaveProperty('name', 'Umesh');
    });
    it('should not allow duplicate email', async () => {
        const user = {
            name: 'Umesh',
            email: 'duplicate@example.com',
            password: 'testpass',
        };
        await request.post('/api/auth/signup').send(user);
        const res = await request.post('/api/auth/signup').send(user);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'User already exist');
    });
});
describe('Auth - Login', () => {
    const user = {
        name: 'umesh bist',
        email: 'umeshlogin@example.com',
        password: 'mypassword123',
    };
    beforeEach(async () => {
        await request.post('/api/auth/signup').send(user);
    });
    it('should login successfully with correct credentials', async () => {
        const res = await request.post('/api/auth/login').send({
            email: user.email,
            password: user.password,
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('name', user.name);
    });
    it('should fail login with wrong password', async () => {
        const res = await request.post('/api/auth/login').send({
            email: user.email,
            password: 'wrongpass123',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Password not matched');
    });
    it('should fail login with unregistered email', async () => {
        const res = await request.post('/api/auth/login').send({
            email: 'notfound@example.com',
            password: 'irrelevantPassword',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'User not found');
    });
});
describe('Auth - Check Email', () => {
    const user = {
        name: 'Check User',
        email: 'check@example.com',
        password: 'test123',
    };
    beforeEach(async () => {
        await request.post('/api/auth/signup').send(user);
    });
    it('should return exists true for existing email', async () => {
        const res = await request
            .get('/api/auth/check-email')
            .query({ email: user.email });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ exists: true });
    });
    it('should return exists false for non-existing email', async () => {
        const res = await request
            .get('/api/auth/check-email')
            .query({ email: 'nonexistent@example.com' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ exists: false });
    });
    it('should return error for invalid email query', async () => {
        const res = await request
            .get('/api/auth/check-email')
            .query({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid email query');
    });
});
