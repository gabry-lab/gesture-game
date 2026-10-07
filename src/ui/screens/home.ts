/** 主页：模式选择（卡通大按钮） */
import { audio } from '../../audio'
import { ACTION_LIST } from '../../pose'

const HOLD_ACTIONS = ACTION_LIST.filter((a) => a.kind === 'hold')
const BEAT_ACTIONS = ACTION_LIST.filter((a) => a.kind === 'beat')

export function mountHome(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="screen home">
      <div class="home-hero">
        <div class="home-logo">🤖</div>
        <h1>动动健身</h1>
        <p>和机器人动动一起，动起来！</p>
      </div>
      <div class="home-modes">
        <button class="mode-card" data-go="#/map">
          <span class="mode-emoji">🗺️</span>
          <span class="mode-name">闯关冒险</span>
          <span class="mode-desc">9 个关卡等你挑战</span>
        </button>
        <button class="mode-card" id="modeHold">
          <span class="mode-emoji">🙌</span>
          <span class="mode-name">模仿动作</span>
          <span class="mode-desc">跟着动动做动作</span>
        </button>
        <button class="mode-card" id="modeBeat">
          <span class="mode-emoji">🎵</span>
          <span class="mode-name">节奏运动</span>
          <span class="mode-desc">踩着节拍动起来</span>
        </button>
      </div>
      <div class="home-foot">
        <a class="mini-link" href="#/camtest">相机自测</a>
        <span class="mini-dot">·</span>
        <a class="mini-link" href="#/coach">教练自测</a>
      </div>
      <div class="sheet" id="sheet" hidden>
        <div class="sheet-title" id="sheetTitle"></div>
        <div class="sheet-grid" id="sheetGrid"></div>
        <button class="btn sheet-close" id="sheetClose">关闭</button>
      </div>
    </div>`

  const sheet = root.querySelector('#sheet') as HTMLElement
  const sheetTitle = root.querySelector('#sheetTitle') as HTMLElement
  const sheetGrid = root.querySelector('#sheetGrid') as HTMLElement

  // 直接跳转卡片（如「闯关冒险」）
  const goCard = root.querySelector('.mode-card[data-go]') as HTMLButtonElement | null
  if (goCard) {
    goCard.addEventListener('click', () => {
      audio.click()
      location.hash = goCard.dataset.go!
    })
  }

  function openSheet(title: string, actions: typeof HOLD_ACTIONS) {
    audio.click()
    sheetTitle.textContent = title
    sheetGrid.innerHTML = actions
      .map((a) => `<button class="act-chip" data-a="${a.id}">${a.emoji} ${a.name}</button>`)
      .join('')
    sheet.hidden = false
    sheet.classList.add('show')
  }
  function closeSheet() {
    sheet.classList.remove('show')
    setTimeout(() => { sheet.hidden = true }, 200)
  }

  root.querySelector('#modeHold')!.addEventListener('click', () => openSheet('选一个动作，跟动动模仿：', HOLD_ACTIONS))
  root.querySelector('#modeBeat')!.addEventListener('click', () => openSheet('选一个动作，跟着节奏做：', BEAT_ACTIONS))
  sheetGrid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null
    if (!btn) return
    const id = btn.dataset.a!
    const kind = HOLD_ACTIONS.some((a) => a.id === id) ? 'hold' : 'beat'
    audio.click()
    location.hash = `#/play?a=${id}&m=${kind}`
  })
  root.querySelector('#sheetClose')!.addEventListener('click', closeSheet)

  // 首次交互解锁音频
  const unlock = () => audio.unlock()
  root.addEventListener('pointerdown', unlock, { once: true })

  return () => {
    root.removeEventListener('pointerdown', unlock)
  }
}
