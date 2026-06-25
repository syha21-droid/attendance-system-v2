import { useEffect, useLayoutEffect } from 'react'

/**
 * 서버에서는 useEffect, 브라우저에서는 useLayoutEffect를 쓴다.
 * useLayoutEffect는 화면이 그려지기(paint) 전에 실행되므로,
 * localStorage에서 데이터를 읽어 화면을 채우는 작업을 깜빡임 없이 처리한다.
 * (서버 렌더는 '로딩 중' 그대로라 하이드레이션 불일치(#418)가 없음)
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect
