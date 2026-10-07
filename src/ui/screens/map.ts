/** 关卡地图：3 章节 × 3 关，星星进度，解锁状态 */
import { audio } from '../../audio'
import { CHAPTERS, LEVELS, loadProgress } from '../../levels'

export function mountMap(root: HTMLElement): () => void {
  const progress = loadProgress()
  root.innerHTML = `
    <div class="screen map">
      <div class="map-head">
        <a class="hud-btn" href="#/">← 主页</a>
        <div class="map-title">🗺️ 闯关冒险</div>
        <div class="map-stars">⭐ ${Object.values(progress.stars).reduce((a, b) => a + b, 0)}/${LEVELS.length * 3}</div>
      </div>
      <div class="map-scroll">
        ${CHAPTERS.map((ch, ci) => `
          <section class="chapter">
            <div class="chapter-head">
              <span class="chapter-emoji">${ch.emoji}</span>
              <div>
                <div class="chapter-name">第 ${ci + 1} 章 · ${ch.name}</div>
                <div class="chapter-desc">${ch.desc}</div>
              </div>
            </div>
            <div class="level-row">
              ${LEVELS.filter((l) => l.chapter === ci).map((l, li) => {
                const unlocked = progress.unlocked.includes(l.id)
                const stars = progress.stars[l.id] ?? 0
                return `
                <button class="level-node${unlocked ? '' : ' locked'}" data-l="${l.id}">
                  <span class="level-emoji">${unlocked ? l.emoji : '🔒'}</span>
                  <span class="level-name">${l.name}</span>
                  <span class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}</span>
                  <span class="level-num">${ci + 1}-${li + 1}</span>
                </button>`
              }).join('')}
            </div>
          </section>`).join('')}
      </div>
    </div>`

  root.addEventListener('click', (e) => {
    const node = (e.target as HTMLElement).closest('.level-node') as HTMLElement | null
    if (!node) return
    if (node.classList.contains('locked')) {
      audio.miss()
      node.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
        { duration: 300 },
      )
      return
    }
    audio.click()
    location.hash = `#/play?l=${node.dataset.l}`
  })
  const unlock = () => audio.unlock()
  root.addEventListener('pointerdown', unlock, { once: true })

  return () => {
    root.removeEventListener('pointerdown', unlock)
  }
}
