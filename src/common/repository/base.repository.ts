import {
  Query,
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  DeleteResult,
  UpdateResult,
  PipelineStage,
} from "mongoose";
import { TransactionContextStorage } from "../transaction/transaction.context";

export abstract class BaseRepository<T extends Document> {
  constructor(
    protected readonly model: Model<T>,
    protected readonly transactionContextStorage: TransactionContextStorage,
  ) {}

  protected attachSession(options?: Record<string, any>): Record<string, any> {
    const session = this.transactionContextStorage.getSession();
    const baseOptions = options || {};
    return session ? { ...baseOptions, session } : baseOptions;
  }

  protected applySessionToQuery<Q>(query: Q): Q {
    const session = this.transactionContextStorage.getSession();
    if (!session || !query) return query;

    if (query instanceof Query) {
      return query.session(session) as Q;
    }
    return query;
  }

  // 공통 CRUD 메서드들
  async create(doc: Partial<T>, options?: object): Promise<T> {
    const attachedOptions = this.attachSession(options);
    const newDoc = new this.model(doc);
    return await newDoc.save(attachedOptions);
  }

  async findById(id: string, options?: object): Promise<T | null> {
    const query = this.model.findById(id);
    return await this.applySessionToQuery(query).exec();
  }

  async findOne(filter: FilterQuery<T>, options?: object): Promise<T | null> {
    const query = this.model.findOne(filter);
    return await this.applySessionToQuery(query).exec();
  }

  async find(filter: FilterQuery<T> = {}, options?: object): Promise<T[]> {
    const query = this.model.find(filter);
    return await this.applySessionToQuery(query).exec();
  }

  async aggregate<R = Record<string, unknown>>(
    pipeline: PipelineStage[],
    options?: object,
  ): Promise<R[]> {
    const attachedOptions = this.attachSession(options);
    return await this.model.aggregate<R>(pipeline, attachedOptions).exec();
  }

  async count(filter: FilterQuery<T>, options?: object): Promise<number> {
    const attachedOptions = this.attachSession(options);
    return await this.model.countDocuments(filter, attachedOptions).exec();
  }

  async findWithPagination(
    filter: FilterQuery<T>,
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const findQuery = this.model.find(filter).sort(sort).skip(skip).limit(limit);
    const countQuery = this.model.countDocuments(filter);

    const [data, total] = await Promise.all([
      this.applySessionToQuery(findQuery).lean(),
      this.applySessionToQuery(countQuery).exec(),
    ]);
    return { data, total };
  }

  async updateById(id: string, update: Partial<T>, options?: object): Promise<T | null> {
    const attachedOptions = this.attachSession({ new: true, lean: true, ...options });
    return await this.model.findByIdAndUpdate(id, update, attachedOptions);
  }

  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: object,
  ): Promise<T | null> {
    const attachedOptions = this.attachSession({ new: true, lean: true, ...options });
    return await this.model.findOneAndUpdate(filter, update, attachedOptions);
  }

  async updateMany(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options?: object,
  ): Promise<UpdateResult> {
    const attachedOptions = this.attachSession(options);
    return await this.model.updateMany(filter, update, attachedOptions);
  }

  async deleteById(id: string, options?: object): Promise<T | null> {
    const attachedOptions = this.attachSession(options);
    return await this.model.findByIdAndDelete(id, attachedOptions);
  }

  async deleteOne(filter: FilterQuery<T>, options?: object): Promise<T | null> {
    const attachedOptions = this.attachSession(options);
    return await this.model.findOneAndDelete(filter, attachedOptions);
  }

  async deleteMany(filter: FilterQuery<T>, options?: object): Promise<DeleteResult> {
    const attachedOptions = this.attachSession(options);
    return await this.model.deleteMany(filter, attachedOptions);
  }
}
