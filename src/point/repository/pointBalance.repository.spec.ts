import { Connection, Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { PointBalanceRepository } from "./pointBalance.repository";
import { PointBalance, PointBalanceSchema } from "../schema/pointBalance.schema";
import { RepositoryTestUtils } from "../../common/repository";

describe(PointBalanceRepository.name, () => {
  let pointBalanceRepository: PointBalanceRepository;
  let mongod: MongoMemoryReplSet;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const testSetup = await RepositoryTestUtils.createTestModule(
      PointBalance.name,
      PointBalanceSchema,
      PointBalanceRepository,
    );

    mongod = testSetup.mongod;
    mongoConnection = testSetup.mongoConnection;
    pointBalanceRepository = testSetup.repository;
  });

  afterAll(async () => {
    await RepositoryTestUtils.cleanupTestModule(mongod, mongoConnection);
  });

  afterEach(async () => {
    await RepositoryTestUtils.clearDatabase(mongoConnection);
  });

  // 샘플 데이터 생성 헬퍼
  const getSampleBalanceData = (): any => ({
    userId: new Types.ObjectId().toString(),
    totalPoints: 1000,
    availablePoints: 1000,
    usedPoints: 0,
    expiredPoints: 0,
  });

  const getUpdateBalanceData = (): any => ({
    totalPoints: 1500,
    availablePoints: 1200,
    usedPoints: 300,
  });

  describe("schema", () => {
    test("should have userId, totalPoints, availablePoints, usedPoints, expiredPoints, createdAt, updatedAt fields", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;
      // When : PointBalanceRepository를 통해 포인트 밸런스 생성
      const point = await pointBalanceRepository.createUserBalance(userId, initPoint);

      // Then : Point 값이 제대로 설정되었는지 확인
      expect(point).toHaveProperty("userId");
      expect(point).toHaveProperty("totalPoints");
      expect(point).toHaveProperty("availablePoints");
      expect(point).toHaveProperty("usedPoints");
      expect(point).toHaveProperty("expiredPoints");
      expect(point).toHaveProperty("createdAt");
      expect(point).toHaveProperty("updatedAt");
      expect(point.userId).toBe(userId);
      expect(point.totalPoints).toBe(initPoint);
      expect(point.availablePoints).toBe(initPoint);
      expect(point.usedPoints).toBe(0);
      expect(point.expiredPoints).toBe(0);
    });

    test("should create Point with initial zero values", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;

      // When : PointBalanceRepository를 통해 포인트 밸런스 생성
      const newPoint = await pointBalanceRepository.createUserBalance(userId, initPoint);

      // Then : Point 값이 제대로 설정되었는지 확인
      expect(newPoint.userId).toBe(userId);
      expect(newPoint.totalPoints).toBe(initPoint);
      expect(newPoint.availablePoints).toBe(initPoint);
      expect(newPoint.usedPoints).toBe(0);
      expect(newPoint.expiredPoints).toBe(0);
    });
  });

  describe("findByUserId", () => {
    test("should return user Point when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;

      await pointBalanceRepository.createUserBalance(userId, initPoint);

      // When : userId로 포인트 조회
      const foundPoint = await pointBalanceRepository.findByUserId(userId);

      // Then : 조회된 포인트가 올바른지 확인
      expect(foundPoint).not.toBeNull();
      expect(foundPoint!.userId).toBe(userId);
      expect(foundPoint!.totalPoints).toBe(initPoint);
      expect(foundPoint!.availablePoints).toBe(initPoint);
      expect(foundPoint!.usedPoints).toBe(0);
      expect(foundPoint!.expiredPoints).toBe(0);
    });

    test("should return null when user does not exist", async () => {
      // Given : Point 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;

      await pointBalanceRepository.createUserBalance(userId, initPoint);
      const nonExistentId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 조회
      const foundPoint = await pointBalanceRepository.findByUserId(nonExistentId);

      // Then : 조회된 포인트가 null인지 확인
      expect(foundPoint).toBeNull();
    });
  });

  describe("earnPoint", () => {
    test("should earn Point when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 0;

      await pointBalanceRepository.createUserBalance(userId, initPoint);
      const earnAmount = 1000;

      // When : userId로 포인트 적립
      const earnedPoint = await pointBalanceRepository.earnPoint(userId, earnAmount);

      // Then : 조회된 포인트가 올바른지 확인
      expect(earnedPoint).not.toBeNull();
      expect(earnedPoint!.userId).toBe(userId);
      expect(earnedPoint!.totalPoints).toBe(earnAmount);
      expect(earnedPoint!.availablePoints).toBe(earnAmount);
      expect(earnedPoint!.usedPoints).toBe(0);
      expect(earnedPoint!.expiredPoints).toBe(0);
    });

    test("should create and earn Point when user does not exist (upsert)", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      const earnAmount = 500;

      // When : userId로 포인트 적립
      const earnedPoint = await pointBalanceRepository.earnPoint(userId, earnAmount);

      // Then : 조회된 포인트가 올바른지 확인
      expect(earnedPoint).not.toBeNull();
      expect(earnedPoint!.userId).toBe(userId);
      expect(earnedPoint!.totalPoints).toBe(earnAmount);
      expect(earnedPoint!.availablePoints).toBe(earnAmount);
      expect(earnedPoint!.usedPoints).toBe(0);
      expect(earnedPoint!.expiredPoints).toBe(0);
    });

    test("should accumulate earned points", async () => {
      // Given : 기존에 포인트가 있는 userId
      const userId = new Types.ObjectId().toString();
      await pointBalanceRepository.earnPoint(userId, 1000);
      const additionalEarnAmount = 500;

      // When : 추�? ?�인???�립
      const earnedPoint = await pointBalanceRepository.earnPoint(
        userId,
        additionalEarnAmount,
      );

      // Then : 조회된 포인트가 올바른지 확인
      expect(earnedPoint).not.toBeNull();
      expect(earnedPoint!.userId).toBe(userId);
      expect(earnedPoint!.totalPoints).toBe(1500); // 1000 + 500
      expect(earnedPoint!.availablePoints).toBe(1500); // 1000 + 500
      expect(earnedPoint!.usedPoints).toBe(0);
      expect(earnedPoint!.expiredPoints).toBe(0);
    });
  });

  describe("usePoint", () => {
    test("should use Point when user exists and has enough points", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      await pointBalanceRepository.earnPoint(userId, 1000);
      const useAmount = 300;

      // When : userId로 포인트 사용
      const usedPoint = await pointBalanceRepository.usePoint(userId, useAmount);

      // Then : 조회된 포인트가 올바른지 확인
      expect(usedPoint).not.toBeNull();
      expect(usedPoint!.userId).toBe(userId);
      expect(usedPoint!.totalPoints).toBe(1000);
      expect(usedPoint!.availablePoints).toBe(700);
      expect(usedPoint!.usedPoints).toBe(300);
      expect(usedPoint!.expiredPoints).toBe(0);
    });

    test("should return null when user does not exist", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      const useAmount = 300;

      // When : 존재하지 않는 userId로 포인트 사용
      const usedPoint = await pointBalanceRepository.usePoint(userId, useAmount);

      // Then : 조회된 포인트가 null인지 확인
      expect(usedPoint).toBeNull();
    });
  });

  describe("expirePoint", () => {
    test("should expire Point when user exists and has enough available points", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      await pointBalanceRepository.earnPoint(userId, 1000);
      const expireAmount = 200;

      // When : userId로 포인트 만료
      const expiredPoint = await pointBalanceRepository.expirePoint(userId, expireAmount);

      // Then : 조회된 포인트가 올바른지 확인
      expect(expiredPoint).not.toBeNull();
      expect(expiredPoint!.userId).toBe(userId);
      expect(expiredPoint!.totalPoints).toBe(1000);
      expect(expiredPoint!.availablePoints).toBe(800);
      expect(expiredPoint!.usedPoints).toBe(0);
      expect(expiredPoint!.expiredPoints).toBe(200);
    });

    test("should return null when user does not have enough available points", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointBalanceRepository.earnPoint(userId, 100);
      const expireAmount = 200;

      // When : 존재하지 않는 userId로 포인트 만료
      const expiredPoint = await pointBalanceRepository.expirePoint(userId, expireAmount);

      // Then : 조회된 포인트가 null인지 확인
      expect(expiredPoint).toBeNull();
    });
  });

  describe("exist", () => {
    test("should return true when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;
      await pointBalanceRepository.createUserBalance(userId, initPoint);

      // When : 존재하는 userId로 조회
      const exists = await pointBalanceRepository.exist(userId);

      // Then : 존재하는지 확인
      expect(exists).toBe(true);
    });

    test("should return false when user does not exist", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 조회
      const exists = await pointBalanceRepository.exist(userId);

      // Then : 존재하지 않는지 확인
      expect(exists).toBe(false);
    });
  });

  describe("updateOne", () => {
    test("should update Point when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 5000;
      await pointBalanceRepository.createUserBalance(userId, initPoint);
      const updateAmount = 1000;

      // When : userId로 포인트 업데이트
      const updatedPoint = await pointBalanceRepository.updateOne(
        { userId },
        {
          $inc: { totalPoints: 1000, availablePoints: 1000 },
        },
      );
      // Then : 조회된 포인트가 올바른지 확인
      expect(updatedPoint).not.toBeNull();
      expect(updatedPoint!.userId).toBe(userId);
      expect(updatedPoint!.totalPoints).toBe(initPoint + updateAmount);
      expect(updatedPoint!.availablePoints).toBe(initPoint + updateAmount);
      expect(updatedPoint!.usedPoints).toBe(0);
      expect(updatedPoint!.expiredPoints).toBe(0);
    });

    test("should return null when user does not exist", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 업데이트
      const updatedPoint = await pointBalanceRepository.updateOne(
        { userId },
        { $inc: { totalPoints: 0, availablePoints: 0 } },
      );

      // Then : 조회된 포인트가 null인지 확인
      expect(updatedPoint).toBeNull();
    });
  });

  describe("updateById", () => {
    test("should update Point when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 5000;
      const newPoint = await pointBalanceRepository.createUserBalance(userId, initPoint);
      const updateAmount = 1000;

      // When : userId로 포인트 업데이트
      const newPointId = String(newPoint.id);
      const updatedPoint = await pointBalanceRepository.updateById(newPointId, {
        totalPoints: initPoint + updateAmount,
        availablePoints: initPoint + updateAmount,
      });
      // Then : 조회된 포인트가 올바른지 확인
      expect(updatedPoint).not.toBeNull();
      expect(updatedPoint!.userId).toBe(userId);
      expect(updatedPoint!.totalPoints).toBe(initPoint + updateAmount);
      expect(updatedPoint!.availablePoints).toBe(initPoint + updateAmount);
      expect(updatedPoint!.usedPoints).toBe(0);
      expect(updatedPoint!.expiredPoints).toBe(0);
    });

    test("should return null when user does not exist", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 업데이트
      const updatedPoint = await pointBalanceRepository.updateById(userId, {
        totalPoints: 0,
        availablePoints: 0,
      });

      // Then : 조회된 포인트가 null인지 확인
      expect(updatedPoint).toBeNull();
    });
  });

  describe("deleteByUserId", () => {
    test("should delete Point when user exists", async () => {
      // Given : Point 생성
      const userId = new Types.ObjectId().toString();
      const initPoint = 1000;
      await pointBalanceRepository.createUserBalance(userId, initPoint);

      // When : userId로 포인트 삭제
      const deleteResult = await pointBalanceRepository.deleteByUserId(userId);

      // Then : 포인트가 정상적으로 삭제되었는지 확인
      expect(deleteResult).not.toBeNull();
      expect(deleteResult!.userId).toBe(userId);

      // And : 실제로 삭제되었는지 확인
      const exists = await pointBalanceRepository.exist(userId);
      expect(exists).toBe(false);
    });

    test("should return null when user does not exist", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 삭제
      const deleteResult = await pointBalanceRepository.deleteByUserId(userId);

      // Then : 삭제된 문서가 없어야 함
      expect(deleteResult).toBeNull();
    });
  });
});
