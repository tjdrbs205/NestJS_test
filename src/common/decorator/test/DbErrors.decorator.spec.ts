import { Logger, InternalServerErrorException } from "@nestjs/common";
import mongoose from "mongoose";
import { HandleAllDbErrors, HandleDbErrors } from "../DbErrors.decorator";

// Logger 모킹
const mockLoggerError = jest.fn();
jest.mock("@nestjs/common", () => ({
  ...jest.requireActual("@nestjs/common"),
  Logger: jest.fn().mockImplementation(() => ({
    error: mockLoggerError,
  })),
}));

describe("HandleDbErrors Decorator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("메서드 데코레이터 - HandleDbErrors", () => {
    class TestRepository {
      @HandleDbErrors
      async successMethod(): Promise<string> {
        return "success";
      }

      @HandleDbErrors
      async mongooseValidationError(): Promise<string> {
        // 실제 Mongoose ValidationError 인스턴스
        const error = new mongoose.Error.ValidationError();
        error.addError(
          "name",
          new mongoose.Error.ValidatorError({
            message: "Name is required",
            path: "name",
            value: undefined,
          }),
        );
        throw error;
      }

      @HandleDbErrors
      async mongooseCastError(): Promise<string> {
        // 실제 Mongoose CastError 인스턴스
        throw new mongoose.Error.CastError("ObjectId", "invalid-id", "_id");
      }

      @HandleDbErrors
      async mongooseDocumentNotFoundError(): Promise<string> {
        // 실제 Mongoose DocumentNotFoundError 인스턴스
        throw new mongoose.Error.DocumentNotFoundError("User not found");
      }

      @HandleDbErrors
      async mongooseMissingSchemaError(): Promise<string> {
        // 실제 Mongoose MissingSchemaError 인스턴스
        throw new mongoose.Error.MissingSchemaError("TestModel");
      }

      @HandleDbErrors
      async mongoErrorWithCode(): Promise<string> {
        // MongoDB 네이티브 에러 (code 속성 있음)
        const error = new Error("E11000 duplicate key error");
        (error as any).code = 11000;
        throw error;
      }

      @HandleDbErrors
      async mongoErrorWithStringCode(): Promise<string> {
        // code가 문자열인 경우 (처리되지 않아야 함)
        const error = new Error("Some error");
        (error as any).code = "SOME_ERROR";
        throw error;
      }

      @HandleDbErrors
      async nonDatabaseError(): Promise<string> {
        // 일반 애플리케이션 에러 (처리되지 않아야 함)
        throw new Error("Regular application error");
      }

      @HandleDbErrors
      async nullError(): Promise<string> {
        // null 에러 (처리되지 않아야 함)
        throw null;
      }
    }

    let testRepository: TestRepository;

    beforeEach(() => {
      testRepository = new TestRepository();
    });

    it("정상적인 메서드 실행 시 결과를 반환해야 한다", async () => {
      const result = await testRepository.successMethod();

      expect(result).toBe("success");
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("Mongoose ValidationError 발생 시 InternalServerErrorException을 던져야 한다", async () => {
      await expect(testRepository.mongooseValidationError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseValidationError:",
        expect.any(mongoose.Error.ValidationError),
      );
    });

    it("Mongoose CastError 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongooseCastError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseCastError:",
        expect.any(mongoose.Error.CastError),
      );
    });

    it("Mongoose DocumentNotFoundError 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongooseDocumentNotFoundError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseDocumentNotFoundError:",
        expect.any(mongoose.Error.DocumentNotFoundError),
      );
    });

    it("Mongoose MissingSchemaError 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongooseMissingSchemaError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseMissingSchemaError:",
        expect.any(mongoose.Error.MissingSchemaError),
      );
    });

    it("MongoDB 네이티브 에러(숫자 code) 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongoErrorWithCode()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongoErrorWithCode:",
        expect.any(Error),
      );
    });

    it("문자열 code를 가진 에러는 처리되지 않아야 한다", async () => {
      await expect(testRepository.mongoErrorWithStringCode()).rejects.toThrow(
        "Some error",
      );

      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("일반 애플리케이션 에러는 처리되지 않아야 한다", async () => {
      await expect(testRepository.nonDatabaseError()).rejects.toThrow(
        "Regular application error",
      );

      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("null 에러는 처리되지 않아야 한다", async () => {
      await expect(testRepository.nullError()).rejects.toBe(null);

      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });

  describe("클래스 데코레이터 - HandleAllDbErrors", () => {
    @HandleAllDbErrors
    class TestRepository {
      async successMethod(): Promise<string> {
        return "success";
      }

      async mongooseValidationError(): Promise<string> {
        throw new mongoose.Error.ValidationError();
      }

      async mongooseCastError(): Promise<string> {
        throw new mongoose.Error.CastError("ObjectId", "invalid-id", "_id");
      }

      async mongoErrorWithCode(): Promise<string> {
        const error = new Error("Duplicate key error");
        (error as any).code = 11000;
        throw error;
      }

      async nonDatabaseError(): Promise<string> {
        throw new Error("Regular error");
      }

      // 동기 메서드는 처리되지 않아야 함
      syncMethod(): string {
        throw new mongoose.Error.ValidationError();
      }
    }

    let testRepository: TestRepository;

    beforeEach(() => {
      testRepository = new TestRepository();
    });

    it("정상적인 메서드 실행 시 결과를 반환해야 한다", async () => {
      const result = await testRepository.successMethod();

      expect(result).toBe("success");
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("Mongoose ValidationError 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongooseValidationError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseValidationError:",
        expect.any(mongoose.Error.ValidationError),
      );
    });

    it("Mongoose CastError 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongooseCastError()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongooseCastError:",
        expect.any(mongoose.Error.CastError),
      );
    });

    it("MongoDB 네이티브 에러 발생 시 처리되어야 한다", async () => {
      await expect(testRepository.mongoErrorWithCode()).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Database error in mongoErrorWithCode:",
        expect.any(Error),
      );
    });

    it("일반 에러는 처리되지 않아야 한다", async () => {
      await expect(testRepository.nonDatabaseError()).rejects.toThrow("Regular error");

      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("동기 메서드는 데코레이터가 적용되지 않아야 한다", () => {
      expect(() => testRepository.syncMethod()).toThrow(mongoose.Error.ValidationError);
      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });

  describe("에러 타입 판별 정확성 테스트", () => {
    class TestRepository {
      @HandleDbErrors
      async testError(error: any): Promise<void> {
        throw error;
      }
    }

    let testRepository: TestRepository;

    beforeEach(() => {
      testRepository = new TestRepository();
    });

    it("instanceof로 정확히 Mongoose 에러를 구분해야 한다", async () => {
      const validationError = new mongoose.Error.ValidationError();
      const castError = new mongoose.Error.CastError("ObjectId", "test", "_id");

      // Mongoose 에러들은 처리되어야 함
      await expect(testRepository.testError(validationError)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(testRepository.testError(castError)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLoggerError).toHaveBeenCalledTimes(2);
    });

    it("일반 Error는 처리되지 않아야 한다", async () => {
      const regularError = new Error("Regular error");
      const customError = new TypeError("Type error");

      // 일반 에러들은 그대로 던져져야 함
      await expect(testRepository.testError(regularError)).rejects.toThrow(
        "Regular error",
      );
      await expect(testRepository.testError(customError)).rejects.toThrow("Type error");

      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });
});
