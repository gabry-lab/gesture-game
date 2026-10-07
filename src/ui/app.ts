/**
 * 应用入口：简易 hash 路由
 * #/          主页（模式选择）
 * #/map       关卡地图
 * #/play?...  游戏画面（闯关 / 练习）
 * #/camtest   相机管线自测屏
 * #/coach     卡通教练自测屏
 */
import { mountCameraTest } from '../camera/camera-test'
import { mountCoachTest } from '../coach/coach-test'
import { mountHome } from './screens/home'
import { mountMap } from './screens/map'
import { mountGame } from './screens/game'
import { parsePlayParams } from './play-params'

type MountFn = (root: HTMLElement) => () => void

function mountPlay(root: HTMLElement): () => void {
  const params = parsePlayParams(location.hash)
  if (!params) {
    location.hash = '#/'
    return mountHome(root)
  }
  return mountGame(root, params)
}

const routes: Record<string, MountFn> = {
  '/': mountHome,
  '/map': mountMap,
  '/play': mountPlay,
  '/camtest': mountCameraTest,
  '/coach': mountCoachTest,
}

export function createApp(root: HTMLElement) {
  let cleanup: (() => void) | null = null

  const navigate = () => {
    // #/play 的查询参数不会触发 hashchange 重复，路径匹配用 base
    const raw = location.hash.replace(/^#/, '') || '/'
    const base = raw.split('?')[0]
    const mount = routes[base] ?? mountHome
    cleanup?.()
    cleanup = mount(root)
  }

  window.addEventListener('hashchange', navigate)
  navigate()

  return () => {
    window.removeEventListener('hashchange', navigate)
    cleanup?.()
  }
}
