import { Test, TestingModule } from "@nestjs/testing";
import { ModuleRef } from "@nestjs/core";
import { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Transactional, setTransactionModuleRef } from "../transactional.decorator";
import { TransactionContextStorage } from "../../transaction/transaction.context";
import { withTransaction } from "../../transaction/transaction.util";

// Mock dependencies
jest.mock("../../transaction/transaction.util");
const mockWithTransaction = withTransaction as jest.MockedFunction<
  typeof withTransaction
>;

describe("Transactional Decorator", () => {
  let moduleRef: ModuleRef;
  let mockConnection: Partial<Connection>;
  let mockStorage: Partial<TransactionContextStorage>;
  let testService: TestService;

  class TestService {
    @Transactional()
    async successMethod(value: string): Promise<string> {
      return `processed: ${value}`;
    }

    @Transactional()
    async errorMethod(): Promise<void> {
      throw new Error("Test error");
    }

    @Transactional()
    async methodWithMultipleArgs(a: number, b: string, c: boolean): Promise<object> {
      return { a, b, c };
    }

    // Non-transactional method for comparison
    async normalMethod(): Promise<string> {
      return "normal result";
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock dependencies
    mockConnection = {
      startSession: jest.fn(),
    };

    mockStorage = {
      run: jest.fn(),
      getSession: jest.fn(),
    };

    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
        {
          provide: TransactionContextStorage,
          useValue: mockStorage,
        },
      ],
    }).compile();

    moduleRef = module.get<ModuleRef>(ModuleRef);
    testService = module.get<TestService>(TestService);

    // Set module ref for decorator
    setTransactionModuleRef(moduleRef);

    // Default withTransaction mock implementation
    mockWithTransaction.mockImplementation(async (connection, storage, callback) => {
      return await callback();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("성공 케이스", () => {
    it("트랜잭션 내에서 메서드가 성공적으로 실행되어야 함", async () => {
      // Given
      const testValue = "test-value";
      const expectedResult = `processed: ${testValue}`;

      // When
      const result = await testService.successMethod(testValue);

      // Then
      expect(result).toBe(expectedResult);
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
      expect(mockWithTransaction).toHaveBeenCalledWith(
        mockConnection,
        mockStorage,
        expect.any(Function),
      );
    });

    it("여러 개의 인자를 가진 메서드가 정상 작동해야 함", async () => {
      // Given
      const a = 123;
      const b = "test";
      const c = true;

      // When
      const result = await testService.methodWithMultipleArgs(a, b, c);

      // Then
      expect(result).toEqual({ a, b, c });
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it("withTransaction이 올바른 매개변수로 호출되어야 함", async () => {
      // When
      await testService.successMethod("test");

      // Then
      expect(mockWithTransaction).toHaveBeenCalledWith(
        mockConnection,
        mockStorage,
        expect.any(Function),
      );

      // Callback function should be the original method wrapped
      const callback = mockWithTransaction.mock.calls[0][2];
      expect(typeof callback).toBe("function");
    });
  });

  describe("에러 케이스", () => {
    it("메서드에서 에러가 발생하면 에러가 전파되어야 함", async () => {
      // Given
      mockWithTransaction.mockImplementation(async (connection, storage, callback) => {
        return await callback();
      });

      // When & Then
      await expect(testService.errorMethod()).rejects.toThrow("Test error");
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it("withTransaction에서 에러가 발생하면 에러가 전파되어야 함", async () => {
      // Given
      const transactionError = new Error("Transaction failed");
      mockWithTransaction.mockRejectedValue(transactionError);

      // When & Then
      await expect(testService.successMethod("test")).rejects.toThrow(
        "Transaction failed",
      );
    });
  });

  describe("ModuleRef 의존성", () => {
    it("ModuleRef가 설정되지 않으면 에러를 던져야 함", async () => {
      // Given
      setTransactionModuleRef(null as any);

      // When & Then
      await expect(testService.successMethod("test")).rejects.toThrow(
        "[@Transactional] ModuleRef has not been set",
      );
    });

    it("TransactionContextStorage를 찾을 수 없으면 에러를 던져야 함", async () => {
      // Given
      const moduleWithoutStorage = {
        get: jest.fn().mockImplementation((token) => {
          if (token === TransactionContextStorage) {
            return null;
          }
          if (token === Connection) {
            return mockConnection;
          }
          return null;
        }),
      } as any;

      setTransactionModuleRef(moduleWithoutStorage);

      // When & Then
      await expect(testService.successMethod("test")).rejects.toThrow(
        "[@Transactional] Unable to resolve asyncContext or connection from DI",
      );
    });

    it("Connection을 찾을 수 없으면 에러를 던져야 함", async () => {
      // Given
      const moduleWithoutConnection = {
        get: jest.fn().mockImplementation((token) => {
          if (token === TransactionContextStorage) {
            return mockStorage;
          }
          if (token === Connection) {
            return null;
          }
          return null;
        }),
      } as any;

      setTransactionModuleRef(moduleWithoutConnection);

      // When & Then
      await expect(testService.successMethod("test")).rejects.toThrow(
        "[@Transactional] Unable to resolve asyncContext or connection from DI",
      );
    });
  });

  describe("메서드 시그니처 보존", () => {
    it("원본 메서드의 this 컨텍스트가 보존되어야 함", async () => {
      // Given
      class ServiceWithState {
        public state = "initial";

        @Transactional()
        async updateState(newState: string): Promise<string> {
          this.state = newState;
          return this.state;
        }
      }

      const serviceInstance = new ServiceWithState();
      setTransactionModuleRef(moduleRef);

      // When
      const result = await serviceInstance.updateState("updated");

      // Then
      expect(result).toBe("updated");
      expect(serviceInstance.state).toBe("updated");
    });

    it("원본 메서드의 매개변수가 정확히 전달되어야 함", async () => {
      // Given
      let capturedArgs: any[] = [];

      class CaptureService {
        @Transactional()
        async captureArgs(...args: any[]): Promise<any[]> {
          capturedArgs = args;
          return args;
        }
      }

      const captureService = new CaptureService();
      const testArgs = [1, "string", true, { obj: "value" }, [1, 2, 3]];

      // When
      const result = await captureService.captureArgs(...testArgs);

      // Then
      expect(result).toEqual(testArgs);
      expect(capturedArgs).toEqual(testArgs);
    });
  });

  describe("데코레이터 적용 검증", () => {
    it("데코레이터가 적용된 메서드는 withTransaction을 호출해야 함", async () => {
      // When
      await testService.successMethod("test");

      // Then
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it("데코레이터가 적용되지 않은 메서드는 withTransaction을 호출하지 않아야 함", async () => {
      // When
      const result = await testService.normalMethod();

      // Then
      expect(result).toBe("normal result");
      expect(mockWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe("비동기 처리", () => {
    it("비동기 메서드의 결과를 올바르게 반환해야 함", async () => {
      // Given
      class AsyncService {
        @Transactional()
        async delayedMethod(delay: number): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return `delayed ${delay}ms`;
        }
      }

      const asyncService = new AsyncService();

      // When
      const start = Date.now();
      const result = await asyncService.delayedMethod(10);
      const elapsed = Date.now() - start;

      // Then
      expect(result).toBe("delayed 10ms");
      expect(elapsed).toBeGreaterThanOrEqual(9); // Allow for some timing variance
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it("Promise 체이닝이 올바르게 작동해야 함", async () => {
      // Given
      class ChainService {
        @Transactional()
        async chainedMethod(value: number): Promise<number> {
          return Promise.resolve(value)
            .then((v) => v * 2)
            .then((v) => v + 1);
        }
      }

      const chainService = new ChainService();

      // When
      const result = await chainService.chainedMethod(5);

      // Then
      expect(result).toBe(11); // (5 * 2) + 1
      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
