# セミプライベートレッスン（ペア事前登録方式）— iOS 連携仕様

本ドキュメントは UK Plus の **セミプライベートレッスン**機能を iOS（生徒スマホアプリ）側で実装するために必要な仕様をまとめたものです。Web 側（管理者・講師）は本リポジトリ `ukplusad2` で実装済みです。

## 概要

- 管理者が **「ペア」（生徒2名以上の固定グループ）** を事前登録します。
- 予約時はペア単位で1つの `privateBookings` レコードを作成し、**メンバー全員ぶんの enrollment（残数）を同時に消費**します。
- 1名でも残数不足や enrollment 期限切れがあれば、トランザクション全体が失敗します。
- 講師の枠 (`privateSlots`) は**プライベート/セミプライベートで共通**です（枠側に種別を持たせていません）。

## データモデル

### 新規: `studentGroups` コレクション

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | ✓ | ドキュメントID（自動生成） |
| `name` | string | ✓ | ペアの表示名（例: 「山田太郎・鈴木花子ペア」） |
| `type` | `"semi_private"` | ✓ | 現状はこの値固定 |
| `memberIds` | string[] | ✓ | メンバーの uid 配列（2名以上） |
| `assignedTeacherIds` | string[] | ✓ | 共通担当講師の uid 配列。空配列なら指定なし |
| `status` | `"active"` \| `"inactive"` | ✓ | 停止中なら新規予約不可 |
| `note` | string \| null | – | 備考メモ |
| `createdBy` | string | ✓ | 作成した管理者の uid |
| `createdAt` | Timestamp | ✓ | 作成日時 |
| `updatedAt` | Timestamp | ✓ | 更新日時 |

### 拡張: `privateBookings` コレクション

既存フィールドはそのまま保持しつつ、以下を追加しました（**プライベートとの後方互換性あり**）。

| 追加フィールド | 型 | 説明 |
|---|---|---|
| `type` | `"private"` \| `"semi_private"` | レッスン種別。未設定の旧データは `"private"` とみなす |
| `groupId` | string \| null | セミプライベート時のペアID。プライベートでは `null` |
| `attendeeStudentIds` | string[] | 参加者全員の uid フラット配列。`array-contains` クエリ用 |
| `attendeeConsumptions` | object[] | 参加者ごとの消費レコード（下記） |
| `lessonMinutes` | number | 実際に予約されたレッスン時間（分）。記録用（消費した enrollment.lessonMinutes と一致） |

`attendeeConsumptions` の各要素:

```ts
{
  studentId: string;
  enrollmentId: string;
  consumed: boolean;
  consumedAt: Timestamp | null;
  consumedReason: string | null;
}
```

既存の単一 `studentId` / `enrollmentId` / `consumption` フィールドは**代表者の値**として残ります（後方互換性のため）。

## Firestore セキュリティルール

```
match /studentGroups/{groupId} {
  allow read: if isTeacher() ||
    (isStudent() && resource.data.memberIds is list &&
      request.auth.uid in resource.data.memberIds);
  allow create, update, delete: if isAdmin();
}

match /privateBookings/{bookingId} {
  allow read: if isTeacher() ||
    (isStudent() && (
      resource.data.studentId == request.auth.uid ||
      (resource.data.attendeeStudentIds is list &&
        request.auth.uid in resource.data.attendeeStudentIds)
    ));
  // create/update/delete も同条件
}
```

→ 生徒は **自分が属するグループ・自分が参加する予約のみ**を読めます。

## iOS 側の取得クエリ例

### ログイン中の生徒が所属するグループ一覧

```swift
db.collection("studentGroups")
  .whereField("memberIds", arrayContains: currentUserId)
  .whereField("status", isEqualTo: "active")
  .getDocuments { ... }
```

### ログイン中の生徒の予約一覧（プライベート + セミプライベート両方）

セミプライベートでは `studentId` が代表者しか入らないため、`attendeeStudentIds` で取得します。

```swift
db.collection("privateBookings")
  .whereField("attendeeStudentIds", arrayContains: currentUserId)
  // 旧データ互換のため、studentId == currentUserId の検索も別途必要に応じて
  .order(by: "bookedAt", descending: true)
  .getDocuments { ... }
```

> **互換性メモ**: 旧データ（プライベートの古い予約）は `attendeeStudentIds` を持たない可能性があります。マイグレーションを行うか、`studentId == currentUserId` のクエリも併用してください（OR 取得）。

### 講師の空き枠取得

セミプライベートとプライベートで共通枠なので、既存の `privateSlots` 取得処理に変更はありません。

```swift
db.collection("privateSlots")
  .whereField("teacherId", isEqualTo: teacherId)
  .whereField("status", isEqualTo: "open")
  .whereField("startAt", isGreaterThanOrEqualTo: from)
  .whereField("startAt", isLessThanOrEqualTo: to)
```

## 生徒ごとのレッスン時間と Enrollment 設計（重要）

### 基本方針: 「チケット種別ごとに別 enrollment」

各 `enrollments` ドキュメントは **そのチケットでのレッスン時間** を `lessonMinutes` フィールドで保持します。1人の生徒が複数の時間種別（例: 60分×8回 と 40分×4回）を併用する場合は、**enrollment を別レコードで複数持たせます**。

| 追加フィールド | 型 | 説明 |
|---|---|---|
| `lessonMinutes` | number | このチケットのレッスン時間（分）。例: 60, 40, 90 |

**後方互換性**: 既存の `lessonMinutes` 未設定 enrollment は **60 分**として扱います（クライアント・サーバー共通）。Web 管理画面で開いた enrollment を保存すると `lessonMinutes` が自動付与されます。

### 残数表示の推奨フォーマット

「●分 × 残●回」を強く推奨します。

例:
- アクティブな enrollment が 1件: `60分 × 残8回`
- アクティブな enrollment が複数件: `60分 × 残8回` / `40分 × 残3回`（縦並び表示推奨）

複数件の合計（例: 「総残り11回」）は分数が混ざるため**意味を持たない**ことに注意してください。**「分数別に」表示**するのが原則です。

### 予約時の消費ルール（案③: 例外OK・別 enrollment から消費）

予約時、サーバー側は **「予約レッスン時間 == enrollment.lessonMinutes」** を厳密にチェックします。

- 60分のレッスンを予約 → `lessonMinutes == 60` の enrollment からのみ消費可能
- 40分のレッスンを予約 → `lessonMinutes == 40` の enrollment からのみ消費可能
- 一致する enrollment が無い場合は HTTP 500 でエラー（メッセージ: `予約時間（XX分）に一致する受講登録が見つかりません`）

**例外的な時間でレッスンを受けたい場合（例: 普段60分の生徒がたまに40分）**

該当時間の enrollment が事前に作成されている必要があります。事務局／管理者が「40分×Nチケット」を別 enrollment として追加発行してください（`案③: 例外OK・別 enrollment から消費（チケット使い分け）` 方式）。

iOS 側では:

1. 予約画面でレッスン時間を選ばせる前に、生徒の **アクティブな enrollment 一覧** を取得
2. **その生徒が持っている `lessonMinutes` の集合**だけを選択肢として提示する（例: 60分 / 40分）
3. 選択した時間に対応する enrollment（残数 > 0 かつ期限内）を特定し、`enrollmentId` として送信
4. 該当 enrollment が無い時間は選択肢に出さない（無効化）か、「この時間のチケットがありません。事務局へお問い合わせください」を表示

### セミプライベートでの整合チェック

セミプライベートでは **参加者全員の `enrollment.lessonMinutes` がすべて予約時間と一致**している必要があります。

- 例: 60分のセミプライベート予約 → 参加者全員が `lessonMinutes == 60` の enrollment を持っていること
- 1名でも一致しない / 残数不足 / 期限切れがあればトランザクション全体がロールバック

UI 側では予約前に全員ぶんの enrollment を読み込み、`lessonMinutes` の整合性を事前にチェックすることを推奨します。

### Firestore クエリ例（Swift）

```swift
// 生徒のアクティブな enrollment を取得
let snapshot = try await db.collection("enrollments")
    .whereField("studentId", isEqualTo: uid)
    .whereField("status", isEqualTo: "active")
    .getDocuments()

// 提示するレッスン時間の選択肢（ユニークな lessonMinutes）
let availableMinutes: Set<Int> = Set(snapshot.documents.compactMap {
    $0.data()["lessonMinutes"] as? Int
})

// 60分レッスンを予約する場合に使う enrollment
let target = snapshot.documents.first(where: { doc in
    let m = doc.data()["lessonMinutes"] as? Int ?? 60
    let remaining = doc.data()["remainingCount"] as? Int ?? 0
    return m == 60 && remaining > 0
})
```

## 予約時間の最少単位（重要）

**予約時間は 30 分単位**でのみ受け付けます。プライベート / セミプライベート共通です。

- `lessonStartAt` / `lessonEndAt` の **分・秒・ミリ秒**は 30 分の倍数（つまり 0 分 か 30 分）である必要があります
- レッスン長 (`lessonEndAt - lessonStartAt`) も **30 分の倍数**である必要があります（30 / 60 / 90 / 120 ...）
- 違反した場合、API は HTTP 400 を返します

iOS 側の予約画面では時刻ピッカーを **30 分刻み**にしてください。サーバー側で再度バリデーションされるため、UI 側で外れた値は弾く設計を推奨します。

定数として `BOOKING_DURATION_STEP_MINUTES = 30` をリポジトリ `lib/utils.ts` でエクスポートしています（Web 側の参照用）。

## 予約作成 API

エンドポイント: `POST /api/bookings/create`

### リクエスト形式

#### 1. プライベート（1名・互換）

```json
{
  "slotId": "slot_xxx",
  "studentId": "student_uid",
  "enrollmentId": "enrollment_xxx",
  "lessonStartAt": "2026-05-10T05:00:00.000Z",
  "lessonEndAt":   "2026-05-10T05:30:00.000Z",
  "bookedBy":      "student_uid",
  "zoomURL":       "https://zoom.example.com/abc"
}
```

#### 2. セミプライベート（複数名）

```json
{
  "slotId": "slot_xxx",
  "groupId": "group_xxx",
  "attendees": [
    { "studentId": "uid_a", "enrollmentId": "enr_a" },
    { "studentId": "uid_b", "enrollmentId": "enr_b" }
  ],
  "lessonStartAt": "2026-05-10T05:00:00.000Z",
  "lessonEndAt":   "2026-05-10T05:30:00.000Z",
  "bookedBy":      "uid_a",
  "zoomURL":       "https://zoom.example.com/abc"
}
```

- `attendees` を渡した場合、`studentId` / `enrollmentId` は不要（無視されます）。
- `groupId` を渡すと、サーバー側で「`attendees` がグループメンバー全員と一致しているか」を検証します。
- `bookedBy` には予約を主導した uid を入れてください（管理者が代行する場合は管理者の uid）。

### レスポンス

```json
{
  "success": true,
  "bookingId": "booking_xxx",
  "type": "semi_private",
  "attendeeStudentIds": ["uid_a", "uid_b"],
  "bufferMinutes": 10,
  "newSlots": { "before": false, "after": true }
}
```

### エラーケース

| ステータス | 内容 |
|---|---|
| 400 | 必須パラメータ不足、`attendees` の形式不正、参加者重複、30分単位違反など |
| 500 | スロットがすでに予約済み、enrollment の残数不足、有効期限切れ、グループメンバー不一致、**予約時間と `enrollment.lessonMinutes` の不一致**など（メッセージ参照） |

サーバー側はトランザクションで処理するため、**1名でも残数不足があれば全体がロールバック**されます。

## iOS 実装ガイド（概略）

### モデル（Swift 例）

```swift
struct StudentGroup: Codable {
    let id: String
    let name: String
    let type: String                  // "semi_private"
    let memberIds: [String]
    let assignedTeacherIds: [String]
    let status: String                // "active" | "inactive"
    let note: String?
    let createdBy: String
    let createdAt: Timestamp
    let updatedAt: Timestamp
}

struct BookingAttendeeConsumption: Codable {
    let studentId: String
    let enrollmentId: String
    let consumed: Bool
    let consumedAt: Timestamp?
    let consumedReason: String?
}

struct PrivateBooking: Codable {
    let id: String
    let slotId: String
    let teacherId: String
    let type: String?                          // "private" | "semi_private" | nil(=private)
    let groupId: String?
    let studentId: String                       // 代表者
    let enrollmentId: String
    let lessonMinutes: Int?                     // 実際に予約された時間（記録用）
    let attendeeStudentIds: [String]?
    let attendeeConsumptions: [BookingAttendeeConsumption]?
    let status: String
    let bookedAt: Timestamp
    let bookedBy: String
    let zoomURL: String?
    // ... 既存フィールド
}

struct Enrollment: Codable {
    let id: String
    let studentId: String
    let type: String                            // "ticket_bundle" | "monthly_registration"
    let lessonMinutes: Int?                     // nil 時は 60 として扱う
    let registeredCount: Int
    let usedCount: Int
    let remainingCount: Int
    let validUntil: Timestamp
    let rescheduleAllowedCount: Int
    let rescheduleUsedCount: Int
    let status: String                          // "active" | "expired" | "depleted" | "inactive"
    // ... 既存フィールド
}
```

### 予約画面の UX 推奨

1. 「**レッスン種別**」を選ばせる:
   - プライベート（1on1）
   - セミプライベート（ペアで受ける）
2. セミプライベート選択時:
   - `studentGroups` から自分が属する `active` なグループを取得
   - グループが0件 → 「事務局へお問い合わせください」を案内
   - グループが1件以上 → 選択肢として表示。ペアの相手の名前を「ペアの相手: ○○さん」のように表示
   - 選択したグループの全メンバーぶんの `enrollments` を読み、**全員が残数を持っているか・期限内か**を予約前にバリデーション
3. 予約 POST 時に `groupId` と `attendees` を組み立てて送信
4. 成功時の表示文言を「**ペアでのレッスン予約が確定しました**」に分岐

### 注意

- セミプライベート予約は **ペア相手の残数も同時に消費**します。生徒には事前に「ペア相手の残レッスン数も1つ消費される」旨を表示してください。
- 一方の生徒が `enrollment` の有効期限切れや残数 0 だと、**予約全体がエラー**になります。エラーメッセージはサーバーが返す `error` をそのまま表示するか、種別判定して案内文を変えてください。

## キャンセル・リスケについて（今後の拡張）

現時点ではキャンセル/リスケ用の専用 API は未実装です。実装時には以下の方針を想定しています:

- **ペア単位でキャンセル**：`attendeeConsumptions` 全員の残数を戻す
- **片方だけ離脱**：未対応（要件次第で追加検討）
- 別ペアへの差し替え：未対応

実装する際は本ドキュメントを更新します。

## 変更履歴

- 2026-05-02: 初版（セミプライベート対応 v1）
- 2026-05-02: 予約時間の最少単位（30分単位）ルールを追記
- 2026-05-02: 生徒ごとのレッスン時間（`enrollment.lessonMinutes`）と「●分 × 残●回」表示・案③（例外OK・別チケット消費）方式を追記
