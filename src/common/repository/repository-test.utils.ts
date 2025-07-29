import { Query, ClientSession, Model, Document } from "mongoose";
import { BaseRepository } from "./base.repository";
import { TransactionContextStorage } from "../transaction/transaction.context";
import { Connection, Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";

// Repository 테스트를 위한 공통 설정 유틸리티
export class RepositoryTestUtils {
  static async createTestModule<T extends Document>(
    modelName: string,
    schema: any,
    repositoryClass: any,
  ) {
    // MongoDB Replica Set을 사용하여 트랜잭션 지원
    const mongod = await MongoMemoryReplSet.create({
      replSet: {
        name: "testset", // replica set 이름 명시
        count: 1, // 단일 노드 replica set
        storageEngine: "wiredTiger",
      },
    });

    const uri = mongod.getUri();

    const testModule: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri, {
          // replica set 연결 옵션은 URI에 포함되어 있으므로 제거
        }),
        MongooseModule.forFeature([
          {
            name: modelName,
            schema: schema,
          },
        ]),
      ],
      providers: [repositoryClass, TransactionContextStorage],
    }).compile();

    const mongoConnection = testModule.get<Connection>(getConnectionToken());
    const repository = testModule.get(repositoryClass);
    const transactionContextStorage = testModule.get<TransactionContextStorage>(
      TransactionContextStorage,
    );

    return {
      mongod,
      mongoConnection,
      repository,
      transactionContextStorage,
      testModule,
    };
  }

  static async cleanupTestModule(
    mongod: MongoMemoryReplSet,
    mongoConnection: Connection,
  ) {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
  }

  static async clearDatabase(mongoConnection: Connection) {
    await mongoConnection.dropDatabase();
  }

  // BaseRepository의 공통 CRUD 메서드들을 테스트하는 헬퍼
  static createCommonCrudTests<T extends Document, R extends BaseRepository<T>>(
    getRepository: () => R,
    getSampleData: () => Partial<T>,
    getUpdateData: () => Partial<T>,
  ) {
    return {
      testCreate: () => {
        test("should create document", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const result = await repository.create(sampleData);

          expect(result).toBeDefined();
          expect((result as any)._id).toBeDefined();
          // 주요 필드들만 검증 (스키마에서 변환되거나 기본값이 설정될 수 있는 필드 제외)
          const keysToCheck = Object.keys(sampleData).filter(
            (key) => sampleData[key] !== undefined && sampleData[key] !== null,
          );
          keysToCheck.forEach((key) => {
            const expected = (sampleData as any)[key];
            const actual = (result as any)[key];
            if (expected instanceof Date && actual instanceof Date) {
              expect(actual.getTime()).toBeCloseTo(expected.getTime(), -3); // 밀리초 단위로 비교
            } else {
              expect(actual).toEqual(expected);
            }
          });
        });
      },

      testFindById: () => {
        test("should find document by id", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const created = await repository.create(sampleData);
          const found = await repository.findById((created as any)._id.toString());

          expect(found).toBeDefined();
          expect((found as any)!._id.toString()).toBe((created as any)._id.toString());
        });

        test("should return null for non-existing id", async () => {
          const repository = getRepository();
          const nonExistentId = new Types.ObjectId().toString();

          const result = await repository.findById(nonExistentId);

          expect(result).toBeNull();
        });
      },

      testUpdateById: () => {
        test("should update document by id", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();
          const updateData = getUpdateData();

          const created = await repository.create(sampleData);
          const updated = await repository.updateById(
            (created as any)._id.toString(),
            updateData,
          );

          expect(updated).toBeDefined();
          Object.keys(updateData).forEach((key) => {
            expect((updated as any)![key]).toEqual((updateData as any)[key]);
          });
        });
      },

      testDeleteById: () => {
        test("should delete document by id", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const created = await repository.create(sampleData);
          const deleted = await repository.deleteById((created as any)._id.toString());

          expect(deleted).toBeDefined();
          expect((deleted as any)!._id.toString()).toBe((created as any)._id.toString());

          const found = await repository.findById((created as any)._id.toString());
          expect(found).toBeNull();
        });
      },

      testCount: () => {
        test("should count documents", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const initialCount = await repository.count({});
          await repository.create(sampleData);
          const afterCount = await repository.count({});

          expect(afterCount).toBe(initialCount + 1);
        });
      },

      testFindWithPagination: () => {
        test("should find documents with pagination", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          // 5개의 문서 생성
          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const result = await repository.findWithPagination({}, 1, 2);

          expect(result.data).toHaveLength(2);
          expect(result.total).toBe(5);
        });

        test("should handle second page pagination", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          // 5개의 문서 생성
          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const result = await repository.findWithPagination({}, 2, 2);

          expect(result.data).toHaveLength(2);
          expect(result.total).toBe(5);
        });

        test("should handle last page with fewer items", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          // 3개의 문서 생성
          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const result = await repository.findWithPagination({}, 2, 2);

          expect(result.data).toHaveLength(1);
          expect(result.total).toBe(3);
        });

        test("should return empty data for page beyond available data", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          await repository.create(sampleData);

          const result = await repository.findWithPagination({}, 3, 2);

          expect(result.data).toHaveLength(0);
          expect(result.total).toBe(1);
        });
      },

      testFindOne: () => {
        test("should find one document by filter", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const created = await repository.create(sampleData);
          const filter = { _id: (created as any)._id };
          const found = await repository.findOne(filter);

          expect(found).toBeDefined();
          expect((found as any)!._id.toString()).toBe((created as any)._id.toString());
        });

        test("should return null when no document matches filter", async () => {
          const repository = getRepository();
          const filter = { _id: new Types.ObjectId() };

          const result = await repository.findOne(filter);

          expect(result).toBeNull();
        });
      },

      testFind: () => {
        test("should find multiple documents by filter", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const result = await repository.find({});

          expect(result).toHaveLength(2);
        });

        test("should return empty array when no documents match", async () => {
          const repository = getRepository();
          const filter = { nonExistentField: "value" };

          const result = await repository.find(filter);

          expect(result).toHaveLength(0);
        });
      },

      testAggregate: () => {
        test("should aggregate documents", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const pipeline = [{ $count: "totalCount" }];
          const result = await repository.aggregate(pipeline);

          expect(result).toHaveLength(1);
          expect(result[0].totalCount).toBe(2);
        });
      },

      testUpdateOne: () => {
        test("should update one document by filter", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();
          const updateData = getUpdateData();

          const created = await repository.create(sampleData);
          const filter = { _id: (created as any)._id };
          const updated = await repository.updateOne(filter, updateData);

          expect(updated).toBeDefined();
          Object.keys(updateData).forEach((key) => {
            expect((updated as any)![key]).toEqual((updateData as any)[key]);
          });
        });

        test("should return null when no document matches filter", async () => {
          const repository = getRepository();
          const filter = { _id: new Types.ObjectId() };
          const updateData = getUpdateData();

          const result = await repository.updateOne(filter, updateData);

          expect(result).toBeNull();
        });
      },

      testUpdateMany: () => {
        test("should update multiple documents", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const updateData = getUpdateData();
          const result = await repository.updateMany({}, updateData);

          expect(result.matchedCount).toBe(2);
          expect(result.modifiedCount).toBe(2);
        });
      },

      testDeleteOne: () => {
        test("should delete one document by filter", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          const created = await repository.create(sampleData);
          const filter = { _id: (created as any)._id };
          const deleted = await repository.deleteOne(filter);

          expect(deleted).toBeDefined();
          expect((deleted as any)!._id.toString()).toBe((created as any)._id.toString());

          const found = await repository.findById((created as any)._id.toString());
          expect(found).toBeNull();
        });

        test("should return null when no document matches filter", async () => {
          const repository = getRepository();
          const filter = { _id: new Types.ObjectId() };

          const result = await repository.deleteOne(filter);

          expect(result).toBeNull();
        });
      },

      testDeleteMany: () => {
        test("should delete multiple documents", async () => {
          const repository = getRepository();
          const sampleData = getSampleData();

          await Promise.all([
            repository.create(sampleData),
            repository.create(sampleData),
          ]);

          const result = await repository.deleteMany({});

          expect(result.deletedCount).toBe(2);

          const remaining = await repository.find({});
          expect(remaining).toHaveLength(0);
        });
      },

      testTransactionSupport: () => {
        describe("Transaction Support", () => {
          test("should work within transaction context", async () => {
            const repository = getRepository();
            const transactionContextStorage = repository["transactionContextStorage"];
            const mongoConnection = repository["model"].db;
            const sampleData = getSampleData();

            let createdDoc: any;
            const session = await mongoConnection.startSession();

            try {
              await session.withTransaction(async () => {
                await transactionContextStorage.run({ session }, async () => {
                  createdDoc = await repository.create(sampleData);
                  expect(createdDoc).toBeDefined();

                  const found = await repository.findById(
                    (createdDoc as any)._id.toString(),
                  );
                  expect(found).toBeDefined();

                  const updateData = getUpdateData();
                  const updated = await repository.updateById(
                    (createdDoc as any)._id.toString(),
                    updateData,
                  );
                  expect(updated).toBeDefined();
                });
              });
            } finally {
              await session.endSession();
            }

            const foundAfterTransaction = await repository.findById(
              (createdDoc as any)._id.toString(),
            );
            expect(foundAfterTransaction).toBeDefined();
          }, 10000);

          test("should rollback changes on transaction failure", async () => {
            const repository = getRepository();
            const transactionContextStorage = repository["transactionContextStorage"];
            const mongoConnection = repository["model"].db;
            const sampleData = getSampleData();

            let createdDocId: string;
            const session = await mongoConnection.startSession();

            try {
              await session.withTransaction(async () => {
                await transactionContextStorage.run({ session }, async () => {
                  const createdDoc = await repository.create(sampleData);
                  createdDocId = (createdDoc as any)._id.toString();

                  const found = await repository.findById(createdDocId);
                  expect(found).toBeDefined();

                  throw new Error("Transaction rollback test");
                });
              });
            } catch (error: any) {
              expect(error.message).toBe("Transaction rollback test");
            } finally {
              await session.endSession();
            }

            const foundAfterRollback = await repository.findById(createdDocId!);
            expect(foundAfterRollback).toBeNull();
          }, 10000);

          test("should handle operations without transactions (fallback)", async () => {
            const repository = getRepository();
            const sampleData = getSampleData();

            // 트랜잭션 없이도 정상적으로 동작하는지 확인
            const created = await repository.create(sampleData);
            expect(created).toBeDefined();

            const found = await repository.findById((created as any)._id.toString());
            expect(found).toBeDefined();

            const updateData = getUpdateData();
            const updated = await repository.updateById(
              (created as any)._id.toString(),
              updateData,
            );
            expect(updated).toBeDefined();
          });
        });
      },

      runAllTests: () => {
        describe("BaseRepository CRUD operations", () => {
          const tests = RepositoryTestUtils.createCommonCrudTests(
            getRepository,
            getSampleData,
            getUpdateData,
          );

          tests.testCreate();
          tests.testFindById();
          tests.testFindOne();
          tests.testFind();
          tests.testAggregate();
          tests.testUpdateById();
          tests.testUpdateOne();
          tests.testUpdateMany();
          tests.testDeleteById();
          tests.testDeleteOne();
          tests.testDeleteMany();
          tests.testCount();
          tests.testFindWithPagination();

          // 트랜잭션 테스트는 별도의 describe 블록으로 실행
          tests.testTransactionSupport();
        });
      },
    };
  }
}
