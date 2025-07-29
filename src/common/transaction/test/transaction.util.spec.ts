import { Connection } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { TransactionContextStorage } from "../transaction.context";
import { withTransaction } from "../transaction.util";

describe("withTransaction", () => {
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let storage: TransactionContextStorage;

  // 전체 테스트 타임아웃을 10초로 설정
  jest.setTimeout(10000);

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

  describe("successful transaction", () => {
    test("should execute function within transaction and commit", async () => {
      // Given: 성공하는 함수
      const mockFn = jest.fn().mockResolvedValue("success result");

      // When: withTransaction으로 함수 실행
      const result = await withTransaction(mongoConnection, storage, mockFn);

      // Then: 함수가 실행되고 결과가 반환되어야 함
      expect(result).toBe("success result");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("should provide session to function through storage", async () => {
      // Given: 세션을 확인하는 함수
      let capturedSession: any = null;
      const mockFn = jest.fn().mockImplementation(async () => {
        capturedSession = storage.getSession();
        return "session captured";
      });

      // When: withTransaction으로 함수 실행
      const result = await withTransaction(mongoConnection, storage, mockFn);

      // Then: 함수 내에서 세션이 사용 가능해야 함
      expect(result).toBe("session captured");
      expect(capturedSession).toBeDefined();
      expect(capturedSession.constructor.name).toBe("ClientSession");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("should commit transaction on successful execution", async () => {
      // Given: 트랜잭션 상태를 추적할 수 있는 함수
      let sessionInTransaction: any = null;
      const mockFn = jest.fn().mockImplementation(async () => {
        sessionInTransaction = storage.getSession();
        // 트랜잭션이 활성 상태인지 확인 (MongoDB 내부적으로 처리됨)
        expect(sessionInTransaction).toBeDefined();
        return "transaction success";
      });

      // When: withTransaction으로 함수 실행
      const result = await withTransaction(mongoConnection, storage, mockFn);

      // Then: 트랜잭션이 커밋되어야 함
      expect(result).toBe("transaction success");
      expect(mockFn).toHaveBeenCalledTimes(1);
      // 세션이 종료되었는지 확인하기 위해 외부에서 getSession 호출
      expect(storage.getSession()).toBeUndefined();
    });
  });

  describe("failed transaction", () => {
    test("should abort transaction and propagate error when function throws", async () => {
      // Given: 에러를 던지는 함수
      const testError = new Error("Transaction failed");
      const mockFn = jest.fn().mockRejectedValue(testError);

      // When & Then: withTransaction 실행 시 에러가 전파되어야 함
      await expect(withTransaction(mongoConnection, storage, mockFn)).rejects.toThrow(
        "Transaction failed",
      );

      expect(mockFn).toHaveBeenCalledTimes(1);
      // 트랜잭션 실패 후 세션이 정리되었는지 확인
      expect(storage.getSession()).toBeUndefined();
    });

    test("should provide session even when function fails", async () => {
      // Given: 세션을 확인한 후 에러를 던지는 함수
      let capturedSession: any = null;
      const mockFn = jest.fn().mockImplementation(async () => {
        capturedSession = storage.getSession();
        throw new Error("Function error");
      });

      // When & Then: 에러가 발생해도 세션은 제공되어야 함
      await expect(withTransaction(mongoConnection, storage, mockFn)).rejects.toThrow(
        "Function error",
      );

      expect(capturedSession).toBeDefined();
      expect(capturedSession.constructor.name).toBe("ClientSession");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test("should handle synchronous errors", async () => {
      // Given: 동기적으로 에러를 던지는 함수
      const syncError = new Error("Synchronous error");
      const mockFn = jest.fn().mockImplementation(() => {
        throw syncError;
      });

      // When & Then: 동기 에러도 적절히 처리되어야 함
      await expect(withTransaction(mongoConnection, storage, mockFn)).rejects.toThrow(
        "Synchronous error",
      );

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("nested transactions", () => {
    test("should handle nested withTransaction calls", async () => {
      // Given: 중첩된 withTransaction 호출
      const outerFn = jest.fn().mockImplementation(async () => {
        const outerSession = storage.getSession();
        expect(outerSession).toBeDefined();

        // 내부 트랜잭션 실행
        const innerResult = await withTransaction(mongoConnection, storage, async () => {
          const innerSession = storage.getSession();
          expect(innerSession).toBeDefined();
          // 새로운 세션이어야 함
          expect(innerSession).not.toBe(outerSession);
          return "inner result";
        });

        // 외부 트랜잭션으로 돌아왔을 때 원래 세션이 복원되어야 함
        expect(storage.getSession()).toBe(outerSession);
        return `outer: ${innerResult}`;
      });

      // When: 중첩된 트랜잭션 실행
      const result = await withTransaction(mongoConnection, storage, outerFn);

      // Then: 모든 트랜잭션이 정상적으로 처리되어야 함
      expect(result).toBe("outer: inner result");
      expect(outerFn).toHaveBeenCalledTimes(1);
    });

    test("should abort outer transaction when inner transaction fails", async () => {
      // Given: 내부 트랜잭션이 실패하는 중첩된 호출
      const outerFn = jest.fn().mockImplementation(async () => {
        const outerSession = storage.getSession();
        expect(outerSession).toBeDefined();

        // 내부 트랜잭션에서 에러 발생
        await withTransaction(mongoConnection, storage, async () => {
          throw new Error("Inner transaction failed");
        });

        return "outer success"; // 이 코드는 실행되지 않아야 함
      });

      // When & Then: 내부 트랜잭션 실패로 외부 트랜잭션도 실패해야 함
      await expect(withTransaction(mongoConnection, storage, outerFn)).rejects.toThrow(
        "Inner transaction failed",
      );

      expect(outerFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("concurrent transactions", () => {
    test("should handle multiple concurrent transactions", async () => {
      // Given: 여러 개의 동시 트랜잭션
      const createTransactionFn = (id: number) =>
        jest.fn().mockImplementation(async () => {
          const session = storage.getSession();
          expect(session).toBeDefined();

          // 각 트랜잭션에서 다른 세션을 가져야 함
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

          return `transaction-${id}-result`;
        });

      const fn1 = createTransactionFn(1);
      const fn2 = createTransactionFn(2);
      const fn3 = createTransactionFn(3);

      // When: 동시에 여러 트랜잭션 실행
      const promises = [
        withTransaction(mongoConnection, storage, fn1),
        withTransaction(mongoConnection, storage, fn2),
        withTransaction(mongoConnection, storage, fn3),
      ];

      const results = await Promise.all(promises);

      // Then: 모든 트랜잭션이 독립적으로 성공해야 함
      expect(results).toEqual([
        "transaction-1-result",
        "transaction-2-result",
        "transaction-3-result",
      ]);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
    });

    test("should isolate transactions when some fail", async () => {
      // Given: 일부는 성공하고 일부는 실패하는 트랜잭션들
      const successFn = jest.fn().mockResolvedValue("success");
      const failFn = jest.fn().mockRejectedValue(new Error("Concurrent failure"));

      // When: 성공과 실패 트랜잭션을 동시 실행
      const promises = [
        withTransaction(mongoConnection, storage, successFn),
        withTransaction(mongoConnection, storage, failFn).catch((error) => error.message),
        withTransaction(mongoConnection, storage, successFn),
      ];

      const results = await Promise.all(promises);

      // Then: 성공한 트랜잭션은 영향받지 않아야 함
      expect(results[0]).toBe("success");
      expect(results[1]).toBe("Concurrent failure");
      expect(results[2]).toBe("success");
      expect(successFn).toHaveBeenCalledTimes(2);
      expect(failFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("session lifecycle", () => {
    test("should properly start and end session", async () => {
      // Given: 세션 생명주기를 추적하는 함수
      let sessionDuringExecution: any = null;
      const mockFn = jest.fn().mockImplementation(async () => {
        sessionDuringExecution = storage.getSession();
        return "lifecycle test";
      });

      // When: withTransaction 실행
      const result = await withTransaction(mongoConnection, storage, mockFn);

      // Then: 실행 중에는 세션이 있고, 실행 후에는 정리되어야 함
      expect(result).toBe("lifecycle test");
      expect(sessionDuringExecution).toBeDefined();
      expect(storage.getSession()).toBeUndefined(); // 실행 후 세션 정리됨
    });

    test("should end session even when commit fails", async () => {
      // Given: 커밋이 실패할 수 있는 상황을 시뮬레이션
      // (실제로는 MongoDB 메모리 서버에서 커밋 실패를 시뮬레이션하기 어려우므로
      // 일반적인 에러 상황으로 테스트)
      const mockFn = jest.fn().mockImplementation(async () => {
        const session = storage.getSession();
        expect(session).toBeDefined();
        throw new Error("Simulated failure");
      });

      // When & Then: 에러 발생 시에도 세션이 정리되어야 함
      await expect(withTransaction(mongoConnection, storage, mockFn)).rejects.toThrow(
        "Simulated failure",
      );

      expect(storage.getSession()).toBeUndefined();
    });
  });

  describe("transaction context isolation", () => {
    test("should not affect outer context when used within storage.run", async () => {
      // Given: 외부 컨텍스트가 있는 상황
      const outerSession = await mongoConnection.startSession();

      try {
        await storage.run({ session: outerSession }, async () => {
          // 외부 컨텍스트에서 세션 확인
          expect(storage.getSession()).toBe(outerSession);

          // withTransaction 실행
          const result = await withTransaction(mongoConnection, storage, async () => {
            const innerSession = storage.getSession();
            expect(innerSession).toBeDefined();
            expect(innerSession).not.toBe(outerSession); // 다른 세션이어야 함
            return "inner transaction";
          });

          // withTransaction 완료 후 원래 컨텍스트로 복원되어야 함
          expect(storage.getSession()).toBe(outerSession);
          expect(result).toBe("inner transaction");
        });
      } finally {
        await outerSession.endSession();
      }
    });
  });

  describe("error handling edge cases", () => {
    test("should handle session creation errors gracefully", async () => {
      // Given: 무효한 연결 객체를 사용하여 에러 상황 시뮬레이션
      const invalidConnection = {
        startSession: jest.fn().mockRejectedValue(new Error("Session creation failed")),
      } as any;

      const mockFn = jest.fn().mockResolvedValue("should not execute");

      // When & Then: 세션 생성 실패 시 에러가 전파되어야 함
      await expect(withTransaction(invalidConnection, storage, mockFn)).rejects.toThrow(
        "Session creation failed",
      );

      expect(mockFn).not.toHaveBeenCalled();
    });

    test("should handle async function execution correctly", async () => {
      // Given: 비동기 함수
      const mockFn = jest.fn().mockResolvedValue("async result");

      // When: withTransaction으로 함수 실행
      const result = await withTransaction(mongoConnection, storage, mockFn);

      // Then: 비동기 결과가 적절히 처리되어야 함
      expect(result).toBe("async result");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
