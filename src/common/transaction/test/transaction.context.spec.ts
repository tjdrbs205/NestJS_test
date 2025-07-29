import { Connection } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { TransactionContextStorage } from "../transaction.context";

describe("TransactionContextStorage", () => {
  let storage: TransactionContextStorage;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const testModule: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri)],
      providers: [TransactionContextStorage],
    }).compile();

    mongoConnection = testModule.get<Connection>(getConnectionToken());
    storage = testModule.get<TransactionContextStorage>(TransactionContextStorage);
  });

  afterAll(async () => {
    await mongoConnection.close();
    await mongod.stop();
  });

  describe("run", () => {
    test("should execute callback with context", async () => {
      // Given: 실제 세션과 컨텍스트
      const session = await mongoConnection.startSession();
      const context = { session };
      const mockCallback = jest.fn().mockResolvedValue("test result");

      try {
        // When: 컨텍스트와 함께 콜백 실행
        const result = await storage.run(context, mockCallback);

        // Then: 콜백이 실행되고 결과가 반환되어야 함
        expect(result).toBe("test result");
        expect(mockCallback).toHaveBeenCalledTimes(1);
      } finally {
        await session.endSession();
      }
    });

    test("should execute callback with empty context", async () => {
      // Given: 빈 컨텍스트
      const context = {};
      const mockCallback = jest.fn().mockResolvedValue("empty context result");

      // When: 빈 컨텍스트와 함께 콜백 실행
      const result = await storage.run(context, mockCallback);

      // Then: 콜백이 실행되고 결과가 반환되어야 함
      expect(result).toBe("empty context result");
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    test("should propagate callback errors", async () => {
      // Given: 에러를 던지는 콜백
      const session = await mongoConnection.startSession();
      const context = { session };
      const error = new Error("Test error");
      const mockCallback = jest.fn().mockRejectedValue(error);

      try {
        // When & Then: 콜백 실행 시 에러가 전파되어야 함
        await expect(storage.run(context, mockCallback)).rejects.toThrow("Test error");
        expect(mockCallback).toHaveBeenCalledTimes(1);
      } finally {
        await session.endSession();
      }
    });

    test("should handle nested run calls", async () => {
      // Given: 중첩된 컨텍스트
      const outerSession = await mongoConnection.startSession();
      const innerSession = await mongoConnection.startSession();
      const outerContext = { session: outerSession };
      const innerContext = { session: innerSession };

      try {
        // When: 중첩된 run 호출
        const result = await storage.run(outerContext, async () => {
          const outerSessionFromStorage = storage.getSession();
          expect(outerSessionFromStorage).toBe(outerSession);

          return storage.run(innerContext, async () => {
            const innerSessionFromStorage = storage.getSession();
            expect(innerSessionFromStorage).toBe(innerSession);
            return "nested result";
          });
        });

        // Then: 내부 컨텍스트 결과가 반환되어야 함
        expect(result).toBe("nested result");
      } finally {
        await outerSession.endSession();
        await innerSession.endSession();
      }
    });
  });

  describe("getSession", () => {
    test("should return session when context has session", async () => {
      // Given: 세션이 있는 컨텍스트
      const session = await mongoConnection.startSession();
      const context = { session };

      try {
        // When & Then: run 내부에서 세션 조회
        await storage.run(context, async () => {
          const retrievedSession = storage.getSession();
          expect(retrievedSession).toBe(session);
        });
      } finally {
        await session.endSession();
      }
    });

    test("should return undefined when context has no session", async () => {
      // Given: 세션이 없는 컨텍스트
      const context = {};

      // When & Then: run 내부에서 세션 조회
      await storage.run(context, async () => {
        const retrievedSession = storage.getSession();
        expect(retrievedSession).toBeUndefined();
      });
    });

    test("should return undefined when called outside of run context", () => {
      // Given & When: run 컨텍스트 외부에서 세션 조회
      const retrievedSession = storage.getSession();

      // Then: undefined가 반환되어야 함
      expect(retrievedSession).toBeUndefined();
    });

    test("should return correct session in nested contexts", async () => {
      // Given: 중첩된 컨텍스트
      const outerSession = await mongoConnection.startSession();
      const innerSession = await mongoConnection.startSession();
      const outerContext = { session: outerSession };
      const innerContext = { session: innerSession };

      try {
        // When & Then: 중첩된 컨텍스트에서 세션 조회
        await storage.run(outerContext, async () => {
          expect(storage.getSession()).toBe(outerSession);

          await storage.run(innerContext, async () => {
            expect(storage.getSession()).toBe(innerSession);
          });

          // 내부 컨텍스트 종료 후 다시 외부 세션이 조회되어야 함
          expect(storage.getSession()).toBe(outerSession);
        });
      } finally {
        await outerSession.endSession();
        await innerSession.endSession();
      }
    });
  });

  describe("concurrent execution", () => {
    test("should handle multiple concurrent contexts correctly", async () => {
      // Given: 여러 개의 독립적인 세션과 컨텍스트
      const session1 = await mongoConnection.startSession();
      const session2 = await mongoConnection.startSession();
      const session3 = await mongoConnection.startSession();

      try {
        // When: 동시에 여러 컨텍스트 실행
        const promises = [
          storage.run({ session: session1 }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { sessionId: session1.id, result: "result1" };
          }),
          storage.run({ session: session2 }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { sessionId: session2.id, result: "result2" };
          }),
          storage.run({ session: session3 }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 15));
            return { sessionId: session3.id, result: "result3" };
          }),
        ];

        const results = await Promise.all(promises);

        // Then: 각 컨텍스트가 독립적으로 실행되어야 함
        expect(results).toHaveLength(3);
        expect(results[0].sessionId).toBe(session1.id);
        expect(results[0].result).toBe("result1");
        expect(results[1].sessionId).toBe(session2.id);
        expect(results[1].result).toBe("result2");
        expect(results[2].sessionId).toBe(session3.id);
        expect(results[2].result).toBe("result3");
      } finally {
        await session1.endSession();
        await session2.endSession();
        await session3.endSession();
      }
    });

    test("should isolate contexts between concurrent executions", async () => {
      // Given: 두 개의 독립적인 세션
      const session1 = await mongoConnection.startSession();
      const session2 = await mongoConnection.startSession();

      try {
        // When: 동시에 두 컨텍스트 실행하며 서로의 세션 확인
        const [result1, result2] = await Promise.all([
          storage.run({ session: session1 }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            const currentSession = storage.getSession();
            return currentSession === session1 ? "correct1" : "wrong1";
          }),
          storage.run({ session: session2 }, async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            const currentSession = storage.getSession();
            return currentSession === session2 ? "correct2" : "wrong2";
          }),
        ]);

        // Then: 각 컨텍스트에서 올바른 세션이 조회되어야 함
        expect(result1).toBe("correct1");
        expect(result2).toBe("correct2");
      } finally {
        await session1.endSession();
        await session2.endSession();
      }
    });
  });

  describe("AsyncLocalStorage behavior", () => {
    test("should maintain context across async operations", async () => {
      // Given: 세션이 있는 컨텍스트
      const session = await mongoConnection.startSession();
      const context = { session };

      try {
        // When: 비동기 작업들을 포함한 복잡한 플로우
        const result = await storage.run(context, async () => {
          // 첫 번째 비동기 작업
          await new Promise((resolve) => setTimeout(resolve, 5));
          expect(storage.getSession()).toBe(session);

          // Promise.all을 사용한 병렬 비동기 작업
          const parallelResults = await Promise.all([
            (async () => {
              await new Promise((resolve) => setTimeout(resolve, 3));
              return storage.getSession();
            })(),
            (async () => {
              await new Promise((resolve) => setTimeout(resolve, 7));
              return storage.getSession();
            })(),
          ]);

          // 모든 병렬 작업에서 동일한 세션이 조회되어야 함
          expect(parallelResults[0]).toBe(session);
          expect(parallelResults[1]).toBe(session);

          // 마지막 확인
          return storage.getSession();
        });

        // Then: 최종 결과도 올바른 세션이어야 함
        expect(result).toBe(session);
      } finally {
        await session.endSession();
      }
    });
  });
});
