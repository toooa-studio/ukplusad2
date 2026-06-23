/** 講師画面（Client Component）から API を呼ぶ際の fetch ラッパー */
export async function teacherApiFetch(
  user: { getIdToken: () => Promise<string> },
  input: string,
  init?: RequestInit,
) {
  const idToken = await user.getIdToken();
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...init?.headers,
    },
  });
}
