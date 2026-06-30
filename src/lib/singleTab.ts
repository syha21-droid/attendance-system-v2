/**
 * 같은 계정은 탭/창 하나에서만 활성화.
 * 새 탭에서 로그인 → 기존 탭들 즉시 로그아웃.
 */
const CH = 'rd_single_session'

function getTabId(): string {
  let id = sessionStorage.getItem('rdTabId')
  if (!id) {
    id = 'tab-' + crypto.randomUUID()
    sessionStorage.setItem('rdTabId', id)
  }
  return id
}

export function broadcastLogin(userId: string) {
  if (typeof window === 'undefined') return
  try {
    const ch = new BroadcastChannel(CH)
    ch.postMessage({ type: 'login', userId, tabId: getTabId() })
    ch.close()
  } catch {}
}

// onKick에 broadcasted userId를 넘겨줌 — 수신 시점에 현재 유저와 비교
// 자기 자신의 탭이 보낸 메시지는 무시
export function listenForKick(onKick: (userId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  try {
    const myTabId = getTabId()
    const ch = new BroadcastChannel(CH)
    ch.onmessage = (e) => {
      if (e.data?.type === 'login' && e.data?.tabId !== myTabId) {
        onKick(e.data.userId)
      }
    }
    return () => ch.close()
  } catch {
    return () => {}
  }
}
