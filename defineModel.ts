import mongoose, { type Model } from 'mongoose';

/**
 * Registers a model once (repeated module evaluation must not throw
 * OverwriteModelError) while keeping the document type at the call site.
 * The schema parameter is intentionally loosely typed: mongoose's own
 * Schema<T> instantiation is extremely deep and blows up tsc's type checker.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defineModel<T>(name: string, schema: any): Model<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema as any);
}
