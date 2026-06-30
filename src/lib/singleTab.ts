/**
 * 같은 계정은 탭/창 하나에서만 활성화.
 * 새 탭에서 로그인 → 기존 탭들 즉시 로그아웃.
 */
const CH = 'rd_single_session'

export function broadcastLogin(userId: string) {
  if (typeof window === 'undefined') return
  try {
    const ch = new BroadcastChannel(CH)
    ch.postMessage({ type: 'login', userId })
    ch.close()
  } catch {}
}

export function listenForKick(currentUserId: string, onKick: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  try {
    const ch = new BroadcastChannel(CH)
    ch.onmessage = (e) => {
      if (e.data?.type === 'login' && e.data?.userId === currentUserId) {
        onKick()
      }
    }
    return () => ch.close()
  } catch {
    return () => {}
  }
}
