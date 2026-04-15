import type { ElementType } from 'react'
import { motion } from 'motion/react'

interface TextGenerateEffectProps {
  text: string
  duration?: number
  staggerDelay?: number
  delay?: number
  className?: string
  as?: ElementType
  play?: boolean
}

export function calcTextGenerateDuration(
  text: string,
  staggerDelay = 0.2,
  duration = 0.5,
  delay = 0,
): number {
  const wordCount = text.trim().split(/\s+/).length
  return delay + wordCount * staggerDelay + duration
}

export function TextGenerateEffect({
  text,
  duration = 0.5,
  staggerDelay = 0.2,
  delay = 0,
  className = '',
  as: Component = 'h1',
  play = true,
}: TextGenerateEffectProps) {
  const words = text.trim().split(/\s+/)

  return (
    <Component className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, filter: 'blur(8px)' }}
          animate={
            play
              ? { opacity: 1, filter: 'blur(0px)' }
              : { opacity: 0, filter: 'blur(8px)' }
          }
          transition={{
            duration,
            ease: 'easeOut',
            delay: delay + i * staggerDelay,
          }}
        >
          {word}
        </motion.span>
      ))}
    </Component>
  )
}
