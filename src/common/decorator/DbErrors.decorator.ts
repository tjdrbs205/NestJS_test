import { InternalServerErrorException, Logger } from "@nestjs/common";
import mongoose from "mongoose";

function isMongooseError(error: any): boolean {
  return (
    error instanceof mongoose.Error || (error?.code && typeof error.code === "number")
  );
}
function isDatabaseError(error: any): boolean {
  return isMongooseError(error);
}

// Method
export function HandleDbErrors(
  target: any,
  propertyName: string,
  descriptor: PropertyDescriptor,
) {
  const method = descriptor.value;
  const logger = new Logger(target.constructor.name);

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      if (isDatabaseError(error)) {
        logger.error(`Database error in ${propertyName}:`, error);
        throw new InternalServerErrorException(
          `Database operation failed: ${error.message}`,
        );
      }
      throw error;
    }
  };
}

// Class
export function HandleAllDbErrors<T extends { new (...arg: any[]): {} }>(constructor: T) {
  const logger = new Logger(constructor.name);

  return class extends constructor {
    constructor(...args: any[]) {
      super(...args);

      const prototype = constructor.prototype;
      Object.getOwnPropertyNames(prototype)
        .filter((name) => {
          const method = prototype[name];
          return (
            typeof method === "function" &&
            name !== "constructor" &&
            method.constructor.name === "AsyncFunction"
          );
        })
        .forEach((methodName) => {
          const originalMethod = prototype[methodName];
          prototype[methodName] = async function (...args: any[]) {
            try {
              return await originalMethod.apply(this, args);
            } catch (error) {
              if (isDatabaseError(error)) {
                logger.error(`Database error in ${methodName}:`, error);
                throw new InternalServerErrorException(
                  `Database error in ${methodName}: ${error.message}`,
                );
              }
              throw error;
            }
          };
        });
    }
  };
}
