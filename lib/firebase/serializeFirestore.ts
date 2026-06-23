import { Timestamp } from 'firebase-admin/firestore';

/** Admin SDK の Firestore 値を JSON レスポンス用に変換 */
export function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return value;
}

export function serializeFirestoreDoc<T extends Record<string, unknown>>(
  id: string,
  data: T,
): T & { id: string } {
  return { id, ...serializeFirestoreValue(data) as T };
}
