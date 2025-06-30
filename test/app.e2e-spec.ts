import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Item Trading System (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Points System', () => {
    it('/points/:userId (GET) - should get user points with default 1000', () => {
      return request(app.getHttpServer())
        .get('/points/testUser')
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toBe('testUser');
          expect(res.body.points).toBe(1000);
          expect(res.body.lastUpdated).toBeDefined();
        });
    });

    it('/points/add (POST) - should add points to user', () => {
      return request(app.getHttpServer())
        .post('/points/add')
        .send({ userId: 'testUser', amount: 500 })
        .expect(201)
        .expect((res) => {
          expect(res.body.userId).toBe('testUser');
          expect(res.body.points).toBe(1500); // 1000 + 500
        });
    });

    it('/points/set (PUT) - should set user points', () => {
      return request(app.getHttpServer())
        .put('/points/set')
        .send({ userId: 'testUser', amount: 2000 })
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toBe('testUser');
          expect(res.body.points).toBe(2000);
        });
    });
  });

  describe('Items System', () => {
    it('/items/generate (POST) - should generate random item', () => {
      return request(app.getHttpServer())
        .post('/items/generate')
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toMatch(/^item_\d+$/);
          expect(res.body.name).toBeDefined();
          expect(res.body.type).toBeDefined();
          expect(res.body.rarity).toBeDefined();
          expect(res.body.price).toBeGreaterThan(0);
          expect(res.body.description).toBeDefined();
        });
    });

    it('/items/shop/random (GET) - should get shop items', () => {
      return request(app.getHttpServer())
        .get('/items/shop/random?count=5')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(5);
          res.body.forEach((item: any) => {
            expect(item.id).toMatch(/^item_\d+$/);
            expect(item.price).toBeGreaterThan(0);
          });
        });
    });

    it('/items/user/:userId (GET) - should get empty user items initially', () => {
      return request(app.getHttpServer())
        .get('/items/user/testUser')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(0);
        });
    });
  });

  describe('Trading System Integration', () => {
    it('should complete full trading flow', async () => {
      // 1. 아이템 생성
      const itemResponse = await request(app.getHttpServer())
        .post('/items/generate')
        .expect(201);
      
      const item = itemResponse.body;

      // 2. 사용자 포인트 설정 (충분한 포인트)
      await request(app.getHttpServer())
        .put('/points/set')
        .send({ userId: 'testUser', amount: 5000 })
        .expect(200);

      // 3. 아이템 구매
      const purchaseResponse = await request(app.getHttpServer())
        .post('/trades/purchase')
        .send({ userId: 'testUser', itemId: item.id })
        .expect(201);

      expect(purchaseResponse.body.success).toBe(true);
      expect(purchaseResponse.body.trade).toBeDefined();
      expect(purchaseResponse.body.userItem).toBeDefined();
      expect(purchaseResponse.body.remainingPoints).toBe(5000 - item.price);

      // 4. 사용자 아이템 확인
      const userItemsResponse = await request(app.getHttpServer())
        .get('/items/user/testUser')
        .expect(200);

      expect(userItemsResponse.body).toHaveLength(1);
      expect(userItemsResponse.body[0].item.id).toBe(item.id);

      // 5. 거래 기록 확인
      const tradesResponse = await request(app.getHttpServer())
        .get('/trades/user/testUser')
        .expect(200);

      expect(tradesResponse.body).toHaveLength(1);
      expect(tradesResponse.body[0].itemId).toBe(item.id);
      expect(tradesResponse.body[0].success).toBe(true);
    });

    it('should fail purchase with insufficient points', async () => {
      // 1. 아이템 생성
      const itemResponse = await request(app.getHttpServer())
        .post('/items/generate')
        .expect(201);
      
      const item = itemResponse.body;

      // 2. 사용자 포인트를 부족하게 설정
      await request(app.getHttpServer())
        .put('/points/set')
        .send({ userId: 'testUser', amount: 10 })
        .expect(200);

      // 3. 아이템 구매 시도 (실패해야 함)
      const purchaseResponse = await request(app.getHttpServer())
        .post('/trades/purchase')
        .send({ userId: 'testUser', itemId: item.id })
        .expect(201);

      expect(purchaseResponse.body.success).toBe(false);
      expect(purchaseResponse.body.message).toContain('포인트가 부족');
    });
  });

  describe('Statistics', () => {
    it('/trades/stats/summary (GET) - should get trade statistics', async () => {
      // 몇 개의 거래를 생성
      const item = await request(app.getHttpServer())
        .post('/items/generate')
        .then(res => res.body);

      await request(app.getHttpServer())
        .put('/points/set')
        .send({ userId: 'testUser', amount: 10000 });

      await request(app.getHttpServer())
        .post('/trades/purchase')
        .send({ userId: 'testUser', itemId: item.id });

      // 통계 확인
      return request(app.getHttpServer())
        .get('/trades/stats/summary')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalTrades).toBeGreaterThanOrEqual(1);
          expect(res.body.successfulTrades).toBeGreaterThanOrEqual(1);
          expect(res.body.totalRevenue).toBeGreaterThanOrEqual(0);
          expect(res.body.averagePrice).toBeGreaterThanOrEqual(0);
        });
    });
  });
});
