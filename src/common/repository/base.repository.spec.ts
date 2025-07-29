import { Schema, Model } from "mongoose";
import { BaseRepository, RepositoryTestUtils } from "../../common/repository";
import { TransactionContextStorage } from "../../common/transaction/transaction.context";
import { Connection } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule, getModelToken } from "@nestjs/mongoose";
import { Injectable } from "@nestjs/common";

// Test Document 스키마 정의
const TestSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Test Repository 구현체
@Injectable()
class TestRepository extends BaseRepository<any> {
  constructor(model: Model<any>, transactionContextStorage: TransactionContextStorage) {
    super(model, transactionContextStorage);
  }
}

describe("BaseRepository", () => {
  let testRepository: TestRepository;
  let mongod: MongoMemoryReplSet;
  let mongoConnection: Connection;
  let transactionContextStorage: TransactionContextStorage;

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
            name: "TestDocument",
            schema: TestSchema,
          },
        ]),
      ],
      providers: [
        {
          provide: TestRepository,
          useFactory: (
            model: Model<any>,
            transactionContextStorage: TransactionContextStorage,
          ) => {
            return new TestRepository(model, transactionContextStorage);
          },
          inject: [getModelToken("TestDocument"), TransactionContextStorage],
        },
        TransactionContextStorage,
      ],
    }).compile();

    mongoConnection = testModule.get<Connection>(getConnectionToken());
    testRepository = testModule.get<TestRepository>(TestRepository);
    transactionContextStorage = testModule.get<TransactionContextStorage>(
      TransactionContextStorage,
    );
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  });

  afterEach(async () => {
    await mongoConnection.dropDatabase();
  });

  // 샘플 데이터 생성 헬퍼
  const getSampleData = (): any => ({
    name: "Test User",
    email: "test@example.com",
    age: 25,
    isActive: true,
  });

  const getUpdateData = (): any => ({
    name: "Updated User",
    age: 30,
  });

  // BaseRepository의 모든 CRUD 테스트 실행
  const crudTests = RepositoryTestUtils.createCommonCrudTests(
    () => testRepository,
    getSampleData,
    getUpdateData,
  );

  crudTests.runAllTests();
});
