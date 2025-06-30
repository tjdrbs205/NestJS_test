import { Connection, Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { Points, PointsSchema } from "./schema/points.schema";
import { PointsRepository } from "./points.repository";
import { describe } from "node:test";

describe(PointsRepository.name, () => {
  let pointsRepository: PointsRepository;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const testModule: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          {
            name: Points.name,
            schema: PointsSchema,
          },
        ]),
      ],
      providers: [PointsRepository],
    }).compile();

    mongoConnection = testModule.get<Connection>(getConnectionToken());
    pointsRepository = testModule.get<PointsRepository>(PointsRepository);
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoConnection.dropDatabase();
  });

  describe("shcema", () => {
    test("should have userId, point, createAt, updatedAt fields", async () => {
      // Given : Points 생성
      const userId = "testUserId";
      const points = await pointsRepository.create(userId);

      // Then : Points 스키마에 userId, point, createdAt, updatedAt 필드가 있는지 확인
      expect(points).toHaveProperty("userId");
      expect(points).toHaveProperty("point");
      expect(points).toHaveProperty("createdAt");
      expect(points).toHaveProperty("updatedAt");
      expect(points.userId).toBe(userId);
      expect(points.point).toBe(1000);
    });
  });

  describe("create", () => {
    test("should create Points with defailt 1000 when no point specified", async () => {
      // Given : 신규 default 포인트 유저데이터
      const userId = new Types.ObjectId().toString();

      // When : 신규 default 포인트 생성
      const newPoints = await pointsRepository.create(userId);

      // Then : 포인트가 정상적으로 생성되었는지 확인
      expect(newPoints.userId).toBe(userId);
      expect(newPoints.point).toBe(1000);
    });

    test("should create Points with specified amount", async () => {
      // Given : 신규 포인트 유저데이터
      const userId = new Types.ObjectId().toString();
      const point = 2000;

      // When : 신규 포인트 생성
      const newPoints = await pointsRepository.create(userId, point);

      // Then : 포인트가 정상적으로 생성되었는지 확인
      expect(newPoints.userId).toBe(userId);
      expect(newPoints.point).toBe(point);
    });
  });

  describe("findById", () => {
    test("should return Points when Points exists", async () => {
      //Given : Points 데이터
      const userId = new Types.ObjectId().toString();
      const newPoints = await pointsRepository.create(userId);

      //When : pointsId로 포인트 조회
      const foundPoints = await pointsRepository.findById(newPoints.id);

      //Then : 포인트가 정상적으로 조회되었는지 확인
      if (foundPoints === null) {
        fail("Expected foundPoints to be defined, but got null ");
      }

      expect(foundPoints.id).toBe(newPoints.id);
      expect(foundPoints.userId).toBe(userId);
      expect(foundPoints.point).toBe(1000);
    });

    test("should return null when Points does not exist", async () => {
      // Given : Points 데이터 & 존재하지않는 pointsId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();

      // When : 존재하지 않는 pointsId로 포인트 조회
      const foundPoints = await pointsRepository.findById(nonExistentId);

      // Then : 포인트가 조회되지 않아야 함
      expect(foundPoints).toBeNull();
    });
  });

  describe("findByUserId", () => {
    test("should return user Points when user exists", async () => {
      // Given : Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);

      // When : userId로 포인트 조회
      const foundPoints = await pointsRepository.findByUserId(userId);

      // Then : 포인트가 정상적으로 조회되었는지 확인
      if (foundPoints === null) {
        fail("Expected foundPoints to be defined, but got null ");
      }

      expect(foundPoints.userId).toBe(userId);
      expect(foundPoints.point).toBe(1000);
    });

    test("should return user null when user does not exist", async () => {
      // Given : Points 데이터 & 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 조회
      const foundPoints = await pointsRepository.findByUserId(nonExistentId);

      // Then : 포인가 조회되지 않아야 함
      expect(foundPoints).toBeNull();
    });
  });

  describe("updatePoints", () => {
    test("should update Points when user exists", async () => {
      // Given : Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const updatedPoint = 5000;

      // When : userId로 포인트 업데이트
      const updatedPoints = await pointsRepository.updatePoints(userId, updatedPoint);

      // Then : 포인트가 정상적으로 업데이트되었는지 확인
      if (updatedPoints === null) {
        fail("Expected updatedPoints to be defined, but got null ");
      }

      expect(updatedPoints.userId).toBe(userId);
      expect(updatedPoints.point).toBe(updatedPoint);
    });

    test("should return null when user does not exist", async () => {
      // Given : Points 데이터 & 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();
      const updatedPoint = 5000;

      // When : 존재하지 않는 userId로 포인트 업데이트
      const updatedPoints = await pointsRepository.updatePoints(nonExistentId, updatedPoint);

      // Then : 포인트가 업데이트되지 않아야 함
      expect(updatedPoints).toBeNull();
    });
  });

  describe("adjustPoints", () => {
    test("should adjust Points when user exists", async () => {
      // Given : Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const adjustmentAmount = 500;

      // When : userId로 포인트 조정
      const adjustedPoints = await pointsRepository.adjustPoints(userId, adjustmentAmount);

      // Then : 포인트가 정상적으로 조정되었는지 확인
      if (adjustedPoints === null) {
        fail("Expected adjustedPoints to be defined, but got null ");
      }

      expect(adjustedPoints.userId).toBe(userId);
      expect(adjustedPoints.point).toBe(1500); // 1000 + 500
    });
  });

  test("should return null when adjusting Points for non-existent user", async () => {
    // Given : 존재하지 않는 userId
    const userId = new Types.ObjectId().toString();
    await pointsRepository.create(userId);
    const nonExistentId = new Types.ObjectId().toString();
    const adjustmentAmount = 500;

    // When : 존재하지 않는 userId로 포인트 조정
    const adjustedPoints = await pointsRepository.adjustPoints(nonExistentId, adjustmentAmount);

    // Then : 포인트가 조정되지 않아야 함
    expect(adjustedPoints).toBeNull();
  });

  describe("addPoints", () => {
    test("should return Points when adding Points for user exists", async () => {
      // Given: Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const amountToAdd = 300;

      // When : userId로 포인트 추가
      const updatedPoints = await pointsRepository.addPoints(userId, amountToAdd);

      // Then : 포인트가 정상적으로 추가되었는지 확인
      if (updatedPoints === null) {
        fail("Expected updatedPoints to be defined, but got null ");
      }
      expect(updatedPoints.userId).toBe(userId);
      expect(updatedPoints.point).toBe(1300);
    });

    test("should return null when adding Points for non-existent user", async () => {
      // Given: 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();
      const amountToAdd = 300;

      // When : 존재하지 않는 userId로 포인트 추가
      const updatedPoints = await pointsRepository.addPoints(nonExistentId, amountToAdd);

      // Then : 포인트가 추가되지 않아야 함
      expect(updatedPoints).toBeNull();
    });
  });

  describe("addPoints", () => {
    test("should return Points when adding Points for user exists", async () => {
      // Given: Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const amountToAdd = 300;

      // When : userId로 포인트 추가
      const updatedPoints = await pointsRepository.addPoints(userId, amountToAdd);

      // Then : 포인트가 정상적으로 추가되었는지 확인
      if (updatedPoints === null) {
        fail("Expected updatedPoints to be defined, but got null ");
      }
      expect(updatedPoints.userId).toBe(userId);
      expect(updatedPoints.point).toBe(1300);
    });

    test("should return null when adding Points for non-existent user", async () => {
      // Given: 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();
      const amountToAdd = 300;

      // When : 존재하지 않는 userId로 포인트 추가
      const updatedPoints = await pointsRepository.addPoints(nonExistentId, amountToAdd);

      // Then : 포인트가 추가되지 않아야 함
      expect(updatedPoints).toBeNull();
    });
  });

  describe("subtractPoints", () => {
    test("should return Points when subtracting Points for user exists", async () => {
      // Given: Points 데이터
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const amountToSubtract = 300;

      // When : userId로 포인트 차감
      const updatedPoints = await pointsRepository.subtractPoints(userId, amountToSubtract);

      // Then : 포인트가 정상적으로 차감되었는지 확인
      if (updatedPoints === null) {
        fail("Expected updatedPoints to be defined, but got null ");
      }
      expect(updatedPoints.userId).toBe(userId);
      expect(updatedPoints.point).toBe(700); // 1000 - 300
    });

    test("should return null when subtracting Points for non-existent user", async () => {
      // Given: 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();
      const amountToSubtract = 300;

      // When : 존재하지 않는 userId로 포인트 차감
      const updatedPoints = await pointsRepository.subtractPoints(nonExistentId, amountToSubtract);

      // Then : 포인트가 차감되지 않아야 함
      expect(updatedPoints).toBeNull();
    });
  });

  describe("deleteById", () => {
    test("should return null when delete Points by userId", async () => {
      // Given : Points 데이터
      const userId = new Types.ObjectId().toString();
      const createdPoints = await pointsRepository.create(userId);

      // When : userId로 포인트 삭제
      const deletedPoints = await pointsRepository.deleteById(createdPoints.id);

      // Then : 포인트가 정상적으로 삭제되었는지 확인
      if (deletedPoints === null) {
        fail("Expected deletedPoints to be defined, but got null ");
      }
      expect(deletedPoints.id).toBe(createdPoints.id);
      expect(deletedPoints.userId).toBe(userId);

      // And : 실제로 삭제되었는지 확인
      const foundPoints = await pointsRepository.findById(createdPoints.id);
      expect(foundPoints).toBeNull();
    });

    test("should return null when delete Points by non-existent userId", async () => {
      // Given : 존재하지 않는 userId
      const userId = new Types.ObjectId().toString();
      await pointsRepository.create(userId);
      const nonExistentId = new Types.ObjectId().toString();

      // When : 존재하지 않는 userId로 포인트 삭제
      const deletedPoints = await pointsRepository.deleteById(nonExistentId);

      // Then : 포인트가 삭제되지 않아야 함
      expect(deletedPoints).toBeNull();
    });
  });
});
