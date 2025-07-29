import { Connection } from "mongoose";
import { TransactionContextStorage } from "../transaction/transaction.context";
import { withTransaction } from "../transaction/transaction.util";
import { ModuleRef } from "@nestjs/core";
import { getConnectionToken } from "@nestjs/mongoose";

let moduleRef: ModuleRef;

export function setTransactionModuleRef(ref: ModuleRef) {
  moduleRef = ref;
}

export function Transactional(): MethodDecorator {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!moduleRef) {
        throw new Error("[@Transactional] ModuleRef has not been set");
      }

      const serviceInstance = this;
      const storage = moduleRef.get(TransactionContextStorage, { strict: false });
      const connection = moduleRef.get<Connection>(getConnectionToken(), {
        strict: false,
      });

      if (!storage || !connection) {
        throw new Error(
          "[@Transactional] Unable to resolve asyncContext or connection from DI",
        );
      }

      return withTransaction(connection, storage, async () =>
        originalMethod.apply(serviceInstance, args),
      );
    };
    return descriptor;
  };
}
