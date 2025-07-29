import { Connection } from "mongoose";
import { TransactionContextStorage } from "./transaction.context";

export async function withTransaction<T>(
  connection: Connection,
  storage: TransactionContextStorage,
  fn: () => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    const result = await session.withTransaction(async () => {
      return storage.run({ session }, fn);
    });
    return result;
  } finally {
    session.endSession();
  }
}
