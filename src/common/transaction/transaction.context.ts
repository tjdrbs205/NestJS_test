import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { ClientSession } from "mongoose";

export interface TransactionContext {
  session?: ClientSession;
}

@Injectable()
export class TransactionContextStorage {
  private readonly contextStorage = new AsyncLocalStorage<TransactionContext>();

  run<T>(context: TransactionContext, callback: () => Promise<T>): Promise<T> {
    return this.contextStorage.run(context, callback);
  }

  getSession(): ClientSession | undefined {
    return this.contextStorage.getStore()?.session;
  }
}
