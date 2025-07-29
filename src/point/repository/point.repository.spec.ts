import { Connection, Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { PointRepository } from "./point.repository";
import { Point, PointSchema, PointType } from "../schema/point.schema";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { RepositoryTestUtils } from "../../common/repository";

describe(PointRepository.name, () => {
  let pointRepository: PointRepository;
  let mongod: MongoMemoryReplSet;
  let mongoConnection: Connection;
  let transactionContextStorage: TransactionContextStorage;

  beforeAll(async () => {
    const testSetup = await RepositoryTestUtils.createTestModule(
      Point.name,
      PointSchema,
      PointRepository,
    );

    mongod = testSetup.mongod;
    mongoConnection = testSetup.mongoConnection;
    pointRepository = testSetup.repository;
    transactionContextStorage = testSetup.transactionContextStorage;
  });

  afterAll(async () => {
    await RepositoryTestUtils.cleanupTestModule(mongod, mongoConnection);
  });

  afterEach(async () => {
    await RepositoryTestUtils.clearDatabase(mongoConnection);
  });

  // 샘플 데이터 생성 헬퍼
  const getSamplePointData = (): any => ({
    userId: new Types.ObjectId().toString(),
    type: PointType.EARN,
    amount: 1000,
    description: "Test point",
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
  });

  const getUpdatePointData = (): any => ({
    amount: 1500,
    description: "Updated test point",
  });

  // 도메인 특화 테스트들만 유지
  describe("Point Repository Domain Methods", () => {
    describe("findByUserId", () => {
      test("should find points by user ID sorted by createdAt desc", async () => {
        // Given: 특정 사용자의 포인트들 생성
        const userId = new Types.ObjectId().toString();
        const pointData1 = getSamplePointData();
        pointData1.userId = userId;
        const pointData2 = getSamplePointData();
        pointData2.userId = userId;
        pointData2.amount = 2000;

        await pointRepository.create(pointData1);
        await new Promise((resolve) => setTimeout(resolve, 10)); // 시간 차이를 위한 지연
        await pointRepository.create(pointData2);

        // When: 사용자 ID로 포인트 조회
        const points = await pointRepository.findByUserId(userId);

        // Then: 해당 사용자의 포인트들이 최신순으로 반환되어야 함
        expect(points).toHaveLength(2);
        expect(points[0].userId).toBe(userId);
        expect(points[1].userId).toBe(userId);
        expect(new Date((points[0] as any).createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date((points[1] as any).createdAt).getTime(),
        );
      });
    });

    describe("findExpiringPoints", () => {
      test("should find points expiring within specified days", async () => {
        // Given: 만료 예정인 포인트와 그렇지 않은 포인트 생성
        const userId = new Types.ObjectId().toString();
        const expiringPoint = getSamplePointData();
        expiringPoint.userId = userId;
        expiringPoint.type = PointType.EARN;
        expiringPoint.isActive = true;
        expiringPoint.expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5일 후

        const nonExpiringPoint = getSamplePointData();
        nonExpiringPoint.userId = userId;
        nonExpiringPoint.type = PointType.EARN;
        nonExpiringPoint.isActive = true;
        nonExpiringPoint.expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15일 후

        await pointRepository.create(expiringPoint);
        await pointRepository.create(nonExpiringPoint);

        // When: 7일 내 만료 예정인 포인트 조회
        const expiringPoints = await pointRepository.findExpiringPoints(userId, 7);

        // Then: 만료 예정인 포인트만 반환되어야 함
        expect(expiringPoints).toHaveLength(1);
        expect(expiringPoints[0].userId).toBe(userId);
      });
    });

    describe("findExpitedPoints", () => {
      test("should find expired points for specific user", async () => {
        // Given: 만료된 포인트 생성
        const userId = new Types.ObjectId().toString();
        const expiredPoint = getSamplePointData();
        expiredPoint.userId = userId;
        expiredPoint.type = PointType.EARN;
        expiredPoint.isActive = false;
        expiredPoint.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1일 전

        await pointRepository.create(expiredPoint);

        // When: 만료된 포인트 조회
        const expiredPoints = await pointRepository.findExpitedPoints(userId);

        // Then: 만료된 포인트가 반환되어야 함
        expect(expiredPoints).toHaveLength(1);
        expect(expiredPoints[0].userId).toBe(userId);
        expect(expiredPoints[0].isActive).toBe(false);
      });

      test("should find all expired points when no userId provided", async () => {
        // Given: 여러 사용자의 만료된 포인트들 생성
        const expiredPoint1 = getSamplePointData();
        expiredPoint1.type = PointType.EARN;
        expiredPoint1.isActive = false;
        expiredPoint1.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const expiredPoint2 = getSamplePointData();
        expiredPoint2.type = PointType.EARN;
        expiredPoint2.isActive = false;
        expiredPoint2.expiresAt = new Date(Date.now() - 48 * 60 * 60 * 1000);

        await pointRepository.create(expiredPoint1);
        await pointRepository.create(expiredPoint2);

        // When: 모든 만료된 포인트 조회
        const expiredPoints = await pointRepository.findExpitedPoints();

        // Then: 모든 만료된 포인트가 반환되어야 함
        expect(expiredPoints.length).toBeGreaterThanOrEqual(2);
        expiredPoints.forEach((point) => {
          expect(point.isActive).toBe(false);
          expect(point.type).toBe(PointType.EARN);
        });
      });
    });
  });
});
