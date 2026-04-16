import {
  createContext,
  useContext,
  useId,
  useState,
  cloneElement,
  type ReactElement,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface MotionHighlightContextValue {
  activeId: string | null
  setActiveId: (id: string | null) => void
  highlightClassName: string
}

const MotionHighlightContext = createContext<MotionHighlightContextValue>({
  activeId: null,
  setActiveId: () => {},
  highlightClassName: '',
})

interface MotionHighlightProps {
  children: React.ReactNode
  hover?: boolean
  mode?: 'children'
  className?: string
}

export function MotionHighlight({
  children,
  className = '',
}: MotionHighlightProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  return (
    <MotionHighlightContext.Provider
      value={{ activeId, setActiveId, highlightClassName: className }}
    >
      {children}
    </MotionHighlightContext.Provider>
  )
}

interface MotionHighlightItemProps {
  children: ReactElement
  asChild?: boolean
}

export function MotionHighlightItem({
  children,
  asChild,
}: MotionHighlightItemProps) {
  const { activeId, setActiveId, highlightClassName } = useContext(
    MotionHighlightContext,
  )
  const id = useId()
  const isActive = activeId === id

  const handlers = {
    onMouseEnter: () => setActiveId(id),
    onMouseLeave: () => setActiveId(null),
  }

  if (asChild) {
    return (
      <span className="relative inline-flex" {...handlers}>
        <AnimatePresence>
          {isActive && (
            <motion.span
              key="highlight"
              layoutId="nav-highlight"
              className={`absolute inset-0 ${highlightClassName}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
            />
          )}
        </AnimatePresence>
        {cloneElement(children, {
          style: {
            position: 'relative',
            zIndex: 1,
            ...(children.props?.style ?? {}),
          },
        } as React.HTMLAttributes<HTMLElement>)}
      </span>
    )
  }

  return (
    <span className="relative inline-flex" {...handlers}>
      <AnimatePresence>
        {isActive && (
          <motion.span
            key="highlight"
            layoutId="nav-highlight"
            className={`absolute inset-0 ${highlightClassName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
          />
        )}
      </AnimatePresence>
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </span>
  )
}
