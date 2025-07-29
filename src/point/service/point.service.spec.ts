import { Test, TestingModule } from "@nestjs/testing";
import { PointsService } from "./point.service";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Connection, Types } from "mongoose";
import { PointBalance, PointBalanceSchema } from "../schema/pointBalance.schema";
import { Point, PointSchema } from "../schema/point.schema";
import { PointBalanceRepository } from "../repository/pointBalance.repository";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { PointRepository } from "../repository/point.repository";
import { setTransactionModuleRef } from "../../common/decorator/transactional.decorator";
import { ModuleRef } from "@nestjs/core";

describe(PointsService.name, () => {
  let mongod: MongoMemoryReplSet;
  let mongoConnection: Connection;
  let pointsService: PointsService;

  beforeAll(async () => {
    // MongoDB Replica Set을 사용하여 트랜잭션 지원
    mongod = await MongoMemoryReplSet.create({
      replSet: {
        name: "testset",
        count: 1,
        storageEngine: "wiredTiger",
      },
    });
    const uri = mongod.getUri();

    const testModule: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        MongooseModule.forFeature([
          {
            name: PointBalance.name,
            schema: PointBalanceSchema,
          },
          {
            name: Point.name,
            schema: PointSchema,
          },
        ]),
      ],
      providers: [
        PointBalanceRepository,
        PointRepository,
        PointsService,
        TransactionContextStorage,
      ],
    }).compile();

    mongoConnection = testModule.get<Connection>(getConnectionToken());
    pointsService = testModule.get<PointsService>(PointsService);

    // @Transactional 데코레이터를 위한 ModuleRef 설정
    const moduleRef = testModule.get<ModuleRef>(ModuleRef);
    setTransactionModuleRef(moduleRef);
  });

  afterEach(async () => {
    await new Promise((res) => setTimeout(res, 200));
    await mongoConnection.dropDatabase();
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  describe("createPointBalance", () => {
    test("should create point balance with default value", async () => {
      // Given
      const userId = new Types.ObjectId().toString();

      // When
      const result = await pointsService.createPointBalance(userId, 1000);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      expect(result!.totalPoints).toBe(1000);
      expect(result!.availablePoints).toBe(1000); // default initPoint
    });

    test("should create point balance with custom initial points", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      const customPoints = 500;

      // When
      const result = await pointsService.createPointBalance(userId, customPoints);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      expect(result!.availablePoints).toBe(customPoints);
    });

    test("should throw error when points already exist for user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);

      // When & Then
      await expect(pointsService.createPointBalance(userId, 1000)).rejects.toThrow(
        "Points already exist for this user",
      );
    });
  });

  describe("getPointsByUserId", () => {
    test("should return points for existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);

      // When
      const result = await pointsService.getPointsByUserId(userId);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      expect(result!.availablePoints).toBe(1000);
    });

    test("should return null for non-existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();

      // When
      const result = await pointsService.getPointsByUserId(userId);

      // Then
      expect(result).toBeNull();
    });
  });

  describe("addPoints", () => {
    test("should add points to existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);
      const amountToAdd = 500;

      // When
      const result = await pointsService.addPoints(userId, amountToAdd);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      // Repository should handle the point addition logic
    });

    test("should throw error when adding points to non-existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      const amountToAdd = 500;

      // When & Then
      await expect(pointsService.addPoints(userId, amountToAdd)).rejects.toThrow(
        "Points not found for this user",
      );
    });
  });

  describe("usePoints", () => {
    test("should use points successfully when user has sufficient points", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);
      const amountToUse = 500;

      // When
      const result = await pointsService.usePoints(userId, amountToUse);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      // Repository should handle the point deduction logic
    });

    test("should throw error when user does not exist", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      const amountToUse = 500;

      // When & Then
      await expect(pointsService.usePoints(userId, amountToUse)).rejects.toThrow(
        "Points not found for this user",
      );
    });

    test("should throw error when user has insufficient points", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);
      const amountToUse = 1500; // More than available

      // When & Then
      await expect(pointsService.usePoints(userId, amountToUse)).rejects.toThrow(
        "Insufficient points",
      );
    });
  });

  describe("deletePoints", () => {
    test("should delete points for existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();
      await pointsService.createPointBalance(userId, 1000);

      // When
      const result = await pointsService.deletePoints(userId);

      // Then
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
    });

    test("should throw error when deleting points for non-existing user", async () => {
      // Given
      const userId = new Types.ObjectId().toString();

      // When & Then
      await expect(pointsService.deletePoints(userId)).rejects.toThrow(
        "Points not found for this user",
      );
    });
  });

  describe("private methods", () => {
    describe("existingPointsCheck", () => {
      test("should return existing points for a user", async () => {
        // Given
        const userId = new Types.ObjectId().toString();
        await pointsService.createPointBalance(userId, 1000);

        // When
        const result = await pointsService["existingPointsCheck"](userId);

        // Then
        expect(result).not.toBeNull();
        expect(result.userId).toBe(userId);
      });

      test("should throw error when no points exist for a user", async () => {
        // Given
        const userId = new Types.ObjectId().toString();

        // When & Then
        await expect(pointsService["existingPointsCheck"](userId)).rejects.toThrow(
          "Points not found for this user",
        );
      });
    });
  });
});
