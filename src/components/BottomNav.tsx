export type ViewName = 'home' | 'analysis' | 'history' | 'more'

interface Props {
  active: ViewName
  onChange: (view: ViewName) => void
  onAdd: () => void
}

export default function BottomNav({ active, onChange, onAdd }: Props) {
  return (
    <nav className="nav">
      <button
        className={active === 'home' ? 'active' : ''}
        onClick={() => onChange('home')}
      >
        <span>⌂</span>Home
      </button>
      <button
        className={active === 'analysis' ? 'active' : ''}
        onClick={() => onChange('analysis')}
      >
        <span>◔</span>Analysis
      </button>
      <button className="plus" onClick={onAdd}>
        <span>＋</span>
      </button>
      <button
        className={active === 'history' ? 'active' : ''}
        onClick={() => onChange('history')}
      >
        <span>☷</span>History
      </button>
      <button
        className={active === 'more' ? 'active' : ''}
        onClick={() => onChange('more')}
      >
        <span>☰</span>More
      </button>
    </nav>
  )
}