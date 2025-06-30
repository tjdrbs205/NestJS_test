import { Test, TestingModule } from "@nestjs/testing";
import { PointsService } from "./points.service";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { PointsRepository } from "./points.repository";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Connection, Types } from "mongoose";
import { Points, PointsSchema } from "./schema/points.schema";

describe(PointsService.name, () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let pointsRepository: PointsRepository;
  let pointsService: PointsService;

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
      providers: [PointsRepository, PointsService],
    }).compile();

    mongoConnection = testModule.get<Connection>(getConnectionToken());
    pointsRepository = testModule.get<PointsRepository>(PointsRepository);
    pointsService = testModule.get<PointsService>(PointsService);
  });

  afterEach(async () => {
    await mongoConnection.dropDatabase();
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  describe("createPoints", () => {
    test("should return points for a user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();

      // When : 새로운 Points 생성
      const result = await pointsService.createPoints(userId);

      // Then : 결과 검증
      if (!result) {
        fail("Points creation failed");
      }
      expect(result.userId).toBe(userId);
      expect(result.point).toBe(1000);
    });

    test("should return points with custom value for a user", async () => {
      // Given : 유저 ID와 포인트 값
      const userId = new Types.ObjectId().toString();
      const customPoints = 500;

      // When : 새로운 Points 생성
      const result = await pointsService.createPoints(userId, customPoints);

      // Then : 결과 검증
      if (!result) {
        fail("Points creation failed");
      }
      expect(result.userId).toBe(userId);
      expect(result.point).toBe(customPoints);
    });

    test("should return throw when points already exist for a user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();
      await pointsService.createPoints(userId);

      // When
      try {
        await pointsService.createPoints(userId);
        fail("Expected an error to be thrown");
      } catch (error) {
        // Then
        expect(error.message).toBe("Points already exist for this user");
      }
    });
  });

  describe("getPointsByUserId", () => {
    test("should return points for a user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();
      await pointsService.createPoints(userId);

      // When : 유저의 포인트 조회
      const result = await pointsService.getPointsByUserId(userId);

      // Then : 결과 검증
      if (!result) {
        fail("Points retrieval failed");
      }
      expect(result.userId).toBe(userId);
    });

    test("should return null when no points exist for a user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();

      // When : 유저의 포인트 조회
      const result = await pointsService.getPointsByUserId(userId);

      // Then : 결과 검증
      expect(result).toBeNull();
    });
  });

  describe("addPoints", () => {
    test("should add points to a user", async () => {
      // Given : 유저 ID와 포인트 값
      const userId = new Types.ObjectId().toString();
      await pointsService.createPoints(userId);
      const amountToAdd = 500;

      // When : 포인트 추가
      const result = await pointsService.addPoints(userId, amountToAdd);

      // Then : 결과 검증
      if (!result) {
        fail("Points addition failed");
      }

      expect(result.userId).toBe(userId);
      expect(result.point).toBe(1500); // 1000 + 500
    });

    test("should throw when adding points to a non-existing user", async () => {
      // Given : 유저 ID와 포인트 값
      const userId = new Types.ObjectId().toString();
      const amountToAdd = 500;

      // When : 없는 유저에 포인트 추가 시도
      try {
        await pointsService.addPoints(userId, amountToAdd);
        fail("Expected an error to be thrown");
      } catch (error) {
        // Then : 결과 검증
        expect(error.message).toBe("Points not found for this user");
      }
    });
  });

  describe("usePoints", () => {
    test("should subtract points from a user", async () => {
      // Given : 유저 ID와 포인트 값
      const userId = new Types.ObjectId().toString();
      await pointsService.createPoints(userId);
      const amountToUse = 500;

      // When : 포인트 사용
      const result = await pointsService.usePoints(userId, amountToUse);

      // Then : 결과 검증
      if (!result) {
        fail("Points usage failed");
      }

      expect(result.userId).toBe(userId);
      expect(result.point).toBe(500); // 1000 - 500
    });

    test("should throw when using points from a non-existing user", async () => {
      // Given : 유저 ID와 포인트 값
      const userId = new Types.ObjectId().toString();
      const amountToUse = 500;

      // When : 없는 유저에 포인트 사용 시도
      try {
        await pointsService.usePoints(userId, amountToUse);
        fail("Expected an error to be thrown");
      } catch (error) {
        // Then : 결과 검증
        expect(error.message).toBe("Points not found for this user");
      }
    });
  });

  describe("deletePoints", () => {
    test("should delete points for a user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();
      await pointsService.createPoints(userId);

      // When : 포인트 삭제
      const result = await pointsService.deletePoints(userId);

      // Then : 결과 검증
      if (!result) {
        fail("Points deletion failed");
      }
      expect(result.userId).toBe(userId);
    });

    test("should throw when deleting points for a non-existing user", async () => {
      // Given : 유저 ID
      const userId = new Types.ObjectId().toString();

      // When : 없는 유저에 포인트 삭제 시도
      try {
        await pointsService.deletePoints(userId);
        fail("Expected an error to be thrown");
      } catch (error) {
        // Then : 결과 검증
        expect(error.message).toBe("Points not found for this user");
      }
    });
  });
});
