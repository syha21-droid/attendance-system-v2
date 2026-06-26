'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Users, Ticket, UserCheck, RefreshCw, Trash2, Check } from 'lucide-react'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'

type Tab = 'lectures' | 'registrations' | 'entitlements' | 'staff'

interface Lecture { id: string; name: string; instructor: string; description: string; registrationCount: number; createdAt: string }
interface Registration { id: string; course_id: string; user_id: string; userName: string; userEmail: string; employeeNo: string; member_type: string; status: string; paid: boolean; attended: boolean; created_at: string }
interface Entitlement { id: string; kind: string; total: number; used: number }
interface Staff { id: string; employee_no: string; name: string; used: boolean; created_at: string }
interface AppUser { id: string; name: string; email: string; employee_no: string; member_type: string }

const ENTITLEMENT_KINDS = ['saturday_special', 'monthly_special', 'vip_pass']

export default function AdminSpecialPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('lectures')
  const [isAdmin, setIsAdmin] = useState(false)

  // 탭별 데이터
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [selectedLecture, setSelectedLecture] = useState<string>('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [userEntitlements, setUserEntitlements] = useState<Entitlement[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  // 폼 상태
  const [newLecture, setNewLecture] = useState({ name: '', instructor: '', description: '' })
  const [grant, setGrant] = useState({ kind: 'saturday_special', amount: 1 })
  const [newStaff, setNewStaff] = useState({ employeeNo: '', name: '' })
  const [busy, setBusy] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) { router.push('/login'); return }
    const u = JSON.parse(saved)
    if (!u.isAdmin) { router.push('/admin'); return }
    setIsAdmin(true)
  }, [router])

  const loadLectures = useCallback(async () => {
    const res = await fetch('/api/admin/special?action=lectures', { cache: 'no-store' })
    const d = await res.json()
    setLectures(d.lectures || [])
  }, [])

  const loadRegistrations = useCallback(async (courseId: string) => {
    if (!courseId) return
    const res = await fetch(`/api/admin/special?action=registrations&courseId=${encodeURIComponent(courseId)}`, { cache: 'no-store' })
    const d = await res.json()
    setRegistrations(d.registrations || [])
  }, [])

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/admin/special?action=users', { cache: 'no-store' })
    const d = await res.json()
    setUsers(d.users || [])
  }, [])

  const loadUserEntitlements = useCallback(async (userId: string) => {
    if (!userId) return
    const res = await fetch(`/api/admin/special?action=entitlements&userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    const d = await res.json()
    setUserEntitlements(d.entitlements || [])
  }, [])

  const loadStaff = useCallback(async () => {
    const res = await fetch('/api/admin/special?action=staff', { cache: 'no-store' })
    const d = await res.json()
    setStaff(d.staff || [])
  }, [])

  useEffect(() => { if (!isAdmin) return; loadLectures() }, [isAdmin, loadLectures])
  useEffect(() => { if (!isAdmin) return; if (tab === 'registrations') loadUsers() }, [isAdmin, tab, loadUsers])
  useEffect(() => { if (!isAdmin) return; if (tab === 'entitlements') loadUsers() }, [isAdmin, tab, loadUsers])
  useEffect(() => { if (!isAdmin) return; if (tab === 'staff') loadStaff() }, [isAdmin, tab, loadStaff])

  useEffect(() => {
    if (selectedLecture) loadRegistrations(selectedLecture)
  }, [selectedLecture, loadRegistrations])

  useEffect(() => {
    if (selectedUser) loadUserEntitlements(selectedUser)
  }, [selectedUser, loadUserEntitlements])

  const post = async (body: object) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/special', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || '오류'); return false }
      return true
    } catch {
      toast.error('네트워크 오류'); return false
    } finally {
      setBusy(false)
    }
  }

  const handleCreateLecture = async () => {
    if (!newLecture.name || !newLecture.instructor) { toast.error('특강명과 강사명을 입력하세요'); return }
    if (await post({ action: 'createLecture', ...newLecture })) {
      toast.success('특강이 추가되었습니다')
      setNewLecture({ name: '', instructor: '', description: '' })
      loadLectures()
    }
  }

  const handleDeleteLecture = async (courseId: string) => {
    if (!confirm('정말 삭제하시겠습니까? 신청 내역도 함께 삭제됩니다.')) return
    if (await post({ action: 'deleteLecture', courseId })) {
      toast.success('삭제되었습니다')
      loadLectures()
    }
  }

  const handleApprove = async (registrationId: string) => {
    if (await post({ action: 'approveRegistration', registrationId })) {
      toast.success('승인 완료')
      loadRegistrations(selectedLecture)
    }
  }

  const handleGrantEntitlement = async () => {
    if (!selectedUser) { toast.error('사용자를 선택하세요'); return }
    if (await post({ action: 'grantEntitlement', userId: selectedUser, kind: grant.kind, amount: grant.amount })) {
      toast.success(`수강권 ${grant.amount}장 지급 완료`)
      loadUserEntitlements(selectedUser)
    }
  }

  const handleAddStaff = async () => {
    if (!newStaff.employeeNo || !newStaff.name) { toast.error('사원번호와 이름을 입력하세요'); return }
    if (await post({ action: 'addStaff', employeeNo: newStaff.employeeNo, name: newStaff.name })) {
      toast.success('사원 등록 완료')
      setNewStaff({ employeeNo: '', name: '' })
      loadStaff()
    }
  }

  const handleDeleteStaff = async (staffId: string, used: boolean) => {
    if (used && !confirm('이미 사용된 사원번호입니다. 삭제하시겠습니까?')) return
    if (await post({ action: 'deleteStaff', staffId })) {
      toast.success('삭제되었습니다')
      loadStaff()
    }
  }

  if (!isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><div className="app-spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">🎟️ 특강 관리</h1>
        </div>
      </nav>

      {/* 탭 */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {([
            ['lectures', '📚 특강 목록'],
            ['registrations', '📋 신청 현황'],
            ['entitlements', '🎫 수강권 부여'],
            ['staff', '🏢 사원 명단'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                tab === key
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ───── 특강 목록 탭 ───── */}
        {tab === 'lectures' && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">+ 새 특강 추가</h2>
              <div className="space-y-3">
                <input
                  value={newLecture.name} onChange={(e) => setNewLecture((p) => ({ ...p, name: e.target.value }))}
                  placeholder="특강명 (필수)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold placeholder-gray-400"
                />
                <input
                  value={newLecture.instructor} onChange={(e) => setNewLecture((p) => ({ ...p, instructor: e.target.value }))}
                  placeholder="강사명 (필수)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold placeholder-gray-400"
                />
                <textarea
                  value={newLecture.description} onChange={(e) => setNewLecture((p) => ({ ...p, description: e.target.value }))}
                  placeholder="특강 설명 (선택)"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-400 resize-none"
                />
                <button
                  onClick={handleCreateLecture} disabled={busy}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 특강 추가
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">특강 목록 ({lectures.length}개)</h2>
                <button onClick={loadLectures} className="p-2 hover:bg-gray-100 rounded-lg">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {lectures.length === 0 ? (
                <p className="text-center text-gray-400 py-8">등록된 특강이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {lectures.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                      <div>
                        <p className="font-semibold text-gray-900">{l.name}</p>
                        <p className="text-sm text-gray-500">👨‍🏫 {l.instructor} · 신청 {l.registrationCount}명</p>
                        {l.description && <p className="text-xs text-gray-400 mt-0.5">{l.description}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteLecture(l.id)}
                        className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ───── 신청 현황 탭 ───── */}
        {tab === 'registrations' && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-3">특강 선택</h2>
              <select
                value={selectedLecture}
                onChange={(e) => setSelectedLecture(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-semibold bg-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- 특강을 선택하세요 --</option>
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.instructor})</option>
                ))}
              </select>
            </div>

            {selectedLecture && (
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg">신청 내역 ({registrations.length}명)</h2>
                  <button onClick={() => loadRegistrations(selectedLecture)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {registrations.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">신청자가 없습니다</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="text-left py-2 pr-4">이름</th>
                          <th className="text-left py-2 pr-4">이메일</th>
                          <th className="text-left py-2 pr-4">사원번호</th>
                          <th className="text-left py-2 pr-4">구분</th>
                          <th className="text-left py-2 pr-4">상태</th>
                          <th className="text-left py-2">출석</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrations.map((r) => (
                          <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 pr-4 font-semibold text-gray-900">{r.userName}</td>
                            <td className="py-3 pr-4 text-gray-600">{r.userEmail}</td>
                            <td className="py-3 pr-4 text-gray-500">{r.employeeNo || '-'}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.member_type === 'external' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {r.member_type === 'external' ? '외부' : '사내'}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {r.status === 'approved' ? '승인' : '대기'}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-center">
                              {r.attended ? '✅' : '-'}
                            </td>
                            <td className="py-3">
                              {r.status === 'pending' && (
                                <button
                                  onClick={() => handleApprove(r.id)}
                                  className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition"
                                >
                                  <Check className="w-3 h-3" /> 승인
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ───── 수강권 부여 탭 ───── */}
        {tab === 'entitlements' && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-3">수강권 부여</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">대상 사용자</label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- 사용자를 선택하세요 --</option>
                    {users.filter((u) => !u.member_type || u.member_type !== 'external').map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) {u.employee_no ? `· ${u.employee_no}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">수강권 종류</label>
                    <select
                      value={grant.kind}
                      onChange={(e) => setGrant((p) => ({ ...p, kind: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500"
                    >
                      {ENTITLEMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">부여 매수</label>
                    <input
                      type="number" min={1} max={10}
                      value={grant.amount}
                      onChange={(e) => setGrant((p) => ({ ...p, amount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-semibold focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGrantEntitlement} disabled={busy}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4" /> 수강권 부여
                </button>
              </div>
            </div>

            {selectedUser && (
              <div className="bg-white rounded-2xl shadow p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900">보유 수강권</h2>
                  <button onClick={() => loadUserEntitlements(selectedUser)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {userEntitlements.length === 0 ? (
                  <p className="text-sm text-gray-400">수강권 없음</p>
                ) : (
                  <div className="space-y-2">
                    {userEntitlements.map((e) => (
                      <div key={e.id} className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-gray-700">{e.kind}</span>
                        <span className="font-bold text-purple-600">
                          사용 {e.used} / {e.total} (잔여 {e.total - e.used})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ───── 사원 명단 탭 ───── */}
        {tab === 'staff' && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">+ 사원 추가</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newStaff.employeeNo} onChange={(e) => setNewStaff((p) => ({ ...p, employeeNo: e.target.value }))}
                  placeholder="사원번호 (예: EMP-2024-001)"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-semibold placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
                />
                <input
                  value={newStaff.name} onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))}
                  placeholder="이름"
                  className="px-4 py-3 border border-gray-300 rounded-lg text-gray-900 font-semibold placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleAddStaff} disabled={busy}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" /> 사원 등록
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">사원 명단 ({staff.length}명)</h2>
                <button onClick={loadStaff} className="p-2 hover:bg-gray-100 rounded-lg">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {staff.length === 0 ? (
                <p className="text-center text-gray-400 py-8">등록된 사원이 없습니다</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-left py-2 pr-4">사원번호</th>
                        <th className="text-left py-2 pr-4">이름</th>
                        <th className="text-left py-2 pr-4">가입 여부</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-mono font-semibold text-gray-900">{s.employee_no}</td>
                          <td className="py-3 pr-4 text-gray-700">{s.name}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.used ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {s.used ? '가입됨' : '미가입'}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleDeleteStaff(s.id, s.used)}
                              className="p-1.5 hover:bg-red-100 text-red-400 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
