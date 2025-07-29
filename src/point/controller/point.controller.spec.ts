import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Connection, Types } from "mongoose";
import { PointsService } from "../service/point.service";
import { PointsController } from "./point.controller";
import { PointBalanceRepository } from "../repository/pointBalance.repository";
import { PointBalance, PointBalanceSchema } from "../schema/pointBalance.schema";
import { Point, PointSchema } from "../schema/point.schema";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { PointRepository } from "../repository/point.repository";
import { setTransactionModuleRef } from "../../common/decorator/transactional.decorator";
import { ModuleRef } from "@nestjs/core";

describe(PointsController.name, () => {
  let mongod: MongoMemoryReplSet;
  let mongoConnection: Connection;
  let pointsController: PointsController;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create();
    const uri = mongod.getUri();

    const module: TestingModule = await Test.createTestingModule({
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
      controllers: [PointsController],
    }).compile();

    mongoConnection = module.get<Connection>(getConnectionToken());
    pointsController = module.get<PointsController>(PointsController);

    // @Transactional 데코레이터를 위한 ModuleRef 설정
    const moduleRef = module.get<ModuleRef>(ModuleRef);
    setTransactionModuleRef(moduleRef);
  });

  afterEach(async () => {
    await new Promise((res) => setTimeout(res, 300));
    await mongoConnection.dropDatabase();
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  describe("createPoints", () => {
    test("should create points default for a user", async () => {
      // Given : userId와 기본 포인트 설정
      const userId = new Types.ObjectId().toString();

      // when : createPoints 호출
      const result = await pointsController.createPoints({ userId });

      // Then : 결과가 null이 아니고, 포인트가 1000으로 설정되어야 한다
      expect(result).toBeDefined();
      expect(result).toHaveProperty("userId", userId);
      expect(result).toHaveProperty("totalPoints", 1000);
      expect(result).toHaveProperty("availablePoints", 1000);
      expect(result).toHaveProperty("usedPoints", 0);
      expect(result).toHaveProperty("expiredPoints", 0);
    });

    test("should create points with specified amount for a user", async () => {
      // Given : userId와 포인트 금액 설정
      const userId = new Types.ObjectId().toString();
      const amount = 500;

      // when : createPoints 호출
      const result = await pointsController.createPoints({ userId, amount });

      // Then : 결과가 null이 아니고, 포인트가 500으로 설정되어야 한다
      expect(result).toBeDefined();
      expect(result).toHaveProperty("userId", userId);
      expect(result).toHaveProperty("totalPoints", amount);
      expect(result).toHaveProperty("availablePoints", amount);
      expect(result).toHaveProperty("usedPoints", 0);
      expect(result).toHaveProperty("expiredPoints", 0);
    });
  });
});
